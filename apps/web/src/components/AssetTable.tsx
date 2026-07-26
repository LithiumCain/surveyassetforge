import { Asset, AssetAssignment, User } from '../types';

const DAY_MS = 86_400_000;

// "14d overdue" / "in 6d" chip next to the due date, so urgency reads at a glance.
const dueChip = (nextDue: string | null) => {
  if (!nextDue) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(`${nextDue}T00:00:00`);
  const days = Math.round((due.getTime() - today.getTime()) / DAY_MS);
  if (days < 0) return <span className="due-chip late">{-days}d overdue</span>;
  if (days === 0) return <span className="due-chip soon">today</span>;
  if (days <= 14) return <span className="due-chip soon">in {days}d</span>;
  return <span className="due-chip">in {days}d</span>;
};

const money = (n: number | null | undefined) =>
  `$${Math.round(Number(n ?? 0)).toLocaleString()}`;

type Props = {
  assets: Asset[];
  user: User;
  activeAssignments: Record<string, AssetAssignment>;
  onEdit: (asset: Asset) => void;
  onDelete: (asset: Asset) => void;
  onAssign: (asset: Asset) => void;
  onCheckIn: (asset: Asset) => void;
  onViewHistory: (asset: Asset) => void;
  onLogCalibration: (asset: Asset) => void;
};

type RowActionProps = Props & { asset: Asset; assignment: AssetAssignment | undefined };

// One set of action buttons shared by the desktop table and the mobile cards.
const RowActions = ({
  asset,
  assignment,
  user,
  onEdit,
  onDelete,
  onAssign,
  onCheckIn,
  onViewHistory,
  onLogCalibration,
}: RowActionProps) => (
  <div className="row-actions">
    <button
      className="icon-action calibrate"
      type="button"
      title="Log calibration"
      onClick={() => onLogCalibration(asset)}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 14a8 8 0 0 1 16 0" />
        <path d="M12 14l4-3" />
        <circle cx="12" cy="14" r="1.2" />
      </svg>
    </button>

    <button
      className="icon-action"
      type="button"
      title="Custody history"
      onClick={() => onViewHistory(asset)}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 3" />
      </svg>
    </button>

    {assignment ? (
      <button
        className="icon-action checkin"
        type="button"
        title={`Check in from ${assignment.assignedToName}`}
        onClick={() => onCheckIn(asset)}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 19V5" />
          <path d="m5 12 7-7 7 7" />
          <path d="M5 19h14" />
        </svg>
      </button>
    ) : (
      <button
        className="icon-action checkout"
        type="button"
        title="Check out to a person"
        onClick={() => onAssign(asset)}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 5v14" />
          <path d="m19 12-7 7-7-7" />
          <path d="M5 5h14" />
        </svg>
      </button>
    )}

    {(user.role === 'super_admin' || user.role === 'site_supervisor') && (
      <button
        className="icon-action edit"
        type="button"
        title="Edit asset"
        onClick={() => onEdit(asset)}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 20h4l10-10-4-4L4 16v4Z" />
          <path d="m12.5 7.5 4 4" />
        </svg>
      </button>
    )}

    {user.role === 'super_admin' && (
      <button
        className="icon-action delete"
        type="button"
        title="Delete asset"
        onClick={() => onDelete(asset)}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 7h14" />
          <path d="M9 7V5.8c0-.44.36-.8.8-.8h4.4c.44 0 .8.36.8.8V7" />
          <path d="M8 7l.7 10.2c.03.46.42.8.88.8h4.84c.46 0 .85-.34.88-.8L16 7" />
        <path d="M10.5 10.2v4.8M13.5 10.2v4.8" />
        </svg>
      </button>
    )}
  </div>
);

