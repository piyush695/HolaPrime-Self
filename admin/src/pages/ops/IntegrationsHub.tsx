import { useState, useEffect } from 'react';
import { A, api, inp, sel, Card, Btn, Pill } from './_shared.js';

const GROUPS = [
  { key:'payments',  label:'💳 Payment Gateways', services:['stripe','paypal','nowpayments','flutterwave','razorpay','skrill','neteller','bank_transfer'] },
  { key:'kyc',       label:'🪪 KYC & Compliance', services:['sumsub'] },
  { key:'email',     label:'📧 Email',             services:['smtp','sendgrid','mailmodo'] },
  { key:'platforms', label:'📊 Trading Platforms', services:['mt5','ctrader','dxtrade','matchtrader','tradovate'] },
  { key:'comms',     label:'💬 Communications',    services:['whatsapp'] },
];

const SERVICE_ICONS: Record<string,string> = {
  stripe:'💳',paypal:'🅿️',nowpayments:'₿',flutterwave:'🌊',razorpay:'💰',
  skrill:'🟣',neteller:'🔵',bank_transfer:'🏦',sumsub:'🪪',smtp:'📬',
  sendgrid:'📨',mailmodo:'✉️',mt5:'📊',ctrader:'📈',dxtrade:'💎',
  matchtrader:'🔄',tradovate:'📉',whatsapp:'💬',
};

const DOCS: Record<string,string> = {
  stripe:      'https://dashboard.stripe.com/apikeys',
  paypal:      'https://developer.paypal.com/dashboard/applications',
  nowpayments: 'https://nowpayments.io/merchant-dashboard',
  sumsub:      'https://cockpit.sumsub.com/developers/api',
  sendgrid:    'https://app.sendgrid.com/settings/api_keys',
  mt5:         'https://www.metaquotes.net/en/company/account',
  ctrader:     'https://ctrader.com/api/',
  whatsapp:    'https://developers.facebook.com/apps',
};

