import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api.js';
import {
  PageHeader, Card, Table, Pagination, StatCard, Spinner, Btn,
} from '../components/ui.js';

const fmt$ = (v: number) =>
  new Intl.NumberFormat('en-US', { style:'currency', currency:'USD', maximumFractionDigits:0 }).format(v);

export default function Risk() {
  const [page,         setPage]         = useState(1);
  const [severity,     setSeverity]     = useState('');
  const [acknowledged, setAcknowledged] = useState<string>('false');
  const qc = useQueryClient();

  const { data: stats } = useQuery({
    queryKey: ['risk-stats'],
    queryFn:  () => api.get('/risk/stats').then(r => r.data),
    refetchInterval: 30_000,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['risk-events', page, severity, acknowledged],
    queryFn:  () => api.get('/risk/events', {
      params: { page, limit:25, severity, acknowledged },
    }).then(r => r.data),
    refetchInterval: 30_000,
    placeholderData: (prev) => prev,
  });

  const ack = useMutation({
    mutationFn: (id: string) => api.post(`/risk/events/${id}/acknowledge`),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey:['risk-events'] });
      qc.invalidateQueries({ queryKey:['risk-stats'] });
    },
  });

  const SEV_ICON: Record<string,string> = {
    critical: '🚨', warning: '⚠️', info: 'ℹ️',
  };
  const SEV_COL: Record<string,string> = {
    critical: '#EB5454', warning: '#F5B326', info: '#3F8FE0',
  };

  const columns = [
    { key:'sev', label:'', width:32,
      render: (r: any) => <span style={{ fontSize:16 }}>{SEV_ICON[r.severity] ?? '•'}</span> },
    {
      key:'message', label:'Event',
      render: (r: any) => (
        <div>
          <div style={{ fontSize:12, fontWeight:600, color: SEV_COL[r.severity] ?? '#CCD2E3' }}>
            {r.event_type.replace(/_/g,' ').toUpperCase()}
          </div>
          <div style={{ fontSize:12, color:'#CCD2E3', marginTop:1 }}>{r.message}</div>
        </div>
      ),
    },
    {
      key:'trader', label:'Trader', width:200,
      render: (r: any) => (
        <div>
          <div style={{ fontSize:12, fontWeight:600, color:'#F5F8FF' }}>{r.email}</div>
          <div style={{ fontSize:11, color:'#4F5669' }}>
            {r.platform} · Login {r.platform_account_id ?? '—'}
          </div>
        </div>
      ),
    },
    { key:'account_size', label:'Account', width:90,
      render: (r: any) => <span style={{ color:'#F5B326', fontWeight:600 }}>{fmt$(parseFloat(r.account_size))}</span> },
    { key:'current_balance', label:'Balance', width:90,
      render: (r: any) => {
        if (!r.current_balance) return <span style={{ color:'#4F5669' }}>—</span>;
        const pct = ((parseFloat(r.current_balance) - parseFloat(r.starting_balance)) / parseFloat(r.starting_balance) * 100);
        return (
          <div>
            <div style={{ fontSize:12, color:'#CCD2E3' }}>{fmt$(parseFloat(r.current_balance))}</div>
            <div style={{ fontSize:11, color: pct >= 0 ? '#38BA82' : '#EB5454' }}>
              {pct >= 0?'+':''}{pct.toFixed(2)}%
            </div>
          </div>
        );
      },
    },
    { key:'created_at', label:'Time', width:130,
      render: (r: any) => <span style={{ color:'#878FA4', fontSize:11 }}>{new Date(r.created_at).toLocaleString()}</span> },
    { key:'action', label:'', width:110,
      render: (r: any) => !r.acknowledged_at ? (
        <Btn size="sm" variant="secondary"
          onClick={() => ack.mutate(r.id)}
          disabled={ack.isPending}>
          Acknowledge
        </Btn>
      ) : (
        <span style={{ fontSize:11, color:'#38BA82' }}>
          ✓ {r.ack_first} {r.ack_last}
        </span>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Risk Monitor"
        sub="Real-time breach detection — refreshes every 30 seconds"
      />

      <div style={{ display:'grid', gridTemplateColumns:'repeat(6,1fr)', gap:12, marginBottom:20 }}>
        <StatCard label="Unacknowledged" value={stats?.unacknowledged ?? '—'} color="#EB5454" />
        <StatCard label="Critical"       value={stats?.critical_unacked ?? '—'} color="#EB5454" />
        <StatCard label="Warnings"       value={stats?.warning_unacked  ?? '—'} color="#F5B326" />
        <StatCard label="Last 24h"       value={stats?.last_24h         ?? '—'} />
        <StatCard label="Breached Accts" value={stats?.breached_accounts ?? '—'} color="#EB5454" />
        <StatCard label="Active Accts"   value={stats?.accounts_at_risk  ?? '—'} color="#38BA82" />
      </div>

      <Card>
        {/* Filters */}
        <div style={{ display:'flex', gap:8, marginBottom:16, alignItems:'center' }}>
          <div style={{ fontSize:12, color:'#878FA4' }}>Severity:</div>
          {['','critical','warning','info'].map(s => (
            <button key={s} onClick={() => { setSeverity(s); setPage(1); }} style={{
              padding:'4px 10px', borderRadius:5, fontSize:12, fontWeight:600,
              cursor:'pointer', border:'1px solid',
              background: severity===s ? '#3F8FE0' : '#252931',
              color:      severity===s ? '#fff' : '#878FA4',
              borderColor: severity===s ? '#3F8FE0' : '#353947',
            }}>{s || 'All'}</button>
          ))}
          <div style={{ width:1, height:20, background:'#353947', margin:'0 4px' }} />
          <div style={{ fontSize:12, color:'#878FA4' }}>Status:</div>
          {[{ v:'false', l:'Open' }, { v:'true', l:'Acknowledged' }, { v:'', l:'All' }].map(o => (
            <button key={o.v} onClick={() => { setAcknowledged(o.v); setPage(1); }} style={{
              padding:'4px 10px', borderRadius:5, fontSize:12, fontWeight:600,
              cursor:'pointer', border:'1px solid',
              background: acknowledged===o.v ? '#3F8FE0' : '#252931',
              color:      acknowledged===o.v ? '#fff' : '#878FA4',
              borderColor: acknowledged===o.v ? '#3F8FE0' : '#353947',
            }}>{o.l}</button>
          ))}
        </div>

        {isLoading
          ? <div style={{ display:'flex', justifyContent:'center', padding:40 }}><Spinner /></div>
          : <>
              <Table columns={columns} data={data?.events ?? []} />
              {data && (
                <Pagination page={data.page} pages={data.pages}
                  total={data.total} limit={data.limit} onChange={setPage} />
              )}
            </>
        }
      </Card>
    </>
  );
}
