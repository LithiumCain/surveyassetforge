import { useEffect, useMemo, useRef, useState } from 'react';
import { apiClient } from '../api/client';
import { AssetForm } from '../components/AssetForm';
import { AssetTable } from '../components/AssetTable';
import { Asset, AssetPayload, Site, User } from '../types';

type Props = {
  user: User;
  onLogout: () => void;
};

export const DashboardPage = ({ user, onLogout }: Props) => {
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
  const [deleteCandidate, setDeleteCandidate] = useState<Asset | null>(null);
  const [pendingUndoDelete, setPendingUndoDelete] = useState<Asset | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const deleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const formAnchorRef = useRef<HTMLDivElement | null>(null);

  const siteCounts = useMemo(() => {
    return assets.reduce<Record<string, number>>((counts, asset) => {
      counts[asset.siteId] = (counts[asset.siteId] ?? 0) + 1;
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

  const filteredAssets = useMemo(() => {
    const results = visibleAssets.filter((asset) => {
      if (statusFilter !== 'all') {
        const matchesCalibration = asset.calibrationStatus === statusFilter;
        const matchesDamage = asset.damageStatus === statusFilter;
        if (!matchesCalibration && !matchesDamage) {
          return false;
        }
      }

      if (equipmentFilter !== 'all' && asset.equipmentType !== equipmentFilter) {
        return false;
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
          return left.calibrationStatus.localeCompare(right.calibrationStatus) || left.assetNumber.localeCompare(right.assetNumber);
        case 'costDesc':
          return Number(right.cost ?? 0) - Number(left.cost ?? 0);
        case 'costAsc':
          return Number(left.cost ?? 0) - Number(right.cost ?? 0);
        case 'currentValueDesc':
          return Number(right.currentValue ?? 0) - Number(left.currentValue ?? 0);
        case 'currentValueAsc':
          return Number(left.currentValue ?? 0) - Number(right.currentValue ?? 0);
        case 'siteNameAsc':
          return left.siteName.localeCompare(right.siteName) || left.assetNumber.localeCompare(right.assetNumber);
        case 'assetNumberAsc':
        default:
          return left.assetNumber.localeCompare(right.assetNumber);
      }
    });
  }, [equipmentFilter, sortBy, statusFilter, visibleAssets]);

  const selectedSiteName = useMemo(() => {
    if (!selectedSiteId) {
      return 'All Locations';
    }

    return sites.find((site) => site.id === selectedSiteId)?.name ?? 'Selected Location';
  }, [selectedSiteId, sites]);

  const summary = useMemo(() => {
    return {
      total: filteredAssets.length,
      overdue: filteredAssets.filter((a) => a.calibrationStatus === 'overdue').length,
      dueSoon: filteredAssets.filter((a) => a.calibrationStatus === 'due_soon').length,
      underRepair: filteredAssets.filter((a) => a.damageStatus === 'under_repair').length,
      totalCost: filteredAssets.reduce((sum, a) => sum + Number(a.cost ?? 0), 0),
      currentValue: filteredAssets.reduce((sum, a) => sum + Number(a.currentValue ?? 0), 0),
    };
  }, [filteredAssets]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [siteRows, assetRows] = await Promise.all([apiClient.getSites(), apiClient.getAssets()]);
      setSites(siteRows);
      setAssets(assetRows);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

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
    return () => {
      if (deleteTimerRef.current) {
        clearTimeout(deleteTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!formOpen) {
      return;
    }

    formAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [formOpen, editing]);

  const handleSave = async (payload: AssetPayload): Promise<void> => {
    if (editing) {
      await apiClient.updateAsset(editing.id, payload);
    } else {
      await apiClient.createAsset(payload);
    }

    setEditing(undefined);
    setFormOpen(false);
    await loadData();
  };

  const handleEdit = (asset: Asset): void => {
    setEditing(asset);
    setFormOpen(true);
    setActionMessage(`Editing ${asset.assetNumber}`);
  };

  const requestDelete = (asset: Asset): void => {
    setDeleteCandidate(asset);
    setActionMessage(null);
  };

  const confirmDelete = (): void => {
    if (!deleteCandidate) {
      return;
    }

    const asset = deleteCandidate;
    setDeleteCandidate(null);
    setPendingUndoDelete(asset);
    setAssets((current) => current.filter((item) => item.id !== asset.id));
    setActionMessage(`${asset.assetNumber} removed. Undo available for 5 seconds.`);

    if (deleteTimerRef.current) {
      clearTimeout(deleteTimerRef.current);
    }

    deleteTimerRef.current = setTimeout(() => {
      void apiClient.deleteAsset(asset.id).catch(async (err) => {
        setError(err instanceof Error ? err.message : 'Delete failed');
        await loadData();
      }).finally(() => {
        setPendingUndoDelete((current) => (current?.id === asset.id ? null : current));
        deleteTimerRef.current = null;
      });
    }, 5000);
  };

  const undoDelete = async (): Promise<void> => {
    if (!pendingUndoDelete) {
      return;
    }

    if (deleteTimerRef.current) {
      clearTimeout(deleteTimerRef.current);
      deleteTimerRef.current = null;
    }

    setActionMessage(`${pendingUndoDelete.assetNumber} restored.`);
    setPendingUndoDelete(null);
    await loadData();
  };

  const handleScanLookup = async (): Promise<void> => {
    try {
      setScanResult(await apiClient.scanAsset(scanInput));
    } catch (err) {
      setScanResult(null);
      alert(err instanceof Error ? err.message : 'Asset not found');
    }
  };

  return (
    <main className="layout">
      <header className="topbar card">
        <div>
          <h1>FieldOps Dashboard</h1>
          <p>{user.username} ({user.role})</p>
          <p className="subtle">Viewing: {selectedSiteName}</p>
        </div>
        <button onClick={onLogout}>Sign Out</button>
      </header>

      <section className="card location-nav">
        <div className="section-heading">
          <div>
            <h3>Locations</h3>
            <p>Break down workbook-backed assets by site.</p>
          </div>
        </div>
        <div className="location-toolbar">
          <label className="location-select">
            <span>Search Sites</span>
            <input
              value={siteSearchTerm}
              onChange={(e) => setSiteSearchTerm(e.target.value)}
              placeholder="Search Sites"
            />
          </label>
          {user.role !== 'field_user' && (
            <label className="location-select">
              <span>Filter by Site</span>
              <select
                value={selectedSiteId ?? ''}
                onChange={(e) => setSelectedSiteId(e.target.value || null)}
              >
                <option value="">All Locations ({assets.length})</option>
                {siteOptions.map((site) => (
                  <option key={site.id} value={site.id}>
                    {site.name} ({siteCounts[site.id] ?? 0})
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

      <section className="summary-grid">
        <article className="card"><h2>{summary.total}</h2><p>Total Assets</p></article>
        <article className="card"><h2>{summary.overdue}</h2><p>Overdue Calibration</p></article>
        <article className="card"><h2>{summary.dueSoon}</h2><p>Due Soon</p></article>
        <article className="card"><h2>{summary.underRepair}</h2><p>Under Repair</p></article>
        <article className="card"><h2>${summary.totalCost.toLocaleString()}</h2><p>Total Cost</p></article>
        <article className="card"><h2>${summary.currentValue.toLocaleString()}</h2><p>Current Value</p></article>
      </section>

      <section className="card scan-box">
        <h3>Scan Lookup</h3>
        <p>Manual fallback for barcode scanner workflow. Camera scan can be added using Html5-QRCode.</p>
        <div className="inline-controls">
          <input value={scanInput} onChange={(e) => setScanInput(e.target.value)} placeholder="Search Assets" />
          <button onClick={() => void handleScanLookup()}>Lookup</button>
        </div>
        {scanResult && (
          <p className="scan-result">
            Found: <strong>{scanResult.assetNumber}</strong> - {scanResult.itemName} ({scanResult.siteName})
          </p>
        )}
      </section>

      {(user.role === 'super_admin' || user.role === 'site_supervisor') && (
        <section className="actions card">
          <button onClick={() => { setEditing(undefined); setFormOpen(true); }}>Add Asset</button>
          {error && <p className="error">{error}</p>}
        </section>
      )}

      {deleteCandidate && (
        <section className="card confirm-strip">
          <div>
            <h3>Delete Asset?</h3>
            <p>
              Delete <strong>{deleteCandidate.assetNumber}</strong>? You will have 5 seconds to undo after confirming.
            </p>
          </div>
          <div className="confirm-actions">
            <button type="button" className="secondary-button" onClick={() => setDeleteCandidate(null)}>Cancel</button>
            <button type="button" className="danger-button" onClick={confirmDelete}>Delete</button>
          </div>
        </section>
      )}

      {pendingUndoDelete && !deleteCandidate && (
        <section className="card undo-strip">
          <p>{actionMessage}</p>
          <button type="button" className="secondary-button" onClick={() => void undoDelete()}>Undo</button>
        </section>
      )}

      {actionMessage && !pendingUndoDelete && !deleteCandidate && (
        <section className="card status-strip">
          <p>{actionMessage}</p>
        </section>
      )}

      <section className="card asset-toolbar">
        <div className="section-heading">
          <div>
            <h3>Assets</h3>
            <p>{filteredAssets.length} results in the current location view.</p>
          </div>
          <label className="location-select">
            <span>Sort Assets</span>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="assetNumberAsc">Asset # A-Z</option>
              <option value="assetNumberDesc">Asset # Z-A</option>
              <option value="itemNameAsc">Item A-Z</option>
              <option value="itemNameDesc">Item Z-A</option>
              <option value="statusAsc">Status</option>
              <option value="siteNameAsc">Site A-Z</option>
              <option value="costDesc">Cost High-Low</option>
              <option value="costAsc">Cost Low-High</option>
              <option value="currentValueDesc">Current Value High-Low</option>
              <option value="currentValueAsc">Current Value Low-High</option>
            </select>
          </label>
        </div>
      </section>

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
      ) : (
        <AssetTable
          assets={filteredAssets}
          user={user}
          onEdit={handleEdit}
          onDelete={requestDelete}
        />
      )}
    </main>
  );
};
