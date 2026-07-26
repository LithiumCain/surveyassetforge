// Parses the Survey Asset Tracker workbook in the browser and normalizes it
// into the import payload the API expects. Column mapping mirrors the original
// scripts/import_survey_asset_tracker.py:
//   A Manufacturer · B Item · C Part Number · D Serial Number · E Rent ·
//   F Own · G RPO · H Subscription End · I Firmware · J Last Calibration ·
//   K Cost · L Value · M Asset Number · N Notes
// Site sheets are named like "0247_Atlas IV"; everything else is skipped.

export type ImportSite = { code: string; name: string };

export type ImportAsset = {
  siteCode: string | null; // null => into inventory (unassigned)
  assetNumber: string;
  itemName: string;
  equipmentType: string;
  manufacturer: string | null;
  partNumber: string | null;
  serialNumber: string | null;
  ownership: 'owned' | 'rental' | 'rpo' | 'unknown';
  firmwareVersion: string | null;
  subscriptionEndDate: string | null;
  lastCalibrationDate: string | null;
  cost: number;
  replacementCost: number;
  notes: string | null;
  sourceSheetName: string;
  sourceRowNumber: number;
};

export type ParsedWorkbook = {
  sites: ImportSite[];
  assets: ImportAsset[];
  purchases: ImportAsset[]; // "YYYY Purchase" sheet items (optional include)
  autoNumbered: number; // rows with gear but no Asset Number (we generate one)
  duplicates: number; // asset numbers listed on more than one sheet
  skippedSheets: string[]; // non-site, non-purchase sheets (formula sheets etc.)
};

// Site tabs look like "0247_Atlas IV" — digits, underscore, name. A space
// separator is NOT enough ("2026 Purchase" is a purchase list, not a site).
const SITE_SHEET = /^(\d+)_\s*(.+)$/;

// Purchase-list tabs: "2026 Purchase". Columns: A MFG · B Unit · C S/N · D Site.
const PURCHASE_SHEET = /^(\d{4})\s+Purchase$/i;

type CellValue = string | number | boolean | Date | undefined;
type Row = Record<string, CellValue>;

const text = (v: CellValue): string => {
  if (v === undefined || v === null) return '';
  if (v instanceof Date) return v.toISOString();
  return String(v).trim();
};

// Excel serial → ISO date (1900 date system, matching the Python importer).
const toIsoDate = (v: CellValue): string | null => {
  if (v === undefined || v === '') return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'number' && v > 0) {
    const ms = Date.UTC(1899, 11, 30) + Math.round(v) * 86_400_000;
    return new Date(ms).toISOString().slice(0, 10);
  }
  const s = text(v);
  if (/^\d+(\.\d+)?$/.test(s)) return toIsoDate(Number(s));
  for (const re of [/^(\d{4})-(\d{2})-(\d{2})/, /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/]) {
    const m = s.match(re);
    if (!m) continue;
    const [y, mo, d] =
      re.source.startsWith('^(\\d{4})')
        ? [Number(m[1]), Number(m[2]), Number(m[3])]
        : [Number(m[3].length === 2 ? `20${m[3]}` : m[3]), Number(m[1]), Number(m[2])];
    const date = new Date(Date.UTC(y, mo - 1, d));
    return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
  }
  return null;
};

