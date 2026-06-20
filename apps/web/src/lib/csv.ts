import { Asset } from '../types';

const escapeCell = (value: unknown): string => {
  const s = value === null || value === undefined ? '' : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const triggerDownload = (filename: string, csv: string): void => {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

// Generic CSV download from a header row + data rows.
export const downloadCsv = (
  filename: string,
  header: string[],
  rows: (string | number | null)[][],
): void => {
  const csv = [header.join(','), ...rows.map((r) => r.map(escapeCell).join(','))].join('\n');
  triggerDownload(filename, csv);
};

const ASSET_COLUMNS: [string, (a: Asset) => string | number | null][] = [
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

const stamp = () => new Date().toISOString().slice(0, 10);

// Export the given assets as a CSV download.
export const exportAssetsCsv = (rows: Asset[]): void => {
  downloadCsv(
    `saf-assets-${stamp()}.csv`,
    ASSET_COLUMNS.map((c) => c[0]),
    rows.map((a) => ASSET_COLUMNS.map((c) => c[1](a))),
  );
};
