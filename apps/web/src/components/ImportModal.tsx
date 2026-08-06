import { useCallback, useMemo, useRef, useState } from 'react';
import { apiClient } from '../api/client';
import { parseWorkbook, type ParsedWorkbook } from '../lib/workbook';
import { useModalDismiss } from '../lib/useModalDismiss';
import { useToast } from './Toast';

type Props = {
  onImported: () => void;
  onClose: () => void;
};

type Phase = 'pick' | 'parsing' | 'preview' | 'importing';

export const ImportModal = ({ onImported, onClose }: Props) => {
  const [phase, setPhase] = useState<Phase>('pick');
  const [fileName, setFileName] = useState<string>('');
  const [parsed, setParsed] = useState<ParsedWorkbook | null>(null);
  const [includePurchases, setIncludePurchases] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const toast = useToast();

  // Escape closes — except mid-import, where abandoning the modal would leave the
  // remaining chunks unsent with no way to tell what landed.
  useModalDismiss(useCallback(() => {
    if (phase !== 'importing') onClose();
  }, [phase, onClose]));

  const perSite = useMemo(() => {
    if (!parsed) return [];
    const counts = new Map<string, number>();
    for (const a of parsed.assets) {
      if (a.siteCode) counts.set(a.siteCode, (counts.get(a.siteCode) ?? 0) + 1);
    }
    return parsed.sites
      .map((s) => ({ ...s, count: counts.get(s.code) ?? 0 }))
      .sort((a, b) => b.count - a.count);
  }, [parsed]);

  const handleFile = async (file: File) => {
    setError(null);
    setFileName(file.name);
    setPhase('parsing');
    try {
      const result = await parseWorkbook(file);
      if (result.sites.length === 0) {
        setError(
          'No site sheets found. Site tabs must be named like "0247_Atlas IV" (site code, underscore, site name).',
        );
        setPhase('pick');
        return;
      }
      if (result.assets.length === 0 && result.purchases.length === 0) {
        setError('Found site sheets but no asset rows.');
        setPhase('pick');
        return;
      }
      setParsed(result);
      setPhase('preview');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read that file.');
      setPhase('pick');
    }
  };

  const totalToImport = (parsed?.assets.length ?? 0) + (includePurchases ? parsed?.purchases.length ?? 0 : 0);

  const handleImport = async () => {
    if (!parsed) return;
    setPhase('importing');
    setError(null);
    try {
      const result = await apiClient.importWorkbook({
        sites: parsed.sites,
        assets: includePurchases ? [...parsed.assets, ...parsed.purchases] : parsed.assets,
      });
      toast.push(
        `Imported ${result.created} asset${result.created !== 1 ? 's' : ''} across ${result.sites} site${result.sites !== 1 ? 's' : ''}` +
          (result.skipped > 0 ? ` (${result.skipped} already existed)` : ''),
        'success',
      );
      onImported();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed.');
      setPhase('preview');
    }
  };

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget && phase !== 'importing') onClose(); }}>
      <div className="modal modal-wide">
        <div className="modal-header">
          <div>
            <h3>Import workbook</h3>
            <p className="subtle">
              Bring sites and assets in from your Survey Asset Tracker spreadsheet (.xlsx).
            </p>
          </div>
        </div>

        {(phase === 'pick' || phase === 'parsing') && (
          <div className="import-drop">
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xlsm,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              style={{ display: 'none' }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleFile(file);
              }}
            />
            <p className="subtle" style={{ marginBottom: 12 }}>
              Each site tab (named like <strong>0247_Atlas IV</strong>) becomes a site; every row
              with an Asset Number becomes an asset. Re-importing skips gear that already exists,
              so it&apos;s always safe to run.
            </p>
            <button type="button" disabled={phase === 'parsing'} onClick={() => fileRef.current?.click()}>
              {phase === 'parsing' ? `Reading ${fileName}…` : 'Choose workbook file'}
            </button>
          </div>
        )}

        {(phase === 'preview' || phase === 'importing') && parsed && (
          <>
            <div className="import-summary">
              <div><strong>{parsed.sites.length}</strong><span>sites</span></div>
              <div><strong>{parsed.assets.length}</strong><span>site assets</span></div>
              <div><strong>{parsed.purchases.length}</strong><span>purchase items</span></div>
            </div>
            {parsed.purchases.length > 0 && (
              <label className="import-toggle">
                <input
                  type="checkbox"
                  checked={includePurchases}
                  onChange={(e) => setIncludePurchases(e.target.checked)}
                />
                <span>
                  Include the purchase-list items — gear naming a known site goes to that site,
                  the rest lands in <strong>Inventory</strong>.
                </span>
              </label>
            )}
            {parsed.autoNumbered > 0 && (
              <p className="subtle">
                {parsed.autoNumbered} rows had no Asset Number in the workbook — they&apos;ll be
                imported with generated numbers (site code + row, e.g.{' '}
                <strong>{parsed.sites[0]?.code}-A012</strong>) so nothing gets left behind.
                {parsed.duplicates > 0 &&
                  ` ${parsed.duplicates} duplicate asset number${parsed.duplicates !== 1 ? 's' : ''} (listed on two sheets) will keep their first sheet only.`}
              </p>
            )}
            <div className="import-sites">
              {perSite.map((s) => (
                <div key={s.code} className="import-site-row">
                  <span className="site-code">{s.code} — {s.name}</span>
                  <span className="subtle">{s.count} asset{s.count !== 1 ? 's' : ''}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {error && <p className="error">{error}</p>}

        <div className="actions" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="secondary-button" disabled={phase === 'importing'} onClick={onClose}>
            Cancel
          </button>
          {(phase === 'preview' || phase === 'importing') && (
            <button type="button" disabled={phase === 'importing'} onClick={() => void handleImport()}>
              {phase === 'importing' ? 'Importing…' : `Import ${totalToImport} assets`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
