// The API sends calendar dates two ways: bare "2026-08-06" and, for Prisma
// @db.Date columns, "2026-08-06T00:00:00.000Z". Both parse as UTC midnight, so
// `new Date(iso).toLocaleDateString()` renders the previous day everywhere west
// of Greenwich. Pin them to local midnight instead — these are calendar dates,
// not instants, and should read the same in every timezone.
export const parseDateOnly = (iso: string): Date => new Date(`${iso.slice(0, 10)}T00:00:00`);

export const formatDateOnly = (iso: string | null | undefined): string =>
  iso
    ? parseDateOnly(iso).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : '—';

export const startOfToday = (): Date => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

// Today's date on the user's own calendar, as YYYY-MM-DD. Not
// `new Date().toISOString().slice(0, 10)` — that is the UTC date, which in the
// evening west of Greenwich is already tomorrow (pre-filling a future
// calibration date) and in the morning east of it is still yesterday (so a date
// picker capped at it refuses today).
export const localIsoDate = (d: Date = new Date()): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
