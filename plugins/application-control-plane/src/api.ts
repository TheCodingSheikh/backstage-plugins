import { discoveryApiRef, fetchApiRef, useApi } from '@backstage/core-plugin-api';
import { useCallback, useEffect, useState } from 'react';
import type { ActivityItem, ApplicationSummary } from './types';

export function useApplications() {
  const discovery = useApi(discoveryApiRef);
  const fetchApi = useApi(fetchApiRef);
  const [data, setData] = useState<ApplicationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const reload = useCallback(async () => {
    setLoading(true); setError(undefined);
    try {
      const base = await discovery.getBaseUrl('application-control-plane');
      const response = await fetchApi.fetch(`${base}/v1/applications`);
      if (!response.ok) throw new Error(`Application query failed (${response.status})`);
      const payload = await response.json() as { items: ApplicationSummary[]; activity?: ActivityItem[]; isPlatformAdmin?: boolean };
      setData(payload.items); setActivity(payload.activity ?? []); setIsPlatformAdmin(payload.isPlatformAdmin ?? false);
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { setLoading(false); }
  }, [discovery, fetchApi]);
  useEffect(() => { void reload(); }, [reload]);
  return { data, activity, isPlatformAdmin, loading, error, reload };
}

export function useApplication(namespace: string, name: string) {
  const discovery = useApi(discoveryApiRef);
  const fetchApi = useApi(fetchApiRef);
  const [data, setData] = useState<ApplicationSummary>();
  const [error, setError] = useState<string>();
  useEffect(() => {
    let active = true;
    Promise.all([discovery.getBaseUrl('application-control-plane')]).then(async ([base]) => {
      const response = await fetchApi.fetch(`${base}/v1/applications/${encodeURIComponent(namespace)}/${encodeURIComponent(name)}`);
      if (!response.ok) throw new Error(response.status === 403 ? 'Application access denied' : `Application query failed (${response.status})`);
      return response.json() as Promise<ApplicationSummary>;
    }).then(value => { if (active) setData(value); }).catch(cause => { if (active) setError(cause instanceof Error ? cause.message : String(cause)); });
    return () => { active = false; };
  }, [discovery, fetchApi, namespace, name]);
  return { data, error };
}
