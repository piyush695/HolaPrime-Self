import { useQuery } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { Card, Badge, Spinner, hp } from '../components/ui.js';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

const fmt$ = (v: number) =>
  new Intl.NumberFormat('en-US', { style:'currency', currency:'USD', maximumFractionDigits:2 }).format(v);

const TOOLTIP_STYLE = { background:'#1C1F27', border:'1px solid #353947', borderRadius:6, fontSize:12 };

const STATUS_COLOR: Record<string,string> = {
  active:'#38BA82', funded:'#F5B326', passed:'#8B5CF6',
  breached:'#EB5454', pending:'#3F8FE0', failed:'#4F5669',
};

export default function AccountDetail() {
  const { id } = useParams<{ id: string }>();

  const { data: account, isLoading } = useQuery({
    queryKey: ['account', id],
    queryFn:  () => api.get(`/accounts/${id}`).then(r => r.data),
  });

  if (isLoading) return <div style={{ display:'flex', justifyContent:'center', padding:80 }}><Spinner size={32} /></div>;
  if (!account)  return <div style={{ color:hp.red, padding:24 }}>Account not found</div>;

  const bal    = parseFloat(account.current_balance ?? account.starting_balance);
  const start  = parseFloat(account.starting_balance);
  const retPct = ((bal - start) / start * 100);
  const target = parseFloat(account.profit_target);
  const ddPct  = Math.max(0, (start - bal) / start * 100);

  const chartData = (account.snapshots ?? [])
    .slice().reverse()
    .map((s: any) => ({
      date:    s.snapshot_date,
      balance: parseFloat(s.balance),
      return:  parseFloat(s.total_pl_pct ?? '0'),
    }));

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      {/* Back */}
      <Link to="/accounts" style={{ color:hp.blue, fontSize:13, textDecoration:'none' }}>← Back to Accounts</Link>

      {/* Header card */}
      <Card>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:16 }}>
          <div>
            <div style={{ fontSize:20, fontWeight:800, color:hp.white }}>{account.product_name}</div>
            <div style={{ fontSize:13, color:hp.txtB, marginTop:3 }}>
              {account.platform} · Login: <code style={{ color:hp.blue }}>{account.platform_account_id ?? 'Pending'}</code>
            </div>
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <Badge label={account.phase} color={hp.blue} />
            <Badge label={account.status} color={STATUS_COLOR[account.status] ?? hp.txtB} />
          </div>
        </div>

        {/* Main metrics */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:16 }}>
          {[
            { l:'Current Balance',  v:fmt$(bal),               c:hp.white },
            { l:'Starting Balance', v:fmt$(start),             c:hp.txtA  },
            { l:'Return',           v:`${retPct >= 0 ? '+' : ''}${retPct.toFixed(2)}%`, c:retPct>=0?hp.green:hp.red },
            { l:'Account Size',     v:fmt$(parseFloat(account.account_size)), c:hp.gold },
          ].map(s => (
            <div key={s.l} style={{ padding:'12px', background:hp.surfB, borderRadius:8 }}>
              <div style={{ fontSize:11, color:hp.txtC, marginBottom:4 }}>{s.l}</div>
              <div style={{ fontSize:18, fontWeight:700, color:s.c }}>{s.v}</div>
            </div>
          ))}
        </div>

        {/* Progress bars */}
        {[
          { l:`Profit target: ${retPct.toFixed(2)}% / ${target}%`, pct: Math.min(100, retPct/target*100), col:hp.green },
          { l:`Daily loss: ${ddPct.toFixed(2)}% / ${account.max_daily_loss}%`, pct: Math.min(100, ddPct/parseFloat(account.max_daily_loss)*100), col: ddPct > parseFloat(account.max_daily_loss)*0.8 ? hp.red : hp.gold },
          { l:`Max drawdown: ${ddPct.toFixed(2)}% / ${account.max_total_loss}%`, pct: Math.min(100, ddPct/parseFloat(account.max_total_loss)*100), col: ddPct > parseFloat(account.max_total_loss)*0.8 ? hp.red : hp.txtB },
        ].map(b => (
          <div key={b.l} style={{ marginBottom:8 }}>
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:hp.txtC, marginBottom:3 }}>
              <span>{b.l}</span>
            </div>
            <div style={{ height:6, background:hp.surfB, borderRadius:3, overflow:'hidden' }}>
              <div style={{ height:'100%', width:`${Math.max(0,b.pct)}%`, background:b.col, borderRadius:3 }} />
            </div>
          </div>
        ))}
      </Card>

      {/* Chart */}
      {chartData.length > 0 && (
        <Card>
          <div style={{ fontSize:14, fontWeight:700, color:hp.white, marginBottom:14 }}>Balance History</div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={chartData} margin={{ top:4, right:4, left:0, bottom:0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#35394733" />
              <XAxis dataKey="date" tick={{ fill:'#4F5669', fontSize:10 }} tickLine={false} />
              <YAxis tick={{ fill:'#4F5669', fontSize:10 }} tickLine={false} axisLine={false} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => [fmt$(v), 'Balance']} />
              <Area type="monotone" dataKey="balance" stroke={hp.blue} fill="#162F4F" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Rules */}
      <Card>
        <div style={{ fontSize:14, fontWeight:700, color:hp.white, marginBottom:12 }}>Challenge Rules</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8 }}>
          {[
            { l:'Profit Target',    v:`${account.profit_target}%`       },
            { l:'Max Daily Loss',   v:`${account.max_daily_loss}%`      },
            { l:'Max Drawdown',     v:`${account.max_total_loss}%`      },
            { l:'Min Trading Days', v:`${account.min_trading_days} days`},
            { l:'Leverage',         v:account.leverage ?? '1:100'       },
            { l:'Profit Split',     v:`${account.profit_split ?? 80}%`  },
          ].map(r => (
            <div key={r.l} style={{ padding:'10px', background:hp.surfB, borderRadius:7 }}>
              <div style={{ fontSize:10, color:hp.txtC, marginBottom:2 }}>{r.l}</div>
              <div style={{ fontSize:14, fontWeight:600, color:hp.white }}>{r.v}</div>
            </div>
          ))}
        </div>
      </Card>

      {/* Recent trades */}
      {account.trades?.length > 0 && (
        <Card>
          <div style={{ fontSize:14, fontWeight:700, color:hp.white, marginBottom:12 }}>Recent Trades</div>
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
              <thead>
                <tr style={{ borderBottom:`1px solid ${hp.bordA}` }}>
                  {['Symbol','Direction','Lots','Open Price','Close Price','Profit'].map(h => (
                    <th key={h} style={{ padding:'7px 10px', color:hp.txtC, fontWeight:600, textAlign:'left' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {account.trades.slice(0, 20).map((t: any) => (
                  <tr key={t.id} style={{ borderBottom:`1px solid #35394722` }}>
                    <td style={{ padding:'7px 10px', fontWeight:600, color:hp.white }}>{t.symbol}</td>
                    <td style={{ padding:'7px 10px', color: t.direction === 'buy' ? hp.green : hp.red }}>{t.direction?.toUpperCase()}</td>
                    <td style={{ padding:'7px 10px', color:hp.txtA }}>{t.lots}</td>
                    <td style={{ padding:'7px 10px', color:hp.txtA }}>{t.open_price}</td>
                    <td style={{ padding:'7px 10px', color:hp.txtA }}>{t.close_price ?? '—'}</td>
                    <td style={{ padding:'7px 10px', fontWeight:600, color: parseFloat(t.profit ?? '0') >= 0 ? hp.green : hp.red }}>
                      {t.profit != null ? `${parseFloat(t.profit) >= 0 ? '+' : ''}${fmt$(parseFloat(t.profit))}` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
