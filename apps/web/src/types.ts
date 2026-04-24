export type UserRole = 'super_admin' | 'regional_director' | 'site_supervisor';

export type User = {
  id: string;
  username: string;
  email: string | null;
  role: UserRole;
  siteId: string | null;
};

export type Site = {
  id: string;
  name: string;
  code: string;
};

export type AssetOwnership = 'owned' | 'rental' | 'rpo' | 'unknown';

export type Asset = {
  id: string;
  assetId: string;
  assetNumber: string;
  partNumber: string | null;
  serialNumber: string | null;
  itemName: string;
  manufacturer: string | null;
  equipmentType: string;
  siteId: string;
  siteName: string;
  ownership: AssetOwnership;
  assignedName: string | null;
  employeeNumber: string | null;
  vendor: string | null;
  firmwareVersion: string | null;
  latestFirmwareVersion: string | null;
  firmwareOutdated: boolean;
  subscriptionEndDate: string | null;
  lastCalibrationDate: string | null;
  calibrationIntervalDays: number;
  nextCalibrationDue: string | null;
  calibrationStatus: 'ok' | 'warning' | 'due_soon' | 'overdue' | 'never_calibrated';
  damageStatus: 'ok' | 'reported' | 'under_repair';
  damageType: string | null;
  assetNotes: string | null;
  repairNotes: string | null;
  estimatedRepairCost: number;
  cost: number;
  replacementCost: number;
  currentValue: number;
  replacementRecommended: boolean;
  acquiredDate: string | null;
  sourceSheetName: string | null;
  sourceRowNumber: number | null;
  createdAt: string;
  updatedAt: string;
};

export type AssetPayload = {
  assetNumber: string;
  partNumber: string | null;
  serialNumber: string | null;
  itemName: string;
  manufacturer: string | null;
  equipmentType: string;
  siteId: string;
  ownership: AssetOwnership;
  assignedName: string | null;
  employeeNumber: string | null;
  vendor: string | null;
  firmwareVersion: string | null;
  latestFirmwareVersion: string | null;
  subscriptionEndDate: string | null;
  lastCalibrationDate: string | null;
  calibrationIntervalDays: number;
  damageStatus: 'ok' | 'reported' | 'under_repair';
  damageType: string | null;
  assetNotes: string | null;
  repairNotes: string | null;
  estimatedRepairCost: number;
  cost: number;
  replacementCost: number;
  acquiredDate: string | null;
};
