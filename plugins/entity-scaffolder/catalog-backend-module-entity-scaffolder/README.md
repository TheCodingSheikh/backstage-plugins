# Entity Scaffolder catalog backend module

Registers the `entity-scaffolder-entity` permission resource type on the catalog plugin, so that a permission policy can be scoped to the `entity-scaffolder.edit` permission of [`@thecodingsheikh/backstage-plugin-entity-scaffolder`](../entity-scaffolder/README.md).

## Why this module exists

`entity-scaffolder.edit` is declared by a frontend plugin. A frontend plugin serves no `/.well-known/backstage/permissions/metadata` endpoint, so as far as the permission system is concerned the permission does not exist on any backend — and a stored conditional policy has nothing to bind to.

Policy providers that persist conditional policies (notably the Red Hat Developer Hub RBAC plugin) make this worse: they do not let you name a permission at all. A policy declares a `(pluginId, resourceType, action)` triple, the provider resolves that to the **first** permission in the plugin's metadata matching `(resourceType, action)`, and stores the resolved _name_. At authorize time the stored name must match the incoming permission exactly.

That is why the permission has its own resource type rather than the catalog's `catalog-entity`: under `catalog-entity` + `update` the first match is always `catalog.entity.refresh`, so the condition would bind to the wrong permission and `entity-scaffolder.edit` would silently fall through to whatever the non-conditional rules say.

This module closes both gaps by registering, on the `catalog` plugin:

- the `entity-scaffolder-entity` resource type — unique per `(resourceType, action)`, so the lookup is unambiguous;
- the `entity-scaffolder.edit` permission, which makes it appear in the catalog's permission metadata;
- the permission rules usable in a policy's `conditions` block;
- a `getResources` implementation that loads the catalog entities those conditions are evaluated against.

Owning the type from the `catalog` plugin (rather than a new `entity-scaffolder` backend) keeps `pluginId: catalog` in policies and means nothing new has to be added to RHDH's `permission.rbac.pluginsWithPermission`.

## Installation

```bash
yarn --cwd packages/backend add @thecodingsheikh/backstage-plugin-catalog-backend-module-entity-scaffolder
```

```ts
// packages/backend/src/index.ts
backend.add(
  import(
    '@thecodingsheikh/backstage-plugin-catalog-backend-module-entity-scaffolder'
  ),
);
```

## Rules

All rules are registered against `entity-scaffolder-entity`. The catalog's own rule implementations are re-used verbatim — only the resource type discriminator changes — so their behaviour is identical to the `catalog-entity` versions.

| Rule                                         | Params                 | Source                              |
| -------------------------------------------- | ---------------------- | ----------------------------------- |
| `HAS_ANNOTATION`                             | `annotation`, `value?` | `@backstage/plugin-catalog-backend` |
| `HAS_LABEL`                                  | `label`, `value?`      | `@backstage/plugin-catalog-backend` |
| `HAS_METADATA`                               | `key`, `value?`        | `@backstage/plugin-catalog-backend` |
| `HAS_SPEC`                                   | `key`, `value?`        | `@backstage/plugin-catalog-backend` |
| `IS_ENTITY_KIND`                             | `kinds`                | `@backstage/plugin-catalog-backend` |
| `IS_ENTITY_OWNER`                            | `claims`               | `@backstage/plugin-catalog-backend` |
| `IS_ENTITY_MULTI_OWNER_WITH_ROLE`            | `claims`, `roles`      | multi-owner processor               |
| `IS_ENTITY_MULTI_OWNER_WITH_ANNOTATION_ROLE` | `claims`, `annotation` | multi-owner processor               |

## Example policy

See the [RBAC section of the entity-scaffolder README](../entity-scaffolder/README.md#rbac-for-edit) for complete RHDH and upstream examples. The short version:

```yaml
conditional-policies.yaml: |
  ---
  result: CONDITIONAL
  roleEntityRef: role:default/all_users
  pluginId: catalog
  resourceType: entity-scaffolder-entity
  permissionMapping:
    - update
  conditions:
    rule: IS_ENTITY_OWNER
    resourceType: entity-scaffolder-entity
    params:
      claims: ["$ownerRefs"]
```

Note that `permissionMapping` takes an **action** (`create`/`read`/`update`/`delete`/`use`), never a permission name — RHDH rejects the whole file otherwise.
