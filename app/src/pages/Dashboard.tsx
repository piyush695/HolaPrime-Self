import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api, useTraderStore } from '../lib/api.js';
import { Card, StatCard, Badge, Spinner, Empty, hp } from '../components/ui.js';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

const fmt$ = (v: number) =>
  new Intl.NumberFormat('en-US', { style:'currency', currency:'USD', maximumFractionDigits:0 }).format(v);

const STATUS_COLOR: Record<string,string> = {
  active:'#38BA82', funded:'#F5B326', passed:'#8B5CF6',
  breached:'#EB5454', pending:'#3F8FE0', failed:'#4F5669',
};

const PHASE_LABEL: Record<string,string> = {
  evaluation:'Evaluation', verification:'Verification', funded:'Funded',
};

const TOOLTIP_STYLE = { background:'#1C1F27', border:'1px solid #353947', borderRadius:6, fontSize:12, color:'#CCD2E3' };

export default function Dashboard() {
  const user = useTraderStore(s => s.user);

  const { data: accounts, isLoading } = useQuery({
    queryKey: ['my-accounts'],
    queryFn:  () => api.get('/accounts').then(r => r.data),
  });

  const { data: profile } = useQuery({
    queryKey: ['my-profile'],
    queryFn:  () => api.get('/me').then(r => r.data),
  });

  if (isLoading) return <div style={{ display:'flex', justifyContent:'center', padding:80 }}><Spinner size={32} /></div>;

  const activeAccounts  = (accounts ?? []).filter((a: any) => a.status === 'active');
  const fundedAccounts  = (accounts ?? []).filter((a: any) => a.status === 'funded');
  const passedAccounts  = (accounts ?? []).filter((a: any) => a.status === 'passed');
  const totalSpent      = (accounts ?? []).reduce((s: number, a: any) => s + parseFloat(a.product_fee ?? '0'), 0);

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
      {/* Welcome */}
      <div style={{ padding:'20px 24px', background:`linear-gradient(135deg, ${hp.surfA}, #162F4F)`, borderRadius:14, border:`1px solid ${hp.blue}33` }}>
        <div style={{ fontSize:22, fontWeight:800, color:hp.white, marginBottom:4 }}>
          Welcome back, {user?.firstName} 👋
        </div>
        <div style={{ fontSize:13, color:hp.txtB, display:'flex', gap:16 }}>
          <span>KYC: <span style={{ color: profile?.kyc_status === 'approved' ? hp.green : hp.gold, fontWeight:600 }}>{profile?.kyc_status ?? '—'}</span></span>
          <span>Member since: <span style={{ color:hp.txtA }}>{profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : '—'}</span></span>
          {profile?.referral_code && <span>Referral: <code style={{ color:hp.blue, fontSize:12 }}>{profile.referral_code}</code></span>}
        </div>
      </div>

      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12 }}>
        <StatCard icon="📊" label="Active Accounts" value={activeAccounts.length}  color={hp.blue}  />
        <StatCard icon="💰" label="Funded Accounts" value={fundedAccounts.length}  color={hp.gold}  />
        <StatCard icon="✅" label="Passed"           value={passedAccounts.length}  color={hp.green} />
        <StatCard icon="💳" label="Total Invested"   value={fmt$(totalSpent)}        color={hp.white} />
      </div>

      {/* Active accounts */}
      {activeAccounts.length > 0 && (
        <div>
          <div style={{ fontSize:15, fontWeight:700, color:hp.white, marginBottom:12 }}>Active Accounts</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:12 }}>
            {activeAccounts.map((a: any) => {
              const bal   = parseFloat(a.current_balance ?? a.starting_balance);
              const start = parseFloat(a.starting_balance);
              const retPct = ((bal - start) / start * 100);
              const target = parseFloat(a.profit_target);
              const progress = Math.min(100, Math.max(0, retPct / target * 100));
              const daily = parseFloat(a.max_daily_loss);
              const total = parseFloat(a.max_total_loss);
              const ddPct = ((start - bal) / start * 100);

              return (
                <Link key={a.id} to={`/accounts/${a.id}`} style={{ textDecoration:'none' }}>
                  <Card style={{ cursor:'pointer', transition:'border-color 0.15s', ':hover':{ borderColor:hp.blue } }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:12 }}>
                      <div>
                        <div style={{ fontSize:14, fontWeight:700, color:hp.white }}>{a.product_name}</div>
                        <div style={{ fontSize:12, color:hp.txtB }}>{a.platform} · {a.platform_account_id ?? 'Provisioning…'}</div>
                      </div>
                      <div style={{ display:'flex', gap:6, flexDirection:'column', alignItems:'flex-end' }}>
                        <Badge label={PHASE_LABEL[a.phase] ?? a.phase} color={hp.blue} />
                        <Badge label={a.status} color={STATUS_COLOR[a.status] ?? hp.txtB} />
                      </div>
                    </div>

                    {/* Balance */}
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:10 }}>
                      <div>
                        <div style={{ fontSize:11, color:hp.txtC }}>Balance</div>
                        <div style={{ fontSize:20, fontWeight:800, color:hp.white }}>{fmt$(bal)}</div>
                      </div>
                      <div style={{ textAlign:'right' }}>
                        <div style={{ fontSize:11, color:hp.txtC }}>Return</div>
                        <div style={{ fontSize:20, fontWeight:800, color: retPct >= 0 ? hp.green : hp.red }}>
                          {retPct >= 0 ? '+' : ''}{retPct.toFixed(2)}%
                        </div>
                      </div>
                    </div>

                    {/* Profit target progress */}
                    <div style={{ marginBottom:8 }}>
                      <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:hp.txtC, marginBottom:3 }}>
                        <span>Profit target ({target}%)</span>
                        <span style={{ color:hp.green }}>{Math.max(0, retPct).toFixed(2)}% / {target}%</span>
                      </div>
                      <div style={{ height:5, background:hp.surfB, borderRadius:3, overflow:'hidden' }}>
                        <div style={{ height:'100%', width:`${progress}%`, background:hp.green, borderRadius:3, transition:'width 0.5s' }} />
                      </div>
                    </div>

                    {/* Drawdown limits */}
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                      <div style={{ padding:'6px 8px', background:hp.surfB, borderRadius:6 }}>
                        <div style={{ fontSize:10, color:hp.txtC }}>Daily limit ({daily}%)</div>
                        <div style={{ fontSize:12, fontWeight:600, color: ddPct > daily * 0.8 ? hp.red : hp.txtA }}>
                          {Math.max(0, ddPct).toFixed(2)}% used
                        </div>
                      </div>
                      <div style={{ padding:'6px 8px', background:hp.surfB, borderRadius:6 }}>
                        <div style={{ fontSize:10, color:hp.txtC }}>Max drawdown ({total}%)</div>
                        <div style={{ fontSize:12, fontWeight:600, color: ddPct > total * 0.8 ? hp.red : hp.txtA }}>
                          {Math.max(0, ddPct).toFixed(2)}% used
                        </div>
                      </div>
                    </div>
                  </Card>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* KYC prompt */}
      {profile?.kyc_status !== 'approved' && (
        <Card style={{ borderColor:`${hp.gold}55`, background:'#362A0A33' }}>
          <div style={{ display:'flex', alignItems:'center', gap:14 }}>
            <span style={{ fontSize:32 }}>🪪</span>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:14, fontWeight:700, color:hp.white, marginBottom:3 }}>
                Complete your identity verification
              </div>
              <div style={{ fontSize:12, color:hp.txtB }}>
                KYC is required to receive payouts from your funded accounts.
              </div>
            </div>
            <Link to="/kyc" style={{ textDecoration:'none' }}>
              <div style={{ padding:'8px 16px', background:hp.gold, color:'#000', borderRadius:8, fontSize:13, fontWeight:700, cursor:'pointer' }}>
                Verify Now
              </div>
            </Link>
          </div>
        </Card>
      )}

      {/* No accounts CTA */}
      {(accounts ?? []).length === 0 && (
        <Card style={{ textAlign:'center', padding:'48px 24px' }}>
          <div style={{ fontSize:40, marginBottom:16 }}>🏆</div>
          <div style={{ fontSize:18, fontWeight:700, color:hp.white, marginBottom:8 }}>Start your trading journey</div>
          <div style={{ fontSize:13, color:hp.txtB, marginBottom:20 }}>Purchase a challenge to get access to funded capital</div>
          <Link to="/challenges" style={{ textDecoration:'none' }}>
            <div style={{ display:'inline-block', padding:'10px 24px', background:hp.blue, color:'#fff', borderRadius:8, fontSize:14, fontWeight:700 }}>
              Browse Challenges
            </div>
          </Link>
        </Card>
      )}
    </div>
  );
}
