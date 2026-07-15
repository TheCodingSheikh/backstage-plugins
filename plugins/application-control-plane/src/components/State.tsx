import { Button, EmptyState, EmptyStateBody, EmptyStateFooter, Spinner } from '@patternfly/react-core';

export function LoadingState() { return <div className="ncai-state" aria-live="polite"><Spinner aria-label="Loading applications" /></div>; }
export function ErrorState({ message, retry }: { message: string; retry?: () => void }) {
  return <EmptyState titleText="Control plane unavailable" headingLevel="h2"><EmptyStateBody>{message}</EmptyStateBody>{retry ? <EmptyStateFooter><Button variant="primary" onClick={retry}>Try again</Button></EmptyStateFooter> : null}</EmptyState>;
}
