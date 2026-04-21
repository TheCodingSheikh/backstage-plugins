# @thecodingsheikh/backstage-plugin-catalog-backend-module-kubernetes

Catalog backend module that ingests Kubernetes workloads and CRDs as Backstage
entities. A slim, catalog-provider-focused rewrite of
[`@terasky/backstage-plugin-kubernetes-ingestor`][terasky] — no Crossplane,
no KRO, no scaffolder templates.

[terasky]: https://github.com/TeraSky-OSS/backstage-plugins/tree/main/plugins/kubernetes-ingestor
[mo]: https://www.npmjs.com/package/@thecodingsheikh/backstage-plugin-catalog-backend-module-multi-owner-processor

## Install

```bash
yarn --cwd packages/backend add @thecodingsheikh/backstage-plugin-catalog-backend-module-kubernetes
```

## What it emits

Per ingested workload:
- **1 Component** (or Resource) — the workload itself.
- **1 System** — one per namespace/cluster, shared across workloads in it. Opt out with `createSystemFromNamespace: false`.
- **1 API** *(optional)* — if the workload has a `<prefix>/provides-api-*` annotation.

Per selected CRD (optional): **1 API entity** per version.

Each sync is a `type: 'full'` mutation, so deleting a K8s resource removes
its entity on the next tick automatically.

## Setup

1. Configure clusters in the core kubernetes plugin (`kubernetes.clusterLocatorMethods`).
2. Wire the module:
   ```ts
   // packages/backend/src/index.ts
   backend.add(import('@thecodingsheikh/backstage-plugin-catalog-backend-module-kubernetes'));
   ```
3. Add at least one provider under `catalog.providers.kubernetes.<id>`.

## Full config reference

```yaml
catalog:
  providers:
    kubernetes:
      # Arbitrary id; becomes part of the provider's log name and locationKey.
      main:
        # Annotation prefix read from K8s resources.
        annotationPrefix: k8s.backstage.io              # default: k8s.backstage.io

        # Fallback owner when neither the workload nor the namespace supplies one.
        defaultOwner: kubernetes-auto-ingested          # default: kubernetes-auto-ingested

        # If a workload has no <prefix>/owner, look up the same annotation on
        # its Namespace object. Each unique namespace is fetched once per run.
        inheritOwnerFromNamespace: false                # default: false

        # Limit which clusters this provider ingests from. Names must match
        # those registered in kubernetes.clusterLocatorMethods.
        # Omit to use every discovered cluster.
        allowedClusterNames: [prod-east, prod-west]

        # Ceiling on in-flight HTTP calls to the kubernetes proxy, per sync
        # phase (list + translate). Lower if your backend struggles with big
        # clusters, raise to speed up huge fleets.
        maxConcurrency: 20                              # default: 20

        # Copies argocd.argoproj.io/tracking-id → argocd/app-name so the
        # ArgoCD card on the entity page works.
        argoIntegration: false                          # default: false

        # Auto-create a System per namespace/cluster. False = no System is
        # emitted and spec.system is only set when <prefix>/system is present.
        createSystemFromNamespace: true                 # default: true

        # Rewrites cluster names stamped on entities. Only needed if you
        # register the same physical cluster twice (e.g. sa-prod + oidc-prod).
        clusterNameMapping:
          mode: prefix-replacement                      # or 'explicit'
          sourcePrefix: sa-                             # prefix-replacement only
          targetPrefix: oidc-
          mappings:                                     # explicit only
            sa-prod-01: oidc-prod-01

        # How entity names are derived. Change these when workloads with the
        # same name exist in multiple clusters or namespaces.
        mappings:
          namespaceModel: default          # default | cluster | namespace
          nameModel: name                  # name | name-kind | name-cluster | name-namespace | uid
          titleModel: name                 # name | name-cluster | name-namespace
          systemModel: namespace           # namespace | cluster | cluster-namespace
          referencesNamespaceModel: default # default | same

        components:
          enabled: true                                 # default: true
          # Emit as Resource entities instead of Components.
          ingestAsResources: false                      # default: false
          # When true, only ingest workloads carrying <prefix>/add-to-catalog.
          onlyIngestAnnotatedResources: false           # default: false
          excludedNamespaces: [kube-system, kube-public]
          # Turn off the built-in Deployment/StatefulSet/DaemonSet/CronJob list.
          disableDefaultWorkloadTypes: false            # default: false
          # Extra GVKs to ingest as Components. Independent of
          # kubernetes.customResources (that one is for the frontend K8s tab).
          customWorkloadTypes:
            - group: argoproj.io
              apiVersion: v1alpha1
              plural: rollouts
              defaultType: service                      # fallback for spec.type
              ingestAsResources: false                  # per-type override

        # Optional: emit one API entity per CRD version.
        crds:
          enabled: false                                # default: false
          # true → spec.type: crd with raw CRD YAML (needs a CRD-aware UI).
          # false → spec.type: openapi with a generated spec (renders in the
          # default API card but paths are approximate).
          ingestAPIsAsCRDs: true                        # default: true
          # spec.system assigned to every CRD-derived API entity.
          system: crds                                  # default: crds
          # Explicit allowlist by CRD metadata.name; takes precedence over selector.
          crds: [widgets.example.io]
          # Or filter by label (ignored when `crds` is set).
          crdLabelSelector:
            key: example.io/catalog
            value: "true"

        # Standard Backstage scheduler config.
        schedule:
          frequency: { minutes: 10 }
          timeout: { minutes: 5 }
```

