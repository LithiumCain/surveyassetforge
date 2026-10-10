import { useMemo } from 'react';
import { Asset, Site } from '../types';
import { startOfToday } from '../lib/date';
import { AlertBucket, CRITICAL_DAYS_OVERDUE, alertBucketFor } from '../lib/calibrationAlerts';

type Props = {
  assets: Asset[];
  sites: Site[];
  onAddSite: () => void;
};

type Counts = Record<AlertBucket, number>;

const emptyCounts = (): Counts => ({ critical: 0, overdue: 0, upcoming: 0, noRecord: 0 });

export const RegionalAlerts = ({ assets, sites, onAddSite }: Props) => {
  const { totals, siteAlerts } = useMemo(() => {
    const today = startOfToday();
    const totals = emptyCounts();
    const siteMap: Record<string, Counts> = {};

    // Only count gear that lives at an active site (skip inactive sites + inventory).
    const activeSiteIds = new Set(sites.filter((s) => s.status !== 'inactive').map((s) => s.id));

    for (const asset of assets) {
      if (!asset.siteId || !activeSiteIds.has(asset.siteId)) continue;

      const bucket = alertBucketFor(asset, today);
      if (!bucket) continue;

      totals[bucket]++;
      (siteMap[asset.siteId] ??= emptyCounts())[bucket]++;
    }

    const siteAlerts = Object.entries(siteMap)
      .map(([siteId, counts]) => {
        const site = sites.find((s) => s.id === siteId);
        return {
          siteId,
          siteCode: site?.code ?? siteId,
          siteName: site?.name ?? 'Unknown',
          city: site?.city ?? null,
          state: site?.state ?? null,
          ...counts,
          total: counts.critical + counts.overdue + counts.upcoming + counts.noRecord,
        };
      })
      .sort(
        (a, b) =>
          b.critical - a.critical || b.overdue - a.overdue || b.total - a.total,
      );

    return { totals, siteAlerts };
  }, [assets, sites]);

  return (
    <section className="card regional-alerts">
      <div className="section-heading">
        <div>
          <h3>Fleet Alerts</h3>
          <p>Calibration urgency across all active sites.</p>
        </div>
        <button onClick={onAddSite}>+ Add Site</button>
      </div>

      <div className="alert-grid">
        <div className="alert-card critical">
          <h2>{totals.critical}</h2>
          <p>Critical</p>
          <span>{CRITICAL_DAYS_OVERDUE}+ days overdue</span>
        </div>
        <div className="alert-card overdue">
          <h2>{totals.overdue}</h2>
          <p>Overdue</p>
          <span>1–{CRITICAL_DAYS_OVERDUE - 1} days overdue</span>
        </div>
        <div className="alert-card due-now">
          <h2>{totals.upcoming}</h2>
          <p>Upcoming</p>
          <span>Due within 30 days</span>
        </div>
        <div className="alert-card no-record">
          <h2>{totals.noRecord}</h2>
          <p>No Record</p>
          <span>Never calibrated</span>
        </div>
      </div>

      {siteAlerts.length > 0 ? (
        <div className="sites-issues">
          <div className="location-meta" style={{ marginBottom: 8 }}>
            <strong>{siteAlerts.length}</strong>
            <span>sites need attention</span>
          </div>
          {siteAlerts.map((s) => (
            <div key={s.siteId} className="site-issue-row">
              <div className="site-info">
                <span className="site-code">
                  {s.siteCode} — {s.siteName}
                </span>
                {(s.city || s.state) && (
                  <span className="site-location">
                    {[s.city, s.state].filter(Boolean).join(', ')}
                  </span>
                )}
              </div>
              <div className="issue-badges">
                {s.critical > 0 && (
                  <span className="badge overdue">{s.critical} critical</span>
                )}
                {s.overdue > 0 && (
                  <span className="badge due_soon">{s.overdue} overdue</span>
                )}
                {s.upcoming > 0 && (
                  <span className="badge warning">{s.upcoming} upcoming</span>
                )}
                {s.noRecord > 0 && (
                  <span className="badge never_calibrated">{s.noRecord} no record</span>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="subtle">No calibration issues detected across active sites.</p>
      )}
    </section>
  );
};
