import {
  Asset,
  AssetAssignment,
  AssetPayload,
  AssignPayload,
  CreateSitePayload,
  Site,
  User,
} from '../types';

const baseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000/api/v1';

class ApiClient {
  // Async getter so we always send a fresh Clerk session token (it auto-refreshes).
  private tokenGetter: (() => Promise<string | null>) | null = null;

  setTokenGetter(getter: () => Promise<string | null>): void {
    this.tokenGetter = getter;
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const headers = new Headers(init?.headers);
    headers.set('Content-Type', 'application/json');

    const token = this.tokenGetter ? await this.tokenGetter() : null;
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    const response = await fetch(`${baseUrl}${path}`, { ...init, headers });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || `Request failed (${response.status})`);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return response.json() as Promise<T>;
  }

  getMe(): Promise<User> {
    return this.request('/users/me');
  }

  getSites(): Promise<Site[]> {
    return this.request('/sites');
  }

  createSite(payload: CreateSitePayload): Promise<Site> {
    return this.request('/sites', { method: 'POST', body: JSON.stringify(payload) });
  }

  getAssets(): Promise<Asset[]> {
    return this.request('/assets');
  }

  createAsset(payload: AssetPayload): Promise<{ id: string }> {
    return this.request('/assets', { method: 'POST', body: JSON.stringify(payload) });
  }

  updateAsset(id: string, payload: AssetPayload): Promise<void> {
    return this.request(`/assets/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
  }

  deleteAsset(id: string): Promise<void> {
    return this.request(`/assets/${id}`, { method: 'DELETE' });
  }

  scanAsset(assetNumber: string): Promise<Asset> {
    return this.request('/scan/asset', { method: 'POST', body: JSON.stringify({ assetNumber }) });
  }

  assignAsset(assetId: string, payload: AssignPayload): Promise<AssetAssignment> {
    return this.request(`/assets/${assetId}/assign`, { method: 'POST', body: JSON.stringify(payload) });
  }

  checkInAsset(assetId: string): Promise<AssetAssignment> {
    return this.request(`/assets/${assetId}/checkin`, { method: 'POST' });
  }

  getAssetHistory(assetId: string): Promise<AssetAssignment[]> {
    return this.request(`/assets/${assetId}/assignments`);
  }

  getActiveAssignments(): Promise<AssetAssignment[]> {
    return this.request('/assignments/active');
  }
}

export const apiClient = new ApiClient();
