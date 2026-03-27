import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api.js';
import {
  PageHeader, Card, CardHeader, StatCard, Table,
  Btn, Input, Spinner, Badge, Empty,
} from '../../components/ui.js';

const INTEGRATION_TYPES = [
  { value:'meta_capi',       label:'Meta Conversions API',       icon:'📘', fields:[
    { key:'pixelId',      label:'Pixel ID' },
    { key:'accessToken',  label:'Access Token',  type:'password' },
    { key:'testCode',     label:'Test Event Code (optional)', hint:'TEST12345' },
  ]},
  { value:'google_ga4',      label:'Google Analytics 4 (MP)',    icon:'📊', fields:[
    { key:'measurementId', label:'Measurement ID', hint:'G-XXXXXXXXXX' },
    { key:'apiSecret',     label:'API Secret',   type:'password' },
  ]},
  { value:'tiktok_events',   label:'TikTok Events API',          icon:'🎵', fields:[
    { key:'pixelCode',    label:'Pixel Code' },
    { key:'accessToken',  label:'Access Token', type:'password' },
  ]},
  { value:'mixpanel',        label:'Mixpanel',                   icon:'🔀', fields:[
    { key:'projectToken', label:'Project Token', type:'password' },
  ]},
  { value:'segment',         label:'Segment',                    icon:'⚡', fields:[
    { key:'writeKey',     label:'Write Key', type:'password' },
  ]},
  { value:'amplitude',       label:'Amplitude',                  icon:'📈', fields:[
    { key:'apiKey',       label:'API Key', type:'password' },
  ]},
  { value:'posthog',         label:'PostHog',                    icon:'🦔', fields:[
    { key:'apiKey',       label:'API Key',  type:'password' },
    { key:'host',         label:'Host (optional)', hint:'https://app.posthog.com' },
  ]},
  { value:'klaviyo',         label:'Klaviyo',                    icon:'📧', fields:[
    { key:'privateKey',   label:'Private API Key', type:'password' },
  ]},
  { value:'custom_http',     label:'Custom HTTP Endpoint',       icon:'🔌', fields:[
    { key:'url',          label:'Endpoint URL' },
    { key:'method',       label:'HTTP Method', hint:'POST' },
    { key:'headers',      label:'Headers (JSON)', hint:'{"Authorization":"Bearer xxx"}' },
    { key:'template',     label:'Body Template (optional)', hint:'{"event":"{{externalName}}","user":"{{email}}"}' },
  ]},
];

const INTERNAL_EVENTS_LABELS: Record<string, string> = {
  'user.registered':      'User Registered',
  'user.email_verified':  'Email Verified',
  'user.kyc_submitted':   'KYC Submitted',
  'user.kyc_approved':    'KYC Approved',
  'user.kyc_rejected':    'KYC Rejected',
  'account.created':      'Account Created',
  'account.passed':       'Account Passed',
  'account.funded':       'Account Funded',
  'account.breached':     'Account Breached',
  'payment.initiated':    'Payment Initiated',
  'payment.completed':    'Payment Completed',
  'payment.failed':       'Payment Failed',
  'payout.requested':     'Payout Requested',
  'payout.approved':      'Payout Approved',
  'payout.rejected':      'Payout Rejected',
  'tournament.registered':'Tournament Registered',
  'tournament.qualified': 'Tournament Qualified',
};

const SUGGESTED_MAPPINGS: Record<string, Record<string, string>> = {
  meta_capi: {
    'user.registered':   'Lead',
    'user.kyc_approved': 'CompleteRegistration',
    'payment.completed': 'Purchase',
    'account.funded':    'Subscribe',
  },
  google_ga4: {
    'user.registered':   'sign_up',
    'user.kyc_approved': 'generate_lead',
    'payment.completed': 'purchase',
    'account.funded':    'begin_checkout',
  },
  tiktok_events: {
    'user.registered':   'Registration',
    'user.kyc_approved': 'CompleteRegistration',
    'payment.completed': 'PlaceAnOrder',
    'account.funded':    'Subscribe',
  },
  mixpanel: {
    'user.registered':   'User Registered',
    'payment.completed': 'Challenge Purchased',
    'account.passed':    'Challenge Passed',
    'account.funded':    'Account Funded',
  },
};

