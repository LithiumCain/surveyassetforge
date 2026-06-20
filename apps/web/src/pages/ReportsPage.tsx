import { useEffect, useMemo, useState } from 'react';
import { apiClient } from '../api/client';
import { downloadCsv } from '../lib/csv';
import { TopBar, type Tab } from '../components/TopBar';
import { useToast } from '../components/Toast';
import { Asset, Site, User } from '../types';

type Props = {
  user: User;
  onTab: (tab: Tab) => void;
};

const DAY_MS = 1000 * 60 * 60 * 24;
const EOL_DAYS = 1095; // 36 months, straight-line depreciation horizon
const APPROACHING_DAYS = 900; // ~30 months — start flagging for replacement

const money = (n: number) => `$${Math.round(n).toLocaleString()}`;
const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

const daysInService = (acquired: string | null): number | null =>
  acquired ? Math.floor((Date.now() - new Date(acquired).getTime()) / DAY_MS) : null;

export const ReportsPage = ({ user, onTab }: Props) => {
  const toast = useToast();
  const [sites, setSites] = useState<Site[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([apiClient.getSites(), apiClient.getAssets()])
      .then(([s, a]) => {
        setSites(s);
        setAssets(a);
      })
      .catch((e) => toast.push(e instanceof Error ? e.message : 'Failed to load reports', 'error'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const summary = useMemo(
    () => ({
      total: assets.length,
      totalCost: assets.reduce((s, a) => s + Number(a.cost ?? 0), 0),
      totalValue: assets.reduce((s, a) => s + Number(a.currentValue ?? 0), 0),
      overdue: assets.filter((a) => a.calibrationStatus === 'overdue').length,
      dueSoon: assets.filter((a) => a.calibrationStatus === 'due_soon' || a.calibrationStatus === 'warning').length,
    }),
    [assets],
  );

  const siteRows = useMemo(() => {
    const groups = new Map<string, { name: string; assets: Asset[] }>();
    for (const s of sites) groups.set(s.id, { name: `${s.code} — ${s.name}`, assets: [] });
    const inventory: Asset[] = [];
    for (const a of assets) {
      if (a.siteId && groups.has(a.siteId)) groups.get(a.siteId)!.assets.push(a);
      else inventory.push(a);
    }
    const rows = [...groups.values()].map((g) => ({
      name: g.name,
      count: g.assets.length,
      overdue: g.assets.filter((a) => a.calibrationStatus === 'overdue').length,
      dueSoon: g.assets.filter((a) => a.calibrationStatus === 'due_soon' || a.calibrationStatus === 'warning').length,
      value: g.assets.reduce((s, a) => s + Number(a.currentValue ?? 0), 0),
    }));
    if (inventory.length) {
      rows.push({
        name: 'Inventory (unassigned)',
        count: inventory.length,
        overdue: inventory.filter((a) => a.calibrationStatus === 'overdue').length,
        dueSoon: inventory.filter((a) => a.calibrationStatus === 'due_soon' || a.calibrationStatus === 'warning').length,
        value: inventory.reduce((s, a) => s + Number(a.currentValue ?? 0), 0),
      });
    }
    return rows.filter((r) => r.count > 0).sort((x, y) => y.count - x.count);
  }, [sites, assets]);

  const eolRows = useMemo(() => {
    return assets
      .map((a) => ({ asset: a, days: daysInService(a.acquiredDate) }))
      .filter((r): r is { asset: Asset; days: number } => r.days !== null && r.days >= APPROACHING_DAYS)
      .map((r) => {
        const months = Math.floor(r.days / 30.44);
        const eol = new Date(new Date(r.asset.acquiredDate as string).getTime() + EOL_DAYS * DAY_MS);
        return {
          asset: r.asset,
          months,
          past: r.days >= EOL_DAYS,
          eolDate: eol.toISOString().slice(0, 10),
        };
      })
      .sort((x, y) => y.months - x.months);
  }, [assets]);

  const exportSiteReport = () => {
    downloadCsv(
      `saf-site-report-${new Date().toISOString().slice(0, 10)}.csv`,
      ['Site', 'Assets', 'Overdue', 'Due Soon', 'Total Value'],
      siteRows.map((r) => [r.name, r.count, r.overdue, r.dueSoon, Math.round(r.value)]),
    );
    toast.push('Site report exported', 'success');
  };

  const exportEolReport = () => {
    downloadCsv(
      `saf-eol-report-${new Date().toISOString().slice(0, 10)}.csv`,
      ['Asset #', 'Item', 'Site', 'Acquired', 'Months In Service', 'Status', 'Current Value'],
      eolRows.map((r) => [
        r.asset.assetNumber,
        r.asset.itemName,
        r.asset.siteName ?? 'Inventory',
        r.asset.acquiredDate,
        r.months,
        r.past ? 'Past EOL' : 'Approaching',
        Math.round(Number(r.asset.currentValue ?? 0)),
      ]),
    );
    toast.push('End-of-life report exported', 'success');
  };

  return (
    <main className="layout">
      <TopBar user={user} tab="reports" onTab={onTab} />

      {loading ? (
        <section className="card">
          <p>Loading reports…</p>
        </section>
      ) : (
        <>
          <section className="summary-grid">
            <article className="card"><h2>{summary.total}</h2><p>Total Assets</p></article>
            <article className="card"><h2>{summary.overdue}</h2><p>Overdue Calibration</p></article>
            <article className="card"><h2>{summary.dueSoon}</h2><p>Due Soon</p></article>
            <article className="card"><h2>{siteRows.length}</h2><p>Active Locations</p></article>
            <article className="card"><h2>{money(summary.totalCost)}</h2><p>Total Cost</p></article>
            <article className="card"><h2>{money(summary.totalValue)}</h2><p>Current Value</p></article>
          </section>

          <section className="card">
            <div className="section-heading">
              <div>
                <h3>Per-Site Report</h3>
                <p>Equipment count, calibration exposure, and fleet value by location.</p>
              </div>
              <button onClick={exportSiteReport}>Export CSV</button>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Location</th><th>Assets</th><th>Overdue</th><th>Due Soon</th><th>Current Value</th></tr>
                </thead>
                <tbody>
                  {siteRows.map((r) => (
                    <tr key={r.name}>
                      <td>{r.name}</td>
                      <td>{r.count}</td>
                      <td>{r.overdue > 0 ? <span className="badge overdue">{r.overdue}</span> : '—'}</td>
                      <td>{r.dueSoon > 0 ? <span className="badge warning">{r.dueSoon}</span> : '—'}</td>
                      <td>{money(r.value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="card">
            <div className="section-heading">
              <div>
                <h3>End-of-Life Report (36 months)</h3>
                <p>Assets at or approaching their 36-month depreciation horizon — candidates to replace.</p>
              </div>
              <button onClick={exportEolReport} disabled={eolRows.length === 0}>Export CSV</button>
            </div>
            {eolRows.length === 0 ? (
              <p className="subtle">No assets are near end-of-life yet.</p>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr><th>Asset #</th><th>Item</th><th>Site</th><th>Acquired</th><th>In Service</th><th>Status</th><th>Current Value</th></tr>
                  </thead>
                  <tbody>
                    {eolRows.map((r) => (
                      <tr key={r.asset.id}>
                        <td>{r.asset.assetNumber}</td>
                        <td>{r.asset.itemName}</td>
                        <td>{r.asset.siteName ?? 'Inventory'}</td>
                        <td>{fmtDate(r.asset.acquiredDate)}</td>
                        <td>{r.months} mo</td>
                        <td>
                          <span className={`badge ${r.past ? 'overdue' : 'warning'}`}>
                            {r.past ? 'Past EOL' : 'Approaching'}
                          </span>
                        </td>
                        <td>{money(Number(r.asset.currentValue ?? 0))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
};
