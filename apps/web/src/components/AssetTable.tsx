import { Asset, User } from '../types';

type Props = {
  assets: Asset[];
  user: User;
  onEdit: (asset: Asset) => void;
  onDelete: (asset: Asset) => void;
};

export const AssetTable = ({ assets, user, onEdit, onDelete }: Props) => {
  return (
    <div className="card">
      <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Asset #</th>
            <th>Date</th>
            <th>Item</th>
            <th>Manufacturer</th>
            <th>Site</th>
            <th>Ownership</th>
            <th>Calibration</th>
            <th>Next Due</th>
            <th>Subscription End</th>
            <th>Firmware</th>
            <th>Part #</th>
            <th>Serial #</th>
            <th>Notes</th>
            <th>Damage</th>
            <th>Current Value</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {assets.length === 0 && (
            <tr>
              <td colSpan={15}>No assets found for this location.</td>
            </tr>
          )}
          {assets.map((asset) => (
            <tr key={asset.id}>
              <td>{asset.assetNumber}</td>
              <td>{asset.acquiredDate ?? 'N/A'}</td>
              <td>{asset.itemName}</td>
              <td>{asset.manufacturer ?? 'N/A'}</td>
              <td>{asset.siteName}</td>
              <td>{asset.ownership}</td>
              <td><span className={`badge ${asset.calibrationStatus}`}>{asset.calibrationStatus}</span></td>
              <td>{asset.nextCalibrationDue ?? 'N/A'}</td>
              <td>{asset.subscriptionEndDate ?? 'N/A'}</td>
              <td>{asset.firmwareVersion ?? 'N/A'} {asset.firmwareOutdated ? '(Outdated)' : ''}</td>
              <td>{asset.partNumber ?? 'N/A'}</td>
              <td>{asset.serialNumber ?? 'N/A'}</td>
              <td>{asset.assetNotes ?? 'N/A'}</td>
              <td>{asset.damageStatus}</td>
              <td>${Number(asset.currentValue ?? 0).toLocaleString()}</td>
              <td>
                <div className="row-actions">
                  <button
                    className="icon-action edit"
                    onClick={() => onEdit(asset)}
                    type="button"
                    aria-label={`Edit ${asset.assetNumber}`}
                      title="Edit asset"
                    >
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path
                          d="M4 20h4l10-10-4-4L4 16v4Z"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path
                          d="m12.5 7.5 4 4"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                        />
                      </svg>
                    </button>
                  {user.role === 'super_admin' && (
                    <button
                      className="icon-action delete"
                      onClick={() => onDelete(asset)}
                      type="button"
                      aria-label={`Delete ${asset.assetNumber}`}
                      title="Delete asset"
                    >
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path
                          d="M5 7h14"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                        />
                        <path
                          d="M9 7V5.8c0-.44.36-.8.8-.8h4.4c.44 0 .8.36.8.8V7"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M8 7l.7 10.2c.03.46.42.8.88.8h4.84c.46 0 .85-.34.88-.8L16 7"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M10.5 10.2v4.8M13.5 10.2v4.8"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                        />
                      </svg>
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
};
