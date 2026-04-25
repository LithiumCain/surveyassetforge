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
  city: string | null;
  state: string | null;
};

export type CreateSitePayload = {
  code: string;
  name: string;
  city: string | null;
  state: string | null;
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

export type AssetAssignment = {
  id: string;
  assetId: string;
  assignedToName: string;
  assignedToNumber: string | null;
  siteId: string;
  checkedOutAt: string;
  checkedInAt: string | null;
  notes: string | null;
  assignedById: string;
  assignedBy?: {
    username: string;
    firstName: string | null;
    lastName: string | null;
  };
  site?: {
    code: string;
    name: string;
  };
};

export type AssignPayload = {
  assignedToName: string;
  assignedToNumber: string | null;
  notes: string | null;
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
