import { FormEvent, useState } from 'react';
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

const STEPS = ['Identity', 'Location', 'Review'] as const;
const LAST_STEP = STEPS.length - 1;

type Props = {
  onCreated: (site: Site) => void;
  onClose: () => void;
};

export const CreateSiteModal = ({ onCreated, onClose }: Props) => {
  const [step, setStep] = useState(0);
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

  // Validate only the fields the current step owns; mirrors the server's rules
  // (code 2–12 chars, name ≥2) so the user is corrected before advancing.
  const validateStep = (s: number): string | null => {
    if (s === 0) {
      const code = (form.code ?? '').trim();
      const name = (form.name ?? '').trim();
      if (code.length < 2 || code.length > 12) return 'Site code must be 2–12 characters.';
      if (name.length < 2) return 'Site name must be at least 2 characters.';
    }
    return null;
  };

  const goBack = () => {
    setError(null);
    setStep((s) => Math.max(s - 1, 0));
  };

  const create = async () => {
    setSaving(true);
    setError(null);
    try {
      const site = await apiClient.createSite({
        ...form,
        code: form.code.trim(),
        name: form.name.trim(),
      });
      onCreated(site);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create site');
      setSaving(false);
    }
  };

  // One submit handler so the Enter key advances on early steps and creates on
  // the last — the form's primary button always does "the obvious next thing".
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (step < LAST_STEP) {
      const msg = validateStep(step);
      if (msg) {
        setError(msg);
        return;
      }
      setError(null);
      setStep((s) => s + 1);
    } else {
      void create();
    }
  };

  const stateLabel = US_STATES.find(([abbr]) => abbr === form.state)?.[1] ?? null;

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <h3>Create New Site</h3>

        <ol className="wizard-steps">
          {STEPS.map((label, i) => (
            <li
              key={label}
              className={`wizard-step${i === step ? ' active' : ''}${i < step ? ' done' : ''}`}
            >
              <span className="wizard-step-dot">{i < step ? '✓' : i + 1}</span>
              <span className="wizard-step-label">{label}</span>
            </li>
          ))}
        </ol>

        <form onSubmit={handleSubmit} className="form-grid">
          {step === 0 && (
            <>
              <label className="location-select">
                <span>Site Code</span>
                <input
                  required
                  autoFocus
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
              <p className="subtle" style={{ gridColumn: '1 / -1' }}>
                The code is a short unique identifier; the name is human-friendly.
              </p>
            </>
          )}

          {step === 1 && (
            <>
              <label className="location-select">
                <span>City</span>
                <input
                  autoFocus
                  placeholder="e.g. Columbia City"
                  value={form.city ?? ''}
                  onChange={(e) => set('city', e.target.value)}
                />
              </label>
              <label className="location-select">
                <span>State</span>
                <select value={form.state ?? ''} onChange={(e) => set('state', e.target.value)}>
                  <option value="">— Select State —</option>
                  {US_STATES.map(([abbr, label]) => (
                    <option key={abbr} value={abbr}>
                      {abbr} — {label}
                    </option>
                  ))}
                </select>
              </label>
              <p className="subtle" style={{ gridColumn: '1 / -1' }}>
                Location is optional — you can add it later.
              </p>
            </>
          )}

          {step === 2 && (
            <>
              <dl className="wizard-review" style={{ gridColumn: '1 / -1' }}>
                <div>
                  <dt>Site Code</dt>
                  <dd>{form.code.trim().toUpperCase()}</dd>
                </div>
                <div>
                  <dt>Site Name</dt>
                  <dd>{form.name.trim()}</dd>
                </div>
                <div>
                  <dt>City</dt>
                  <dd>{form.city || '—'}</dd>
                </div>
                <div>
                  <dt>State</dt>
                  <dd>{form.state ? `${form.state}${stateLabel ? ` — ${stateLabel}` : ''}` : '—'}</dd>
                </div>
              </dl>
              <p className="subtle" style={{ gridColumn: '1 / -1' }}>
                The site will be available immediately for asset assignment.
              </p>
            </>
          )}

          {error && <p className="error">{error}</p>}

          <div className="actions">
            <button
              type="button"
              className="secondary-button"
              onClick={step === 0 ? onClose : goBack}
            >
              {step === 0 ? 'Cancel' : 'Back'}
            </button>
            <button type="submit" disabled={saving}>
              {step < LAST_STEP ? 'Next' : saving ? 'Creating…' : 'Create Site'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
