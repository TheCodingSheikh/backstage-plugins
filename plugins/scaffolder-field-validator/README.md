# scaffolder-field-validator

A Backstage scaffolder field extension that validates form input against any backend API before submission.

It works as a hidden field that watches another form field, calls an API when the value changes, and blocks submission if the validation fails.

## Install

```bash
yarn add @thecodingsheikh/backstage-plugin-scaffolder-field-validator
```

Register the extension in your `App.tsx`:

```tsx
import { ScaffolderFieldValidatorExtension } from '@thecodingsheikh/backstage-plugin-scaffolder-field-validator';

<Route path="/create" element={<ScaffolderPage />}>
  <ScaffolderFieldValidatorExtension />
</Route>
```

## Config

| Field | Required | Description |
|---|---|---|
| `watchField` | yes | The form field to watch for changes |
| `apiPath` | yes | Backend API path. First segment is the plugin ID (e.g. `catalog/entities` calls `discoveryApi.getBaseUrl('catalog')` + `/entities`) |
| `params` | no | Query parameters. Values support `{{value}}` (watched field) and `{{fieldName}}` (other form fields) |
| `jmesPath` | no | [JMESPath](https://jmespath.org/) expression evaluated against the API response. Truthy result = validation fails. If omitted, fails when response is a non-empty array or truthy value |
| `errorMessage` | no | Error message shown on failure. Supports `{{value}}` |

## Examples

### Check if a component already exists in the catalog

```yaml
parameters:
  - title: Component Info
    properties:
      name:
        type: string
        title: Component Name
      nameValidator:
        type: string
        ui:field: ScaffolderFieldValidator
        ui:widget: hidden
        ui:options:
          watchField: name
          apiPath: catalog/entities
          params:
            filter: "kind=Component,metadata.name={{value}}"
          jmesPath: "length(@) > `0`"
          errorMessage: "Component '{{value}}' already exists"
```

### Check if a group exists before using it as owner

```yaml
parameters:
  - title: Ownership
    properties:
      owner:
        type: string
        title: Owner Group
      ownerValidator:
        type: string
        ui:field: ScaffolderFieldValidator
        ui:widget: hidden
        ui:options:
          watchField: owner
          apiPath: catalog/entities
          params:
            filter: "kind=Group,metadata.name={{value}}"
          jmesPath: "length(@) == `0`"
          errorMessage: "Group '{{value}}' does not exist"
```

### Validate against an external API via proxy

```yaml
parameters:
  - title: Project Setup
    properties:
      projectName:
        type: string
        title: Project Name
      projectValidator:
        type: string
        ui:field: ScaffolderFieldValidator
        ui:widget: hidden
        ui:options:
          watchField: projectName
          apiPath: proxy/my-api/projects/{{value}}
          jmesPath: "status == 'archived'"
          errorMessage: "Project '{{value}}' is archived"
```

### Numeric comparison

```yaml
parameters:
  - title: Resources
    properties:
      replicas:
        type: number
        title: Replicas
      replicaValidator:
        type: string
        ui:field: ScaffolderFieldValidator
        ui:widget: hidden
        ui:options:
          watchField: replicas
          apiPath: proxy/cluster-api/capacity
          jmesPath: "available < `{{value}}`"
          errorMessage: "Not enough cluster capacity for {{value}} replicas"
```

### Check if a name is in a reserved list

```yaml
parameters:
  - title: Details
    properties:
      name:
        type: string
        title: Name
      reservedCheck:
        type: string
        ui:field: ScaffolderFieldValidator
        ui:widget: hidden
        ui:options:
          watchField: name
          apiPath: proxy/my-api/reserved-names
          jmesPath: "contains(@, '{{value}}')"
          errorMessage: "'{{value}}' is a reserved name"
```

### Use other form fields in the API call

```yaml
parameters:
  - title: Details
    properties:
      environment:
        type: string
        title: Environment
        enum: [dev, staging, prod]
      name:
        type: string
        title: Service Name
      nameValidator:
        type: string
        ui:field: ScaffolderFieldValidator
        ui:widget: hidden
        ui:options:
          watchField: name
          apiPath: proxy/my-api/services
          params:
            env: "{{environment}}"
            name: "{{value}}"
          jmesPath: "length(@) > `0`"
          errorMessage: "'{{value}}' already exists in this environment"
```

### Multiple validations on the same field

Add multiple hidden validator fields, each with its own rule:

```yaml
parameters:
  - title: Details
    properties:
      name:
        type: string
        title: Component Name
      nameExistsCheck:
        type: string
        ui:field: ScaffolderFieldValidator
        ui:widget: hidden
        ui:options:
          watchField: name
          apiPath: catalog/entities
          params:
            filter: "kind=Component,metadata.name={{value}}"
          jmesPath: "length(@) > `0`"
          errorMessage: "Component '{{value}}' already exists"
      nameReservedCheck:
        type: string
        ui:field: ScaffolderFieldValidator
        ui:widget: hidden
        ui:options:
          watchField: name
          apiPath: proxy/my-api/reserved-names
          jmesPath: "contains(@, '{{value}}')"
          errorMessage: "'{{value}}' is reserved"
```

## How it works

1. The hidden field watches `watchField` for changes
2. When the value changes, it calls `GET <apiPath>?<params>`
3. If `jmesPath` is set, it evaluates the expression against the response
4. If the result is truthy (`true`, non-empty array, non-null value), validation fails
5. On form submission, the error message is shown and submission is blocked

The API path is resolved using Backstage's `discoveryApi` — the first path segment is treated as the plugin ID. For example, `catalog/entities` resolves to `discoveryApi.getBaseUrl('catalog')` + `/entities`.
