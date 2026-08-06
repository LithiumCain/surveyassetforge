import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { apiClient } from '../api/client';
import { exportAssetsCsv } from '../lib/csv';
import { TopBar, type Tab } from '../components/TopBar';
import { AssetForm } from '../components/AssetForm';
import { AssetTable } from '../components/AssetTable';
import { BulkEditGrid } from '../components/BulkEditGrid';
import { AssignModal } from '../components/AssignModal';
import { CalibrationModal } from '../components/CalibrationModal';
import { CreateSiteModal } from '../components/CreateSiteModal';
import { CustodyHistory } from '../components/CustodyHistory';
import { DispositionModal } from '../components/DispositionModal';
import { ImportModal } from '../components/ImportModal';
import { RegionalAlerts } from '../components/RegionalAlerts';
// html5-qrcode is ~334 kB and only needed once someone taps Scan. Loading it on
// demand keeps the initial payload small on a phone over field cellular.
const ScannerModal = lazy(() =>
  import('../components/ScannerModal').then((m) => ({ default: m.ScannerModal })),
);
import { useToast } from '../components/Toast';
import { Asset, AssetAssignment, AssetPayload, Site, User } from '../types';

type Props = {
  user: User;
  onTab: (tab: Tab) => void;
};

// Triage order for "Sort by → Status". Alphabetical order puts overdue below ok,
// which is the opposite of what the sort is for.
const CALIBRATION_RANK: Record<string, number> = {
  overdue: 0,
  due_soon: 1,
  warning: 2,
  never_calibrated: 3,
  ok: 4,
};

