import crypto from 'node:crypto';
import { coreServices, createBackendModule } from '@backstage/backend-plugin-api';
import { catalogServiceRef } from '@backstage/plugin-catalog-node';
import { createTemplateAction } from '@backstage/plugin-scaffolder-node';
import { scaffolderActionsExtensionPoint } from '@backstage/plugin-scaffolder-node/alpha';
import YAML from 'yaml';

type Role = 'view' | 'edit' | 'admin';
const rank: Record<Role, number> = { view: 1, edit: 2, admin: 3 };
const safeName = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/;
const platformAdmins = 'group:default/platform-admins';

function ownerGrants(entity: any): Array<{ subject: string; role: Role }> {
  const raw = Array.isArray(entity.spec?.owners) ? entity.spec.owners : [];
  const structured = raw.flatMap((owner: any) => {
    const subject = owner?.subject ?? owner?.name;
    return typeof subject === 'string' && subject.startsWith('group:default/') && rank[owner?.role as Role]
      ? [{ subject, role: owner.role as Role }]
      : [];
  });
  if (structured.length) return structured;
  return String(entity.metadata?.annotations?.['ncai.backstage.io/owners'] ?? '')
    .split(',')
    .flatMap((entry: string) => {
      const match = entry.trim().match(/^(group:default\/[a-z0-9](?:[-a-z0-9]*[a-z0-9])?):(admin|edit|view)$/);
      return match ? [{ subject: match[1], role: match[2] as Role }] : [];
    });
}

function effectiveRole(entity: any, refs: string[]): Role | undefined {
  if (refs.includes(platformAdmins)) return 'admin';
  return ownerGrants(entity).reduce<Role | undefined>((best, grant) =>
    refs.includes(grant.subject) && (!best || rank[grant.role] > rank[best]) ? grant.role : best, undefined);
}