const toMoney = (v: CellValue): number => {
  if (typeof v === 'number') return Number.isFinite(v) && v > 0 ? v : 0;
  const cleaned = text(v).replace(/[$,]/g, '').trim();
  if (!cleaned || cleaned.toUpperCase() === 'N/A') return 0;
  const n = Number(cleaned);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

const inferEquipmentType = (itemName: string): string => {
  const lower = itemName.toLowerCase();
  if (['office', 'business center', 'site prep', 'subscription', 'license'].some((t) => lower.includes(t)))
    return 'Software';
  if (['fc-6400', 'fc-6000', 'tablet', 'controller', 'toughbook'].some((t) => lower.includes(t)))
    return 'Data Collector';
  if (['hiper', 'gnss', 'receiver'].some((t) => lower.includes(t))) return 'GNSS';
  if (['radio', '450 mhz', 'satel', 'antenna', 'lmr', 'tnc'].some((t) => lower.includes(t))) return 'Radio';
  if (['laptop', 'monitor', 'desktop', 'dock'].some((t) => lower.includes(t))) return 'Computer';
  if (
    ['charger', 'battery', 'rod', 'pole', 'bipod', 'tripod', 'tribrach', 'kit', 'cable', 'adapter',
     'case', 'bracket', 'backpack', 'prism', 'bag', 'locater', 'locator', 'detector', 'hammer']
      .some((t) => lower.includes(t))
  )
    return 'Accessory';
  return 'Equipment';
};

const ownershipOf = (row: Row): ImportAsset['ownership'] => {
  if (text(row.F).toUpperCase() === 'X') return 'owned';
  if (text(row.E).toUpperCase() === 'X') return 'rental';
  if (text(row.G).toUpperCase() === 'X') return 'rpo';
  return 'unknown';
};

export const parseWorkbook = async (file: File): Promise<ParsedWorkbook> => {
  const XLSX = await import('xlsx');
  const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });

  const sites: ImportSite[] = [];
  const assets: ImportAsset[] = [];
  const purchases: ImportAsset[] = [];
  const skippedSheets: string[] = [];
  const purchaseSheets: string[] = [];
  const seenNumbers = new Set<string>();
  let autoNumbered = 0;
  let duplicates = 0;

  for (const sheetName of wb.SheetNames) {
    const match = sheetName.trim().match(SITE_SHEET);
    if (!match) {
      if (PURCHASE_SHEET.test(sheetName.trim())) {
        purchaseSheets.push(sheetName);
      } else {
        skippedSheets.push(sheetName.trim());
      }
      continue;
    }
    const [, code, name] = match;
    sites.push({ code: code.trim(), name: name.trim() });

    const rows = XLSX.utils.sheet_to_json<Row>(wb.Sheets[sheetName], {
      header: 'A',
      raw: true,
      defval: '',
    });

    // Row 1 is the header row.
    rows.slice(1).forEach((row, i) => {
      const rowNumber = i + 2;
      let manufacturer = text(row.A);
      let itemName = text(row.B);
      let serialNumber = text(row.D);

      // One known workbook quirk: a software row shifted a column right.
      if ((!itemName || /^\d+$/.test(itemName)) && manufacturer.toLowerCase().includes('office')) {
        const m = manufacturer.match(/^([A-Za-z0-9/&+ -]+?)\s+(Office.+)$/);
        if (m) {
          manufacturer = m[1].trim();
          itemName = m[2].trim();
          serialNumber = text(row.B);
        }
      }

      if (!itemName) return; // blank/padding row

      // Real-world workbooks only have asset tags on some rows. Generate a
      // deterministic number for the rest (site code + row) so ALL gear comes
      // in and re-imports stay idempotent. The team can re-tag later.
      let assetNumber = text(row.M);
      if (assetNumber.length < 2) {
        assetNumber = `${code}-A${String(rowNumber).padStart(3, '0')}`;
        autoNumbered += 1;
      }
      if (seenNumbers.has(assetNumber)) {
        duplicates += 1;
        return; // same tag listed on a second sheet — first sheet wins
      }
      seenNumbers.add(assetNumber);

      const cost = toMoney(row.K);
      assets.push({
        siteCode: code.trim(),
        assetNumber,
        itemName,
        equipmentType: inferEquipmentType(itemName),
        manufacturer: manufacturer || null,
        partNumber: text(row.C) || null,
        serialNumber: serialNumber || null,
        ownership: ownershipOf(row),
        firmwareVersion: text(row.I) || null,
        subscriptionEndDate: toIsoDate(row.H),
        lastCalibrationDate: toIsoDate(row.J),
        cost,
        replacementCost: toMoney(row.L) || cost,
        notes: text(row.N) || null,
        sourceSheetName: sheetName.trim(),
        sourceRowNumber: rowNumber,
      });
    });
  }

  // Purchase lists come last so site names can be matched against real sites.
  // Items name their site loosely ("Clear Fork" for "Clear Fork Creek") or not
  // at all — unmatched gear goes to inventory with the raw text kept in notes.
  const findSiteCode = (raw: string): string | null => {
    const needle = raw.trim().toLowerCase();
    if (!needle) return null;
    const hit = sites.find((s) => {
      const name = s.name.toLowerCase();
      return name === needle || name.startsWith(needle) || needle.startsWith(name);
    });
    return hit?.code ?? null;
  };

  for (const sheetName of purchaseSheets) {
    const year = sheetName.trim().match(PURCHASE_SHEET)![1];
    const rows = XLSX.utils.sheet_to_json<Row>(wb.Sheets[sheetName], {
      header: 'A',
      raw: true,
      defval: '',
    });
    rows.slice(1).forEach((row, i) => {
      const rowNumber = i + 2;
      const itemName = text(row.B);
      if (!itemName) return;
      const rawSite = text(row.D);
      const siteCode = findSiteCode(rawSite);
      const assetNumber = `P${year.slice(2)}-${String(rowNumber).padStart(3, '0')}`;
      if (seenNumbers.has(assetNumber)) return;
      seenNumbers.add(assetNumber);
      purchases.push({
        siteCode,
        assetNumber,
        itemName,
        equipmentType: inferEquipmentType(itemName),
        manufacturer: text(row.A) || null,
        partNumber: null,
        serialNumber: text(row.C) || null,
        ownership: 'unknown',
        firmwareVersion: null,
        subscriptionEndDate: null,
        lastCalibrationDate: null,
        cost: 0,
        replacementCost: 0,
        notes:
          `${year} purchase` +
          (rawSite && !siteCode ? ` — for ${rawSite}` : ''),
        sourceSheetName: sheetName.trim(),
        sourceRowNumber: rowNumber,
      });
    });
  }

  return { sites, assets, purchases, autoNumbered, duplicates, skippedSheets };
};
