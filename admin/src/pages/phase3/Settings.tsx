import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api.js';
import {
  PageHeader, Card, CardHeader, Table, Pagination,
  StatCard, Btn, Input, Select, Spinner, Badge, StatusBadge, Empty,
} from '../../components/ui.js';

const ROLES = ['admin','compliance','support','finance','risk'].map(r => ({ value:r, label:r }));

export default function Settings() {
  const [tab, setTab] = useState<'general'|'admins'|'platform'|'audit'>('general');
  const [showNewAdmin, setShowNewAdmin] = useState(false);
  const [newAdmin, setNewAdmin] = useState({ email:'', firstName:'', lastName:'', role:'support', password:'' });
  const [auditPage, setAuditPage] = useState(1);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState(false);
  const qc = useQueryClient();

  const { data: settingsData } = useQuery({
    queryKey: ['settings'],
    queryFn:  () => api.get('/settings').then(r => r.data),
    onSuccess: (d: any) => setSettings(
      Object.fromEntries(Object.entries(d.settings ?? {}).map(([k,v]) => [k, String(v)]))
    ),
  } as any);

  const { data: admins } = useQuery({
    queryKey: ['admins'],
    queryFn:  () => api.get('/settings/admins').then(r => r.data),
    enabled:  tab === 'admins',
  });

  const { data: health } = useQuery({
    queryKey: ['platform-health'],
    queryFn:  () => api.get('/settings/platform-health').then(r => r.data),
    enabled:  tab === 'platform',
    refetchInterval: 30_000,
  });

  const { data: audit } = useQuery({
    queryKey: ['audit-log', auditPage],
    queryFn:  () => api.get('/settings/audit-log', { params:{ page: auditPage, limit: 50 } }).then(r => r.data),
    enabled:  tab === 'audit',
  });

  const saveSettings = useMutation({
    mutationFn: () => api.put('/settings', settings),
    onSuccess:  () => { setDirty(false); qc.invalidateQueries({ queryKey:['settings'] }); },
  });

  const createAdmin = useMutation({
    mutationFn: () => api.post('/settings/admins', {
      email: newAdmin.email, firstName: newAdmin.firstName,
      lastName: newAdmin.lastName, role: newAdmin.role, password: newAdmin.password,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey:['admins'] });
      setShowNewAdmin(false);
      setNewAdmin({ email:'', firstName:'', lastName:'', role:'support', password:'' });
    },
  });

  const toggleAdmin = useMutation({
    mutationFn: ({ id, isActive }: { id:string; isActive:boolean }) =>
      api.patch(`/settings/admins/${id}`, { isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey:['admins'] }),
  });

  const set = (k: string, v: string) => { setSettings(p => ({ ...p, [k]: v })); setDirty(true); };

  const PLATFORM_COLS: Record<string, string> = {
    mt5:'#3F8FE0', ctrader:'#38BA82', matchtrader:'#F5B326',
    ninjatrader:'#8B5CF6', tradovate:'#14B8A6',
  };

  const adminCols = [
    { key:'name', label:'Admin',
      render:(r:any) => (
        <div>
          <div style={{ fontWeight:600, color:'#F5F8FF' }}>{r.first_name} {r.last_name}</div>
          <div style={{ fontSize:11, color:'#4F5669' }}>{r.email}</div>
        </div>
      ),
    },
    { key:'role',      label:'Role',      width:110, render:(r:any) => <Badge label={r.role} variant="blue" /> },
    { key:'is_active', label:'Status',    width:90,  render:(r:any) => <Badge label={r.is_active?'active':'inactive'} variant={r.is_active?'green':'default'} /> },
    { key:'last_login_at', label:'Last Login', width:140,
      render:(r:any) => <span style={{ color:'#878FA4', fontSize:11 }}>{r.last_login_at ? new Date(r.last_login_at).toLocaleString() : 'Never'}</span> },
    { key:'actions', label:'', width:100,
      render:(r:any) => (
        <Btn size="sm" variant="secondary"
          onClick={() => toggleAdmin.mutate({ id:r.id, isActive:!r.is_active })}>
          {r.is_active ? 'Disable' : 'Enable'}
        </Btn>
      ),
    },
  ];

  const auditCols = [
    { key:'ts', label:'Time', width:140,
      render:(r:any) => <span style={{ color:'#878FA4', fontSize:11 }}>{new Date(r.created_at).toLocaleString()}</span> },
    { key:'admin', label:'Admin', width:160,
      render:(r:any) => <span style={{ color:'#CCD2E3' }}>{r.first_name} {r.last_name}</span> },
    { key:'action', label:'Action', width:200,
      render:(r:any) => <code style={{ fontSize:11, color:'#3F8FE0' }}>{r.action}</code> },
    { key:'entity_type', label:'Entity', width:120,
      render:(r:any) => r.entity_type ? <Badge label={r.entity_type} variant="teal" /> : null },
  ];

  return (
    <>
      <PageHeader title="Settings" sub="Platform configuration, admin users, and system health" />

      <div style={{ display:'flex', gap:0, marginBottom:20, borderBottom:'1px solid #353947' }}>
        {[
          { id:'general',  label:'General' },
          { id:'admins',   label:'Admin Users' },
          { id:'platform', label:'Platform Health' },
          { id:'audit',    label:'Audit Log' },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id as any)} style={{
            padding:'10px 20px', fontSize:13, fontWeight:tab===t.id?700:400,
            color:tab===t.id?'#F5F8FF':'#878FA4', background:'none', border:'none',
            cursor:'pointer', borderBottom:tab===t.id?'2px solid #3F8FE0':'2px solid transparent',
          }}>{t.label}</button>
        ))}
      </div>

      {/* General settings */}
      {tab === 'general' && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
          {/* Platform settings */}
          <Card>
            <CardHeader title="Platform" sub="Core platform configuration" />
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {[
                { key:'platform.name',          label:'Platform Name' },
                { key:'platform.support_email', label:'Support Email' },
                { key:'platform.currency',      label:'Default Currency' },
                { key:'platform.timezone',      label:'Timezone' },
              ].map(f => (
                <div key={f.key}>
                  <div style={{ fontSize:11, color:'#878FA4', marginBottom:4 }}>{f.label}</div>
                  <Input
                    value={settings[f.key] ?? ''}
                    onChange={v => set(f.key, v)}
                    style={{ width:'100%' }}
                  />
                </div>
              ))}
            </div>
          </Card>

          {/* Feature flags */}
          <Card>
            <CardHeader title="Feature Flags" />
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              {[
                { key:'challenges.enabled',   label:'New Challenge Purchases' },
                { key:'kyc.required',         label:'KYC Required to Trade' },
                { key:'kyc.auto_approve',     label:'Auto-Approve KYC' },
                { key:'payouts.auto_approve', label:'Auto-Approve Payouts' },
                { key:'maintenance.enabled',  label:'Maintenance Mode' },
              ].map(f => {
                const val = settings[f.key] === 'true';
                return (
                  <div key={f.key} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 10px', background:'#252931', borderRadius:6 }}>
                    <span style={{ fontSize:13, color:'#CCD2E3' }}>{f.label}</span>
                    <button
                      onClick={() => set(f.key, val ? 'false' : 'true')}
                      style={{
                        width:40, height:22, borderRadius:11, border:'none', cursor:'pointer',
                        background: val ? '#38BA82' : '#353947',
                        position:'relative', transition:'background 0.2s',
                      }}
                    >
                      <div style={{
                        position:'absolute', top:3, left: val ? 21 : 3,
                        width:16, height:16, borderRadius:'50%', background:'#fff',
                        transition:'left 0.2s',
                      }} />
                    </button>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Payout settings */}
          <Card>
            <CardHeader title="Payouts" />
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {[
                { key:'payouts.min_amount',    label:'Minimum Payout (USD)' },
                { key:'payouts.auto_threshold',label:'Auto-Approve Threshold (USD)' },
              ].map(f => (
                <div key={f.key}>
                  <div style={{ fontSize:11, color:'#878FA4', marginBottom:4 }}>{f.label}</div>
                  <Input value={settings[f.key] ?? ''} onChange={v => set(f.key, v)} style={{ width:'100%' }} />
                </div>
              ))}
            </div>
          </Card>

          {/* Maintenance */}
          <Card>
            <CardHeader title="Maintenance Message" />
            <textarea
              value={settings['maintenance.message'] ?? ''}
              onChange={e => set('maintenance.message', e.target.value)}
              rows={3}
              style={{ width:'100%', background:'#252931', color:'#F5F8FF', border:'1px solid #353947', borderRadius:6, padding:'8px', fontSize:13, resize:'vertical' }}
            />
          </Card>

          <div style={{ gridColumn:'1 / -1', display:'flex', justifyContent:'flex-end', gap:8 }}>
            {dirty && <span style={{ fontSize:12, color:'#F5B326', alignSelf:'center' }}>Unsaved changes</span>}
            <Btn variant="primary" disabled={!dirty || saveSettings.isPending} onClick={() => saveSettings.mutate()}>
              {saveSettings.isPending ? 'Saving…' : 'Save Settings'}
            </Btn>
          </div>
        </div>
      )}

      {/* Admin users */}
      {tab === 'admins' && (
        <>
          {showNewAdmin && (
            <div style={{ position:'fixed', inset:0, background:'#00000088', zIndex:100, display:'flex', alignItems:'center', justifyContent:'center' }}>
              <div style={{ background:'#1C1F27', border:'1px solid #353947', borderRadius:12, padding:24, width:440 }}>
                <div style={{ fontWeight:700, color:'#F5F8FF', marginBottom:16 }}>New Admin User</div>
                <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                  {[
                    { key:'firstName', label:'First Name' }, { key:'lastName', label:'Last Name' },
                    { key:'email',     label:'Email' },      { key:'password', label:'Password (min 8)' },
                  ].map(f => (
                    <div key={f.key}>
                      <div style={{ fontSize:11, color:'#878FA4', marginBottom:4 }}>{f.label}</div>
                      <Input value={(newAdmin as any)[f.key]} onChange={v => setNewAdmin(p => ({ ...p, [f.key]:v }))} style={{ width:'100%' }} type={f.key==='password'?'password':'text'} />
                    </div>
                  ))}
                  <div>
                    <div style={{ fontSize:11, color:'#878FA4', marginBottom:4 }}>Role</div>
                    <Select value={newAdmin.role} onChange={v => setNewAdmin(p => ({ ...p, role:v }))} options={ROLES} style={{ width:'100%' }} />
                  </div>
                </div>
                <div style={{ display:'flex', gap:8, marginTop:16 }}>
                  <Btn variant="primary" disabled={!newAdmin.email||!newAdmin.password||createAdmin.isPending} onClick={() => createAdmin.mutate()}>Create</Btn>
                  <Btn variant="secondary" onClick={() => setShowNewAdmin(false)}>Cancel</Btn>
                </div>
              </div>
            </div>
          )}
          <Card>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:16 }}>
              <span style={{ fontSize:15, fontWeight:700, color:'#F5F8FF' }}>Admin Users</span>
              <Btn onClick={() => setShowNewAdmin(true)}>+ Add Admin</Btn>
            </div>
            {!admins ? <Spinner /> : <Table columns={adminCols} data={admins ?? []} />}
          </Card>
        </>
      )}

      {/* Platform health */}
      {tab === 'platform' && (
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:12 }}>
            {health ? Object.entries(health.health ?? {}).map(([platform, h]: [string, any]) => (
              <Card key={platform}>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
                  <div style={{ width:8, height:8, borderRadius:'50%', background: h.connected ? '#38BA82' : '#EB5454' }} />
                  <span style={{ fontSize:13, fontWeight:700, color:'#F5F8FF', textTransform:'capitalize' }}>{platform}</span>
                </div>
                <div style={{ fontSize:11, color: h.connected ? '#38BA82' : '#EB5454' }}>
                  {h.connected ? `Connected · ${h.latencyMs}ms` : h.message ?? 'Offline'}
                </div>
              </Card>
            )) : [1,2,3,4,5].map(i => <Card key={i}><Spinner /></Card>)}
          </div>

          <Card>
            <CardHeader title="Platform Connections" sub="Configured trading platform integrations" />
            {health?.connections?.length === 0
              ? <Empty icon="🔌" message="No platform connections configured" sub="Add connection credentials in .env and restart the API" />
              : <Table
                  columns={[
                    { key:'platform', label:'Platform', render:(r:any) => <Badge label={r.platform} variant="blue" /> },
                    { key:'environment', label:'Env', width:80, render:(r:any) => <Badge label={r.environment} variant={r.environment==='live'?'red':'gold'} /> },
                    { key:'name', label:'Name' },
                    { key:'health_status', label:'Status', width:100, render:(r:any) => <StatusBadge status={r.health_status} /> },
                    { key:'last_health_at', label:'Last Check', width:130, render:(r:any) => r.last_health_at ? <span style={{ color:'#878FA4', fontSize:11 }}>{new Date(r.last_health_at).toLocaleString()}</span> : <span style={{ color:'#4F5669' }}>—</span> },
                  ]}
                  data={health?.connections ?? []}
                />
            }
          </Card>
        </div>
      )}

      {/* Audit log */}
      {tab === 'audit' && (
        <Card>
          <CardHeader title="Admin Audit Log" sub="All admin actions across the platform" />
          {!audit ? <Spinner /> : (
            <>
              <Table columns={auditCols} data={audit?.logs ?? []} />
              <Pagination page={audit?.page ?? 1} pages={audit?.pages ?? 1} total={audit?.total ?? 0} limit={50} onChange={setAuditPage} />
            </>
          )}
        </Card>
      )}
    </>
  );
}
