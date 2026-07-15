import { useState } from 'react';
import { Button } from '@patternfly/react-core';
import { Link, useParams } from 'react-router-dom';
import { useApplication } from '../api';
import { canAdmin, canEdit } from '../types';
import { ErrorState, LoadingState } from './State';
import { Status } from './Status';

const tabs = ['Overview', 'Resources', 'Deployments', 'Access', 'Activity'] as const;

export function ApplicationPage() {
  const { namespace = 'default', name = '' } = useParams();
  const { data, error } = useApplication(namespace, name);
  const [tab, setTab] = useState<(typeof tabs)[number]>('Overview');
  if (error) return <ErrorState message={error} />;
  if (!data) return <LoadingState />;
  const editable = canEdit(data.effectiveRole), admin = canAdmin(data.effectiveRole);
  return <main className="ncai-application-page">
    <header className="ncai-app-header"><p><Link to="/my-applications">My Applications</Link> / {data.name}</p><div className="ncai-title-row"><div><h1>{data.name}</h1><span>Tenant: {data.tenant}</span><i /> <span>Namespace: {data.namespace}</span></div><div>{editable ? <Button variant="secondary" component="a" href={`/create?application=${encodeURIComponent(data.ref)}`}>Add resource⌄</Button> : null}{admin ? <Button component="a" href={`/create/templates/default/application-access?applicationRef=${encodeURIComponent(data.ref)}`}>Edit application</Button> : null}</div></div></header>
    <section className="ncai-summary" aria-label="Application status"><div><small>Health</small><Status value={data.health} /></div><div><small>Sync</small><Status value={data.sync} /></div><div><small>Namespace</small><strong>{data.namespace}</strong></div><div><small>Effective role</small><strong>{data.effectiveRole}</strong></div>{admin ? <div className="ncai-admin-links"><a href={`/argo-cd/applications?search=${data.name}`}>Open in Argo CD ↗</a><a href={`/catalog/default/system/${data.tenant}-${data.name}`}>Open catalog entity ↗</a></div> : null}</section>
    <nav className="ncai-tabs" aria-label="Application sections">{tabs.map(item => <button key={item} role="tab" aria-selected={tab === item} onClick={() => setTab(item)}>{item}</button>)}</nav>
    <div className="ncai-tab-content" role="tabpanel">{tab === 'Overview' || tab === 'Resources' ? <Overview data={data} editable={editable} admin={admin} /> : tab === 'Access' ? <Access data={data} admin={admin} /> : <EmptyTab title={tab} />}</div>
  </main>;
}

function Overview({ data, editable, admin }: { data: NonNullable<ReturnType<typeof useApplication>['data']>; editable: boolean; admin: boolean }) {
  return <><div className="ncai-overview-grid"><section className="ncai-panel"><h2>Resources</h2><div className="ncai-table-wrap"><table><thead><tr><th>Name</th><th>Type</th><th>Health</th><th>Sync</th><th>Actions</th></tr></thead><tbody>{data.resources?.length ? data.resources.map(resource => <tr key={resource.name}><td>{resource.name}</td><td>{resource.kind}</td><td><Status value={resource.health} /></td><td><Status value={resource.sync} /></td><td>{editable ? '⋮' : '—'}</td></tr>) : <tr><td colSpan={5}>No reconciled resources.</td></tr>}</tbody></table></div>{editable ? <Button variant="secondary" component="a" href={`/create?application=${encodeURIComponent(data.ref)}`}>Add resource⌄</Button> : null}</section><section className="ncai-panel ncai-details"><h2>Application details</h2><dl><dt>Tenant</dt><dd>{data.tenant}</dd><dt>Namespace</dt><dd>{data.namespace}</dd><dt>Owning groups</dt><dd>{data.owners.map(owner => <span className="ncai-owner" key={`${owner.subject}-${owner.role}`}>♧ {owner.subject.replace('group:default/', '')} <b>{owner.role}</b></span>)}</dd><dt>Catalog ref</dt><dd>{data.ref}</dd><dt>Access</dt><dd>{admin ? 'Ownership management' : data.effectiveRole === 'edit' ? 'Resource management' : 'Read only'}</dd></dl></section></div><section className="ncai-panel"><h2>Recent deployments</h2><p className="ncai-empty">Deployment history appears after Argo reports application revisions.</p></section></>;
}

function Access({ data, admin }: { data: NonNullable<ReturnType<typeof useApplication>['data']>; admin: boolean }) { return <section className="ncai-panel"><h2>Application access</h2>{data.owners.map(owner => <p className="ncai-owner" key={owner.subject}>♧ {owner.subject} <b>{owner.role}</b></p>)}{admin ? <Button component="a" href={`/create/templates/default/application-access?applicationRef=${encodeURIComponent(data.ref)}`}>Manage access</Button> : <p>Only application admins can change ownership.</p>}</section>; }
function EmptyTab({ title }: { title: string }) { return <section className="ncai-panel"><h2>{title}</h2><p className="ncai-empty">No {title.toLowerCase()} available.</p></section>; }
