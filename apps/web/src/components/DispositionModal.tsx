import { FormEvent, useState } from 'react';
import { apiClient } from '../api/client';
import { useToast } from './Toast';
import { Asset, DispositionStatus } from '../types';

type Props = {
  asset: Asset;
  onDisposed: () => void;
  onClose: () => void;
};

const OPTIONS: { value: DispositionStatus; label: string }[] = [
  { value: 'sold', label: 'Sold' },
  { value: 'lost', label: 'Lost' },
  { value: 'stolen', label: 'Stolen' },
  { value: 'written_off', label: 'Written off' },
];

export const DispositionModal = ({ asset, onDisposed, onClose }: Props) => {
  const toast = useToast();
  const [status, setStatus] = useState<DispositionStatus>('written_off');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await apiClient.disposeAsset(asset.id, { status, notes: notes || null });
      toast.push(`${asset.assetNumber} marked ${status.replace('_', ' ')}`, 'success');
      onDisposed();
    } catch (err) {
      toast.push(err instanceof Error ? err.message : 'Failed to update asset', 'error');
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <div className="modal-header">
          <div>
            <h3>Remove from active fleet</h3>
            <p className="subtle">{asset.assetNumber} — {asset.itemName}</p>
          </div>
        </div>

        <form onSubmit={(e) => void submit(e)} className="form-grid">
          <label>
            Reason
            <select value={status} onChange={(e) => setStatus(e.target.value as DispositionStatus)}>
              {OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>
          <label style={{ gridColumn: '1 / -1' }}>
            Notes
            <input
              placeholder="Optional — buyer, claim #, circumstances, etc."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>

          <p className="subtle" style={{ gridColumn: '1 / -1' }}>
            The record is kept for history — it just leaves the active fleet.
          </p>

          <div className="actions">
            <button type="button" className="secondary-button" onClick={onClose}>Cancel</button>
            <button type="submit" className="danger-button" disabled={saving}>
              {saving ? 'Saving…' : 'Confirm'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
