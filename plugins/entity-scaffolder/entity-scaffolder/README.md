# backstage-plugin-entity-scaffolder

This plugin embeds a Backstage Scaffolder workflow into an entity's page, allowing to update catalog entities with the same template workflow

![screenshow](https://github.com/TheCodingSheikh/backstage-plugins/blob/main/plugins/entity-scaffolder/screenshot.png?raw=true)

## Installation

1.  Install the package in your Backstage app:

    ```bash
    yarn --cwd packages/app add @thecodingsheikh/backstage-plugin-entity-scaffolder
    ```

2.  Add the scaffolder tab to your entity page in `packages/app/src/components/catalog/EntityPage.tsx`:

    ```typescript jsx
    // In packages/app/src/components/catalog/EntityPage.tsx

    import {
      EntityScaffolderContent,
      isEntityScaffolderAvailable,
    } from '@thecodingsheikh/backstage-plugin-entity-scaffolder';


    // ...
    const websiteEntityPage = ( // Or any other EntitPage
      <EntityLayout>
        {/* ... other routes */}

        <EntityLayout.Route
          path="/entity-scaffolder"
          title="manage"
          if={isEntityScaffolderAvailable}
        >
          <EntityScaffolderContent/>
        </EntityLayout.Route>

        {/* ... other routes */}
      </EntityLayout>
    );
    ```

## RBAC for edit

This plugin integrates with the [Backstage Permission Framework](https://backstage.io/docs/permissions/overview). Who may use the embedded workflow on any given entity is decided by your permission policy — when denied, the tab stays visible but the panel renders a _Not authorized_ message instead of the workflow.

The common package `@thecodingsheikh/backstage-plugin-entity-scaffolder-common` exports:

-   **`entityScaffolderEditPermission`** — permission name `entity-scaffolder.edit`, action `update`, `resourceType: catalog-entity`.

Because the permission's resource type is `catalog-entity`, your existing catalog conditional rules (`IS_ENTITY_OWNER`, `HAS_ANNOTATION`, `IS_ENTITY_KIND`, …) apply to it directly — no custom rule code is needed.

### Installation

1.  Install the common package (it's a transitive dep of the frontend plugin, but your permission backend or policy provider may need it too):

    ```bash
    yarn --cwd packages/backend add @thecodingsheikh/backstage-plugin-entity-scaffolder-common
    ```

2.  Make sure `@backstage/plugin-permission-backend` (and a policy provider, e.g. the RHDH RBAC plugin) is installed and wired up. The frontend already calls `usePermission` against `entity-scaffolder.edit` — without a permission backend, the result defaults to **allowed**.

### RHDH policy examples

#### Deny by default, allow platform admins outright

```yaml
rbac-policy.csv: |
  p, role:default/all_users, entity-scaffolder.edit, update, deny
  p, role:default/platform_admins, entity-scaffolder.edit, update, allow

  g, group:default/user, role:default/all_users
  g, group:default/platform, role:default/platform_admins
```

#### Owners of the entity are allowed (via `IS_ENTITY_OWNER`)

```yaml
conditional-policies.yaml: |
  ---
  result: CONDITIONAL
  roleEntityRef: role:default/all_users
  pluginId: catalog
  resourceType: catalog-entity
  permissionMapping:
    - entity-scaffolder.edit
  conditions:
    rule: IS_ENTITY_OWNER
    resourceType: catalog-entity
    params:
      claims: ["$ownerRefs"]
```

`IS_ENTITY_OWNER` already works with entities using `@thecodingsheikh/backstage-plugin-multi-owner`, because the multi-owner catalog processor emits an `ownedBy` relation for every entry in `spec.owners` — regardless of the owner's `role`.

#### Role-aware owner checks (requires the multi-owner permission rule)

If you want `backstage.io/scaffolder-edit-roles: 'admin'` to mean _"only owners whose `role: admin` may edit"_, install [`@thecodingsheikh/backstage-plugin-catalog-backend-module-multi-owner-processor`](https://github.com/TheCodingSheikh/backstage-plugins/blob/main/plugins/multi-owner/catalog-backend-module-multi-owner-processor/README.md#permission-rules) — it registers the `IS_ENTITY_MULTI_OWNER_WITH_ANNOTATION_ROLE` rule used below. The resulting policy looks like:

```yaml
conditional-policies.yaml: |
  ---
  result: CONDITIONAL
  roleEntityRef: role:default/all_users
  pluginId: catalog
  resourceType: catalog-entity
  permissionMapping:
    - entity-scaffolder.edit
  conditions:
    anyOf:
      # No edit-roles annotation → fall back to plain owner check
      - allOf:
          - not:
              rule: HAS_ANNOTATION
              resourceType: catalog-entity
              params: { annotation: backstage.io/scaffolder-edit-roles }
          - rule: IS_ENTITY_OWNER
            resourceType: catalog-entity
            params: { claims: ["$ownerRefs"] }
      # Annotation present → only owners whose role matches the CSV in it
      - rule: IS_ENTITY_MULTI_OWNER_WITH_ANNOTATION_ROLE
        resourceType: catalog-entity
        params: { annotation: backstage.io/scaffolder-edit-roles }
```

With that rule in place, per-entity annotations drive the role check:

```yaml
# only owners with role: admin may edit
metadata:
  annotations:
    backstage.io/scaffolder-edit-roles: 'admin'
spec:
  owners:
    - { name: group:default/team, role: edit }       # denied
    - { name: group:default/platform, role: admin }  # allowed
```

### Redhat Developer Hub (RHDH)
This plugin can be installed as a dynamic plugin, [Check here](https://github.com/TheCodingSheikh/backstage-plugins/releases/tag/19874628921-1)

## Usage

To enable the Scaffolder tab on an entity page, add the following annotations to the entity. The tab will only appear if both annotations are present.

-   **`backstage.io/scaffolder-template`**: The entity reference for the Scaffolder template to use.
-   **`backstage.io/last-applied-configuration`**: A JSON object string representing the template parameter values to to pass to the Scaffolder workflow.
-   **`backstage.io/immutable-fields`** *(optional)*: A comma-separated list of field names that should be disabled (non-editable) when the form is rendered from an entity page. This is useful for fields like `name` or `repoUrl` that should not change after initial creation.

### Example

Here is an example of how to configure a `Component` entity to use the Scaffolder plugin.

```yaml
apiVersion: backstage.io/v1alpha1
kind: Component
metadata:
  name: my-service
  annotations:
    backstage.io/last-applied-configuration: '{"name":"my-service","repoUrl":"github.com?owner=thecodingsheikh&repo=backstage-plugins","firstRun":false}'
    backstage.io/scaffolder-template: template:default/entity-scaffolder-template
    backstage.io/immutable-fields: 'name,repoUrl'
spec:
  type: service
  lifecycle: experimental
  owner: team-a
```

> **Note:** The `immutable-fields` annotation applies `ui:disabled` to the specified fields, which works with both standard form fields and custom field extensions like `RepoUrlPicker`, `OwnerPicker`, etc.
It is best to add them automatically from a scaffolder template, for example

```yaml
apiVersion: scaffolder.backstage.io/v1beta3
kind: Template
metadata:
  name: entity-scaffolder-template
spec:
  # ...
  steps:
    - id: fetch-base
      name: Fetch Base
      action: fetch:template
      input:
        url: ./content
        values:
          # ...
          params: ${{ parameters }}
```
and in the template you can do
```yaml
apiVersion: backstage.io/v1alpha1
kind: Component
metadata:
  name: ${{ values.name | dump }}
  annotations:
    backstage.io/last-applied-configuration: '${{ values.params | dump }}'
    backstage.io/scaffolder-template: template:entity-scaffolder-template
```
or you can use the [catalog:annotate](https://www.npmjs.com/package/@backstage-community/plugin-scaffolder-backend-module-annotator) action instead, with conditional step (Example below)

### Conditional Workflow
there is a special template parameter `firstRun` that is added with the value `false` in any scaffolder template initiated from an entity's page, this offers conditional steps, for example

```yaml
apiVersion: scaffolder.backstage.io/v1beta3
kind: Template
metadata:
  name: entity-scaffolder-template
  title: Example Entity Scaffolder
  description: An example template
spec:
  owner: user:guest
  type: service

  parameters:
    - title: Fill in some steps
      required:
        - name
      properties:
        name:
          title: Name
          type: string
    - title: Choose a location
      required:
        - repoUrl
      properties:
        repoUrl:
          title: Repository Location
          type: string
          ui:field: RepoUrlPicker
          ui:options:
            allowedHosts:
              - github.com

  steps:
    - id: fetch-base
      name: Fetch Base
      action: fetch:template
      input:
        url: ./content
        values:
          name: ${{ parameters.name }}
          params: ${{ parameters }}

    - id: publish
      name: Publish
      # This means if the value of firstRun is true or doesn't exist, execute this step, so it will only run when executed first time from the self service page, and will be skipped if executed from the entity page
      if: ${{ parameters.firstRun != false }}
      action: publish:github
      input:
        description: This is ${{ parameters.name }}
        repoUrl: ${{ parameters.repoUrl }}
        defaultBranch: 'main'

    - id: register
      name: Register
      # Same as above
      if: ${{ parameters.firstRun != false }}
      action: catalog:register
      input:
        repoContentsUrl: ${{ steps['publish'].output.repoContentsUrl }}
        catalogInfoPath: '/catalog-info.yaml'

    - id: pull
      name: pull
      # This step will execute only when executed from an enity's page
      if: ${{ parameters.firstRun == false }}
      action: publish:github:pull-request
      input:
        title: test
        description: This is ${{ parameters.name }}
        repoUrl: ${{ parameters.repoUrl }}
        branchName: 'test'
```
