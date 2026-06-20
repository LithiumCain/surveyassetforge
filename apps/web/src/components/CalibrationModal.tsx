import { FormEvent, useEffect, useState } from 'react';
import { apiClient } from '../api/client';
import { useToast } from './Toast';
import { Asset, CalibrationRecord } from '../types';

type Props = {
  asset: Asset;
  onLogged: () => void;
  onClose: () => void;
};

const today = () => new Date().toISOString().slice(0, 10);

const fmt = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

export const CalibrationModal = ({ asset, onLogged, onClose }: Props) => {
  const toast = useToast();
  const [history, setHistory] = useState<CalibrationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [calibratedDate, setCalibratedDate] = useState(today());
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    apiClient
      .getCalibrations(asset.id)
      .then(setHistory)
      .catch((e) => toast.push(e instanceof Error ? e.message : 'Failed to load calibrations', 'error'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asset.id]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await apiClient.logCalibration(asset.id, { calibratedDate, notes: notes || null });
      toast.push('Calibration logged', 'success');
      setNotes('');
      onLogged(); // refresh the asset list so the new status shows
      load(); // refresh this history
    } catch (err) {
      toast.push(err instanceof Error ? err.message : 'Failed to log calibration', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal modal-wide">
        <div className="modal-header">
          <div>
            <h3>Calibration</h3>
            <p className="subtle">{asset.assetNumber} — {asset.itemName}</p>
          </div>
          <span className={`badge ${asset.calibrationStatus}`}>
            {asset.calibrationStatus.replace('_', ' ')}
          </span>
        </div>

        <form onSubmit={(e) => void submit(e)} className="form-grid">
          <label>
            Calibration Date
            <input
              type="date"
              required
              max={today()}
              value={calibratedDate}
              onChange={(e) => setCalibratedDate(e.target.value)}
            />
          </label>
          <label style={{ gridColumn: '1 / -1' }}>
            Notes
            <input
              placeholder="Optional — technician, certificate #, etc."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>
          <div className="actions">
            <button type="button" className="secondary-button" onClick={onClose}>Close</button>
            <button type="submit" disabled={saving}>
              {saving ? 'Logging…' : 'Log Calibration'}
            </button>
          </div>
        </form>

        <div className="custody-list" style={{ marginTop: 16 }}>
          {loading && <p className="subtle">Loading history…</p>}
          {!loading && history.length === 0 && (
            <p className="subtle">No calibrations logged yet.</p>
          )}
          {!loading &&
            history.map((rec) => {
              const by = rec.calibratedBy
                ? [rec.calibratedBy.firstName, rec.calibratedBy.lastName].filter(Boolean).join(' ') ||
                  rec.calibratedBy.email
                : null;
              return (
                <div key={rec.id} className="custody-row">
                  <div className="custody-assignee">
                    <span className="custody-name">{fmt(rec.calibratedDate)}</span>
                  </div>
                  <div className="custody-meta">
                    {rec.notes && <p className="custody-notes">{rec.notes}</p>}
                    {by && <p className="custody-by">Logged by {by}</p>}
                    {rec.photoUrl && (
                      <a href={rec.photoUrl} target="_blank" rel="noreferrer">View photo</a>
                    )}
                  </div>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
};
