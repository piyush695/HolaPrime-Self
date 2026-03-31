import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api.js';
import { useAuthStore } from '../../lib/api.js';
import {
  PageHeader, Card, Btn, Spinner, Badge, StatusBadge, Table, Empty,
} from '../../components/ui.js';

const ROLES = [
  { value:'superadmin',  label:'Super Admin',  desc:'Full platform access, can manage all admins and settings',   color:'#FF4C6A' },
  { value:'admin',       label:'Admin',         desc:'Full access except cannot manage Super Admins',              color:'#3F8FE0' },
  { value:'compliance',  label:'Compliance',    desc:'KYC, risk flags, country controls, audit log',              color:'#F5B326' },
  { value:'support',     label:'Support',       desc:'Users, tickets, read-only account access',                  color:'#38BA82' },
  { value:'finance',     label:'Finance',       desc:'Payouts, payments, financial reports',                      color:'#A78BFA' },
  { value:'risk',        label:'Risk',          desc:'Risk dashboard, fraud flags, trading accounts',             color:'#F97316' },
];

const ROLE_COLOR: Record<string, string> = Object.fromEntries(ROLES.map(r => [r.value, r.color]));
const ROLE_LABEL: Record<string, string> = Object.fromEntries(ROLES.map(r => [r.value, r.label]));