export default function Integrations() {
  const [showNew,    setShowNew]    = useState(false);
  const [selected,   setSelected]  = useState<any>(null);
  const [selectedType, setSelectedType] = useState('meta_capi');
  const [configFields, setConfigFields] = useState<Record<string, string>>({});
  const [name,       setName]       = useState('');
  const [eventMap,   setEventMap]   = useState<Record<string, string>>({});
  const [testEvent,  setTestEvent]  = useState('payment.completed');
  const [testResult, setTestResult] = useState<any>(null);
  const qc = useQueryClient();

  const { data: stats } = useQuery({
    queryKey: ['integration-stats'],
    queryFn:  () => api.get('/integrations/stats').then(r => r.data),
    refetchInterval: 30_000,
  });

  const { data: integrations, isLoading } = useQuery({
    queryKey: ['integrations'],
    queryFn:  () => api.get('/integrations').then(r => r.data),
  });

  const { data: detail } = useQuery({
    queryKey: ['integration-detail', selected?.id],
    queryFn:  () => selected ? api.get(`/integrations/${selected.id}`).then(r => r.data) : null,
    enabled:  !!selected,
  });

  const { data: availableEvents } = useQuery({
    queryKey: ['integration-events'],
    queryFn:  () => api.get('/integrations/events').then(r => r.data),
  });

  const create = useMutation({
    mutationFn: () => api.post('/integrations', {
      name, type: selectedType,
      config:   configFields,
      eventMap,
      isActive: false,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey:['integrations'] });
      setShowNew(false); setName(''); setConfigFields({}); setEventMap({});
    },
  });

  const toggle = useMutation({
    mutationFn: ({ id, isActive }: { id:string; isActive:boolean }) =>
      api.patch(`/integrations/${id}`, { isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey:['integrations'] }),
  });

  const del = useMutation({
    mutationFn: (id: string) => api.delete(`/integrations/${id}`),
    onSuccess:  () => { qc.invalidateQueries({ queryKey:['integrations'] }); setSelected(null); },
  });

  const runTest = useMutation({
    mutationFn: () => api.post(`/integrations/${selected.id}/test`, { event: testEvent }),
    onSuccess:  (res: any) => setTestResult(res.data),
  });

  const typeInfo = INTEGRATION_TYPES.find(t => t.value === selectedType);

  const applyDefaults = () => {
    const defaults = SUGGESTED_MAPPINGS[selectedType] ?? {};
    setEventMap(defaults);
  };

  const listCols = [
    { key:'info', label:'Integration',
      render:(r:any) => {
        const ti = INTEGRATION_TYPES.find(t => t.value === r.type);
        return (
          <div style={{ display:'flex', gap:10, alignItems:'center' }}>
            <span style={{ fontSize:20 }}>{ti?.icon ?? '🔌'}</span>
            <div>
              <div style={{ fontWeight:600, color:'#F5F8FF' }}>{r.name}</div>
              <div style={{ fontSize:11, color:'#4F5669' }}>{ti?.label ?? r.type}</div>
            </div>
          </div>
        );
      },
    },
    { key:'is_active', label:'Status', width:90,
      render:(r:any) => <Badge label={r.is_active ? 'active' : 'inactive'} variant={r.is_active ? 'green' : 'default'} />,
    },
    { key:'events_24h', label:'24h Events', width:100,
      render:(r:any) => <span style={{ color:'#CCD2E3' }}>{r.events_24h ?? 0}</span> },
    { key:'failed_events', label:'Failed', width:80,
      render:(r:any) => <span style={{ color: parseInt(r.failed_events ?? '0') > 0 ? '#EB5454' : '#4F5669' }}>{r.failed_events ?? 0}</span> },
    { key:'last_fired_at', label:'Last Fired', width:140,
      render:(r:any) => r.last_fired_at
        ? <span style={{ color:'#878FA4', fontSize:11 }}>{new Date(r.last_fired_at).toLocaleString()}</span>
        : <span style={{ color:'#4F5669', fontSize:11 }}>Never</span> },
    { key:'actions', label:'', width:120,
      render:(r:any) => (
        <div style={{ display:'flex', gap:6 }}>
          <Btn size="sm" onClick={() => setSelected(r)}>View</Btn>
          <Btn size="sm" variant="secondary"
            onClick={() => toggle.mutate({ id: r.id, isActive: !r.is_active })}>
            {r.is_active ? 'Pause' : 'Enable'}
          </Btn>
        </div>
      ),
    },
  ];

  const logCols = [
    { key:'internal_event', label:'Event',
      render:(r:any) => <code style={{ fontSize:11, color:'#3F8FE0' }}>{r.internal_event}</code> },
    { key:'external_event', label:'Mapped To', width:160,
      render:(r:any) => <code style={{ fontSize:11, color:'#8B5CF6' }}>{r.external_event}</code> },
    { key:'success', label:'Result', width:80,
      render:(r:any) => r.is_test
        ? <Badge label="test" variant="gold" />
        : <Badge label={r.success ? 'ok' : 'fail'} variant={r.success ? 'green' : 'red'} /> },
    { key:'response_status', label:'HTTP', width:60,
      render:(r:any) => <span style={{ color: r.response_status >= 200 && r.response_status < 300 ? '#38BA82' : '#EB5454', fontSize:12 }}>{r.response_status ?? '—'}</span> },
    { key:'duration_ms', label:'ms', width:60,
      render:(r:any) => <span style={{ color:'#878FA4' }}>{r.duration_ms}</span> },
    { key:'fired_at', label:'Time', width:140,
      render:(r:any) => <span style={{ color:'#878FA4', fontSize:11 }}>{new Date(r.fired_at).toLocaleString()}</span> },
  ];

  return (
    <>
      <PageHeader
        title="S2S Integrations"
        sub="Server-side event tracking — Meta CAPI, GA4, TikTok, Mixpanel, Segment, Amplitude, PostHog, Klaviyo, Custom"
        action={<Btn onClick={() => setShowNew(true)}>+ New Integration</Btn>}
      />

      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:20 }}>
        <StatCard label="Active Integrations" value={stats?.active_integrations  ?? '—'} color="#38BA82" />
        <StatCard label="Events (24h)"        value={stats?.total_events_24h     ?? '—'} color="#3F8FE0" />
        <StatCard label="Successful"          value={stats?.successful_24h       ?? '—'} color="#38BA82" />
        <StatCard label="Success Rate"        value={stats?.success_rate ? stats.success_rate + '%' : '—'} color={parseFloat(stats?.success_rate ?? '0') >= 95 ? '#38BA82' : '#EB5454'} />
      </div>

      {/* New integration panel */}
      {showNew && (
        <Card style={{ marginBottom:16 }}>
          <CardHeader title="New S2S Integration" />
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
            {/* Left: type + credentials */}
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              <div>
                <div style={{ fontSize:12, color:'#878FA4', marginBottom:4 }}>Integration Name</div>
                <Input value={name} onChange={setName} placeholder="e.g. Meta - Purchase Events" style={{ width:'100%' }} />
              </div>
              <div>
                <div style={{ fontSize:12, color:'#878FA4', marginBottom:8 }}>Platform</div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
                  {INTEGRATION_TYPES.map(t => (
                    <button key={t.value} onClick={() => { setSelectedType(t.value); setConfigFields({}); applyDefaults(); }}
                      style={{
                        padding:'8px 10px', borderRadius:6, cursor:'pointer',
                        border:'1px solid', textAlign:'left',
                        background: selectedType === t.value ? '#162F4F' : '#252931',
                        borderColor: selectedType === t.value ? '#3F8FE044' : '#353947',
                        color: selectedType === t.value ? '#3F8FE0' : '#878FA4',
                      }}>
                      <span style={{ marginRight:6 }}>{t.icon}</span>
                      <span style={{ fontSize:12 }}>{t.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ fontSize:12, color:'#878FA4', fontWeight:700 }}>CREDENTIALS</div>
              {typeInfo?.fields.map(f => (
                <div key={f.key}>
                  <div style={{ fontSize:11, color:'#878FA4', marginBottom:3 }}>
                    {f.label} {f.hint && <span style={{ color:'#4F5669' }}>({f.hint})</span>}
                  </div>
                  <Input
                    type={(f as any).type ?? 'text'}
                    value={configFields[f.key] ?? ''}
                    onChange={v => setConfigFields(p => ({ ...p, [f.key]: v }))}
                    placeholder={f.hint}
                    style={{ width:'100%' }}
                  />
                </div>
              ))}
            </div>

            {/* Right: event mapping */}
            <div>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                <div style={{ fontSize:12, color:'#878FA4', fontWeight:700 }}>EVENT MAPPING</div>
                <Btn size="sm" variant="ghost" onClick={applyDefaults}>Apply Defaults</Btn>
              </div>
              <div style={{ fontSize:11, color:'#4F5669', marginBottom:10 }}>
                Map internal platform events to the names this integration expects.
                Leave blank to skip that event.
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:6, maxHeight:400, overflowY:'auto' }}>
                {(availableEvents ?? Object.keys(INTERNAL_EVENTS_LABELS)).map((ev: string) => (
                  <div key={ev} style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <div style={{ width:180, fontSize:11, color:'#878FA4', flexShrink:0 }}>
                      {INTERNAL_EVENTS_LABELS[ev] ?? ev}
                    </div>
                    <span style={{ color:'#4F5669', fontSize:11 }}>→</span>
                    <Input
                      value={eventMap[ev] ?? ''}
                      onChange={v => setEventMap(p => v ? { ...p, [ev]: v } : Object.fromEntries(Object.entries(p).filter(([k]) => k !== ev)))}
                      placeholder="e.g. Purchase"
                      style={{ flex:1, fontSize:12 }}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div style={{ display:'flex', gap:8, marginTop:16 }}>
            <Btn variant="primary"
              disabled={!name || !selectedType || Object.keys(eventMap).length === 0 || create.isPending}
              onClick={() => create.mutate()}>
              {create.isPending ? 'Creating…' : 'Create Integration'}
            </Btn>
            <Btn variant="secondary" onClick={() => setShowNew(false)}>Cancel</Btn>
            <div style={{ fontSize:12, color:'#4F5669', alignSelf:'center' }}>
              Integration will be inactive until you enable it
            </div>
          </div>
        </Card>
      )}

      <div style={{ display:'grid', gridTemplateColumns: selected ? '1fr 480px' : '1fr', gap:16 }}>
        <Card>
          {isLoading ? <Spinner /> : (integrations ?? []).length === 0
            ? <Empty icon="🔌" message="No integrations yet" sub="Create one to start sending server-side events to Meta, GA4, TikTok, and more" />
            : <Table columns={listCols} data={integrations ?? []} onRowClick={setSelected} />
          }
        </Card>

        {selected && detail && (
          <Card style={{ display:'flex', flexDirection:'column', gap:14 }}>
            <div style={{ display:'flex', justifyContent:'space-between' }}>
              <div>
                <div style={{ fontSize:15, fontWeight:700, color:'#F5F8FF' }}>{detail.name}</div>
                <div style={{ fontSize:12, color:'#4F5669' }}>{detail.type}</div>
              </div>
              <button onClick={() => setSelected(null)} style={{ background:'none', border:'none', color:'#878FA4', fontSize:18, cursor:'pointer' }}>×</button>
            </div>

            {/* Event map */}
            <div>
              <div style={{ fontSize:11, fontWeight:700, color:'#4F5669', letterSpacing:'0.05em', marginBottom:8 }}>EVENT MAPPING</div>
              <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                {Object.entries(detail.event_map ?? {}).map(([int, ext]) => (
                  <div key={int} style={{ display:'flex', justifyContent:'space-between', padding:'5px 8px', background:'#252931', borderRadius:5 }}>
                    <code style={{ fontSize:11, color:'#878FA4' }}>{int}</code>
                    <span style={{ fontSize:10, color:'#4F5669' }}>→</span>
                    <code style={{ fontSize:11, color:'#3F8FE0' }}>{ext as string}</code>
                  </div>
                ))}
              </div>
            </div>

            {/* Test fire */}
            <div style={{ padding:'12px', background:'#252931', borderRadius:8 }}>
              <div style={{ fontSize:11, fontWeight:700, color:'#4F5669', marginBottom:8 }}>TEST EVENT</div>
              <div style={{ display:'flex', gap:8, marginBottom:8 }}>
                <select value={testEvent} onChange={e => setTestEvent(e.target.value)}
                  style={{ flex:1, background:'#1C1F27', color:'#F5F8FF', border:'1px solid #353947', borderRadius:6, padding:'6px 10px', fontSize:12, outline:'none', fontFamily:'inherit' }}>
                  {Object.keys(detail.event_map ?? {}).map((ev: string) => (
                    <option key={ev} value={ev}>{INTERNAL_EVENTS_LABELS[ev] ?? ev}</option>
                  ))}
                </select>
                <Btn size="sm" variant="primary" onClick={() => runTest.mutate()} disabled={runTest.isPending}>
                  {runTest.isPending ? 'Firing…' : '▶ Fire Test'}
                </Btn>
              </div>
              {testResult && (
                <div style={{
                  padding:'8px 10px', borderRadius:6,
                  background: testResult.success ? '#123B26' : '#3D1313',
                  border: `1px solid ${testResult.success ? '#38BA8233' : '#EB545433'}`,
                }}>
                  <div style={{ fontSize:12, fontWeight:600, color: testResult.success ? '#38BA82' : '#EB5454' }}>
                    {testResult.success ? '✓ Success' : '✗ Failed'} · {testResult.durationMs}ms
                  </div>
                  {testResult.error && <div style={{ fontSize:11, color:'#878FA4', marginTop:3 }}>{testResult.error}</div>}
                  {testResult.response && <div style={{ fontSize:10, color:'#4F5669', marginTop:3, fontFamily:'monospace', wordBreak:'break-all' }}>{testResult.response.slice(0, 200)}</div>}
                </div>
              )}
            </div>

            {/* Actions */}
            <div style={{ display:'flex', gap:8 }}>
              <Btn variant={detail.is_active ? 'secondary' : 'primary'}
                onClick={() => toggle.mutate({ id: detail.id, isActive: !detail.is_active })}>
                {detail.is_active ? 'Pause Integration' : 'Enable Integration'}
              </Btn>
              <Btn variant="danger" onClick={() => del.mutate(detail.id)}>Delete</Btn>
            </div>

            {/* Recent log */}
            <div>
              <div style={{ fontSize:11, fontWeight:700, color:'#4F5669', letterSpacing:'0.05em', marginBottom:8 }}>RECENT EVENTS</div>
              {(detail.recentLogs ?? []).length === 0
                ? <Empty icon="📋" message="No events fired yet" />
                : <Table columns={logCols} data={(detail.recentLogs ?? []).slice(0, 20)} />
              }
            </div>
          </Card>
        )}
      </div>
    </>
  );
}