export default function IntegrationsHub() {
  const [integrations, setIntegrations] = useState<any[]>([]);
  const [schemas, setSchemas] = useState<Record<string,any[]>>({});
  const [selected, setSelected] = useState<string|null>(null);
  const [editCreds, setEditCreds] = useState<Record<string,string>>({});
  const [isActive, setIsActive] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ok:boolean;message:string;latency_ms?:number}|null>(null);
  const [saved, setSaved] = useState(false);
  const [group, setGroup] = useState('payments');

  useEffect(() => {
    api('/api/v1/integrations-hub').then(d => setIntegrations(Array.isArray(d)?d:[]));
    api('/api/v1/integrations-hub/schema').then(setSchemas);
  }, []);

  function selectService(service: string) {
    const integ = integrations.find(i => i.service === service);
    setSelected(service);
    setIsActive(integ?.is_active ?? false);
    setEditCreds(integ?.credentials ?? {});
    setTestResult(integ?.test_result ?? null);
    setSaved(false);
  }

  async function save() {
    if (!selected) return;
    setSaving(true);
    await api(`/api/v1/integrations-hub/${selected}`, {
      method: 'PATCH',
      body: JSON.stringify({ credentials: editCreds, is_active: isActive }),
    });
    setIntegrations(ints => ints.map(i => i.service===selected ? {...i,credentials:editCreds,is_active:isActive} : i));
    setSaved(true); setTimeout(()=>setSaved(false),2500);
    setSaving(false);
  }

  async function testConn() {
    if (!selected) return;
    // Auto-save first
    await save();
    setTesting(true); setTestResult(null);
    const result = await api(`/api/v1/integrations-hub/${selected}/test`, { method:'POST', body:'{}' });
    setTestResult(result);
    setIntegrations(ints => ints.map(i => i.service===selected ? {...i,test_result:result,last_tested:new Date().toISOString()} : i));
    setTesting(false);
  }

  const selectedGroup = GROUPS.find(g => g.key === group);
  const selectedInteg = integrations.find(i => i.service === selected);
  const selectedSchema = selected ? schemas[selected] ?? [] : [];

  const getStatus = (service: string) => {
    const integ = integrations.find(i => i.service === service);
    if (!integ) return 'unconfigured';
    if (!integ.is_active) return 'inactive';
    if (integ.test_result?.ok) return 'connected';
    if (integ.test_result?.ok === false) return 'error';
    return 'configured';
  };

  const statusColor: Record<string,string> = {
    connected:'#10B981', configured:'#4F8CF7', error:'#EF4444',
    inactive:'#64748B', unconfigured:'#64748B',
  };
  const statusLabel: Record<string,string> = {
    connected:'Connected', configured:'Saved', error:'Error',
    inactive:'Inactive', unconfigured:'Not configured',
  };

  return (
    <div style={{ fontFamily:"'Plus Jakarta Sans',sans-serif" }}>
      <div style={{ marginBottom:24 }}>
        <h1 style={{ fontSize:22,fontWeight:800,color:A.white,marginBottom:4 }}>Integrations Hub</h1>
        <p style={{ fontSize:13,color:A.txtB }}>Configure all third-party services. Enter credentials, save, then test the connection. Everything is plug-and-play — just add your API keys.</p>
      </div>

      <div style={{ display:'grid',gridTemplateColumns:'260px 1fr',gap:20,minHeight:600 }}>
        {/* Left: service list */}
        <div style={{ display:'flex',flexDirection:'column',gap:12 }}>
          {/* Group tabs */}
          <div style={{ display:'flex',flexDirection:'column',gap:2 }}>
            {GROUPS.map(g => {
              const configured = g.services.filter(s => getStatus(s) !== 'unconfigured' && getStatus(s) !== 'inactive').length;
              const total = g.services.length;
              return (
                <button key={g.key} onClick={() => { setGroup(g.key); setSelected(null); }}
                  style={{ display:'flex',justifyContent:'space-between',alignItems:'center',padding:'9px 14px',borderRadius:9,border:`1px solid ${group===g.key?A.blue:A.bord}`,background:group===g.key?'rgba(63,143,224,.12)':A.surf,cursor:'pointer',fontFamily:'inherit',transition:'all .15s',textAlign:'left' }}>
                  <span style={{ fontSize:13,fontWeight:group===g.key?700:400,color:group===g.key?A.white:A.txtA }}>{g.label}</span>
                  <span style={{ fontSize:10,color:configured>0?A.green:A.txtC }}>{configured}/{total}</span>
                </button>
              );
            })}
          </div>

          {/* Services in current group */}
          {selectedGroup && (
            <div style={{ display:'flex',flexDirection:'column',gap:4,paddingTop:8,borderTop:`1px solid ${A.bord}` }}>
              {selectedGroup.services.map(service => {
                const status = getStatus(service);
                const integ = integrations.find(i => i.service === service);
                return (
                  <button key={service} onClick={() => selectService(service)}
                    style={{ display:'flex',alignItems:'center',gap:10,padding:'10px 12px',borderRadius:9,border:`1px solid ${selected===service?A.blue:A.bord}`,background:selected===service?'rgba(63,143,224,.1)':A.surf,cursor:'pointer',fontFamily:'inherit',transition:'all .15s',textAlign:'left' }}
                    onMouseEnter={e=>(e.currentTarget as any).style.borderColor=A.blue}
                    onMouseLeave={e=>(e.currentTarget as any).style.borderColor=selected===service?A.blue:A.bord}>
                    <span style={{ fontSize:18 }}>{SERVICE_ICONS[service]??'🔌'}</span>
                    <div style={{ flex:1,minWidth:0 }}>
                      <div style={{ fontSize:12,fontWeight:600,color:selected===service?A.white:A.txtA,marginBottom:2 }}>{integ?.label ?? service}</div>
                      <div style={{ display:'flex',alignItems:'center',gap:4 }}>
                        <div style={{ width:6,height:6,borderRadius:'50%',background:statusColor[status] }}/>
                        <span style={{ fontSize:10,color:statusColor[status] }}>{statusLabel[status]}</span>
                        {integ?.last_tested && <span style={{ fontSize:9,color:A.txtD,marginLeft:4 }}>tested {new Date(integ.last_tested).toLocaleDateString()}</span>}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: credential form */}
        {selected ? (
          <Card style={{ display:'flex',flexDirection:'column' }}>
            <div style={{ display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:20,paddingBottom:16,borderBottom:`1px solid ${A.bord}` }}>
              <div style={{ display:'flex',alignItems:'center',gap:12 }}>
                <div style={{ width:44,height:44,borderRadius:12,background:A.surf2,display:'flex',alignItems:'center',justifyContent:'center',fontSize:22 }}>{SERVICE_ICONS[selected]??'🔌'}</div>
                <div>
                  <h2 style={{ fontSize:17,fontWeight:700,color:A.white,marginBottom:3 }}>{selectedInteg?.label ?? selected}</h2>
                  <div style={{ display:'flex',gap:6,alignItems:'center' }}>
                    <div style={{ width:7,height:7,borderRadius:'50%',background:statusColor[getStatus(selected)] }}/>
                    <span style={{ fontSize:12,color:statusColor[getStatus(selected)] }}>{statusLabel[getStatus(selected)]}</span>
                    {DOCS[selected] && <a href={DOCS[selected]} target="_blank" rel="noreferrer" style={{ fontSize:11,color:A.blue,marginLeft:8 }}>Get credentials →</a>}
                  </div>
                </div>
              </div>
              <div style={{ display:'flex',gap:8,alignItems:'center' }}>
                {saved && <span style={{ fontSize:12,color:A.green }}>✓ Saved</span>}
                <Btn onClick={testConn} disabled={testing||saving} variant="ghost" style={{ padding:'7px 16px',fontSize:12 }}>
                  {testing?'Testing…':'🔌 Test Connection'}
                </Btn>
                <Btn onClick={save} disabled={saving} style={{ padding:'7px 16px',fontSize:12 }}>
                  {saving?'Saving…':'Save Credentials'}
                </Btn>
              </div>
            </div>

            {/* Test result banner */}
            {testResult && (
              <div style={{ padding:'12px 14px',borderRadius:9,marginBottom:16,background:testResult.ok?'rgba(16,185,129,.08)':'rgba(239,68,68,.08)',border:`1px solid ${testResult.ok?'rgba(16,185,129,.25)':'rgba(239,68,68,.25)'}`,display:'flex',alignItems:'flex-start',gap:10 }}>
                <span style={{ fontSize:18 }}>{testResult.ok?'✅':'❌'}</span>
                <div>
                  <div style={{ fontSize:13,fontWeight:600,color:testResult.ok?A.green:A.red,marginBottom:2 }}>{testResult.ok?'Connection successful':'Connection failed'}</div>
                  <div style={{ fontSize:12,color:A.txtB }}>{testResult.message}</div>
                  {testResult.latency_ms && <div style={{ fontSize:11,color:A.txtD,marginTop:2 }}>Response time: {testResult.latency_ms}ms</div>}
                </div>
              </div>
            )}

            {/* Enable/disable toggle */}
            <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 14px',background:A.surf2,borderRadius:9,marginBottom:20 }}>
              <div>
                <div style={{ fontSize:13,fontWeight:600,color:A.white }}>Enable this integration</div>
                <div style={{ fontSize:11,color:A.txtB,marginTop:2 }}>When enabled, traders can use this payment method / this service is active</div>
              </div>
              <div onClick={()=>setIsActive(a=>!a)} style={{ width:44,height:24,borderRadius:12,position:'relative',cursor:'pointer',background:isActive?A.blue:A.surf2,border:`1px solid ${isActive?A.blue:A.bord}`,transition:'all .2s' }}>
                <div style={{ position:'absolute',top:2,left:isActive?22:2,width:18,height:18,borderRadius:'50%',background:'#fff',transition:'left .2s' }}/>
              </div>
            </div>

            {/* Credential fields */}
            <div style={{ display:'flex',flexDirection:'column',gap:14 }}>
              {selectedSchema.length === 0 ? (
                <div style={{ textAlign:'center',padding:32,color:A.txtC }}>No schema defined for this integration</div>
              ) : (
                selectedSchema.map((field: any) => (
                  <div key={field.key}>
                    <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6 }}>
                      <label style={{ fontSize:12,color:A.txtB,fontWeight:500 }}>
                        {field.label}{field.required&&<span style={{ color:A.red,marginLeft:3 }}>*</span>}
                      </label>
                      {field.hint && <span style={{ fontSize:10,color:A.txtD,maxWidth:200,textAlign:'right' }}>{field.hint}</span>}
                    </div>
                    {field.type === 'select' ? (
                      <select value={editCreds[field.key]??''} onChange={e=>setEditCreds(c=>({...c,[field.key]:e.target.value}))} style={sel}>
                        {field.options?.map((opt: string) => <option key={opt} value={opt}>{opt}</option>)}
                      </select>
                    ) : (
                      <input type={field.type==='password'?'password':field.type==='url'?'url':'text'}
                        value={editCreds[field.key]??''} onChange={e=>setEditCreds(c=>({...c,[field.key]:e.target.value}))}
                        placeholder={field.placeholder} style={inp} autoComplete="off" spellCheck={false}
                        onFocus={e=>e.currentTarget.style.borderColor=A.blue} onBlur={e=>e.currentTarget.style.borderColor=A.bord}/>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Footer save button */}
            <div style={{ marginTop:24,paddingTop:16,borderTop:`1px solid ${A.bord}`,display:'flex',gap:10,justifyContent:'flex-end' }}>
              <Btn onClick={testConn} disabled={testing||saving} variant="ghost" style={{ padding:'10px 20px' }}>
                {testing?'Testing…':'🔌 Test Connection'}
              </Btn>
              <Btn onClick={save} disabled={saving} style={{ padding:'10px 20px' }}>
                {saving?'Saving…':'Save Credentials'}
              </Btn>
            </div>
          </Card>
        ) : (
          <Card>
            <div style={{ textAlign:'center',padding:'60px 0',color:A.txtC }}>
              <div style={{ fontSize:48,marginBottom:14 }}>🔌</div>
              <div style={{ fontSize:16,fontWeight:700,color:A.white,marginBottom:6 }}>Select an integration</div>
              <div style={{ fontSize:13,color:A.txtB,maxWidth:360,margin:'0 auto',lineHeight:1.6 }}>
                Choose a service from the left panel to configure credentials. All credentials are encrypted and stored securely in your database.
              </div>
              <div style={{ marginTop:28,display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,maxWidth:400,margin:'28px auto 0' }}>
                {integrations.filter(i=>i.is_active).slice(0,8).map((i: any)=>(
                  <div key={i.service} style={{ padding:'10px',background:A.surf2,border:`1px solid ${A.bord}`,borderRadius:9,textAlign:'center' }}>
                    <div style={{ fontSize:18 }}>{SERVICE_ICONS[i.service]??'🔌'}</div>
                    <div style={{ fontSize:9,color:A.green,marginTop:3 }}>Active</div>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
