import { Router } from 'express';
import PromiseRouter from 'express-promise-router';
import type { AuthService, HttpAuthService, UserInfoService, LoggerService, RootConfigService } from '@backstage/backend-plugin-api';
import type { CatalogService } from '@backstage/plugin-catalog-node';
import { applicationData, effectiveRole, hasRole, isApplication, type ApplicationRole } from './ownership';

type Options = {
  auth: AuthService;
  httpAuth: HttpAuthService;
  userInfo: UserInfoService;
  catalog: CatalogService;
  logger: LoggerService;
  config: RootConfigService;
};

const roles = new Set<ApplicationRole>(['view', 'edit', 'admin']);

export async function createRouter(options: Options): Promise<Router> {
  const router = PromiseRouter();
  router.use(Router().use((_, res, next) => {
    res.setHeader('Cache-Control', 'private, no-store');
    next();
  }));

  router.get('/v1/applications', async (req, res) => {
    const credentials = await options.httpAuth.credentials(req, { allow: ['user'] });
    const { ownershipEntityRefs } = await options.userInfo.getUserInfo(credentials);
    const required = String(req.query.minimumRole ?? 'view') as ApplicationRole;
    if (!roles.has(required)) return res.status(400).json({ error: 'minimumRole must be view, edit, or admin' });
    const serviceCredentials = await options.auth.getOwnServiceCredentials();
    const response = await options.catalog.getEntities({}, { credentials: serviceCredentials });
    const visible = response.items
      .filter(isApplication)
      .flatMap(entity => {
        const role = effectiveRole(entity, ownershipEntityRefs);
        if (!hasRole(role, required)) return [];
        try {
          const data = applicationData(entity);
          return [{ ...data, effectiveRole: role }];
        }
        catch (error) {
          options.logger.warn(String(error));
          return [];
        }
      });
    const [argo, activity] = await Promise.all([
      readArgoApplications(options).catch(error => {
        options.logger.warn(`Argo aggregation unavailable: ${error}`);
        return new Map<string, ArgoSummary>();
      }),
      readGitLabActivity(options, visible).catch(error => {
        options.logger.warn(`GitLab activity unavailable: ${error}`);
        return [];
      }),
    ]);
    const items = visible
      .map(data => ({ ...data, health: argo.get(`${data.tenant}/${data.name}`)?.health ?? 'Unknown', sync: argo.get(`${data.tenant}/${data.name}`)?.sync ?? 'Unknown' }))
      .sort((a, b) => a.title.localeCompare(b.title));
    return res.json({ items, activity, isPlatformAdmin: ownershipEntityRefs.includes('group:default/platform-admins') });
  });

  router.get('/v1/applications/:namespace/:name', async (req, res) => {
    const credentials = await options.httpAuth.credentials(req, { allow: ['user'] });
    const { ownershipEntityRefs } = await options.userInfo.getUserInfo(credentials);
    const entity = await options.catalog.getEntityByRef(
      `system:${req.params.namespace}/${req.params.name}`,
      { credentials: await options.auth.getOwnServiceCredentials() },
    );
    if (!entity || !isApplication(entity)) return res.status(404).json({ error: 'Application not found' });
    const role = effectiveRole(entity, ownershipEntityRefs);
    if (!role) return res.status(403).json({ error: 'Application access denied' });
    const data = applicationData(entity);
    const argo = await readArgoApplications(options).catch(() => new Map<string, ArgoSummary>());
    return res.json({ ...data, effectiveRole: role, health: argo.get(`${data.tenant}/${data.name}`)?.health ?? 'Unknown', sync: argo.get(`${data.tenant}/${data.name}`)?.sync ?? 'Unknown', resources: argo.get(`${data.tenant}/${data.name}`)?.resources ?? [] });
  });

  return router;
}

type ArgoSummary = { health: string; sync: string; resources: Array<{ name: string; kind: string; health: string; sync: string }> };

async function readArgoApplications(options: Options): Promise<Map<string, ArgoSummary>> {
  const baseUrl = options.config.getOptionalString('applicationControlPlane.argo.baseUrl');
  const token = options.config.getOptionalString('applicationControlPlane.argo.token');
  if (!baseUrl || !token) return new Map();
  const response = await fetch(`${baseUrl.replace(/\/$/, '')}/api/v1/applications?selector=ncai.backstage.io%2Frestricted%3Dtrue`, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const payload = await response.json() as { items?: any[] };
  const result = new Map<string, ArgoSummary>();
  for (const item of payload.items ?? []) {
    const labels = item.metadata?.labels ?? {};
    const key = `${labels['ncai.backstage.io/tenant']}/${labels['ncai.backstage.io/application']}`;
    if (!key.includes('undefined')) {
      const current = result.get(key) ?? { health: 'Healthy', sync: 'Synced', resources: [] };
      const health = item.status?.health?.status ?? 'Unknown';
      const sync = item.status?.sync?.status ?? 'Unknown';
      current.health = current.health === 'Healthy' ? health : current.health;
      current.sync = current.sync === 'Synced' ? sync : current.sync;
      current.resources.push({ name: item.metadata?.name ?? 'unknown', kind: labels['ncai.backstage.io/service'] ?? 'Resource', health, sync });
      result.set(key, current);
    }
  }
  return result;
}

async function readGitLabActivity(options: Options, applications: Array<{ tenant: string; name: string }>) {
  const baseUrl = options.config.getOptionalString('applicationControlPlane.gitlab.apiBaseUrl');
  const projectId = options.config.getOptionalString('applicationControlPlane.gitlab.projectId');
  const token = options.config.getOptionalString('applicationControlPlane.gitlab.token');
  if (!baseUrl || !projectId || !token || applications.length === 0) return [];
  const api = `${baseUrl.replace(/\/$/, '')}/projects/${encodeURIComponent(projectId)}`;
  const headers = { 'PRIVATE-TOKEN': token };
  const response = await fetch(`${api}/merge_requests?state=merged&target_branch=main&order_by=updated_at&sort=desc&per_page=20`, { headers });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const mergeRequests = await response.json() as Array<{ iid: number; title: string; merged_at?: string; web_url: string; author?: { name?: string } }>;
  const prefixes = applications.map(app => `${app.tenant}/applications/${app.name}/`);
  const projected = await Promise.all(mergeRequests.map(async mr => {
    const detailResponse = await fetch(`${api}/merge_requests/${mr.iid}/changes`, { headers });
    if (!detailResponse.ok) return undefined;
    const detail = await detailResponse.json() as { changes?: Array<{ old_path: string; new_path: string }> };
    const visible = (detail.changes ?? []).some(change => prefixes.some(prefix => change.old_path.startsWith(prefix) || change.new_path.startsWith(prefix)));
    return visible ? { type: 'merge-request', title: mr.title, time: mr.merged_at, actor: mr.author?.name ?? 'unknown', url: mr.web_url } : undefined;
  }));
  return projected.filter(Boolean).slice(0, 10);
}
