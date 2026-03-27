import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api.js';
import { PageHeader, Card, Btn, Spinner, Badge } from '../../components/ui.js';

const C = {
  surfA:'#1C1F27', surfB:'#252931', bordA:'#353947',
  blue:'#3F8FE0', green:'#38BA82', gold:'#F5B326',
  red:'#EB5454', white:'#F5F8FF', txtA:'#CCD2E3', txtB:'#878FA4', txtC:'#4F5669',
};

const inp: React.CSSProperties = {
  width:'100%', background:C.surfB, color:C.white, border:`1px solid ${C.bordA}`,
  borderRadius:7, padding:'9px 12px', fontSize:13, outline:'none', fontFamily:'inherit',
};

// ── Platform definitions ──────────────────────────────────────────────────────
const PLATFORMS = [
  {
    id: 'mt5',
    name: 'MetaTrader 5',
    icon: '📊',
    color: '#1B6AE4',
    description: 'Connect via MT5 Manager REST bridge API',
    docsUrl: 'https://www.mql5.com/en/docs/integration/managerapi',
    fields: [
      { key:'apiUrl',  label:'Bridge API URL',  placeholder:'https://your-mt5-bridge.com', required:true, hint:'Your MT5 REST bridge base URL' },
      { key:'apiKey',  label:'API Key',          placeholder:'your_api_key', required:true, type:'password', hint:'Manager API key' },
      { key:'server',  label:'Server Name',      placeholder:'YourBroker-Live', required:true, hint:'MT5 server name shown to traders' },
    ],
    testTip: 'Tests connection to /health endpoint on your bridge',
  },
  {
    id: 'ctrader',
    name: 'cTrader',
    icon: '📉',
    color: '#0BA3DA',
    description: 'Connect via cTrader Open API OAuth2',
    docsUrl: 'https://help.ctrader.com/open-api/',
    fields: [
      { key:'clientId',     label:'Client ID',     placeholder:'your_client_id', required:true },
      { key:'clientSecret', label:'Client Secret', placeholder:'your_client_secret', required:true, type:'password' },
      { key:'accountId',    label:'Account ID',    placeholder:'your_account_id', required:true },
      { key:'env',          label:'Environment',   placeholder:'live', required:false, hint:'live or demo' },
    ],
    testTip: 'Tests OAuth2 token generation',
  },
  {
    id: 'matchtrader',
    name: 'MatchTrader',
    icon: '🔄',
    color: '#7B2FBE',
    description: 'Connect via MatchTrader REST API',
    docsUrl: 'https://docs.match-trade.com/',
    fields: [
      { key:'apiUrl',   label:'API URL',    placeholder:'https://api.matchtrader.com', required:true },
      { key:'apiKey',   label:'API Key',    placeholder:'your_api_key', required:true, type:'password' },
      { key:'brokerId', label:'Broker ID',  placeholder:'your_broker_id', required:true },
    ],
    testTip: 'Tests connection to MatchTrader API',
  },
  {
    id: 'ninjatrader',
    name: 'NinjaTrader',
    icon: '⚡',
    color: '#E86525',
    description: 'Connect via NinjaTrader REST bridge',
    docsUrl: 'https://ninjatrader.com/support/forum/forum/ninjatrader-8/developer-api',
    fields: [
      { key:'apiUrl',        label:'Bridge API URL',  placeholder:'https://your-nt-bridge.com', required:true },
      { key:'apiKey',        label:'API Key',         placeholder:'your_api_key', required:true, type:'password' },
      { key:'accountNumber', label:'Account Number',  placeholder:'your_account_number', required:true },
    ],
    testTip: 'Tests connection to NinjaTrader bridge',
  },
  {
    id: 'tradovate',
    name: 'Tradovate',
    icon: '🌊',
    color: '#00B4D8',
    description: 'Connect via Tradovate REST API',
    docsUrl: 'https://tradovate.github.io/tradovate-api/',
    fields: [
      { key:'apiUrl',     label:'API URL',     placeholder:'https://live.tradovateapi.com/v1', required:true },
      { key:'username',   label:'Username',    placeholder:'your_username', required:true },
      { key:'password',   label:'Password',    placeholder:'your_password', required:true, type:'password' },
      { key:'appId',      label:'App ID',      placeholder:'your_app_id', required:true },
      { key:'appVersion', label:'App Version', placeholder:'1.0', required:false },
    ],
    testTip: 'Tests authentication and token generation',
  },
];

