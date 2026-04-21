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

You can restrict who is allowed to open the scaffolder tab on a given entity by adding the `backstage.io/scaffolder-edit-roles` annotation. The value is a comma-separated list of role names. The tab is shown only to users who appear in the entity's `spec.owners` with a `role` matching one of those names.

-   **Fallback**: if the annotation is absent, the tab is shown to everyone (backwards compatible).
-   **Owner format**: role-based checks require the owner to be declared as `{ name, role }` in `spec.owners` (the format produced by [`@thecodingsheikh/backstage-plugin-multi-owner`](https://github.com/TheCodingSheikh/backstage-plugins/blob/main/plugins/multi-owner/multi-owner/README.md)). Plain-string shorthand owners have no role and are denied when the annotation is set.

### Annotation

```yaml
metadata:
  annotations:
    backstage.io/scaffolder-edit-roles: 'edit,admin'
```

### Wiring into `EntityPage.tsx` with multi-owner

Because the identity check is async, wire it into a **function component** so you can use the `useCanEditEntityScaffolder` hook and conditionally render the `EntityLayout.Route`. Returning `false` from the JSX hides the tab entirely — it does not render at all.

```typescript jsx
// In packages/app/src/components/catalog/EntityPage.tsx
import { useEntity } from '@backstage/plugin-catalog-react';
import {
  EntityScaffolderContent,
  isEntityScaffolderAvailable,
  useCanEditEntityScaffolder,
} from '@thecodingsheikh/backstage-plugin-entity-scaffolder';

const ServiceEntityPage = () => {
  const { entity } = useEntity();
  const { allowed: canEditScaffolder } = useCanEditEntityScaffolder(entity);

  return (
    <EntityLayout>
      {/* ... other routes */}

      {canEditScaffolder && (
        <EntityLayout.Route
          path="/entity-scaffolder"
          title="manage"
          if={isEntityScaffolderAvailable}
        >
          <EntityScaffolderContent />
        </EntityLayout.Route>
      )}

      {/* ... other routes */}
    </EntityLayout>
  );
};
```

> **Note:** The content component also short-circuits to `null` when the hook returns `allowed: false`, so direct navigation to `/entity-scaffolder` renders nothing. This is a UX-level guard — for true authorization use Backstage's permission framework in your scaffolder backend.

### Example: mixing `edit` and `admin` per entity

Say you have two services. Service A is edited by owners with the `edit` role; service B is restricted to owners with the `admin` role.

```yaml
# Service A — any owner with role: edit may open the scaffolder tab
apiVersion: backstage.io/v1alpha1
kind: Component
metadata:
  name: service-a
  annotations:
    backstage.io/scaffolder-edit-roles: 'edit'
    backstage.io/scaffolder-template: template:default/entity-scaffolder-template
    backstage.io/last-applied-configuration: '{"name":"service-a","firstRun":false}'
spec:
  type: service
  lifecycle: production
  owners:
    - { name: group:default/team-a, role: edit }
    - { name: group:default/auditors, role: viewer }   # tab hidden for these
```

```yaml
# Service B — only platform admins may open the scaffolder tab
apiVersion: backstage.io/v1alpha1
kind: Component
metadata:
  name: service-b
  annotations:
    backstage.io/scaffolder-edit-roles: 'admin'
    backstage.io/scaffolder-template: template:default/entity-scaffolder-template
    backstage.io/last-applied-configuration: '{"name":"service-b","firstRun":false}'
spec:
  type: service
  lifecycle: production
  owners:
    - { name: group:default/team-b, role: edit }       # tab hidden for these
    - { name: group:default/platform, role: admin }
```

You can also allow multiple roles at once, e.g. `backstage.io/scaffolder-edit-roles: 'edit,admin'` to let both groups edit.

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