export const AssetTable = (props: Props) => {
  const { assets, activeAssignments } = props;

  return (
    <div className="card asset-list">
      {/* Desktop: full table */}
      <div className="table-wrap asset-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Asset #</th>
              <th>Item</th>
              <th>Manufacturer</th>
              <th>Site</th>
              <th>Ownership</th>
              <th>Assigned To</th>
              <th>Calibration</th>
              <th>Firmware</th>
              <th>Serial #</th>
              <th>Damage</th>
              <th>Current Value</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {assets.length === 0 && (
              <tr>
                <td colSpan={12} style={{ textAlign: 'center', color: 'var(--muted)', padding: '32px' }}>
                  No assets found for this location.
                </td>
              </tr>
            )}
            {assets.map((asset) => {
              const assignment = activeAssignments[asset.id];
              return (
                <tr key={asset.id}>
                  <td>{asset.assetNumber}</td>
                  <td>{asset.itemName}</td>
                  <td>{asset.manufacturer ?? '—'}</td>
                  <td>{asset.siteName ?? <span style={{ color: 'var(--muted)' }}>Inventory</span>}</td>
                  <td style={{ textTransform: 'capitalize' }}>{asset.ownership}</td>
                  <td>
                    {assignment ? (
                      <span className="assignment-pill">
                        {assignment.assignedToName}
                        {assignment.assignedToNumber && (
                          <span className="assignment-number"> #{assignment.assignedToNumber}</span>
                        )}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--muted)' }}>—</span>
                    )}
                  </td>
                  <td>
                    <div className="cal-cell">
                      <span className={`badge ${asset.calibrationStatus}`}>
                        {asset.calibrationStatus.replace('_', ' ')}
                      </span>
                      {dueChip(asset.nextCalibrationDue)}
                    </div>
                  </td>
                  <td>
                    {asset.firmwareVersion ?? '—'}
                    {asset.firmwareOutdated && (
                      <span className="badge warning" style={{ marginLeft: 6 }}>outdated</span>
                    )}
                  </td>
                  <td>{asset.serialNumber ?? '—'}</td>
                  <td>
                    <span className={`badge ${asset.damageStatus}`}>
                      {asset.damageStatus.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="num">{money(asset.currentValue)}</td>
                  <td>
                    <RowActions {...props} asset={asset} assignment={assignment} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Phone: card list (CSS swaps the two) */}
      <div className="asset-cards">
        {assets.length === 0 && (
          <p className="subtle" style={{ textAlign: 'center', padding: '24px 0' }}>
            No assets found for this location.
          </p>
        )}
        {assets.map((asset) => {
          const assignment = activeAssignments[asset.id];
          return (
            <article key={asset.id} className="asset-card">
              <header className="asset-card-head">
                <div className="asset-card-title">
                  <span className="asset-card-number">{asset.assetNumber}</span>
                  <span className="asset-card-name">{asset.itemName}</span>
                </div>
                <span className={`badge ${asset.calibrationStatus}`}>
                  {asset.calibrationStatus.replace('_', ' ')}
                </span>
              </header>

              <dl className="asset-card-meta">
                <div>
                  <dt>Site</dt>
                  <dd>{asset.siteName ?? 'Inventory'}</dd>
                </div>
                <div>
                  <dt>Serial #</dt>
                  <dd>{asset.serialNumber ?? '—'}</dd>
                </div>
                <div>
                  <dt>Value</dt>
                  <dd>{money(asset.currentValue)}</dd>
                </div>
                <div>
                  <dt>Assigned</dt>
                  <dd>{assignment ? assignment.assignedToName : '—'}</dd>
                </div>
              </dl>

              <footer className="asset-card-foot">
                <div className="asset-card-flags">
                  {dueChip(asset.nextCalibrationDue)}
                  {asset.damageStatus !== 'ok' && (
                    <span className={`badge ${asset.damageStatus}`}>
                      {asset.damageStatus.replace('_', ' ')}
                    </span>
                  )}
                  {asset.firmwareOutdated && <span className="badge warning">fw outdated</span>}
                </div>
                <RowActions {...props} asset={asset} assignment={assignment} />
              </footer>
            </article>
          );
        })}
      </div>
    </div>
  );
};
