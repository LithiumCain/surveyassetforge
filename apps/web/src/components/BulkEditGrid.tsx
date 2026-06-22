import { useMemo, useState } from 'react';
import { apiClient } from '../api/client';
import { useToast } from './Toast';
import { Asset, AssetOwnership, AssetPayload, Site } from '../types';

const OWNERSHIP: AssetOwnership[] = ['owned', 'rental', 'rpo', 'unknown'];

// The subset of fields this grid lets you change in bulk.
type RowEdits = Partial<
  Pick<Asset, 'siteId' | 'ownership' | 'calibrationIntervalDays' | 'lastCalibrationDate'>
>;

type Props = {
  assets: Asset[];
  sites: Site[];
  onSaved: () => void;
  onCancel: () => void;
};

// Rebuild the full update payload from an asset. The PUT endpoint expects every
// field, so we echo the asset's current values and overlay the edited ones.
const assetToPayload = (a: Asset): AssetPayload => ({
  assetNumber: a.assetNumber,
  partNumber: a.partNumber,
  serialNumber: a.serialNumber,
  itemName: a.itemName,
  manufacturer: a.manufacturer,
  equipmentType: a.equipmentType,
  siteId: a.siteId,
  ownership: a.ownership,
  assignedName: a.assignedName,
  employeeNumber: a.employeeNumber,
  vendor: a.vendor,
  firmwareVersion: a.firmwareVersion,
  latestFirmwareVersion: a.latestFirmwareVersion,
  subscriptionEndDate: a.subscriptionEndDate,
  lastCalibrationDate: a.lastCalibrationDate,
  calibrationIntervalDays: a.calibrationIntervalDays,
  damageStatus: a.damageStatus,
  damageType: a.damageType,
  assetNotes: a.assetNotes,
  repairNotes: a.repairNotes,
  estimatedRepairCost: a.estimatedRepairCost,
  cost: a.cost,
  replacementCost: a.replacementCost,
  acquiredDate: a.acquiredDate,
});

export const BulkEditGrid = ({ assets, sites, onSaved, onCancel }: Props) => {
  const toast = useToast();
  const [edits, setEdits] = useState<Record<string, RowEdits>>({});
  const [saving, setSaving] = useState(false);

  const setField = <K extends keyof RowEdits>(id: string, field: K, value: RowEdits[K]) => {
    setEdits((prev) => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  };

  // The live value for a cell: an unsaved edit if present, else the original.
  const valueOf = <K extends keyof RowEdits>(a: Asset, field: K): RowEdits[K] =>
    (edits[a.id]?.[field] ?? a[field]) as RowEdits[K];

  // A row is dirty only if an edited field actually differs from the original.
  const isDirty = (a: Asset): boolean => {
    const e = edits[a.id];
    if (!e) return false;
    return (Object.keys(e) as (keyof RowEdits)[]).some((k) => e[k] !== a[k]);
  };

  const dirtyAssets = useMemo(
    () => assets.filter(isDirty),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [assets, edits],
  );

  const save = async () => {
    if (dirtyAssets.length === 0) return;
    setSaving(true);
    const results = await Promise.allSettled(
      dirtyAssets.map((a) =>
        apiClient.updateAsset(a.id, { ...assetToPayload(a), ...edits[a.id] }),
      ),
    );
    const ok = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.length - ok;
    setSaving(false);

    if (failed === 0) {
      toast.push(`Saved ${ok} asset${ok !== 1 ? 's' : ''}`, 'success');
    } else {
      toast.push(`Saved ${ok}, ${failed} failed — try again`, ok ? 'info' : 'error');
    }
    onSaved();
  };

  return (
    <div className="card">
      <div className="bulk-bar">
        <span className="subtle">
          {dirtyAssets.length === 0
            ? 'Edit any cell below — changes are batched until you save.'
            : `${dirtyAssets.length} row${dirtyAssets.length !== 1 ? 's' : ''} changed`}
        </span>
        <div className="actions">
          <button type="button" className="secondary-button" onClick={onCancel} disabled={saving}>
            Cancel
          </button>
          <button type="button" onClick={() => void save()} disabled={saving || dirtyAssets.length === 0}>
            {saving ? 'Saving…' : `Save ${dirtyAssets.length || ''} change${dirtyAssets.length !== 1 ? 's' : ''}`.trim()}
          </button>
        </div>
      </div>

      <div className="table-wrap">
        <table className="bulk-grid">
          <thead>
            <tr>
              <th>Asset #</th>
              <th>Item</th>
              <th>Site</th>
              <th>Ownership</th>
              <th>Cal. Interval (days)</th>
              <th>Last Calibration</th>
            </tr>
          </thead>
          <tbody>
            {assets.length === 0 && (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', color: 'var(--muted)', padding: '32px' }}>
                  No assets in the current view.
                </td>
              </tr>
            )}
            {assets.map((a) => (
              <tr key={a.id} className={isDirty(a) ? 'bulk-dirty' : undefined}>
                <td>{a.assetNumber}</td>
                <td>{a.itemName}</td>
                <td>
                  <select
                    value={valueOf(a, 'siteId') ?? ''}
                    onChange={(e) => setField(a.id, 'siteId', e.target.value)}
                  >
                    {/* Show the current site even if it's outside the filtered list. */}
                    {!sites.some((s) => s.id === a.siteId) && (
                      <option value={a.siteId}>{a.siteName ?? '— current —'}</option>
                    )}
                    {sites.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.code} — {s.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <select
                    value={valueOf(a, 'ownership')}
                    onChange={(e) => setField(a.id, 'ownership', e.target.value as AssetOwnership)}
                  >
                    {OWNERSHIP.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <input
                    type="number"
                    min={1}
                    max={365}
                    value={valueOf(a, 'calibrationIntervalDays')}
                    onChange={(e) =>
                      setField(a.id, 'calibrationIntervalDays', Number(e.target.value))
                    }
                  />
                </td>
                <td>
                  <input
                    type="date"
                    value={valueOf(a, 'lastCalibrationDate') ?? ''}
                    onChange={(e) => setField(a.id, 'lastCalibrationDate', e.target.value || null)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
