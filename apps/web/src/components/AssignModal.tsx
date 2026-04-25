import { useState } from 'react';
import { apiClient } from '../api/client';
import { Asset, AssignPayload } from '../types';

type Props = {
  asset: Asset;
  onAssigned: () => void;
  onClose: () => void;
};

export const AssignModal = ({ asset, onAssigned, onClose }: Props) => {
  const [form, setForm] = useState<AssignPayload>({
    assignedToName: '',
    assignedToNumber: null,
    notes: null,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (key: keyof AssignPayload, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value || null }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiClient.assignAsset(asset.id, form);
      onAssigned();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to assign asset');
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <div className="modal-header">
          <div>
            <h3>Check Out Asset</h3>
            <p className="subtle">{asset.assetNumber} — {asset.itemName}</p>
          </div>
          <span className={`badge ${asset.calibrationStatus}`}>{asset.calibrationStatus}</span>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="form-grid">
          <label>
            Assigned To
            <input
              required
              placeholder="Full name"
              value={form.assignedToName}
              onChange={(e) => set('assignedToName', e.target.value)}
            />
          </label>
          <label>
            Employee / Badge #
            <input
              placeholder="Optional"
              value={form.assignedToNumber ?? ''}
              onChange={(e) => set('assignedToNumber', e.target.value)}
            />
          </label>
          <label style={{ gridColumn: '1 / -1' }}>
            Notes
            <input
              placeholder="Condition on checkout, project, etc."
              value={form.notes ?? ''}
              onChange={(e) => set('notes', e.target.value)}
            />
          </label>

          {error && <p className="error">{error}</p>}

          <div className="actions">
            <button type="button" className="secondary-button" onClick={onClose}>Cancel</button>
            <button type="submit" disabled={saving}>
              {saving ? 'Checking out…' : 'Confirm Check Out'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
