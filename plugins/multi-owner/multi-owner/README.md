# @thecodingsheikh/backstage-plugin-multi-owner

A frontend plugin that displays multiple owners for Backstage entities, with optional role labels.

![screenshow](https://github.com/TheCodingSheikh/backstage-plugins/blob/main/plugins/multi-owner/multi-owner/screenshot.png?raw=true)

## Features

- **EntityMultiOwnerCard** — An info card showing all owners with clickable entity reference links
- **Role chips** — Optional role labels displayed as Material UI chips
- **Smart icons** — Group icon for groups, person icon for users
- **Fallback** — Falls back to `spec.owner` when `spec.owners` is not configured
- **EntitySwitch guard** — `isMultiOwnerAvailable()` for conditional rendering

## Installation

```bash
yarn add @thecodingsheikh/backstage-plugin-multi-owner
```

## Usage

### Entity Page

Add the card to your entity pages in `packages/app/src/components/catalog/EntityPage.tsx`:

```tsx
import {
  EntityMultiOwnerCard,
  isMultiOwnerAvailable,
} from '@thecodingsheikh/backstage-plugin-multi-owner';

// In your entity page layout:
const overviewContent = (
  <Grid container spacing={3}>
    {/* ... other cards ... */}

    <EntitySwitch>
      <EntitySwitch.Case if={isMultiOwnerAvailable}>
        <Grid item md={6}>
          <EntityMultiOwnerCard />
        </Grid>
      </EntitySwitch.Case>
    </EntitySwitch>
  </Grid>
);
```

### Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `title` | `string` | `"Owners"` | Card title |
| `variant` | `'gridItem' \| 'fullHeight'` | — | Card variant |

### Custom Hook

You can also use the `useMultiOwners` hook directly:

```tsx
import { useMultiOwners } from '@thecodingsheikh/backstage-plugin-multi-owner';

function MyComponent() {
  const { owners, loading } = useMultiOwners();

  if (loading) return <Progress />;

  return (
    <ul>
      {owners.map(owner => (
        <li key={owner.name}>
          {owner.name} {owner.role && `(${owner.role})`}
        </li>
      ))}
    </ul>
  );
}
```

## Requirements

This plugin requires the backend processor module to be installed:

```bash
yarn add @thecodingsheikh/backstage-plugin-catalog-backend-module-multi-owner-processor
```

See the [backend module README](../catalog-backend-module-multi-owner-processor/README.md) for setup instructions.