function signer(secret: string) {
  return {
    issue(payload: object) {
      const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
      const signature = crypto.createHmac('sha256', secret).update(encoded).digest('base64url');
      return `${encoded}.${signature}`;
    },
    verify(token: string) {
      const [encoded, supplied] = token.split('.');
      if (!encoded || !supplied) throw new Error('Invalid mutation authorization');
      const expected = crypto.createHmac('sha256', secret).update(encoded).digest('base64url');
      if (!crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) throw new Error('Invalid mutation authorization');
      const payload = JSON.parse(Buffer.from(encoded.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString()) as { expires: number; path: string; user: string; operation: string };
      if (payload.expires < Date.now()) throw new Error('Mutation authorization expired');
      return payload;
    },
  };
}

export const applicationControlPlaneScaffolderModule = createBackendModule({
  pluginId: 'scaffolder',
  moduleId: 'application-control-plane',
  register(reg) {
    reg.registerInit({
      deps: { actions: scaffolderActionsExtensionPoint, auth: coreServices.auth, catalog: catalogServiceRef, config: coreServices.rootConfig },
      async init({ actions, auth, catalog, config }) {
        const secret = config.getString('applicationControlPlane.authorizationSecret');
        const grants = signer(secret);
        const gitlabBase = config.getString('applicationControlPlane.gitlab.apiBaseUrl');
        const gitlabProject = config.getString('applicationControlPlane.gitlab.projectId');
        const gitlabToken = config.getString('applicationControlPlane.gitlab.token');

        actions.addActions(createTemplateAction({
          id: 'ncai:application:authorize',
          description: 'Resolve application and enforce effective group role.',
          schema: { input: {
            applicationRef: z => z.string().optional(), tenant: z => z.string().optional(), requiredRole: z => z.enum(['view', 'edit', 'admin', 'platform-admin']),
            operation: z => z.string(), confirmation: z => z.string().optional(),
            owners: z => z.array(z.object({ subject: z.string(), role: z.enum(['admin', 'edit', 'view']) })).optional(),
            resource: z => z.object({ service: z.enum(['webapp', 'postgres', 'full-stack']), name: z.string(), manifest: z.string().optional() }).optional(),
          } },
          async handler(ctx) {
            const userRef = ctx.user?.ref;
            const ownershipRefs = ctx.user?.entity?.metadata ? [userRef, ...(ctx.user.entity.relations ?? []).filter((r: any) => r.type === 'memberOf').map((r: any) => r.targetRef)] : [userRef];
            if (!userRef) throw new Error('Authenticated user identity required');
            if (ctx.input.owners) {
              if (!ctx.input.owners.some(owner => owner.role === 'admin')) throw new Error('At least one application admin group is required');
              if (ctx.input.owners.some(owner => !/^group:default\/[a-z0-9](?:[-a-z0-9]*[a-z0-9])?$/.test(owner.subject))) throw new Error('Application owners must be Backstage groups');
            }
            if (ctx.input.requiredRole === 'platform-admin') {
              if (!ownershipRefs.includes(platformAdmins)) throw new Error('Platform administrator role required');
              if (!ctx.input.tenant || !safeName.test(ctx.input.tenant)) throw new Error('Invalid tenant');
              ctx.output('tenant', ctx.input.tenant);
              return;
            }
            if (!ctx.input.applicationRef || !/^system:default\/[a-z0-9-]+$/.test(ctx.input.applicationRef)) throw new Error('Invalid application reference');
            const entity = await catalog.getEntityByRef(ctx.input.applicationRef, { credentials: await auth.getOwnServiceCredentials() });
            if (!entity || entity.kind.toLowerCase() !== 'system' || entity.spec?.type !== 'application') throw new Error('Application not found');
            const required = ctx.input.requiredRole as Role;
            const actual = effectiveRole(entity, ownershipRefs.filter(Boolean) as string[]);
            if (!actual || rank[actual] < rank[required]) throw new Error(`Application ${required} role required`);
            const annotations = entity.metadata.annotations ?? {};
            const tenant = annotations['ncai.backstage.io/tenant'];
            const application = annotations['ncai.backstage.io/title'] ?? entity.metadata.title ?? entity.metadata.name;
            if (!tenant || !safeName.test(tenant) || !safeName.test(application)) throw new Error('Application metadata invalid');
            const app = { tenant, name: application, namespace: `${tenant}-tenant-${application}`, description: entity.metadata.description ?? annotations['ncai.backstage.io/description'] ?? '' };
            ctx.output('tenant', tenant); ctx.output('application', app);
            if (ctx.input.resource) {
              const { service, name, manifest } = ctx.input.resource;
              if (!safeName.test(name)) throw new Error('Invalid resource name');
              const path = `${tenant}/applications/${application}/${service}/${name}/manifest.yaml`;
              if (ctx.input.operation === 'delete-resource' && ctx.input.confirmation !== 'DELETE') throw new Error('Deletion confirmation must equal DELETE');
              if (manifest) {
                const parsed = YAML.parse(manifest);
                if (parsed?.spec?.tenant !== tenant || parsed?.spec?.application !== application || parsed?.spec?.name !== name || parsed?.metadata?.namespace !== app.namespace) {
                  throw new Error('Immutable tenant, application, name, or namespace changed');
                }
              }
              ctx.output('releasePath', path);
              ctx.output('authorizationToken', grants.issue({ user: userRef, path, operation: ctx.input.operation, expires: Date.now() + 5 * 60_000 }));
            }
          },
        }));

        actions.addActions(createTemplateAction({
          id: 'ncai:gitlab:merge-request',
          description: 'Create signed single-file GitLab merge request.',
          schema: { input: {
            operation: z => z.enum(['update', 'delete']), path: z => z.string(), content: z => z.string().optional(), title: z => z.string(), authorizationToken: z => z.string(),
          } },
          async handler(ctx) {
            const grant = grants.verify(ctx.input.authorizationToken);
            if (grant.path !== ctx.input.path || !ctx.user?.ref || grant.user !== ctx.user.ref) throw new Error('Mutation authorization scope mismatch');
            if (!/^[a-z0-9-]+\/applications\/[a-z0-9-]+\/(webapp|postgres|full-stack)\/[a-z0-9-]+\/manifest\.yaml$/.test(ctx.input.path) || ctx.input.path.includes('..')) throw new Error('Unsafe release path');
            const branch = `backstage-${ctx.input.operation}-${crypto.randomUUID().slice(0, 8)}`;
            const headers = { 'PRIVATE-TOKEN': gitlabToken, 'Content-Type': 'application/json' };
            const api = `${gitlabBase}/projects/${encodeURIComponent(gitlabProject)}`;
            let response = await fetch(`${api}/repository/branches`, { method: 'POST', headers, body: JSON.stringify({ branch, ref: 'main' }) });
            if (!response.ok) throw new Error(`GitLab branch creation failed: ${response.status}`);
            const action = ctx.input.operation === 'delete' ? 'delete' : 'update';
            response = await fetch(`${api}/repository/commits`, { method: 'POST', headers, body: JSON.stringify({ branch, commit_message: ctx.input.title, actions: [{ action, file_path: ctx.input.path, content: ctx.input.content }] }) });
            if (!response.ok) throw new Error(`GitLab commit failed: ${response.status}`);
            response = await fetch(`${api}/merge_requests`, { method: 'POST', headers, body: JSON.stringify({ source_branch: branch, target_branch: 'main', title: ctx.input.title, remove_source_branch: true }) });
            if (!response.ok) throw new Error(`GitLab merge request failed: ${response.status}`);
            const mr = await response.json() as { web_url: string };
            ctx.output('mergeRequestUrl', mr.web_url);
          },
        }));
      },
    });
  },
});

export default applicationControlPlaneScaffolderModule;
