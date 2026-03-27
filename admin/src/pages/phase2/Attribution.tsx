import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api.js';
import {
  PageHeader, Card, CardHeader, StatCard, Table, Spinner, Badge,
} from '../../components/ui.js';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, PieChart, Pie, Cell, Legend,
} from 'recharts';

const fmt$ = (v: number) =>
  new Intl.NumberFormat('en-US', { style:'currency', currency:'USD', maximumFractionDigits:0 }).format(v);

const CHANNEL_COLORS: Record<string, string> = {
  'Paid Search':   '#3F8FE0',
  'Paid Social':   '#8B5CF6',
  'Organic Search':'#38BA82',
  'Organic Social':'#14B8A6',
  'Email':         '#F5B326',
  'Affiliate':     '#F97316',
  'Direct':        '#9CAABF',
  'WhatsApp/SMS':  '#25D366',
  'Other':         '#4F5669',
};

const TOOLTIP_STYLE = {
  background:'#1C1F27', border:'1px solid #353947',
  borderRadius:6, fontSize:12, color:'#CCD2E3',
};

export default function Attribution() {
  const [range, setRange] = useState(30);

  const to   = new Date().toISOString().split('T')[0];
  const from = new Date(Date.now() - range * 86400000).toISOString().split('T')[0];

  const { data: stats } = useQuery({
    queryKey: ['attr-stats'],
    queryFn:  () => api.get('/attribution/stats').then(r => r.data),
  });

  const { data: report, isLoading } = useQuery({
    queryKey: ['attr-report', range],
    queryFn:  () => api.get('/attribution/channel-report', { params:{ from, to } }).then(r => r.data),
    placeholderData: (prev) => prev,
  });

  const channelData = (report?.channelBreakdown ?? []).map((c: any) => ({
    ...c,
    color: CHANNEL_COLORS[c.channel] ?? '#4F5669',
  }));

  const campaignColumns = [
    { key:'utm_campaign', label:'Campaign',
      render: (r: any) => <div style={{ fontWeight:600, color:'#F5F8FF' }}>{r.utm_campaign || '(none)'}</div> },
    { key:'utm_source', label:'Source', width:120,
      render: (r: any) => <Badge label={r.utm_source || '—'} variant="blue" /> },
    { key:'utm_medium', label:'Medium', width:110,
      render: (r: any) => <span style={{ color:'#878FA4' }}>{r.utm_medium || '—'}</span> },
    { key:'users', label:'Users', width:80,
      render: (r: any) => <span style={{ fontWeight:600, color:'#CCD2E3' }}>{r.users}</span> },
    { key:'conversions', label:'Conversions', width:110,
      render: (r: any) => <span style={{ fontWeight:700, color:'#38BA82' }}>{r.conversions}</span> },
    { key:'revenue', label:'Revenue', width:110,
      render: (r: any) => <span style={{ color:'#F5B326', fontWeight:700 }}>{fmt$(parseFloat(r.revenue ?? '0'))}</span> },
    { key:'cpa', label:'CPA', width:90,
      render: (r: any) => {
        const cpa = parseFloat(r.conversions) > 0
          ? parseFloat(r.revenue ?? '0') / parseFloat(r.conversions)
          : 0;
        return <span style={{ color:'#8B5CF6' }}>{cpa > 0 ? fmt$(cpa) : '—'}</span>;
      },
    },
  ];

  return (
    <>
      <PageHeader title="Attribution" sub="Channel performance, UTM tracking, and multi-touch analysis" />

      {/* Quick stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:20 }}>
        <StatCard label="Events (24h)"       value={stats?.events_24h            ?? '—'} color="#3F8FE0" />
        <StatCard label="Tracked Users/Month" value={stats?.tracked_users_month  ?? '—'} color="#38BA82" />
        <StatCard label="Top Channel"        value={stats?.top_channel           ?? '—'} color="#F5B326" />
        <StatCard label="Top Campaign"       value={stats?.top_campaign?.slice(0,20) ?? '—'} color="#8B5CF6" />
      </div>

      {/* Date range picker */}
      <div style={{ display:'flex', gap:8, marginBottom:20 }}>
        {[7, 14, 30, 90].map(d => (
          <button key={d} onClick={() => setRange(d)} style={{
            padding:'5px 14px', borderRadius:5, fontSize:12, fontWeight:600,
            cursor:'pointer', border:'1px solid',
            background: range===d ? '#3F8FE0' : '#252931',
            color:      range===d ? '#fff' : '#878FA4',
            borderColor: range===d ? '#3F8FE0' : '#353947',
          }}>Last {d}d</button>
        ))}
      </div>

      {isLoading
        ? <div style={{ display:'flex', justifyContent:'center', padding:80 }}><Spinner size={32} /></div>
        : (
          <>
            {/* Overview row */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:20 }}>
              <StatCard label="Total Users"    value={report?.overview?.total_users    ?? '—'} />
              <StatCard label="Total Sessions" value={report?.overview?.total_sessions ?? '—'} />
              <StatCard label="Sign-Ups"       value={report?.overview?.signups        ?? '—'} color="#38BA82" />
              <StatCard label="Purchases"      value={report?.overview?.purchases      ?? '—'} color="#F5B326" />
            </div>

            {/* Channel breakdown */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:16 }}>
              <Card>
                <CardHeader title="Users by Channel" sub={`Last ${range} days`} />
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={channelData} margin={{ top:4, right:4, left:0, bottom:40 }} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#35394733" horizontal={false} />
                    <XAxis type="number" tick={{ fill:'#4F5669', fontSize:10 }} tickLine={false} />
                    <YAxis type="category" dataKey="channel" tick={{ fill:'#878FA4', fontSize:11 }} tickLine={false} width={110} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                    <Bar dataKey="users" radius={[0,3,3,0]}>
                      {channelData.map((c: any, i: number) => (
                        <Cell key={i} fill={c.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Card>

              <Card>
                <CardHeader title="Conversions by Channel" />
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie
                      data={channelData.filter((c: any) => parseInt(c.conversions) > 0)}
                      cx="50%" cy="50%" outerRadius={85}
                      dataKey="conversions" nameKey="channel"
                      label={({ channel, percent }) => `${channel} ${(percent * 100).toFixed(0)}%`}
                      labelLine={{ stroke:'#353947' }}
                    >
                      {channelData.map((c: any, i: number) => (
                        <Cell key={i} fill={c.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                  </PieChart>
                </ResponsiveContainer>
              </Card>
            </div>

            {/* Channel table */}
            <Card style={{ marginBottom:16 }}>
              <CardHeader title="Channel Performance Table" />
              <div style={{ overflowX:'auto' }}>
                <table style={{ width:'100%', borderCollapse:'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom:'1px solid #353947' }}>
                      {['Channel','Users','Sessions','Sign-Ups','Purchases','Revenue','Conv. Rate'].map(h => (
                        <th key={h} style={{ padding:'8px 10px', fontSize:10, color:'#4F5669', fontWeight:700, textAlign:'left', letterSpacing:'0.05em' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(report?.channelBreakdown ?? []).map((c: any) => {
                      const convRate = parseInt(c.users) > 0
                        ? (parseInt(c.conversions) / parseInt(c.users) * 100).toFixed(1)
                        : '0.0';
                      return (
                        <tr key={c.channel} style={{ borderBottom:'1px solid #35394722' }}>
                          <td style={{ padding:'9px 10px' }}>
                            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                              <div style={{ width:8, height:8, borderRadius:'50%', background: CHANNEL_COLORS[c.channel] ?? '#4F5669', flexShrink:0 }} />
                              <span style={{ fontSize:13, fontWeight:600, color:'#CCD2E3' }}>{c.channel}</span>
                            </div>
                          </td>
                          <td style={{ padding:'9px 10px', fontSize:13, color:'#CCD2E3' }}>{parseInt(c.users).toLocaleString()}</td>
                          <td style={{ padding:'9px 10px', fontSize:13, color:'#878FA4' }}>{parseInt(c.sessions).toLocaleString()}</td>
                          <td style={{ padding:'9px 10px', fontSize:13, color:'#38BA82', fontWeight:600 }}>{c.signups}</td>
                          <td style={{ padding:'9px 10px', fontSize:13, color:'#F5B326', fontWeight:700 }}>{c.purchases}</td>
                          <td style={{ padding:'9px 10px', fontSize:13, color:'#8B5CF6', fontWeight:700 }}>{fmt$(parseFloat(c.revenue ?? '0'))}</td>
                          <td style={{ padding:'9px 10px', fontSize:13, color: parseFloat(convRate) > 5 ? '#38BA82' : '#878FA4' }}>{convRate}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* UTM Campaigns */}
            <Card>
              <CardHeader title="UTM Campaigns" sub="Top performing campaigns by conversions" />
              <Table columns={campaignColumns} data={report?.utmCampaigns ?? []} emptyMessage="No campaign data in this period" />
            </Card>
          </>
        )
      }
    </>
  );
}
