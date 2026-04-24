const baseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000/api/v1';
class ApiClient {
    constructor() {
        this.token = null;
    }
    setToken(token) {
        this.token = token;
    }
    async request(path, init) {
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
            return undefined;
        }
        return response.json();
    }
    login(username, password) {
        return this.request('/login', {
            method: 'POST',
            body: JSON.stringify({ username, password }),
        });
    }
    getMe() {
        return this.request('/users/me');
    }
    getSites() {
        return this.request('/sites');
    }
    getAssets() {
        return this.request('/assets');
    }
    createAsset(payload) {
        return this.request('/assets', {
            method: 'POST',
            body: JSON.stringify(payload),
        });
    }
    updateAsset(id, payload) {
        return this.request(`/assets/${id}`, {
            method: 'PUT',
            body: JSON.stringify(payload),
        });
    }
    deleteAsset(id) {
        return this.request(`/assets/${id}`, {
            method: 'DELETE',
        });
    }
    scanAsset(assetNumber) {
        return this.request('/scan/asset', {
            method: 'POST',
            body: JSON.stringify({ assetNumber }),
        });
    }
}
export const apiClient = new ApiClient();
