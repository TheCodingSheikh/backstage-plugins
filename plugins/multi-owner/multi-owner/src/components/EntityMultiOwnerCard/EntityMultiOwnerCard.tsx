import {
    InfoCard,
} from '@backstage/core-components';
import { EntityRefLinks } from '@backstage/plugin-catalog-react';
import {
    List,
    ListItem,
    ListItemText,
    ListItemIcon,
    Chip,
    makeStyles,
    createStyles,
    Theme,
    Typography,
} from '@material-ui/core';
import PeopleIcon from '@material-ui/icons/People';
import PersonIcon from '@material-ui/icons/Person';
import { parseEntityRef } from '@backstage/catalog-model';
import { useMultiOwners } from '../../hooks/useMultiOwners';

const useStyles = makeStyles((theme: Theme) =>
    createStyles({
        list: {
            padding: 0,
        },
        listItem: {
            paddingLeft: theme.spacing(1),
            paddingRight: theme.spacing(1),
            '&:not(:last-child)': {
                borderBottom: `1px solid ${theme.palette.divider}`,
            },
        },
        chip: {
            marginLeft: theme.spacing(1),
            height: 22,
            fontSize: '0.75rem',
            fontWeight: 500,
        },
        ownerContent: {
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: theme.spacing(0.5),
        },
        emptyState: {
            padding: theme.spacing(2),
            textAlign: 'center',
        },
    }),
);

/** Props for the {@link EntityMultiOwnerCard} component. */
export interface EntityMultiOwnerCardProps {
    /** Optional card title override. Defaults to `"Owners"`. */
    title?: string;
    /** Optional card variant. */
    variant?: 'gridItem' | 'fullHeight';
}

/**
 * An info card that displays multiple owners for an entity, each with an
 * optional role label. Owners are rendered as clickable entity reference
 * links that navigate to the owner's entity page.
 *
 * @remarks
 * Requires the entity to have the `backstage.io/owners` annotation,
 * typically set by the backend {@link MultiOwnerEntitiesProcessor}.
 * Falls back to `spec.owner` if the annotation is absent.
 */
export function EntityMultiOwnerCard(props: EntityMultiOwnerCardProps) {
    const { title = 'Owners', variant } = props;
    const classes = useStyles();
    const { owners } = useMultiOwners();

    if (owners.length === 0) {
        return (
            <InfoCard title={title} variant={variant}>
                <Typography
                    variant="body2"
                    color="textSecondary"
                    className={classes.emptyState}
                >
                    No owners defined
                </Typography>
            </InfoCard>
        );
    }

    return (
        <InfoCard title={title} variant={variant}>
            <List className={classes.list}>
                {owners.map((owner, index) => {
                    const isGroup = getOwnerKind(owner.name) === 'group';

                    return (
                        <ListItem
                            key={`${owner.name}-${index}`}
                            className={classes.listItem}
                        >
                            <ListItemIcon>
                                {isGroup ? <PeopleIcon /> : <PersonIcon />}
                            </ListItemIcon>
                            <ListItemText
                                disableTypography
                                primary={
                                    <div className={classes.ownerContent}>
                                        <EntityRefLinks
                                            entityRefs={[owner.name]}
                                            defaultKind="group"
                                        />
                                        {owner.role && (
                                            <Chip
                                                label={owner.role}
                                                size="small"
                                                color="primary"
                                                variant="outlined"
                                                className={classes.chip}
                                            />
                                        )}
                                    </div>
                                }
                            />
                        </ListItem>
                    );
                })}
            </List>
        </InfoCard>
    );
}

/** Extracts the kind from an entity reference string, defaulting to "group". */
function getOwnerKind(ref: string): string {
    try {
        return parseEntityRef(ref, { defaultKind: 'group', defaultNamespace: 'default' }).kind.toLowerCase();
    } catch {
        return 'group';
    }
}
