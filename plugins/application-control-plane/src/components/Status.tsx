
export function Status({ value }: { value: string }) {
  const good = value === 'Healthy' || value === 'Synced';
  const unknown = value === 'Unknown';
  return <span className={`ncai-status ${good ? 'is-good' : unknown ? 'is-unknown' : 'is-bad'}`}><span aria-hidden="true">{good ? '●' : unknown ? '○' : '●'}</span>{value}</span>;
}
