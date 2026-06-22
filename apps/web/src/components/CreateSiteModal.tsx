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

const STEPS = ['Identity', 'Location', 'Manager', 'Review'] as const;
const LAST_STEP = STEPS.length - 1;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

type Props = {
  // inviteNote is an optional human message about the manager invitation outcome.
  onCreated: (site: Site, inviteNote?: string) => void;
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
  const [manager, setManager] = useState({ firstName: '', lastName: '', email: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (key: keyof CreateSitePayload, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value || null }));
  };
  const setMgr = (key: keyof typeof manager, value: string) => {
    setManager((prev) => ({ ...prev, [key]: value }));
  };

  const willInvite = manager.email.trim().length > 0;

  // Validate only the fields the current step owns; mirrors the server's rules.
  const validateStep = (s: number): string | null => {
    if (s === 0) {
      const code = form.code.trim();
      const name = form.name.trim();
      if (code.length < 2 || code.length > 12) return 'Site code must be 2–12 characters.';
      if (name.length < 2) return 'Site name must be at least 2 characters.';
    }
    if (s === 2 && willInvite) {
      if (!EMAIL_RE.test(manager.email.trim())) return 'Enter a valid email address.';
      if (manager.firstName.trim().length < 1 || manager.lastName.trim().length < 1) {
        return "Add the manager's first and last name to send an invite.";
      }
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
    let site: Site;
    try {
      site = await apiClient.createSite({
        ...form,
        code: form.code.trim(),
        name: form.name.trim(),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create site');
      setSaving(false);
      return;
    }

    // Site exists now. The invite is best-effort: if it fails, don't lose the
    // site — report the invite problem but still finish the create.
    if (!willInvite) {
      onCreated(site);
      return;
    }
    try {
      await apiClient.inviteManager(site.id, {
        email: manager.email.trim(),
        firstName: manager.firstName.trim(),
        lastName: manager.lastName.trim(),
      });
      onCreated(site, `Invited ${manager.email.trim()} as site manager.`);
    } catch (err) {
      const why = err instanceof Error ? err.message : 'invite failed';
      onCreated(site, `Site created, but the invite didn't send (${why}).`);
    }
  };

  // One submit handler so Enter advances on early steps and creates on the last.
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
  const managerName = `${manager.firstName.trim()} ${manager.lastName.trim()}`.trim();

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
              <label className="location-select">
                <span>Manager First Name</span>
                <input
                  autoFocus
                  placeholder="e.g. Mike"
                  value={manager.firstName}
                  onChange={(e) => setMgr('firstName', e.target.value)}
                />
              </label>
              <label className="location-select">
                <span>Manager Last Name</span>
                <input
                  placeholder="e.g. Loth"
                  value={manager.lastName}
                  onChange={(e) => setMgr('lastName', e.target.value)}
                />
              </label>
              <label className="location-select" style={{ gridColumn: '1 / -1' }}>
                <span>Invite Email (optional)</span>
                <input
                  type="email"
                  placeholder="mike.loth@example.com"
                  value={manager.email}
                  onChange={(e) => setMgr('email', e.target.value)}
                />
              </label>
              <p className="subtle" style={{ gridColumn: '1 / -1' }}>
                {willInvite
                  ? 'We’ll email an invitation. When they accept, they get a login scoped to this site as its supervisor.'
                  : 'Add an email to invite a site supervisor now — or skip and assign one later.'}
              </p>
            </>
          )}

          {step === 3 && (
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
                <div>
                  <dt>Manager</dt>
                  <dd>
                    {willInvite
                      ? `${managerName || 'Invitee'} — invite ${manager.email.trim()}`
                      : '—'}
                  </dd>
                </div>
              </dl>
              <p className="subtle" style={{ gridColumn: '1 / -1' }}>
                {willInvite
                  ? 'The site is created and the manager is emailed an invitation to join.'
                  : 'The site will be available immediately for asset assignment.'}
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
              {step < LAST_STEP
                ? 'Next'
                : saving
                  ? 'Creating…'
                  : willInvite
                    ? 'Create & Invite'
                    : 'Create Site'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
