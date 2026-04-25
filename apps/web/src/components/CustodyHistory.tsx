import { useEffect, useState } from 'react';
import { apiClient } from '../api/client';
import { Asset, AssetAssignment } from '../types';

type Props = {
  asset: Asset;
  onClose: () => void;
};

const fmt = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

const duration = (outIso: string, inIso: string | null): string => {
  const end = inIso ? new Date(inIso) : new Date();
  const days = Math.floor((end.getTime() - new Date(outIso).getTime()) / (1000 * 60 * 60 * 24));
  if (days === 0) return 'Less than 1 day';
  return `${days} day${days !== 1 ? 's' : ''}`;
};

export const CustodyHistory = ({ asset, onClose }: Props) => {
  const [history, setHistory] = useState<AssetAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiClient
      .getAssetHistory(asset.id)
      .then(setHistory)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load history'))
      .finally(() => setLoading(false));
  }, [asset.id]);

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal modal-wide">
        <div className="modal-header">
          <div>
            <h3>Custody History</h3>
            <p className="subtle">{asset.assetNumber} — {asset.itemName}</p>
          </div>
          <button type="button" className="secondary-button" onClick={onClose}>Close</button>
        </div>

        {loading && <p className="subtle">Loading…</p>}
        {error && <p className="error">{error}</p>}

        {!loading && !error && history.length === 0 && (
          <p className="subtle">No assignment history for this asset.</p>
        )}

        {!loading && history.length > 0 && (
          <div className="custody-list">
            {history.map((entry) => (
              <div key={entry.id} className={`custody-row ${!entry.checkedInAt ? 'custody-row--active' : ''}`}>
                <div className="custody-assignee">
                  <span className="custody-name">{entry.assignedToName}</span>
                  {entry.assignedToNumber && (
                    <span className="custody-number">#{entry.assignedToNumber}</span>
                  )}
                </div>
                <div className="custody-dates">
                  <span>Out: {fmt(entry.checkedOutAt)}</span>
                  {entry.checkedInAt
                    ? <span>In: {fmt(entry.checkedInAt)}</span>
                    : <span className="badge overdue" style={{ fontSize: 10 }}>Checked Out</span>
                  }
                  <span className="custody-duration">{duration(entry.checkedOutAt, entry.checkedInAt)}</span>
                </div>
                <div className="custody-meta">
                  {entry.notes && <p className="custody-notes">{entry.notes}</p>}
                  {entry.assignedBy && (
                    <p className="custody-by">
                      Logged by {entry.assignedBy.firstName
                        ? `${entry.assignedBy.firstName} ${entry.assignedBy.lastName ?? ''}`.trim()
                        : entry.assignedBy.username}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
