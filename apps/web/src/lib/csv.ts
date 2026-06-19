import { Asset } from '../types';

const COLUMNS: [string, (a: Asset) => string | number | null][] = [
  ['Asset #', (a) => a.assetNumber],
  ['Item', (a) => a.itemName],
  ['Manufacturer', (a) => a.manufacturer],
  ['Site', (a) => a.siteName],
  ['Type', (a) => a.equipmentType],
  ['Ownership', (a) => a.ownership],
  ['Calibration', (a) => a.calibrationStatus],
  ['Next Due', (a) => a.nextCalibrationDue],
  ['Last Calibrated', (a) => a.lastCalibrationDate],
  ['Damage', (a) => a.damageStatus],
  ['Cost', (a) => a.cost],
  ['Current Value', (a) => a.currentValue],
  ['Serial #', (a) => a.serialNumber],
];

const escapeCell = (value: unknown): string => {
  const s = value === null || value === undefined ? '' : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

// Build a CSV from the given assets and trigger a browser download.
export const exportAssetsCsv = (rows: Asset[]): void => {
  const header = COLUMNS.map((c) => c[0]).join(',');
  const body = rows.map((a) => COLUMNS.map((c) => escapeCell(c[1](a))).join(',')).join('\n');
  const csv = `${header}\n${body}`;

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `saf-assets-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