export const DashboardPage = ({ user, onTab }: Props) => {
  const [sites, setSites] = useState<Site[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(
    user.role === 'site_supervisor' ? user.siteId : null,
  );
  const [siteSearchTerm, setSiteSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [equipmentFilter, setEquipmentFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('assetNumberAsc');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Asset | undefined>(undefined);
  const [scanInput, setScanInput] = useState('');
  const [scanResult, setScanResult] = useState<Asset | null>(null);
  const [dispositionTarget, setDispositionTarget] = useState<Asset | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [createSiteOpen, setCreateSiteOpen] = useState(false);
  const [activeAssignments, setActiveAssignments] = useState<Record<string, AssetAssignment>>({});
  const [assignTarget, setAssignTarget] = useState<Asset | null>(null);
  const [historyTarget, setHistoryTarget] = useState<Asset | null>(null);
  const [calibrationTarget, setCalibrationTarget] = useState<Asset | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [bulkEdit, setBulkEdit] = useState(false);
  const formAnchorRef = useRef<HTMLDivElement | null>(null);
  const toast = useToast();

  // Mirrors POST /sites, which is super_admin + regional_director only.
  const canManageSites = user.role === 'super_admin' || user.role === 'regional_director';

  const siteCounts = useMemo(() => {
    return assets.reduce<Record<string, number>>((counts, asset) => {
      if (asset.siteId) counts[asset.siteId] = (counts[asset.siteId] ?? 0) + 1;
      return counts;
    }, {});
  }, [assets]);

  const sortedSites = useMemo(() => {
    return [...sites].sort((left, right) => {
      const countDiff = (siteCounts[right.id] ?? 0) - (siteCounts[left.id] ?? 0);
      if (countDiff !== 0) {
        return countDiff;
      }
      return left.name.localeCompare(right.name);
    });
  }, [siteCounts, sites]);

  const populatedSites = useMemo(() => {
    return sortedSites.filter((site) => (siteCounts[site.id] ?? 0) > 0);
  }, [siteCounts, sortedSites]);

  const siteOptions = useMemo(() => {
    const search = siteSearchTerm.trim().toLowerCase();
    if (!search) {
      return sortedSites;
    }

    return sortedSites.filter((site) => {
      return [site.name, site.code].some((value) => value.toLowerCase().includes(search));
    });
  }, [siteSearchTerm, sortedSites]);

  const visibleAssets = useMemo(() => {
    if (!selectedSiteId) {
      return assets;
    }

    return assets.filter((asset) => asset.siteId === selectedSiteId);
  }, [assets, selectedSiteId]);

  const equipmentTypes = useMemo(() => {
    return [...new Set(visibleAssets.map((asset) => asset.equipmentType).filter(Boolean))].sort((left, right) =>
      left.localeCompare(right),
    );
  }, [visibleAssets]);

  // Site + category filters applied, status filter NOT. The KPI tiles set the status
  // filter, so deriving their counts from the status-filtered list would make every
  // other tile collapse to zero the moment one is clicked.
  const scopedAssets = useMemo(
    () =>
      visibleAssets.filter(
        (asset) => equipmentFilter === 'all' || asset.equipmentType === equipmentFilter,
      ),
    [visibleAssets, equipmentFilter],
  );

  const filteredAssets = useMemo(() => {
    const results = scopedAssets.filter((asset) => {
      if (statusFilter !== 'all') {
        const matchesCalibration = asset.calibrationStatus === statusFilter;
        const matchesDamage = asset.damageStatus === statusFilter;
        if (!matchesCalibration && !matchesDamage) {
          return false;
        }
      }

      return true;
    });

    return [...results].sort((left, right) => {
      switch (sortBy) {
        case 'assetNumberDesc':
          return right.assetNumber.localeCompare(left.assetNumber);
        case 'itemNameAsc':
          return left.itemName.localeCompare(right.itemName);
        case 'itemNameDesc':
          return right.itemName.localeCompare(left.itemName);
        case 'statusAsc':
          return (
            (CALIBRATION_RANK[left.calibrationStatus] ?? 99) -
              (CALIBRATION_RANK[right.calibrationStatus] ?? 99) ||
            left.assetNumber.localeCompare(right.assetNumber)
          );
        case 'costDesc':
          return Number(right.cost ?? 0) - Number(left.cost ?? 0);
        case 'costAsc':
          return Number(left.cost ?? 0) - Number(right.cost ?? 0);
        case 'currentValueDesc':
          return Number(right.currentValue ?? 0) - Number(left.currentValue ?? 0);
        case 'currentValueAsc':
          return Number(left.currentValue ?? 0) - Number(right.currentValue ?? 0);
        case 'siteNameAsc':
          return (left.siteName ?? '').localeCompare(right.siteName ?? '') || left.assetNumber.localeCompare(right.assetNumber);
        case 'assetNumberAsc':
        default:
          return left.assetNumber.localeCompare(right.assetNumber);
      }
    });
  }, [scopedAssets, sortBy, statusFilter]);

  const selectedSiteName = useMemo(() => {
    if (!selectedSiteId) {
      return 'All Locations';
    }

    return sites.find((site) => site.id === selectedSiteId)?.name ?? 'Selected Location';
  }, [selectedSiteId, sites]);

  const summary = useMemo(() => {
    return {
      total: scopedAssets.length,
      overdue: scopedAssets.filter((a) => a.calibrationStatus === 'overdue').length,
      dueSoon: scopedAssets.filter((a) => a.calibrationStatus === 'due_soon').length,
      underRepair: scopedAssets.filter((a) => a.damageStatus === 'under_repair').length,
      totalCost: scopedAssets.reduce((sum, a) => sum + Number(a.cost ?? 0), 0),
      currentValue: scopedAssets.reduce((sum, a) => sum + Number(a.currentValue ?? 0), 0),
    };
  }, [scopedAssets]);

  const loadData = async ({ initial = false }: { initial?: boolean } = {}) => {
    // Only blank the table on the very first load. Post-save refreshes keep the
    // current rows on screen instead of flashing "Loading assets…" over them.
    if (initial) setLoading(true);
    setError(null);
    try {
      const [siteRows, assetRows, assignmentRows] = await Promise.all([
        apiClient.getSites(),
        apiClient.getAssets(),
        apiClient.getActiveAssignments(),
      ]);
      setSites(siteRows);
      setAssets(assetRows);
      setActiveAssignments(Object.fromEntries(assignmentRows.map((a) => [a.assetId, a])));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      if (initial) setLoading(false);
    }
  };

  useEffect(() => {
    void loadData({ initial: true });
  }, []);

  // A category chosen at one site may not exist at the next; without this the
  // select renders blank and the table reads "no assets found".
  useEffect(() => {
    if (equipmentFilter !== 'all' && !equipmentTypes.includes(equipmentFilter)) {
      setEquipmentFilter('all');
    }
  }, [equipmentTypes, equipmentFilter]);

  useEffect(() => {
    if (user.role === 'site_supervisor') {
      setSelectedSiteId(user.siteId);
      return;
    }

    if (selectedSiteId && !sites.some((site) => site.id === selectedSiteId)) {
      setSelectedSiteId(null);
    }
  }, [selectedSiteId, sites, user.role, user.siteId]);

  useEffect(() => {
    if (!formOpen) {
      return;
    }

    formAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [formOpen, editing]);

  const handleSave = async (payload: AssetPayload): Promise<void> => {
    const isEdit = Boolean(editing);
    if (editing) {
      await apiClient.updateAsset(editing.id, payload);
    } else {
      await apiClient.createAsset(payload);
    }

    setEditing(undefined);
    setFormOpen(false);
    await loadData();
    toast.push(isEdit ? 'Asset updated' : 'Asset created', 'success');
  };

  const handleEdit = (asset: Asset): void => {
    setEditing(asset);
    setFormOpen(true);
    setActionMessage(`Editing ${asset.assetNumber}`);
  };

  const handleDisposed = async (): Promise<void> => {
    setDispositionTarget(null);
    await loadData();
  };

  const handleCheckIn = async (asset: Asset): Promise<void> => {
    try {
      await apiClient.checkInAsset(asset.id);
      setActiveAssignments((prev) => {
        const next = { ...prev };
        delete next[asset.id];
        return next;
      });
      toast.push(`${asset.assetNumber} checked in`, 'success');
    } catch (err) {
      toast.push(err instanceof Error ? err.message : 'Check-in failed', 'error');
    }
  };

  const handleScanLookup = async (value: string = scanInput): Promise<void> => {
    const query = value.trim();
    if (!query) return;
    try {
      setScanResult(await apiClient.scanAsset(query));
    } catch (err) {
      setScanResult(null);
      toast.push(err instanceof Error ? err.message : 'Asset not found', 'error');
    }
  };

  return (
    <main className="layout">
      <TopBar user={user} tab="dashboard" onTab={onTab}>
        <span className="topbar-viewing">Viewing: {selectedSiteName}</span>
        <button
          onClick={() => {
            exportAssetsCsv(filteredAssets);
            toast.push(
              `Exported ${filteredAssets.length} asset${filteredAssets.length !== 1 ? 's' : ''}`,
              'success',
            );
          }}
        >
          Export CSV
        </button>
        {user.role === 'super_admin' && (
          <button onClick={() => setImportOpen(true)}>Import</button>
        )}
      </TopBar>

      {(user.role === 'super_admin' || user.role === 'regional_director') && (
        <RegionalAlerts
          assets={assets}
          sites={sites}
          onAddSite={() => setCreateSiteOpen(true)}
        />
      )}

      <section className="summary-grid">
        <article className="card kpi" onClick={() => setStatusFilter('all')}>
          <h2>{summary.total}</h2><p>Total Assets</p>
        </article>
        <article
          className={`card kpi clickable${statusFilter === 'overdue' ? ' active' : ''}`}
          onClick={() => setStatusFilter(statusFilter === 'overdue' ? 'all' : 'overdue')}
        >
          <h2>{summary.overdue}</h2><p>Overdue Calibration</p>
        </article>
        <article
          className={`card kpi clickable${statusFilter === 'due_soon' ? ' active' : ''}`}
          onClick={() => setStatusFilter(statusFilter === 'due_soon' ? 'all' : 'due_soon')}
        >
          <h2>{summary.dueSoon}</h2><p>Due Soon</p>
        </article>
        <article
          className={`card kpi clickable${statusFilter === 'under_repair' ? ' active' : ''}`}
          onClick={() => setStatusFilter(statusFilter === 'under_repair' ? 'all' : 'under_repair')}
        >
          <h2>{summary.underRepair}</h2><p>Under Repair</p>
        </article>
        <article className="card kpi"><h2>${Math.round(summary.totalCost).toLocaleString()}</h2><p>Total Cost</p></article>
        <article className="card kpi"><h2>${Math.round(summary.currentValue).toLocaleString()}</h2><p>Current Value</p></article>
      </section>

      <section className="card scan-box">
        <h3>Scan Lookup</h3>
        <p>Scan a barcode or QR code with your camera, or type the asset number.</p>
        {/* A form, so hardware barcode wedges (which type the code then Enter) and the
            phone keyboard's "Go" key both trigger the lookup. */}
        <form
          className="inline-controls"
          onSubmit={(e) => {
            e.preventDefault();
            void handleScanLookup();
          }}
        >
          <input
            value={scanInput}
            onChange={(e) => {
              setScanInput(e.target.value);
              setScanResult(null);
            }}
            placeholder="Asset number"
          />
          <button type="submit">Lookup</button>
          <button type="button" className="secondary-button" onClick={() => setScannerOpen(true)}>Scan</button>
        </form>
        {scanResult && (
          <p className="scan-result">
            Found: <strong>{scanResult.assetNumber}</strong> - {scanResult.itemName} (
            {scanResult.siteName ?? 'Inventory'})
          </p>
        )}
      </section>

      {/* Must come before the empty state: a failed load leaves assets at [], and
          showing "no assets yet" for what is really a network error tells the
          customer their fleet is empty. */}
      {!loading && error && (
        <section className="card empty-state">
          <h3>Couldn&apos;t load your fleet</h3>
          <p className="error">{error}</p>
          <div className="actions" style={{ justifyContent: 'center', marginTop: 14 }}>
            <button onClick={() => void loadData({ initial: true })}>Try again</button>
          </div>
        </section>
      )}

      {!loading && !error && assets.length === 0 && (
        <section className="card empty-state">
          <h3>Let&apos;s get your fleet in here</h3>
          <p className="subtle">
            No assets yet. The fastest way to start is importing your existing Survey Asset
            Tracker workbook — every site tab becomes a site, every row becomes a tracked asset.
          </p>
          <div className="actions" style={{ justifyContent: 'center', marginTop: 14 }}>
            {user.role === 'super_admin' && (
              <button onClick={() => setImportOpen(true)}>Import your workbook</button>
            )}
            {canManageSites && (
              <button className="secondary-button" onClick={() => setCreateSiteOpen(true)}>Add a site</button>
            )}
            {(user.role === 'super_admin' || user.role === 'site_supervisor') && (
              <button className="secondary-button" onClick={() => { setEditing(undefined); setFormOpen(true); }}>
                Add one asset
              </button>
            )}
          </div>
        </section>
      )}

      {(loading || assets.length > 0) && (
      <section className="card location-nav">
        <div className="section-heading">
          <div>
            <h3>Locations</h3>
            <p>Break down workbook-backed assets by site.</p>
          </div>
          {canManageSites && (
            <button onClick={() => setCreateSiteOpen(true)}>+ Add Site</button>
          )}
        </div>
        <div className="location-toolbar">
          {/* Only filters the site picker below, which supervisors don't get. */}
          {user.role !== 'site_supervisor' && (
            <label className="location-select">
              <span>Search Sites</span>
              <input
                value={siteSearchTerm}
                onChange={(e) => setSiteSearchTerm(e.target.value)}
                placeholder="Search Sites"
              />
            </label>
          )}
          {user.role !== 'site_supervisor' && (
            <label className="location-select">
              <span>Filter by Site</span>
              <select
                value={selectedSiteId ?? ''}
                onChange={(e) => setSelectedSiteId(e.target.value || null)}
              >
                <option value="">All Locations ({assets.length})</option>
                {siteOptions.map((site) => (
                  <option key={site.id} value={site.id}>
                    {site.name}{site.state ? ` (${site.state})` : ''} — {siteCounts[site.id] ?? 0} assets
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="location-select">
            <span>Filter by Status</span>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">All</option>
              <option value="overdue">Overdue Calibration</option>
              <option value="due_soon">Due Soon</option>
              <option value="warning">Warning</option>
              <option value="never_calibrated">Never Calibrated</option>
              <option value="under_repair">Under Repair</option>
              <option value="reported">Reported Damage</option>
              <option value="ok">OK</option>
            </select>
          </label>
          <label className="location-select">
            <span>Filter by Category</span>
            <select value={equipmentFilter} onChange={(e) => setEquipmentFilter(e.target.value)}>
              <option value="all">All</option>
              {equipmentTypes.map((equipmentType) => (
                <option key={equipmentType} value={equipmentType}>
                  {equipmentType}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="location-meta">
          <strong>{populatedSites.length}</strong>
          <span>sites with workbook data</span>
        </div>
      </section>
      )}

      {actionMessage && (
        <section className="card status-strip">
          <p>{actionMessage}</p>
        </section>
      )}

      {(loading || assets.length > 0) && (
      <section className="card asset-toolbar">
        <div className="section-heading">
          <div>
            <h3>Assets</h3>
            <p>{filteredAssets.length} result{filteredAssets.length !== 1 ? 's' : ''} in the current view.</p>
          </div>
          <div className="asset-toolbar-actions">
            <label className="location-select">
              <span>Sort By</span>
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                <option value="assetNumberAsc">Asset # A–Z</option>
                <option value="assetNumberDesc">Asset # Z–A</option>
                <option value="itemNameAsc">Item A–Z</option>
                <option value="itemNameDesc">Item Z–A</option>
                <option value="statusAsc">Status</option>
                <option value="siteNameAsc">Site A–Z</option>
                <option value="costDesc">Cost: High–Low</option>
                <option value="costAsc">Cost: Low–High</option>
                <option value="currentValueDesc">Value: High–Low</option>
                <option value="currentValueAsc">Value: Low–High</option>
              </select>
            </label>
            {user.role === 'super_admin' && (
              <button
                className="secondary-button"
                onClick={() => setBulkEdit((v) => !v)}
              >
                {bulkEdit ? 'Done editing' : 'Bulk edit'}
              </button>
            )}
            {(user.role === 'super_admin' || user.role === 'site_supervisor') && (
              <button onClick={() => { setEditing(undefined); setFormOpen(true); }}>+ Add Asset</button>
            )}
          </div>
        </div>
        {error && <p className="error" style={{ marginTop: 8 }}>{error}</p>}
      </section>
      )}

      <div ref={formAnchorRef} />
      {formOpen && (
        <AssetForm
          sites={sites}
          user={user}
          initial={editing}
          onSubmit={handleSave}
          onCancel={() => {
            setFormOpen(false);
            setEditing(undefined);
          }}
        />
      )}

      {loading ? (
        <section className="card"><p>Loading assets...</p></section>
      ) : assets.length === 0 ? null : bulkEdit ? (
        <BulkEditGrid
          assets={filteredAssets}
          sites={sites}
          onSaved={() => {
            setBulkEdit(false);
            void loadData();
          }}
          onCancel={() => setBulkEdit(false)}
        />
      ) : (
        <AssetTable
          assets={filteredAssets}
          user={user}
          activeAssignments={activeAssignments}
          onEdit={handleEdit}
          onDelete={setDispositionTarget}
          onAssign={setAssignTarget}
          onCheckIn={(asset) => void handleCheckIn(asset)}
          onViewHistory={setHistoryTarget}
          onLogCalibration={setCalibrationTarget}
        />
      )}

      {assignTarget && (
        <AssignModal
          asset={assignTarget}
          onAssigned={() => {
            void loadData();
            setAssignTarget(null);
            setActionMessage(`${assignTarget.assetNumber} checked out.`);
          }}
          onClose={() => setAssignTarget(null)}
        />
      )}

      {historyTarget && (
        <CustodyHistory
          asset={historyTarget}
          onClose={() => setHistoryTarget(null)}
        />
      )}

      {calibrationTarget && (
        <CalibrationModal
          asset={calibrationTarget}
          onLogged={() => void loadData()}
          onClose={() => setCalibrationTarget(null)}
        />
      )}

      {dispositionTarget && (
        <DispositionModal
          asset={dispositionTarget}
          onDisposed={() => void handleDisposed()}
          onClose={() => setDispositionTarget(null)}
        />
      )}

      {importOpen && (
        <ImportModal
          onImported={() => {
            setImportOpen(false);
            void loadData();
          }}
          onClose={() => setImportOpen(false)}
        />
      )}

      {scannerOpen && (
        <Suspense
          fallback={
            <div className="modal-overlay">
              <div className="modal"><p>Starting camera…</p></div>
            </div>
          }
        >
          <ScannerModal
            onScan={(text) => {
              setScannerOpen(false);
              setScanInput(text);
              void handleScanLookup(text);
            }}
            onClose={() => setScannerOpen(false)}
          />
        </Suspense>
      )}

      {createSiteOpen && (
        <CreateSiteModal
          onCreated={(site, inviteNote) => {
            setSites((current) => [...current, site].sort((a, b) => a.name.localeCompare(b.name)));
            setCreateSiteOpen(false);
            setActionMessage(`Site ${site.code} — ${site.name} created.${inviteNote ? ` ${inviteNote}` : ''}`);
          }}
          onClose={() => setCreateSiteOpen(false)}
        />
      )}
    </main>
  );
};
