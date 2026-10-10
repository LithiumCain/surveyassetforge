import { Asset } from '../types';
import { parseDateOnly } from './date';

// Which Fleet Alerts card an asset belongs on, or null for none.
//
// Driven by the API's calibrationStatus — the same value the badges on every
// asset row show — so the alert cards and the asset list can never disagree
// about whether something is overdue. Days overdue only splits "overdue" into
// overdue and critical.
//
// Previously the cards bucketed on raw day counts: anything 1–29 days past due
// landed under "Due Now", next to gear that was not due for another month.
export type AlertBucket = 'critical' | 'overdue' | 'upcoming' | 'noRecord';

export const CRITICAL_DAYS_OVERDUE = 90;

// Types that are tracked as assets but never sent out for calibration. A missing
// calibration record on these is expected, not a gap to flag.
const NOT_CALIBRATED_TYPES = new Set(['software', 'accessory', 'computer']);

const DAY_MS = 86_400_000;

// Whole calendar days since the epoch for a local date. Subtracting two
// getTime() values instead is off by an hour across a DST change, which
// Math.floor turns into a whole day.
const dayNumber = (d: Date): number =>
  Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DAY_MS);

export const daysOverdue = (nextCalibrationDue: string, today: Date): number =>
  dayNumber(today) - dayNumber(parseDateOnly(nextCalibrationDue));

export const alertBucketFor = (
  asset: Pick<Asset, 'calibrationStatus' | 'nextCalibrationDue' | 'equipmentType'>,
  today: Date,
): AlertBucket | null => {
  switch (asset.calibrationStatus) {
    case 'overdue': {
      const days = asset.nextCalibrationDue ? daysOverdue(asset.nextCalibrationDue, today) : 0;
      return days >= CRITICAL_DAYS_OVERDUE ? 'critical' : 'overdue';
    }
    case 'due_soon':
    case 'warning':
      return 'upcoming';
    case 'never_calibrated':
      return NOT_CALIBRATED_TYPES.has(asset.equipmentType.trim().toLowerCase()) ? null : 'noRecord';
    default:
      return null;
  }
};
