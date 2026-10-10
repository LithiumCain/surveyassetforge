import { CalibrationStatus } from '../types/asset.js';

export const isoDate = (value: Date): string => value.toISOString().slice(0, 10);

// Latest calibration date the API accepts: tomorrow, in UTC. A calibration can't
// have happened in the future, and a future date parks the asset at "ok" until
// long after it is genuinely due — a year typo (2027 for 2026) hid an overdue
// instrument for twelve months. One day of grace because a technician's local
// calendar runs up to a day ahead of UTC (UTC+14 at the extreme), so their
// "today" can already be tomorrow on the server.
export const latestAllowedCalibrationDate = (): string => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 1);
  return isoDate(d);
};

// Returns a user-facing message when the date is unacceptable, null when fine.
// YYYY-MM-DD strings compare correctly as plain strings.
export const futureCalibrationDateError = (value: string | null | undefined): string | null =>
  value && value.slice(0, 10) > latestAllowedCalibrationDate()
    ? `Calibration date ${value.slice(0, 10)} is in the future. Enter the date the calibration was actually performed.`
    : null;

const normalizeDateInput = (value: string): string => value.slice(0, 10);

export const computeNextCalibrationDue = (
  lastCalibrationDate: string | null,
  intervalDays: number,
): string | null => {
  if (!lastCalibrationDate) {
    return null;
  }

  const date = new Date(lastCalibrationDate);
  date.setUTCDate(date.getUTCDate() + intervalDays);
  return isoDate(date);
};

export const computeCalibrationStatus = (
  nextCalibrationDue: string | null,
): CalibrationStatus => {
  if (!nextCalibrationDue) {
    return 'never_calibrated';
  }

  const today = new Date();
  const dueDate = new Date(`${nextCalibrationDue}T00:00:00.000Z`);
  const diffMs = dueDate.getTime() - Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const daysUntilDue = Math.floor(diffMs / 86400000);

  if (daysUntilDue < 0) {
    return 'overdue';
  }

  if (daysUntilDue < 21) {
    return 'due_soon';
  }

  if (daysUntilDue <= 30) {
    return 'warning';
  }

  return 'ok';
};

export const computeCurrentValue = (cost: number, acquiredDate: string | null): number => {
  if (!acquiredDate) {
    return 0;
  }

  const today = new Date();
  const acquired = new Date(`${normalizeDateInput(acquiredDate)}T00:00:00.000Z`);
  if (Number.isNaN(acquired.getTime())) {
    return 0;
  }
  const daysInService = Math.max(0, Math.floor((today.getTime() - acquired.getTime()) / 86400000));
  const dailyDeprRate = cost / 1095;
  const currentValue = cost - dailyDeprRate * daysInService;
  return Math.max(0, Number(currentValue.toFixed(2)));
};

export const shouldRecommendReplacement = (
  estimatedRepairCost: number,
  replacementCost: number,
  threshold = 0.7,
): boolean => {
  if (replacementCost <= 0) {
    return false;
  }
  return estimatedRepairCost > replacementCost * threshold;
};
