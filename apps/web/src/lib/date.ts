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
