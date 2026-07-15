import { Button } from '@patternfly/react-core';
import { Link } from 'react-router-dom';
import { useApplications } from '../api';
import { canEdit } from '../types';
import { Status } from './Status';
import { ErrorState, LoadingState } from './State';

const appHref = (ref: string) => `/my-applications/${ref.split(':')[1]}`;

export function ControlPlaneHomePage() {
  const { data, activity, isPlatformAdmin, loading, error, reload } = useApplications();
  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} retry={reload} />;
  const attention = data.filter(app => !['Healthy', 'Unknown'].includes(app.health) || !['Synced', 'Unknown'].includes(app.sync));
  const canCreate = isPlatformAdmin;
  return <main className="ncai-page">
    <section className="ncai-hero" aria-labelledby="welcome-title">
      <div><h1 id="welcome-title">Good morning, Product Owner</h1><p>Manage applications owned by your groups across assigned tenants.</p>{canCreate ? <Button component="a" href="/create/templates/default/application">＋ Create application</Button> : null}</div>
      <aside className="ncai-quick" aria-label="Quick actions"><h2>Quick actions</h2><a href="/create">⊕ <span>Add resource</span><b>›</b></a><a href="/catalog">▤ <span>View catalog</span><b>›</b></a>{data.some(app => app.effectiveRole === 'admin') ? <a href="/argo-cd">◉ <span>Open Argo CD</span><b>›</b></a> : null}</aside>
    </section>
    <section className="ncai-panel" aria-labelledby="attention-title"><h2 id="attention-title"><span className="ncai-warning" aria-hidden="true">▲</span> Needs attention</h2>
      {attention.length ? <div className="ncai-attention-list">{attention.map(app => <div className="ncai-attention-row" key={app.ref}><span className="ncai-app-icon">▦</span><span><Link to={appHref(app.ref)}>{app.name}</Link><small>{app.tenant}</small></span><Status value={app.health} /><Status value={app.sync} /><Link className="ncai-outline-action" to={appHref(app.ref)}>View application</Link>{canEdit(app.effectiveRole) ? <a className="ncai-primary-action" href={`/create?application=${encodeURIComponent(app.ref)}`}>Review deployment</a> : null}</div>)}</div> : <p className="ncai-empty">No owned applications need attention.</p>}
    </section>
    <section className="ncai-panel" aria-labelledby="applications-title"><div className="ncai-panel-heading"><h2 id="applications-title">My applications</h2><span>♧ Owned by your groups</span><i /> <span>Across {new Set(data.map(app => app.tenant)).size} assigned tenants</span></div>
      {data.length ? <div className="ncai-table-wrap"><table><thead><tr><th>Application</th><th>Tenant</th><th>Health</th><th>Sync status</th><th>Role</th><th><span className="pf-v6-screen-reader">Actions</span></th></tr></thead><tbody>{data.map(app => <tr key={app.ref}><td><span className="ncai-mini-icon">&lt;/&gt;</span><Link to={appHref(app.ref)}>{app.name}</Link></td><td>{app.tenant}</td><td><Status value={app.health} /></td><td><Status value={app.sync} /></td><td>{app.effectiveRole}</td><td><Link to={appHref(app.ref)}>View application</Link></td></tr>)}</tbody></table></div> : <p className="ncai-empty">No applications owned by your groups.</p>}
    </section>
    <section className="ncai-panel ncai-activity" aria-labelledby="changes-title"><h2 id="changes-title">Recent changes</h2>{activity.length ? <ol>{activity.map(item => <li key={`${item.url}-${item.time}`}><span aria-hidden="true">⑂</span><a href={item.url}>{item.title}</a><small>{item.time ? new Date(item.time).toLocaleString() : ''} by {item.actor}</small></li>)}</ol> : <p className="ncai-empty">GitOps activity appears after first merged application change.</p>}</section>
  </main>;
}