## Workload annotations

All keys use the configured `annotationPrefix`.

| Annotation | Effect |
|---|---|
| `<prefix>/add-to-catalog` | Required to ingest when `onlyIngestAnnotatedResources` is true. |
| `<prefix>/exclude-from-catalog` | Always skip this workload. |
| `<prefix>/name`, `/title`, `/description` | Override generated values. |
| `<prefix>/owner` | Sets `spec.owner` (full entity ref or bare name). |
| `<prefix>/owners` | Sets `spec.owners` for the [multi-owner processor][mo]. Compact syntax: comma/newline-separated, each entry `kind:name[:role]` or `kind:namespace/name[:role]`. A trailing `:role` is optional. JSON array form also accepted for explicit `{ name, role }`. Inherited from the Namespace when `inheritOwnerFromNamespace` is on. |
| `<prefix>/system` | Sets `spec.system`. |
| `<prefix>/system-type`, `/domain` | Applied to the generated System entity. |
| `<prefix>/component-type`, `/lifecycle` | Override `spec.type` and `spec.lifecycle`. |
| `<prefix>/backstage-namespace` | Override the Backstage namespace for both Component and System. |
| `<prefix>/backstage-tags` | Extra tags as `k1:v1,k2:v2`. |
| `<prefix>/component-annotations` | Extra annotations as `k1=v1,k2=v2`. |
| `<prefix>/links` | JSON array of Backstage links. |
| `<prefix>/dependsOn`, `/providesApis`, `/consumesApis`, `/subcomponent-of` | Entity-ref relationships. |
| `<prefix>/kubernetes-label-selector` | Override the auto-derived label selector. |
| `<prefix>/source-code-repo-url`, `/source-branch`, `/techdocs-path` | Wire up `backstage.io/source-location` + `backstage.io/techdocs-ref`. |
| `<prefix>/provides-api-from-url` | Fetch OpenAPI/YAML from this URL, emit a linked API entity. |
| `<prefix>/provides-api-from-def` | URL stored via Backstage's `$text` reference (no fetch). |
| `<prefix>/provides-api-from-resource-ref` | JSON pointing at a K8s resource whose status field yields the URL to fetch. |
| `argocd.argoproj.io/tracking-id` | Source for `argocd/app-name` when `argoIntegration` is on. |

## Differences from `kubernetes-ingestor`

| Feature | `kubernetes-ingestor` | This module |
|---|---|---|
| Config root | `kubernetesIngestor.*` | `catalog.providers.kubernetes.<id>.*` |
| Multiple instances | no | yes |
| Crossplane claims/XRs, XRD/CRD templates | yes | removed |
| KRO instances, RGD templates | yes | removed |
| Scaffolder template generation | yes | removed |
| Signals-based delta updates | yes | removed (full sync handles deletion) |
| Concurrency cap | no | `maxConcurrency`, default 20 |
| Standard + custom workload ingestion | yes | kept |
| CRD → API entity | yes | kept |
| ArgoCD integration | yes | kept |
| Cluster-name mapping, owner inheritance, naming models | yes | kept |
