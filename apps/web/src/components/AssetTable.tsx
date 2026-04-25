import { Asset, AssetAssignment, User } from '../types';

type Props = {
  assets: Asset[];
  user: User;
  activeAssignments: Record<string, AssetAssignment>;
  onEdit: (asset: Asset) => void;
  onDelete: (asset: Asset) => void;
  onAssign: (asset: Asset) => void;
  onCheckIn: (asset: Asset) => void;
  onViewHistory: (asset: Asset) => void;
};

export const AssetTable = ({
  assets,
  user,
  activeAssignments,
  onEdit,
  onDelete,
  onAssign,
  onCheckIn,
  onViewHistory,
}: Props) => {
  return (
    <div className="card">
      <div className="table-wrap">
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
              <th>Next Due</th>
              <th>Subscription End</th>
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
                <td colSpan={14} style={{ textAlign: 'center', color: 'var(--muted)', padding: '32px' }}>
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
                  <td>{asset.siteName}</td>
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
                    <span className={`badge ${asset.calibrationStatus}`}>
                      {asset.calibrationStatus.replace('_', ' ')}
                    </span>
                  </td>
                  <td>{asset.nextCalibrationDue ?? '—'}</td>
                  <td>{asset.subscriptionEndDate ?? '—'}</td>
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
                  <td>${Number(asset.currentValue ?? 0).toLocaleString()}</td>
                  <td>
                    <div className="row-actions">
                      {/* History */}
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

                      {/* Check out / check in */}
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

                      {/* Edit */}
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

                      {/* Delete */}
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
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
