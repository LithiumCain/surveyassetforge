import { useState } from 'react';
import { apiClient } from '../api/client';
import { CreateSitePayload, Site } from '../types';

const US_STATES: [string, string][] = [
  ['AL', 'Alabama'], ['AK', 'Alaska'], ['AZ', 'Arizona'], ['AR', 'Arkansas'],
  ['CA', 'California'], ['CO', 'Colorado'], ['CT', 'Connecticut'], ['DE', 'Delaware'],
  ['FL', 'Florida'], ['GA', 'Georgia'], ['HI', 'Hawaii'], ['ID', 'Idaho'],
  ['IL', 'Illinois'], ['IN', 'Indiana'], ['IA', 'Iowa'], ['KS', 'Kansas'],
  ['KY', 'Kentucky'], ['LA', 'Louisiana'], ['ME', 'Maine'], ['MD', 'Maryland'],
  ['MA', 'Massachusetts'], ['MI', 'Michigan'], ['MN', 'Minnesota'], ['MS', 'Mississippi'],
  ['MO', 'Missouri'], ['MT', 'Montana'], ['NE', 'Nebraska'], ['NV', 'Nevada'],
  ['NH', 'New Hampshire'], ['NJ', 'New Jersey'], ['NM', 'New Mexico'], ['NY', 'New York'],
  ['NC', 'North Carolina'], ['ND', 'North Dakota'], ['OH', 'Ohio'], ['OK', 'Oklahoma'],
  ['OR', 'Oregon'], ['PA', 'Pennsylvania'], ['RI', 'Rhode Island'], ['SC', 'South Carolina'],
  ['SD', 'South Dakota'], ['TN', 'Tennessee'], ['TX', 'Texas'], ['UT', 'Utah'],
  ['VT', 'Vermont'], ['VA', 'Virginia'], ['WA', 'Washington'], ['WV', 'West Virginia'],
  ['WI', 'Wisconsin'], ['WY', 'Wyoming'],
];

type Props = {
  onCreated: (site: Site) => void;
  onClose: () => void;
};

export const CreateSiteModal = ({ onCreated, onClose }: Props) => {
  const [form, setForm] = useState<CreateSitePayload>({
    code: '',
    name: '',
    city: null,
    state: null,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (key: keyof CreateSitePayload, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value || null }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const site = await apiClient.createSite(form);
      onCreated(site);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create site');
      setSaving(false);
    }
  };

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="modal">
        <h3>Create New Site</h3>
        <p className="subtle">The site will be available immediately for asset assignment.</p>
        <form onSubmit={(e) => void handleSubmit(e)} className="form-grid">
          <label className="location-select">
            <span>Site Code</span>
            <input
              required
              placeholder="e.g. 0273"
              value={form.code}
              onChange={(e) => set('code', e.target.value)}
              maxLength={12}
            />
          </label>
          <label className="location-select">
            <span>Site Name</span>
            <input
              required
              placeholder="e.g. Armadillo"
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
            />
          </label>
          <label className="location-select">
            <span>City</span>
            <input
              placeholder="e.g. Columbia City"
              value={form.city ?? ''}
              onChange={(e) => set('city', e.target.value)}
            />
          </label>
          <label className="location-select">
            <span>State</span>
            <select
              value={form.state ?? ''}
              onChange={(e) => set('state', e.target.value)}
            >
              <option value="">— Select State —</option>
              {US_STATES.map(([abbr, label]) => (
                <option key={abbr} value={abbr}>
                  {abbr} — {label}
                </option>
              ))}
            </select>
          </label>
          {error && <p className="error">{error}</p>}
          <div className="actions">
            <button type="button" className="secondary-button" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" disabled={saving}>
              {saving ? 'Creating...' : 'Create Site'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
