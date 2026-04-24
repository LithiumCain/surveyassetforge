import { FormEvent, useMemo, useState } from 'react';
import { Asset, AssetPayload, Site, User } from '../types';

type Props = {
  sites: Site[];
  user: User;
  initial?: Asset;
  onSubmit: (payload: AssetPayload) => Promise<void>;
  onCancel: () => void;
};

const today = new Date().toISOString().slice(0, 10);

const toNullable = (value: string): string | null => {
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

export const AssetForm = ({ sites, user, initial, onSubmit, onCancel }: Props) => {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const defaultSiteId = user.role === 'site_supervisor' ? user.siteId ?? '' : sites[0]?.id ?? '';

  const [form, setForm] = useState({
    assetNumber: initial?.assetNumber ?? '',
    partNumber: initial?.partNumber ?? '',
    serialNumber: initial?.serialNumber ?? '',
    itemName: initial?.itemName ?? '',
    manufacturer: initial?.manufacturer ?? '',
    equipmentType: initial?.equipmentType ?? 'GNSS',
    siteId: initial?.siteId ?? defaultSiteId,
    ownership: initial?.ownership ?? 'unknown',
    assignedName: initial?.assignedName ?? '',
    employeeNumber: initial?.employeeNumber ?? '',
    vendor: initial?.vendor ?? '',
    firmwareVersion: initial?.firmwareVersion ?? '',
    latestFirmwareVersion: initial?.latestFirmwareVersion ?? '',
    subscriptionEndDate: initial?.subscriptionEndDate ?? '',
    lastCalibrationDate: initial?.lastCalibrationDate ?? '',
    calibrationIntervalDays: initial?.calibrationIntervalDays ?? 30,
    damageStatus: initial?.damageStatus ?? 'ok',
    damageType: initial?.damageType ?? '',
    assetNotes: initial?.assetNotes ?? '',
    repairNotes: initial?.repairNotes ?? '',
    estimatedRepairCost: initial?.estimatedRepairCost ?? 0,
    cost: initial?.cost ?? 0,
    replacementCost: initial?.replacementCost ?? 0,
    acquiredDate: initial?.acquiredDate ?? '',
  });

  const siteOptions = useMemo(() => {
    if (user.role === 'site_supervisor') {
      return sites.filter((site) => site.id === user.siteId);
    }
    return sites;
  }, [sites, user.role, user.siteId]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      await onSubmit({
        assetNumber: form.assetNumber,
        partNumber: toNullable(form.partNumber),
        serialNumber: toNullable(form.serialNumber),
        itemName: form.itemName,
        manufacturer: toNullable(form.manufacturer),
        equipmentType: form.equipmentType,
        siteId: form.siteId,
        ownership: form.ownership as AssetPayload['ownership'],
        assignedName: toNullable(form.assignedName),
        employeeNumber: toNullable(form.employeeNumber),
        vendor: toNullable(form.vendor),
        firmwareVersion: toNullable(form.firmwareVersion),
        latestFirmwareVersion: toNullable(form.latestFirmwareVersion),
        subscriptionEndDate: toNullable(form.subscriptionEndDate),
        lastCalibrationDate: toNullable(form.lastCalibrationDate),
        calibrationIntervalDays: Number(form.calibrationIntervalDays),
        damageStatus: form.damageStatus as AssetPayload['damageStatus'],
        damageType: toNullable(form.damageType),
        assetNotes: toNullable(form.assetNotes),
        repairNotes: toNullable(form.repairNotes),
        estimatedRepairCost: Number(form.estimatedRepairCost),
        cost: Number(form.cost),
        replacementCost: Number(form.replacementCost),
        acquiredDate: toNullable(form.acquiredDate),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save asset');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="card form-grid" onSubmit={submit}>
      <h3>{initial ? 'Edit Asset' : 'Create Asset'}</h3>
      {error && <p className="error">{error}</p>}

      <label>Asset Number<input required value={form.assetNumber} onChange={(e) => setForm({ ...form, assetNumber: e.target.value })} /></label>
      <label>Item Name<input required value={form.itemName} onChange={(e) => setForm({ ...form, itemName: e.target.value })} /></label>
      <label>Manufacturer<input value={form.manufacturer} onChange={(e) => setForm({ ...form, manufacturer: e.target.value })} /></label>
      <label>Equipment Type<input required value={form.equipmentType} onChange={(e) => setForm({ ...form, equipmentType: e.target.value })} /></label>
      <label>Site<select required value={form.siteId} onChange={(e) => setForm({ ...form, siteId: e.target.value })} disabled={user.role === 'site_supervisor'}>{siteOptions.map((site) => <option key={site.id} value={site.id}>{site.name}</option>)}</select></label>
      <label>Ownership<select value={form.ownership} onChange={(e) => setForm({ ...form, ownership: e.target.value as AssetPayload['ownership'] })}><option value="unknown">Unknown</option><option value="owned">Owned</option><option value="rental">Rental</option><option value="rpo">RPO</option></select></label>
      <label>Part Number<input value={form.partNumber} onChange={(e) => setForm({ ...form, partNumber: e.target.value })} /></label>
      <label>Serial Number<input value={form.serialNumber} onChange={(e) => setForm({ ...form, serialNumber: e.target.value })} /></label>
      <label>Firmware<input maxLength={128} value={form.firmwareVersion} onChange={(e) => setForm({ ...form, firmwareVersion: e.target.value })} /></label>
      <label>Latest Firmware<input maxLength={128} value={form.latestFirmwareVersion} onChange={(e) => setForm({ ...form, latestFirmwareVersion: e.target.value })} /></label>
      <label>Subscription End<input type="date" value={form.subscriptionEndDate} onChange={(e) => setForm({ ...form, subscriptionEndDate: e.target.value })} /></label>
      <label>Last Calibration<input type="date" value={form.lastCalibrationDate} onChange={(e) => setForm({ ...form, lastCalibrationDate: e.target.value })} /></label>
      <label>Calibration Interval Days<input type="number" min={1} max={365} value={form.calibrationIntervalDays} onChange={(e) => setForm({ ...form, calibrationIntervalDays: Number(e.target.value) })} /></label>
      <label>Damage Status<select value={form.damageStatus} onChange={(e) => setForm({ ...form, damageStatus: e.target.value as AssetPayload['damageStatus'] })}><option value="ok">OK</option><option value="reported">Reported</option><option value="under_repair">Under Repair</option></select></label>
      <label>Damage Type<input value={form.damageType} onChange={(e) => setForm({ ...form, damageType: e.target.value })} /></label>
      <label>Asset Notes<input value={form.assetNotes} onChange={(e) => setForm({ ...form, assetNotes: e.target.value })} /></label>
      <label>Repair Notes<input value={form.repairNotes} onChange={(e) => setForm({ ...form, repairNotes: e.target.value })} /></label>
      <label>Cost<input type="number" min={0} step="0.01" value={form.cost} onChange={(e) => setForm({ ...form, cost: Number(e.target.value) })} /></label>
      <label>Replacement Cost<input type="number" min={0} step="0.01" value={form.replacementCost} onChange={(e) => setForm({ ...form, replacementCost: Number(e.target.value) })} /></label>
      <label>Estimated Repair Cost<input type="number" min={0} step="0.01" value={form.estimatedRepairCost} onChange={(e) => setForm({ ...form, estimatedRepairCost: Number(e.target.value) })} /></label>
      <label>Acquired Date<input type="date" value={form.acquiredDate} onChange={(e) => setForm({ ...form, acquiredDate: e.target.value })} /></label>

      <div className="actions">
        <button type="button" onClick={onCancel}>Cancel</button>
        <button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save Asset'}</button>
      </div>
    </form>
  );
};
