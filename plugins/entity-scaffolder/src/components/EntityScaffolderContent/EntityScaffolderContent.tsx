/*
 * Copyright SeatGeek
 * Licensed under the terms of the Apache-2.0 license. See LICENSE file in project root for terms.
 */
import { parseEntityRef } from '@backstage/catalog-model';
import { 
  MissingAnnotationEmptyState,
  useEntity 
} from '@backstage/plugin-catalog-react';
import {
  SecretsContextProvider,
} from '@backstage/plugin-scaffolder-react';
import { EmbeddedScaffolderWorkflow, WorkflowButton } from '@frontside/backstage-plugin-scaffolder-workflow';

import { 
  ENTITY_SCAFFOLDER_CONFIG_ANNOTATION, 
  ENTITY_SCAFFOLDER_TEMPLATE_ANNOTATION 
} from '../../annotations';


import { IconComponent, useApp } from '@backstage/core-plugin-api';
import WebIcon from '@material-ui/icons/Web';
import { useEntity } from '@backstage/plugin-catalog-react';
import { JsonValue } from '@backstage/types';
import { WorkflowButton } from '@frontside/backstage-plugin-scaffolder-workflow';
import {
  type IdleComponentType,
  type ModalComponentProps,
  type SuccessComponentProps,
  ModalTaskProgress,
} from '@frontside/backstage-plugin-scaffolder-workflow';
import { Button, makeStyles } from '@material-ui/core';
import { Link } from '@backstage/core-components';
import { assert } from 'assert-ts';
import  { useCallback, type MouseEvent, useState } from 'react';

const useStyles = makeStyles(theme => ({
  link: {
    '&:hover': {
      textDecoration: 'none',
    },
  },
  idle: {
    backgroundColor: theme.palette.primary.main,
    color: '#ffffff',
  },
  pending: {
    backgroundColor: theme.palette.warning.main,
    color: '#ffffff',
  },
  error: {
    backgroundColor: theme.palette.error.main,
    color: '#ffffff',
  },
  success: {
    backgroundColor: theme.palette.success.main,
    color: '#ffffff',
  },
}));
/**
 * Use templates from within the EntityPage.
 *
 * @public
 */
const Idle: IdleComponentType<{
  initialState: Record<string, JsonValue>;
}> = ({ execute, initialState }) => {
  const classes = useStyles();

  const clickHandler = useCallback(
    (e: MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation();

      // TODO: how do I make this type so it doesn't need to be optional?
      // @ts-expect-error ts(2722)
      execute(initialState);
    },
    [execute, initialState],
  );

  return (
    <Button
      variant="contained"
      color="primary"
      disableRipple
      disableFocusRipple
      type="button"
      size="medium"
      className={classes.idle}
      onClick={clickHandler}
    >
      Deprecate
    </Button>
  );
};

const Pending = () => {
  const classes = useStyles();
  return (
    <>
      <Button
        variant="contained"
        color="primary"
        disableRipple
        disableFocusRipple
        type="button"
        size="medium"
        className={classes.pending}
      >
        Running
      </Button>
    </>
  );
};

const Error = () => {
  const classes = useStyles();

  return (
    <>
      <Button
        variant="contained"
        color="primary"
        disableRipple
        disableFocusRipple
        type="button"
        size="medium"
        className={classes.error}
      >
        Failed
      </Button>
    </>
  );
};

const Success = ({ taskStream }: SuccessComponentProps) => {
  const classes = useStyles();
  const app = useApp();
  const iconResolver = (key?: string): IconComponent =>
    app.getSystemIcon(key!) ?? WebIcon;

  return (
    <>
      {taskStream?.output?.links &&
        taskStream.output.links.map(({ url, title, icon }, i) => {
          const Icon = iconResolver(icon);

          return (
            <Link to={url ?? ''} key={i} className={classes.link}>
              <Button
                variant="contained"
                type="button"
                color="primary"
                disableRipple
                disableFocusRipple
                size="medium"
                startIcon={<Icon />}
              >
                {title}
              </Button>
            </Link>
          );
        })}
    </>
  );
};

const Modal = ({ taskStream, taskStatus }: ModalComponentProps) => {
  const [open, setOpen] = useState(false);
  const closeHandler = useCallback(() => setOpen(false), []);

  if (taskStatus !== 'idle' && taskStream) {
    return (
      <>
        <Button 
          color="secondary" 
          disableRipple
          disableFocusRipple 
          onClick={() => setOpen(true)}>
          Show Logs
        </Button>
        <ModalTaskProgress
          taskStream={taskStream}
          open={open}
          onClick={closeHandler}
          onClose={closeHandler}
        />
      </>
    );
  }

  return null;
};

export const EntityScaffolderContent = () => {
  const { entity } = useEntity();

  const entityScaffolderConfigAnnotationValue =
    entity.metadata.annotations?.[ENTITY_SCAFFOLDER_CONFIG_ANNOTATION];

  const entityScaffolderTemplateAnnotationValue =
    entity.metadata.annotations?.[ENTITY_SCAFFOLDER_TEMPLATE_ANNOTATION];

  const initialState = {
    ...(entityScaffolderConfigAnnotationValue
      ? JSON.parse(entityScaffolderConfigAnnotationValue)
      : {}),
    firstRun: false,
  };

  if (
    entityScaffolderConfigAnnotationValue && entityScaffolderTemplateAnnotationValue
  ) {
    const templateEntity = parseEntityRef(entityScaffolderTemplateAnnotationValue);

    return (

      <SecretsContextProvider>
      <WorkflowButton
          namespace={templateEntity.namespace}
          templateName={templateEntity.name}
        components={{
          idle: <Idle initialState={initialState} />,
          pending: <Pending />,
          error: <Error />,
          success: <Success />,
          modal: <Modal />,
        }}
      />
        <EmbeddedScaffolderWorkflow
          namespace={templateEntity.namespace}
          templateName={templateEntity.name}
          initialState={initialState}
          onError={(error: Error | undefined) => (
            <h2>{error?.message ?? 'Error running workflow'}</h2>
          )}
        >
        </EmbeddedScaffolderWorkflow>
      </SecretsContextProvider>
    );
  }
  return (
    <MissingAnnotationEmptyState annotation={ENTITY_SCAFFOLDER_CONFIG_ANNOTATION} />
      
  );
};