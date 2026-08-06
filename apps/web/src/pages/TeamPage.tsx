import { useEffect, useMemo, useState } from 'react';
import { EMAIL_RE } from '../lib/validation';
import { apiClient } from '../api/client';
import { TopBar, type Tab } from '../components/TopBar';
import { useToast } from '../components/Toast';
import { Site, TeamUser, User, UserRole } from '../types';

type Props = {
  user: User;
  onTab: (tab: Tab) => void;
};

const ROLE_LABEL: Record<UserRole, string> = {
  super_admin: 'Super Admin',
  regional_director: 'Regional Director',
  site_supervisor: 'Site Supervisor',
};

const ROLE_HINT: Record<UserRole, string> = {
  super_admin: 'Full control — every site, every action, including dispositions.',
  regional_director: 'Fleet-wide visibility, check-in/out and calibrations. No asset edits or dispositions.',
  site_supervisor: 'Locked to one site. Day-to-day field work: scan, calibrate, check gear in and out.',
};

const displayName = (u: TeamUser) =>
  [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email || 'Unnamed user';

export const TeamPage = ({ user, onTab }: Props) => {
  const toast = useToast();
  const [team, setTeam] = useState<TeamUser[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  // Invite form (site supervisors — the app's own invite flow)
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteFirst, setInviteFirst] = useState('');
  const [inviteLast, setInviteLast] = useState('');
  const [inviteSiteId, setInviteSiteId] = useState('');
  const [inviting, setInviting] = useState(false);

  const canEdit = user.role === 'super_admin';

  const load = () => {
    setLoading(true);
    Promise.all([apiClient.getTeam(), apiClient.getSites()])
      .then(([users, siteRows]) => {
        setTeam(users);
        setSites(siteRows);
        if (!inviteSiteId && siteRows.length > 0) setInviteSiteId(siteRows[0].id);
      })
      .catch((e) => toast.push(e instanceof Error ? e.message : 'Failed to load the team', 'error'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const counts = useMemo(
    () => ({
      // Active-only, so this tile equals the three role tiles below it. Counting
      // deactivated people here made the numbers visibly fail to add up.
      total: team.filter((u) => u.isActive).length,
      admins: team.filter((u) => u.isActive && u.role === 'super_admin').length,
      directors: team.filter((u) => u.isActive && u.role === 'regional_director').length,
      supervisors: team.filter((u) => u.isActive && u.role === 'site_supervisor').length,
      inactive: team.filter((u) => !u.isActive).length,
    }),
    [team],
  );

  const applyUpdate = async (target: TeamUser, payload: Parameters<typeof apiClient.updateTeamUser>[1], done: string) => {
    setSavingId(target.id);
    try {
      const updated = await apiClient.updateTeamUser(target.id, payload);
      setTeam((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      toast.push(done, 'success');
    } catch (e) {
      toast.push(e instanceof Error ? e.message : 'Update failed', 'error');
    } finally {
      setSavingId(null);
    }
  };

  const handleInvite = async () => {
    if (!inviteEmail || !inviteFirst || !inviteLast || !inviteSiteId) {
      toast.push('Fill in every invite field', 'error');
      return;
    }
    if (!EMAIL_RE.test(inviteEmail.trim())) {
      toast.push('Enter a valid email address', 'error');
      return;
    }
    setInviting(true);
    try {
      const site = sites.find((s) => s.id === inviteSiteId);
      await apiClient.inviteManager(inviteSiteId, {
        email: inviteEmail,
        firstName: inviteFirst,
        lastName: inviteLast,
      });
      toast.push(`Invitation sent to ${inviteEmail} for ${site?.name ?? 'site'}`, 'success');
      setInviteEmail('');
      setInviteFirst('');
      setInviteLast('');
      setInviteOpen(false);
    } catch (e) {
      toast.push(e instanceof Error ? e.message : 'Invitation failed', 'error');
    } finally {
      setInviting(false);
    }
  };

  return (
    <main className="layout">
      <TopBar user={user} tab="team" onTab={onTab} />

      <section className="summary-grid team-summary">
        <article className="card kpi"><h2>{counts.total}</h2><p>Team Members</p></article>
        <article className="card kpi"><h2>{counts.admins}</h2><p>Super Admins</p></article>
        <article className="card kpi"><h2>{counts.directors}</h2><p>Directors</p></article>
        <article className="card kpi"><h2>{counts.supervisors}</h2><p>Site Supervisors</p></article>
        {counts.inactive > 0 && (
          <article className="card kpi"><h2>{counts.inactive}</h2><p>Deactivated</p></article>
        )}
      </section>

      <section className="card">
        <div className="section-heading">
          <div>
            <h3>Team</h3>
            <p>
              Roles control what people can do; supervisors are locked to their site.
              {canEdit ? ' Changes save immediately.' : ' Only a Super Admin can make changes.'}
            </p>
          </div>
          {canEdit && (
            <button onClick={() => setInviteOpen((v) => !v)}>
              {inviteOpen ? 'Close invite' : '+ Invite site supervisor'}
            </button>
          )}
        </div>

        {inviteOpen && (
          <div className="invite-box">
            <div className="form-grid">
              <label>
                Email
                <input value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="name@company.com" type="email" />
              </label>
              <label>
                First name
                <input value={inviteFirst} onChange={(e) => setInviteFirst(e.target.value)} />
              </label>
              <label>
                Last name
                <input value={inviteLast} onChange={(e) => setInviteLast(e.target.value)} />
              </label>
              <label>
                Site
                <select value={inviteSiteId} onChange={(e) => setInviteSiteId(e.target.value)}>
                  {sites.map((s) => (
                    <option key={s.id} value={s.id}>{s.code} — {s.name}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="actions" style={{ marginTop: 12 }}>
              <button onClick={() => void handleInvite()} disabled={inviting}>
                {inviting ? 'Sending…' : 'Send invitation'}
              </button>
            </div>
            <p className="subtle" style={{ marginTop: 10 }}>
              They&apos;ll get an email, sign up, and land already scoped to that site as a
              Site Supervisor. To add admins or directors instead, add them to your company&apos;s
              organization in Clerk — org admins arrive as Super Admins, members as Directors.
            </p>
          </div>
        )}

        {loading ? (
          <p className="subtle">Loading team…</p>
        ) : (
          <div className="team-list">
            {team.map((member) => {
              const isSelf = member.id === user.id;
              const busy = savingId === member.id;
              return (
                <div key={member.id} className={`team-row${member.isActive ? '' : ' inactive'}`}>
                  <div className="team-identity">
                    <span className="team-name">
                      {displayName(member)}
                      {isSelf && <span className="chip-you">you</span>}
                      {!member.isActive && <span className="badge never_calibrated">deactivated</span>}
                    </span>
                    <span className="team-email">{member.email ?? 'no email on file'}</span>
                  </div>

                  <div className="team-controls">
                    <label className="location-select">
                      <span>Role</span>
                      <select
                        value={member.role}
                        disabled={!canEdit || isSelf || busy || !member.isActive}
                        title={ROLE_HINT[member.role]}
                        onChange={(e) =>
                          void applyUpdate(
                            member,
                            { role: e.target.value as UserRole },
                            `${displayName(member)} is now ${ROLE_LABEL[e.target.value as UserRole]}`,
                          )
                        }
                      >
                        {(Object.keys(ROLE_LABEL) as UserRole[]).map((r) => (
                          <option key={r} value={r}>{ROLE_LABEL[r]}</option>
                        ))}
                      </select>
                    </label>

                    {member.role === 'site_supervisor' && (
                      <label className="location-select">
                        <span>Site</span>
                        <select
                          value={member.siteId ?? ''}
                          disabled={!canEdit || busy || !member.isActive}
                          onChange={(e) =>
                            void applyUpdate(
                              member,
                              { siteId: e.target.value || null },
                              `${displayName(member)} moved to ${
                                sites.find((s) => s.id === e.target.value)?.name ?? 'inventory only'
                              }`,
                            )
                          }
                        >
                          <option value="">No site (inventory only)</option>
                          {sites.map((s) => (
                            <option key={s.id} value={s.id}>{s.code} — {s.name}</option>
                          ))}
                        </select>
                      </label>
                    )}

                    {canEdit && !isSelf && (
                      <button
                        type="button"
                        className={member.isActive ? 'danger-button' : 'secondary-button'}
                        disabled={busy}
                        onClick={() =>
                          void applyUpdate(
                            member,
                            { isActive: !member.isActive },
                            member.isActive
                              ? `${displayName(member)} deactivated — they can no longer sign in`
                              : `${displayName(member)} reactivated`,
                          )
                        }
                      >
                        {busy ? 'Saving…' : member.isActive ? 'Deactivate' : 'Reactivate'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="card">
        <h3>How roles work</h3>
        <ul className="role-legend">
          {(Object.keys(ROLE_LABEL) as UserRole[]).map((r) => (
            <li key={r}>
              <strong>{ROLE_LABEL[r]}</strong> — {ROLE_HINT[r]}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
};
