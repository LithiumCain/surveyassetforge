import { Asset, AssetPayload, Site, User } from '../types';

const baseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000/api/v1';

class ApiClient {
  private token: string | null = null;

  setToken(token: string | null): void {
    this.token = token;
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const headers = new Headers(init?.headers);
    headers.set('Content-Type', 'application/json');
    if (this.token) {
      headers.set('Authorization', `Bearer ${this.token}`);
    }

    const response = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || `Request failed (${response.status})`);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return response.json() as Promise<T>;
  }

  login(username: string, password: string): Promise<{ token: string; user: User }> {
    return this.request('/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
  }

  getMe(): Promise<User> {
    return this.request('/users/me');
  }

  getSites(): Promise<Site[]> {
    return this.request('/sites');
  }

  getAssets(): Promise<Asset[]> {
    return this.request('/assets');
  }

  createAsset(payload: AssetPayload): Promise<{ id: string }> {
    return this.request('/assets', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  updateAsset(id: string, payload: AssetPayload): Promise<void> {
    return this.request(`/assets/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }

  deleteAsset(id: string): Promise<void> {
    return this.request(`/assets/${id}`, {
      method: 'DELETE',
    });
  }

  scanAsset(assetNumber: string): Promise<Asset> {
    return this.request('/scan/asset', {
      method: 'POST',
      body: JSON.stringify({ assetNumber }),
    });
  }
}

export const apiClient = new ApiClient();