export default function TradingPlatforms() {
  const [selected, setSelected]   = useState<string | null>(null);
  const [editCreds, setEditCreds] = useState<Record<string, string>>({});
  const [isActive, setIsActive]   = useState(false);
  const [testResult, setTestResult] = useState<{ ok:boolean; latencyMs?:number|null; message?:string } | null>(null);
  const qc = useQueryClient();

  const { data: configs = [], isLoading } = useQuery({
    queryKey: ['platform-configs'],
    queryFn: () => api.get('/trading-sync/platforms').then(r => r.data),
    refetchInterval: 30_000,
  });

  const { data: health = [] } = useQuery({
    queryKey: ['platform-health'],
    queryFn: () => api.get('/trading-sync/platforms/health').then(r => r.data),
    refetchInterval: 60_000,
  });

  const save = useMutation({
    mutationFn: () => api.put(`/trading-sync/platforms/${selected}`, {
      credentials: editCreds,
      isActive,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['platform-configs'] });
      qc.invalidateQueries({ queryKey: ['platform-health'] });
    },
  });

  const test = useMutation({
    mutationFn: () => api.post(`/trading-sync/platforms/${selected}/test`).then(r => r.data),
    onSuccess: (data) => {
      setTestResult(data);
      qc.invalidateQueries({ queryKey: ['platform-health'] });
    },
    onError: () => setTestResult({ ok: false, message: 'Connection test failed' }),
  });

  const platformDef = PLATFORMS.find(p => p.id === selected);
  const selectedConfig = configs.find((c: any) => c.platform === selected);
  const healthMap = Object.fromEntries((health as any[]).map((h: any) => [h.platform, h]));

  function openPlatform(platformId: string) {
    const conf = configs.find((c: any) => c.platform === platformId);
    const creds = conf?.credentials ?? {};
    setSelected(platformId);
    setEditCreds(creds);
    setIsActive(conf?.is_active ?? false);
    setTestResult(null);
  }

  if (isLoading) return <div style={{ display:'flex', justifyContent:'center', padding:80 }}><Spinner size={32} /></div>;

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
      <PageHeader
        title="Trading Platform Connections"
        subtitle="Connect and manage your trading platform API credentials. Changes take effect immediately — no restart required."
      />

      <div style={{ display:'grid', gridTemplateColumns: selected ? '1fr 440px' : 'repeat(auto-fill, minmax(280px, 1fr))', gap:16 }}>

        {/* Platform cards */}
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          {!selected && (
            <div style={{ padding:'12px 16px', background:`${C.blue}15`, border:`1px solid ${C.blue}33`, borderRadius:10, fontSize:13, color:C.txtA, lineHeight:1.6 }}>
              💡 <strong style={{ color:C.white }}>No code changes needed.</strong> Credentials are stored securely in the database and loaded at runtime. Edit a platform below and test the connection before activating.
            </div>
          )}

          {PLATFORMS.map(pl => {
            const conf   = configs.find((c: any) => c.platform === pl.id);
            const h      = healthMap[pl.id];
            const isConn = h?.lastTestOk;
            const isAct  = conf?.is_active;
            const isSelected = selected === pl.id;

            return (
              <div key={pl.id}
                onClick={() => selected === pl.id ? setSelected(null) : openPlatform(pl.id)}
                style={{
                  padding:'16px 18px', borderRadius:12, cursor:'pointer',
                  background: isSelected ? `${pl.color}18` : C.surfA,
                  border:`1px solid ${isSelected ? pl.color + '66' : C.bordA}`,
                  borderLeft:`4px solid ${isAct ? (isConn ? C.green : C.gold) : C.bordA}`,
                  transition:'all 0.15s',
                }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                    <div style={{ width:42, height:42, borderRadius:10, background:`${pl.color}22`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:22 }}>
                      {pl.icon}
                    </div>
                    <div>
                      <div style={{ fontSize:15, fontWeight:700, color:C.white }}>{pl.name}</div>
                      <div style={{ fontSize:12, color:C.txtB }}>{pl.description}</div>
                    </div>
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:4 }}>
                    {isAct ? (
                      <span style={{ fontSize:11, padding:'2px 8px', borderRadius:4, background:`${C.green}22`, color:C.green, fontWeight:700 }}>ACTIVE</span>
                    ) : (
                      <span style={{ fontSize:11, padding:'2px 8px', borderRadius:4, background:C.surfB, color:C.txtC, fontWeight:700 }}>INACTIVE</span>
                    )}
                    {h?.lastTested && (
                      <span style={{ fontSize:10, color: isConn ? C.green : C.red }}>
                        {isConn ? '✓ Connected' : '✗ Not connected'}
                      </span>
                    )}
                  </div>
                </div>

                {h?.lastTested && (
                  <div style={{ fontSize:11, color:C.txtC }}>
                    Last tested: {new Date(h.lastTested).toLocaleString()}
                    {h.lastTestMsg && !isConn && <span style={{ color:C.red }}> — {h.lastTestMsg.slice(0, 60)}</span>}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Credential editor panel */}
        {selected && platformDef && (
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            <Card style={{ display:'flex', flexDirection:'column', gap:16 }}>
              {/* Header */}
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                  <div style={{ width:44, height:44, borderRadius:10, background:`${platformDef.color}22`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:24 }}>
                    {platformDef.icon}
                  </div>
                  <div>
                    <div style={{ fontSize:16, fontWeight:700, color:C.white }}>{platformDef.name}</div>
                    <a href={platformDef.docsUrl} target="_blank" rel="noreferrer"
                      style={{ fontSize:11, color:C.blue, textDecoration:'none' }}>📖 API Documentation ↗</a>
                  </div>
                </div>
                <button onClick={() => setSelected(null)}
                  style={{ background:'none', border:'none', color:C.txtB, fontSize:20, cursor:'pointer' }}>×</button>
              </div>

              {/* Fields */}
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                {platformDef.fields.map(f => (
                  <div key={f.key}>
                    <div style={{ fontSize:12, color:C.txtB, marginBottom:5, fontWeight:500 }}>
                      {f.label} {f.required && <span style={{ color:C.red }}>*</span>}
                      {(f as any).hint && <span style={{ color:C.txtC, fontWeight:400 }}> — {(f as any).hint}</span>}
                    </div>
                    <input
                      type={(f as any).type ?? 'text'}
                      value={editCreds[f.key] ?? ''}
                      onChange={e => setEditCreds(p => ({ ...p, [f.key]: e.target.value }))}
                      style={inp}
                      placeholder={f.placeholder}
                    />
                  </div>
                ))}
              </div>

              {/* Active toggle */}
              <label style={{ display:'flex', alignItems:'center', gap:10, cursor:'pointer' }}>
                <div onClick={() => setIsActive(v => !v)} style={{
                  width:40, height:22, borderRadius:11, background:isActive ? C.green : C.bordA,
                  position:'relative', cursor:'pointer', transition:'background 0.2s',
                }}>
                  <div style={{ width:16, height:16, borderRadius:'50%', background:'#fff', position:'absolute', top:3, left:isActive?21:3, transition:'left 0.2s' }} />
                </div>
                <span style={{ fontSize:13, color:C.txtA, fontWeight:500 }}>
                  {isActive ? 'Active — platform available for account provisioning' : 'Inactive — will not be used for new accounts'}
                </span>
              </label>

              {/* Actions */}
              <div style={{ display:'flex', gap:10, paddingTop:4, borderTop:`1px solid ${C.bordA}` }}>
                <Btn onClick={() => { setTestResult(null); test.mutate(); }} disabled={test.isPending} variant="secondary">
                  {test.isPending ? '⏳ Testing…' : '🔌 Test Connection'}
                </Btn>
                <Btn onClick={() => save.mutate()} disabled={save.isPending}>
                  {save.isPending ? 'Saving…' : '💾 Save Credentials'}
                </Btn>
              </div>

              {/* Test result */}
              {testResult && (
                <div style={{
                  padding:'12px 14px', borderRadius:8,
                  background: testResult.ok ? '#0E2E1F' : '#3D1313',
                  border:`1px solid ${testResult.ok ? C.green : C.red}44`,
                }}>
                  <div style={{ fontSize:13, fontWeight:700, color:testResult.ok ? C.green : C.red, marginBottom:4 }}>
                    {testResult.ok ? '✅ Connection successful' : '❌ Connection failed'}
                    {testResult.latencyMs != null && ` · ${testResult.latencyMs}ms`}
                  </div>
                  {testResult.message && (
                    <div style={{ fontSize:12, color:C.txtB }}>{testResult.message}</div>
                  )}
                  {testResult.ok && (
                    <div style={{ fontSize:12, color:C.green, marginTop:4 }}>
                      Platform is ready. Enable it above to start provisioning accounts.
                    </div>
                  )}
                </div>
              )}

              {/* Tips */}
              <div style={{ padding:'10px 14px', background:C.surfB, borderRadius:8, fontSize:12, color:C.txtB, lineHeight:1.7 }}>
                <div style={{ fontWeight:700, color:C.txtA, marginBottom:4 }}>🧪 Test tip</div>
                {platformDef.testTip}. Masked values (••••) are existing saved credentials — leave them unchanged to keep current values.
              </div>
            </Card>

            {/* Save confirmation */}
            {save.isSuccess && (
              <div style={{ padding:'10px 14px', background:'#0E2E1F', border:`1px solid ${C.green}44`, borderRadius:8, fontSize:13, color:C.green }}>
                ✅ Credentials saved. Changes are live immediately — no restart required.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
