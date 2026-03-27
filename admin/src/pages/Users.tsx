import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api.js';
import {
  PageHeader, Card, Table, Pagination, StatusBadge,
  StatCard, Input, Select, Btn, Spinner,
} from '../components/ui.js';

const STATUSES  = ['active','pending','suspended','banned'];
const KYC_STATS = ['not_submitted','pending','under_review','approved','rejected'];

export default function Users() {
  const [page,   setPage]   = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [kyc,    setKyc]    = useState('');
  const qc = useQueryClient();

  const { data: stats } = useQuery({
    queryKey: ['users-stats'],
    queryFn:  () => api.get('/users/stats').then(r => r.data),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['users', page, search, status, kyc],
    queryFn:  () => api.get('/users', { params:{ page, limit:25, search, status, kycStatus:kyc } }).then(r => r.data),
    placeholderData: (prev) => prev,
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, s }: { id:string; s:string }) =>
      api.patch(`/users/${id}/status`, { status: s }),
    onSuccess: () => { qc.invalidateQueries({ queryKey:['users'] }); qc.invalidateQueries({ queryKey:['users-stats'] }); },
  });

  const columns = [
    {
      key:'name', label:'Trader',
      render: (r: any) => (
        <div>
          <div style={{ fontWeight:600, color:'#F5F8FF' }}>{r.first_name} {r.last_name}</div>
          <div style={{ fontSize:11, color:'#4F5669' }}>{r.email}</div>
        </div>
      ),
    },
    { key:'country_code', label:'Country', width:80,
      render: (r: any) => <span style={{ color:'#878FA4' }}>{r.country_code ?? '—'}</span> },
    { key:'status',     label:'Status',   width:110, render: (r: any) => <StatusBadge status={r.status} /> },
    { key:'kyc_status', label:'KYC',      width:130, render: (r: any) => <StatusBadge status={r.kyc_status} /> },
    { key:'created_at', label:'Joined',   width:120,
      render: (r: any) => <span style={{ color:'#878FA4', fontSize:12 }}>{new Date(r.created_at).toLocaleDateString()}</span> },
    {
      key:'actions', label:'', width:120,
      render: (r: any) => (
        <div style={{ display:'flex', gap:6 }}>
          {r.status === 'active'
            ? <Btn size="sm" variant="secondary" onClick={() => updateStatus.mutate({ id:r.id, s:'suspended' })}>Suspend</Btn>
            : r.status === 'suspended'
            ? <Btn size="sm" variant="primary"   onClick={() => updateStatus.mutate({ id:r.id, s:'active'    })}>Activate</Btn>
            : null
          }
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Users"
        sub="All registered traders on the platform"
        action={<Btn>Export CSV</Btn>}
      />

      {/* Stats row */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:12, marginBottom:20 }}>
        <StatCard label="Total"        value={stats?.total_users   ?? '—'} color="#F5F8FF" />
        <StatCard label="Active"       value={stats?.active_users  ?? '—'} color="#38BA82" />
        <StatCard label="KYC Approved" value={stats?.kyc_approved  ?? '—'} color="#3F8FE0" />
        <StatCard label="New Today"    value={stats?.new_today     ?? '—'} color="#F5B326" />
        <StatCard label="New/Month"    value={stats?.new_this_month ?? '—'} color="#14B8A6" />
      </div>

      <Card>
        {/* Filters */}
        <div style={{ display:'flex', gap:10, marginBottom:16, flexWrap:'wrap' }}>
          <Input
            placeholder="Search email, name, phone…"
            value={search}
            onChange={v => { setSearch(v); setPage(1); }}
            style={{ flex:1, minWidth:200 }}
          />
          <Select
            value={status}
            onChange={v => { setStatus(v); setPage(1); }}
            options={STATUSES.map(s => ({ value:s, label: s.charAt(0).toUpperCase()+s.slice(1) }))}
            placeholder="All statuses"
            style={{ width:140 }}
          />
          <Select
            value={kyc}
            onChange={v => { setKyc(v); setPage(1); }}
            options={KYC_STATS.map(s => ({ value:s, label: s.replace(/_/g,' ') }))}
            placeholder="Any KYC"
            style={{ width:160 }}
          />
          {(search || status || kyc) && (
            <Btn variant="ghost" onClick={() => { setSearch(''); setStatus(''); setKyc(''); setPage(1); }}>
              Clear
            </Btn>
          )}
        </div>

        {isLoading
          ? <div style={{ display:'flex', justifyContent:'center', padding:40 }}><Spinner /></div>
          : <>
              <Table columns={columns} data={data?.users ?? []} />
              {data && (
                <Pagination
                  page={data.page} pages={data.pages}
                  total={data.total} limit={data.limit}
                  onChange={setPage}
                />
              )}
            </>
        }
      </Card>
    </>
  );
}
