import { useMemo } from 'react';
import { Asset, Site } from '../types';

type Props = {
  assets: Asset[];
  sites: Site[];
  onAddSite: () => void;
};

const DAY_MS = 1000 * 60 * 60 * 24;

export const RegionalAlerts = ({ assets, sites, onAddSite }: Props) => {
  const { critical, overdue, dueNow, siteAlerts } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let critical = 0;
    let overdue = 0;
    let dueNow = 0;

    type SiteBucket = { critical: number; overdue: number; dueNow: number };
    const siteMap: Record<string, SiteBucket> = {};

    for (const asset of assets) {
      if (!asset.nextCalibrationDue) continue;

      const dueDate = new Date(asset.nextCalibrationDue);
      dueDate.setHours(0, 0, 0, 0);
      const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / DAY_MS);

      let bucket: keyof SiteBucket | null = null;

      if (daysOverdue >= 90) {
        critical++;
        bucket = 'critical';
      } else if (daysOverdue >= 30) {
        overdue++;
        bucket = 'overdue';
      } else if (daysOverdue >= -30) {
        dueNow++;
        bucket = 'dueNow';
      }

      if (bucket) {
        if (!siteMap[asset.siteId]) {
          siteMap[asset.siteId] = { critical: 0, overdue: 0, dueNow: 0 };
        }
        siteMap[asset.siteId][bucket]++;
      }
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
          total: counts.critical + counts.overdue + counts.dueNow,
        };
      })
      .filter((s) => s.total > 0)
      .sort((a, b) => b.critical - a.critical || b.total - a.total);

    return { critical, overdue, dueNow, siteAlerts };
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
          <h2>{critical}</h2>
          <p>Critical</p>
          <span>90+ days overdue</span>
        </div>
        <div className="alert-card overdue">
          <h2>{overdue}</h2>
          <p>Overdue</p>
          <span>30–90 days overdue</span>
        </div>
        <div className="alert-card due-now">
          <h2>{dueNow}</h2>
          <p>Due Now</p>
          <span>Within 30-day window</span>
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
                {s.dueNow > 0 && (
                  <span className="badge warning">{s.dueNow} due now</span>
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