function genPassword(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
  return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

const inp: React.CSSProperties = {
  width:'100%', background:'rgba(255,255,255,.05)', color:'#F5F8FF',
  border:'1px solid #353947', borderRadius:8, padding:'9px 12px',
  fontSize:13, outline:'none', fontFamily:'inherit', boxSizing:'border-box',
};
const selStyle: React.CSSProperties = { ...inp, cursor:'pointer' };

function RoleBadge({ role }: { role: string }) {
  const color = ROLE_COLOR[role] ?? '#64748B';
  const label = ROLE_LABEL[role] ?? role;
  return (
    <span style={{ fontSize:11, fontWeight:700, padding:'3px 10px', borderRadius:20,
      background:`${color}18`, color, border:`1px solid ${color}44` }}>
      {label}
    </span>
  );
}

function AdminInviteModal({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState({ email:'', firstName:'', lastName:'', role:'support', sendEmail:true });
  const [generatedPassword, setGeneratedPassword] = useState(genPassword());
  const [step, setStep] = useState<'form'|'success'>('form');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [sendingInvite, setSendingInvite] = useState(false);
  const qc = useQueryClient();
  const me = useAuthStore(s => s.admin);

  function f(k: string, v: any) { setForm(p => ({ ...p, [k]: v })); }

  async function create() {
    setError('');
    if (!form.email || !form.firstName || !form.role) {
      setError('Email, first name, and role are required'); return;
    }
    setSaving(true);
    try {
      await api.post('/settings/admins', {
        email: form.email, firstName: form.firstName,
        lastName: form.lastName, role: form.role, password: generatedPassword,
      });
      // Send invite email with credentials
      if (form.sendEmail) {
        setSendingInvite(true);
        try {
          await api.post('/settings/admins/invite', {
            email: form.email, firstName: form.firstName,
            role: form.role, tempPassword: generatedPassword,
          });
        } catch { /* email failure shouldn't block admin creation */ }
        setSendingInvite(false);
      }
      qc.invalidateQueries({ queryKey:['admins'] });
      setStep('success');
    } catch(e: any) {
      setError(e?.response?.data?.error ?? e.message ?? 'Failed to create admin');
    }
    setSaving(false);
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'#00000099', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ background:'#1C1F27', border:'1px solid #353947', borderRadius:16, width:520, maxHeight:'90vh', overflowY:'auto', boxShadow:'0 32px 80px rgba(0,0,0,.7)' }}>
        <div style={{ padding:'20px 24px', borderBottom:'1px solid #353947', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div style={{ fontSize:16, fontWeight:800, color:'#F5F8FF' }}>{step === 'form' ? 'Invite Admin User' : 'Admin Invited ✅'}</div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'#878FA4', fontSize:22, cursor:'pointer' }}>×</button>
        </div>

        {step === 'form' ? (
          <div style={{ padding:24 }}>
            {/* Role info cards */}
            <div style={{ marginBottom:20 }}>
              <div style={{ fontSize:11, color:'#64748B', fontWeight:700, marginBottom:10, textTransform:'uppercase', letterSpacing:'.05em' }}>
                Choose a role
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                {ROLES.map(r => (
                  <button key={r.value} onClick={() => f('role', r.value)} style={{
                    padding:'10px 12px', borderRadius:8, border:`1px solid ${form.role === r.value ? r.color : '#353947'}`,
                    background: form.role === r.value ? `${r.color}12` : '#252931',
                    cursor:'pointer', textAlign:'left', transition:'all .15s',
                  }}>
                    <div style={{ fontSize:12, fontWeight:800, color: form.role === r.value ? r.color : '#F5F8FF', marginBottom:2 }}>
                      {r.value === 'superadmin' && '⭐ '}{r.label}
                    </div>
                    <div style={{ fontSize:10, color:'#64748B', lineHeight:1.4 }}>{r.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
              <div>
                <label style={{ fontSize:11, color:'#8892B0', display:'block', marginBottom:5, fontWeight:700 }}>First Name *</label>
                <input value={form.firstName} onChange={e => f('firstName', e.target.value)} placeholder="Jane" style={inp} />
              </div>
              <div>
                <label style={{ fontSize:11, color:'#8892B0', display:'block', marginBottom:5, fontWeight:700 }}>Last Name</label>
                <input value={form.lastName} onChange={e => f('lastName', e.target.value)} placeholder="Smith" style={inp} />
              </div>
            </div>

            <div style={{ marginBottom:16 }}>
              <label style={{ fontSize:11, color:'#8892B0', display:'block', marginBottom:5, fontWeight:700 }}>Email Address *</label>
              <input value={form.email} onChange={e => f('email', e.target.value)} placeholder="jane@holaprime.com" type="email" style={inp} />
            </div>

            {/* Auto-generated password */}
            <div style={{ marginBottom:16, padding:'14px 16px', background:'rgba(255,255,255,.03)', borderRadius:10, border:'1px solid #252D3D' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                <div style={{ fontSize:11, color:'#8892B0', fontWeight:700, textTransform:'uppercase', letterSpacing:'.05em' }}>Auto-generated Password</div>
                <button onClick={() => setGeneratedPassword(genPassword())} style={{
                  padding:'3px 10px', borderRadius:6, border:'1px solid #353947', background:'#252931',
                  color:'#8892B0', fontSize:11, cursor:'pointer',
                }}>↻ Regenerate</button>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <code style={{ fontSize:16, fontWeight:800, color:'#F5B326', letterSpacing:'2px', flex:1 }}>
                  {generatedPassword}
                </code>
                <button onClick={() => navigator.clipboard.writeText(generatedPassword)} style={{
                  padding:'4px 10px', borderRadius:6, border:'1px solid #353947', background:'#252931',
                  color:'#8892B0', fontSize:11, cursor:'pointer',
                }}>Copy</button>
              </div>
              <div style={{ fontSize:11, color:'#4F5669', marginTop:8 }}>
                The user will be prompted to change this on first login.
              </div>
            </div>

            <div style={{ marginBottom:20, display:'flex', alignItems:'center', gap:10 }}>
              <input type="checkbox" id="sendEmail" checked={form.sendEmail} onChange={e => f('sendEmail', e.target.checked)}
                style={{ width:16, height:16, cursor:'pointer' }} />
              <label htmlFor="sendEmail" style={{ fontSize:13, color:'#D8E0F0', cursor:'pointer' }}>
                Send invite email with login credentials
              </label>
            </div>

            {error && (
              <div style={{ padding:'10px 14px', background:'rgba(255,76,106,.1)', border:'1px solid rgba(255,76,106,.3)', borderRadius:8, fontSize:13, color:'#FF4C6A', marginBottom:14 }}>
                ❌ {error}
              </div>
            )}

            <div style={{ display:'flex', gap:10 }}>
              <Btn onClick={create} disabled={saving}>{saving ? (sendingInvite ? '📧 Sending invite…' : '⏳ Creating…') : 'Create & Invite'}</Btn>
              <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
            </div>
          </div>
        ) : (
          <div style={{ padding:32, textAlign:'center' }}>
            <div style={{ fontSize:48, marginBottom:16 }}>✅</div>
            <div style={{ fontSize:18, fontWeight:800, color:'#F5F8FF', marginBottom:8 }}>
              {form.firstName} has been invited!
            </div>
            <div style={{ fontSize:14, color:'#8892B0', marginBottom:24, lineHeight:1.6 }}>
              {form.sendEmail
                ? `An invite email has been sent to ${form.email} with their temporary password.`
                : `Account created. Share these credentials manually:`}
            </div>
            {!form.sendEmail && (
              <div style={{ background:'#1C2A3A', borderRadius:10, padding:16, marginBottom:24, textAlign:'left' }}>
                <div style={{ fontSize:12, color:'#64748B', marginBottom:4 }}>Email</div>
                <code style={{ color:'#60A9F0' }}>{form.email}</code>
                <div style={{ fontSize:12, color:'#64748B', marginTop:12, marginBottom:4 }}>Temp Password</div>
                <code style={{ color:'#F5B326', fontSize:16, letterSpacing:'2px' }}>{generatedPassword}</code>
              </div>
            )}
            <Btn onClick={onClose}>Done</Btn>
          </div>
        )}
      </div>
    </div>
  );
}

function ChangePasswordModal({ adminId, onClose }: { adminId: string; onClose: () => void }) {
  const [form, setForm] = useState({ currentPassword:'', newPassword:'', confirm:'' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const me = useAuthStore(s => s.admin);
  const isSelf = me?.id === adminId;

  function f(k: string, v: string) { setForm(p => ({ ...p, [k]: v })); }

  async function save() {
    setError('');
    if (form.newPassword.length < 8) { setError('New password must be at least 8 characters'); return; }
    if (form.newPassword !== form.confirm) { setError('Passwords do not match'); return; }
    setSaving(true);
    try {
      if (isSelf) {
        if (!form.currentPassword) { setError('Current password is required'); setSaving(false); return; }
        await api.post('/settings/admins/me/change-password', {
          currentPassword: form.currentPassword,
          newPassword: form.newPassword,
        });
      } else {
        await api.post(`/settings/admins/${adminId}/reset-password`, { password: form.newPassword });
      }
      setSuccess(true);
    } catch(e: any) {
      setError(e?.response?.data?.error ?? e.message ?? 'Failed to change password');
    }
    setSaving(false);
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'#00000099', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ background:'#1C1F27', border:'1px solid #353947', borderRadius:14, width:420, padding:24 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
          <div style={{ fontSize:16, fontWeight:800, color:'#F5F8FF' }}>
            {isSelf ? 'Change My Password' : 'Reset Password'}
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'#878FA4', fontSize:22, cursor:'pointer' }}>×</button>
        </div>
        {success ? (
          <div style={{ textAlign:'center', padding:'20px 0' }}>
            <div style={{ fontSize:40, marginBottom:12 }}>✅</div>
            <div style={{ fontSize:15, fontWeight:700, color:'#38BA82' }}>Password changed successfully</div>
            <div style={{ marginTop:16 }}><Btn onClick={onClose}>Done</Btn></div>
          </div>
        ) : (
          <>
            {isSelf && (
              <div style={{ marginBottom:12 }}>
                <label style={{ fontSize:11, color:'#8892B0', display:'block', marginBottom:5, fontWeight:700 }}>Current Password</label>
                <input type="password" value={form.currentPassword} onChange={e => f('currentPassword', e.target.value)} style={inp} />
              </div>
            )}
            <div style={{ marginBottom:12 }}>
              <label style={{ fontSize:11, color:'#8892B0', display:'block', marginBottom:5, fontWeight:700 }}>New Password (min 8 chars)</label>
              <input type="password" value={form.newPassword} onChange={e => f('newPassword', e.target.value)} style={inp} />
            </div>
            <div style={{ marginBottom:16 }}>
              <label style={{ fontSize:11, color:'#8892B0', display:'block', marginBottom:5, fontWeight:700 }}>Confirm New Password</label>
              <input type="password" value={form.confirm} onChange={e => f('confirm', e.target.value)} style={inp}
                onKeyDown={e => e.key === 'Enter' && save()} />
            </div>
            {error && (
              <div style={{ padding:'10px 14px', background:'rgba(255,76,106,.1)', border:'1px solid rgba(255,76,106,.3)', borderRadius:8, fontSize:13, color:'#FF4C6A', marginBottom:14 }}>
                ❌ {error}
              </div>
            )}
            <div style={{ display:'flex', gap:10 }}>
              <Btn onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Change Password'}</Btn>
              <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function Settings() {
  const [tab, setTab] = useState<'general'|'admins'|'myprofile'|'platform'|'audit'>('general');
  const [showInvite, setShowInvite] = useState(false);
  const [changePwdFor, setChangePwdFor] = useState<string | null>(null);
  const [editAdmin, setEditAdmin] = useState<any>(null);
  const [auditPage, setAuditPage] = useState(1);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState(false);
  const qc = useQueryClient();
  const me = useAuthStore(s => s.admin);

  const { data: settingsData } = useQuery({
    queryKey: ['settings'],
    queryFn: () => api.get('/settings').then(r => r.data),
    enabled: tab === 'general',
    onSuccess: (d: any) => {
      const flat: Record<string, string> = {};
      for (const [k, v] of Object.entries(d?.settings ?? {})) flat[k] = String(v ?? '');
      setSettings(flat);
    },
  } as any);

  const { data: admins, isLoading: adminsLoading } = useQuery({
    queryKey: ['admins'],
    queryFn: () => api.get('/settings/admins').then(r => r.data),
    enabled: tab === 'admins',
  });

  const { data: myProfile } = useQuery({
    queryKey: ['my-profile'],
    queryFn: () => api.get('/settings/admins/me').then(r => r.data),
    enabled: tab === 'myprofile',
  });

  const { data: auditData } = useQuery({
    queryKey: ['audit', auditPage],
    queryFn: () => api.get('/settings/audit-log', { params:{ page: auditPage, limit:30 } }).then(r => r.data),
    enabled: tab === 'audit',
  });

  const saveSettings = useMutation({
    mutationFn: () => api.post('/settings/bulk', { settings }),
    onSuccess: () => { setDirty(false); qc.invalidateQueries({ queryKey:['settings'] }); },
  });

  const toggleAdmin = useMutation({
    mutationFn: ({ id, isActive }: { id:string; isActive:boolean }) =>
      api.patch(`/settings/admins/${id}`, { isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey:['admins'] }),
  });

  const updateRole = useMutation({
    mutationFn: ({ id, role }: { id:string; role:string }) =>
      api.patch(`/settings/admins/${id}`, { role }),
    onSuccess: () => { qc.invalidateQueries({ queryKey:['admins'] }); setEditAdmin(null); },
  });

  const SETTINGS_FIELDS = [
    { key:'platform_name',     label:'Platform Name',     type:'text' },
    { key:'support_email',     label:'Support Email',     type:'email' },
    { key:'payout_currency',   label:'Default Currency',  type:'text' },
    { key:'min_payout_amount', label:'Min Payout Amount', type:'number' },
  ];

  return (
    <>
      <PageHeader title="Settings" sub="Platform configuration, admin users, and audit log" />

      {showInvite && <AdminInviteModal onClose={() => setShowInvite(false)} />}
      {changePwdFor && <ChangePasswordModal adminId={changePwdFor} onClose={() => setChangePwdFor(null)} />}

      {/* Edit role modal */}
      {editAdmin && (
        <div style={{ position:'fixed', inset:0, background:'#00000099', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div style={{ background:'#1C1F27', border:'1px solid #353947', borderRadius:14, width:420, padding:24 }}>
            <div style={{ fontSize:16, fontWeight:800, color:'#F5F8FF', marginBottom:16 }}>
              Change Role — {editAdmin.first_name} {editAdmin.last_name}
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:20 }}>
              {ROLES.map(r => (
                <button key={r.value} onClick={() => setEditAdmin({ ...editAdmin, newRole: r.value })} style={{
                  padding:'10px 12px', borderRadius:8, border:`1px solid ${(editAdmin.newRole ?? editAdmin.role) === r.value ? r.color : '#353947'}`,
                  background:(editAdmin.newRole ?? editAdmin.role) === r.value ? `${r.color}12` : '#252931',
                  cursor:'pointer', textAlign:'left',
                }}>
                  <div style={{ fontSize:12, fontWeight:700, color:(editAdmin.newRole ?? editAdmin.role) === r.value ? r.color : '#F5F8FF' }}>{r.label}</div>
                  <div style={{ fontSize:10, color:'#64748B' }}>{r.desc}</div>
                </button>
              ))}
            </div>
            <div style={{ display:'flex', gap:10 }}>
              <Btn onClick={() => updateRole.mutate({ id: editAdmin.id, role: editAdmin.newRole ?? editAdmin.role })} disabled={updateRole.isPending}>
                Save Role
              </Btn>
              <Btn variant="secondary" onClick={() => setEditAdmin(null)}>Cancel</Btn>
            </div>
          </div>
        </div>
      )}

      {/* Tab bar */}
      <div style={{ display:'flex', gap:0, marginBottom:24, borderBottom:'1px solid #353947' }}>
        {([
          { id:'general',   label:'⚙️ General' },
          { id:'admins',    label:'👥 Admin Users' },
          { id:'myprofile', label:'👤 My Profile' },
          { id:'platform',  label:'🔌 Platform Health' },
          { id:'audit',     label:'📋 Audit Log' },
        ] as { id: typeof tab, label: string }[]).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding:'10px 18px', fontSize:13, fontWeight: tab===t.id ? 700 : 400,
            color: tab===t.id ? '#F5F8FF' : '#878FA4',
            background:'none', border:'none', cursor:'pointer',
            borderBottom: tab===t.id ? '2px solid #3F8FE0' : '2px solid transparent',
          }}>{t.label}</button>
        ))}
      </div>

      {/* General settings */}
      {tab === 'general' && (
        <Card>
          <div style={{ display:'grid', gap:14, maxWidth:480 }}>
            {SETTINGS_FIELDS.map(f => (
              <div key={f.key}>
                <label style={{ fontSize:11, color:'#8892B0', display:'block', marginBottom:5, fontWeight:700 }}>{f.label}</label>
                <input type={f.type} value={settings[f.key] ?? ''}
                  onChange={e => { setSettings(p => ({ ...p, [f.key]: e.target.value })); setDirty(true); }}
                  style={inp} />
              </div>
            ))}
            <Btn onClick={() => saveSettings.mutate()} disabled={!dirty || saveSettings.isPending}>
              {saveSettings.isPending ? 'Saving…' : 'Save Settings'}
            </Btn>
          </div>
        </Card>
      )}

      {/* Admin users */}
      {tab === 'admins' && (
        <div>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
            <div style={{ fontSize:13, color:'#8892B0' }}>
              {admins?.length ?? 0} admin user{admins?.length !== 1 ? 's' : ''} · Only <strong style={{ color:'#F5F8FF' }}>Super Admins</strong> can invite other Super Admins
            </div>
            <Btn onClick={() => setShowInvite(true)}>+ Invite Admin</Btn>
          </div>

          {adminsLoading
            ? <div style={{ display:'flex', justifyContent:'center', padding:40 }}><Spinner /></div>
            : (
              <div style={{ display:'grid', gap:10 }}>
                {(admins ?? []).map((a: any) => (
                  <Card key={a.id} style={{ display:'flex', alignItems:'center', gap:16, padding:'14px 20px' }}>
                    {/* Avatar */}
                    <div style={{ width:40, height:40, borderRadius:'50%', background:`${ROLE_COLOR[a.role] ?? '#3F8FE0'}22`,
                      border:`2px solid ${ROLE_COLOR[a.role] ?? '#3F8FE0'}44`, display:'flex', alignItems:'center',
                      justifyContent:'center', fontSize:16, fontWeight:800, color:ROLE_COLOR[a.role] ?? '#3F8FE0', flexShrink:0 }}>
                      {a.first_name?.[0]?.toUpperCase()}{a.last_name?.[0]?.toUpperCase()}
                    </div>
                    {/* Info */}
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:3 }}>
                        <span style={{ fontSize:14, fontWeight:700, color:'#F5F8FF' }}>{a.first_name} {a.last_name}</span>
                        <RoleBadge role={a.role} />
                        {a.id === me?.id && (
                          <span style={{ fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:20, background:'rgba(63,143,224,.15)', color:'#60A9F0', border:'1px solid rgba(63,143,224,.3)' }}>YOU</span>
                        )}
                        {!a.is_active && (
                          <span style={{ fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:20, background:'rgba(255,76,106,.1)', color:'#FF4C6A', border:'1px solid rgba(255,76,106,.3)' }}>SUSPENDED</span>
                        )}
                      </div>
                      <div style={{ fontSize:12, color:'#64748B' }}>{a.email}</div>
                      <div style={{ fontSize:11, color:'#4F5669', marginTop:2 }}>
                        Last login: {a.last_login_at ? new Date(a.last_login_at).toLocaleString() : 'Never'}
                        &nbsp;· Joined {new Date(a.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    {/* Actions */}
                    <div style={{ display:'flex', gap:8, flexShrink:0 }}>
                      {(me?.role === 'superadmin' || (me?.role === 'admin' && a.role !== 'superadmin')) && a.id !== me?.id && (
                        <>
                          <button onClick={() => setEditAdmin(a)} style={{ padding:'5px 12px', borderRadius:6,
                            border:'1px solid #353947', background:'#252931', color:'#8892B0', fontSize:11, cursor:'pointer' }}>
                            Change Role
                          </button>
                          <button onClick={() => toggleAdmin.mutate({ id:a.id, isActive:!a.is_active })} style={{ padding:'5px 12px', borderRadius:6,
                            border:`1px solid ${a.is_active ? 'rgba(255,76,106,.3)' : 'rgba(56,186,130,.3)'}`,
                            background: a.is_active ? 'rgba(255,76,106,.05)' : 'rgba(56,186,130,.05)',
                            color: a.is_active ? '#FF4C6A' : '#38BA82', fontSize:11, cursor:'pointer' }}>
                            {a.is_active ? 'Suspend' : 'Reactivate'}
                          </button>
                        </>
                      )}
                      <button onClick={() => setChangePwdFor(a.id)} style={{ padding:'5px 12px', borderRadius:6,
                        border:'1px solid #353947', background:'#252931', color:'#8892B0', fontSize:11, cursor:'pointer' }}>
                        {a.id === me?.id ? 'My Password' : 'Reset Password'}
                      </button>
                    </div>
                  </Card>
                ))}
                {!admins?.length && <Empty icon="👥" message="No admin users" sub="Invite your first admin" />}
              </div>
            )}
        </div>
      )}

      {/* My Profile */}
      {tab === 'myprofile' && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>
          <Card>
            <div style={{ fontSize:14, fontWeight:800, color:'#F5F8FF', marginBottom:16 }}>My Profile</div>
            {myProfile && (
              <div>
                <div style={{ display:'flex', alignItems:'center', gap:16, marginBottom:20 }}>
                  <div style={{ width:56, height:56, borderRadius:'50%', background:`${ROLE_COLOR[myProfile.role] ?? '#3F8FE0'}22`,
                    border:`2px solid ${ROLE_COLOR[myProfile.role] ?? '#3F8FE0'}44`, display:'flex', alignItems:'center',
                    justifyContent:'center', fontSize:22, fontWeight:900, color:ROLE_COLOR[myProfile.role] ?? '#3F8FE0' }}>
                    {myProfile.first_name?.[0]?.toUpperCase()}{myProfile.last_name?.[0]?.toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontSize:16, fontWeight:800, color:'#F5F8FF' }}>{myProfile.first_name} {myProfile.last_name}</div>
                    <div style={{ marginTop:4 }}><RoleBadge role={myProfile.role} /></div>
                  </div>
                </div>
                {[
                  { label:'Email', value:myProfile.email },
                  { label:'Role',  value:ROLE_LABEL[myProfile.role] ?? myProfile.role },
                  { label:'Member since', value: new Date(myProfile.created_at).toLocaleDateString() },
                  { label:'Last login', value: myProfile.last_login_at ? new Date(myProfile.last_login_at).toLocaleString() : 'N/A' },
                ].map(f => (
                  <div key={f.label} style={{ display:'flex', justifyContent:'space-between', padding:'10px 0', borderBottom:'1px solid #1E2535' }}>
                    <span style={{ fontSize:12, color:'#64748B' }}>{f.label}</span>
                    <span style={{ fontSize:13, color:'#D8E0F0', fontWeight:600 }}>{f.value}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <div style={{ fontSize:14, fontWeight:800, color:'#F5F8FF', marginBottom:16 }}>Change Password</div>
            <p style={{ fontSize:13, color:'#8892B0', marginBottom:20, lineHeight:1.6 }}>
              Use a strong password with at least 8 characters including uppercase, lowercase, and numbers.
            </p>
            <Btn onClick={() => setChangePwdFor(me?.id ?? '')}>Change My Password</Btn>
          </Card>
        </div>
      )}

      {/* Platform health */}
      {tab === 'platform' && (
        <Card>
          <div style={{ fontSize:13, color:'#64748B', padding:40, textAlign:'center' }}>
            Platform health monitoring — connect trading platforms in Integrations Hub to see live status.
          </div>
        </Card>
      )}

      {/* Audit log */}
      {tab === 'audit' && (
        <Card>
          {auditData?.rows?.length
            ? (
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                <thead>
                  <tr style={{ borderBottom:'1px solid #252D3D' }}>
                    {['Admin','Action','Entity','Time'].map(h => (
                      <th key={h} style={{ padding:'8px 12px', textAlign:'left', color:'#64748B', fontWeight:700 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(auditData.rows ?? []).map((r: any) => (
                    <tr key={r.id} style={{ borderBottom:'1px solid #1E2535' }}>
                      <td style={{ padding:'10px 12px', color:'#D8E0F0' }}>{r.admin_email ?? r.admin_id?.slice(0,8)}</td>
                      <td style={{ padding:'10px 12px' }}>
                        <code style={{ fontSize:11, color:'#60A9F0' }}>{r.action}</code>
                      </td>
                      <td style={{ padding:'10px 12px', color:'#8892B0' }}>{r.entity_type}</td>
                      <td style={{ padding:'10px 12px', color:'#4F5669', fontSize:11 }}>
                        {new Date(r.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
            : <Empty icon="📋" message="No audit log entries yet" />}
        </Card>
      )}
    </>
  );
}
