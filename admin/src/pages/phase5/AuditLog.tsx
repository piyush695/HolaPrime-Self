import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api.js';
import {
  PageHeader, Card, Table, Pagination, StatusBadge,
  Select, Btn, Spinner, Badge, Input,
} from '../../components/ui.js';

const fmtDate = (d: string) => new Date(d).toLocaleString();

const MODULE_COLORS: Record<string, string> = {
  payouts: 'gold', users: 'blue', kyc: 'teal',
  accounts: 'purple', risk: 'red', settings: 'silver', admin: 'red',
};

export default function AuditLog() {
  const [page,    setPage]   = useState(1);
  const [module,  setModule] = useState('');
  const [search,  setSearch] = useState('');
  const [from,    setFrom]   = useState('');
  const [to,      setTo]     = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs', page, module, search, from, to],
    queryFn: () => api.get('/audit', {
      params: { page, limit: 50, module: module || undefined, search: search || undefined, from: from || undefined, to: to || undefined },
    }).then(r => r.data),
    placeholderData: (prev) => prev,
  });

  const { data: modules } = useQuery({
    queryKey: ['audit-modules'],
    queryFn: () => api.get('/audit/modules').then(r => r.data),
  });

  const columns = [
    {
      key: 'created_at', label: 'Time', width: 160,
      render: (r: any) => (
        <span style={{ fontSize: 12, color: '#878FA4', fontFamily: 'monospace' }}>
          {fmtDate(r.created_at)}
        </span>
      ),
    },
    {
      key: 'admin', label: 'Admin', width: 180,
      render: (r: any) => (
        <div>
          <div style={{ fontWeight: 600, color: '#F5F8FF', fontSize: 12 }}>
            {r.admin_first} {r.admin_last}
          </div>
          <div style={{ fontSize: 11, color: '#4F5669' }}>{r.admin_email}</div>
        </div>
      ),
    },
    {
      key: 'module', label: 'Module', width: 110,
      render: (r: any) => r.module ? (
        <Badge label={r.module} variant={MODULE_COLORS[r.module] ?? 'default'} />
      ) : <span style={{ color: '#4F5669' }}>—</span>,
    },
    {
      key: 'action', label: 'Action', width: 180,
      render: (r: any) => (
        <code style={{ fontSize: 11, color: '#3F8FE0', background: '#162F4F', padding: '2px 6px', borderRadius: 4 }}>
          {r.action}
        </code>
      ),
    },
    {
      key: 'description', label: 'Description',
      render: (r: any) => (
        <span style={{ fontSize: 12, color: '#CCD2E3' }}>{r.description ?? '—'}</span>
      ),
    },
    {
      key: 'entity', label: 'Entity', width: 130,
      render: (r: any) => r.entity_type ? (
        <div>
          <div style={{ fontSize: 11, color: '#878FA4' }}>{r.entity_type}</div>
          <div style={{ fontSize: 10, color: '#4F5669', fontFamily: 'monospace' }}>
            {r.entity_id?.slice(0, 8)}…
          </div>
        </div>
      ) : <span style={{ color: '#4F5669' }}>—</span>,
    },
    {
      key: 'ip', label: 'IP', width: 120,
      render: (r: any) => (
        <span style={{ fontSize: 11, color: '#4F5669', fontFamily: 'monospace' }}>
          {r.ip_address ?? '—'}
        </span>
      ),
    },
    {
      key: 'diff', label: '', width: 60,
      render: (r: any) => (r.old_data || r.new_data) ? (
        <Btn size="sm" variant="secondary" onClick={() => setExpanded(expanded === r.id ? null : r.id)}>
          {expanded === r.id ? '▲' : '▼'}
        </Btn>
      ) : null,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Audit Log"
        subtitle="Full trail of every admin action across the platform"
      />

      {/* Filters */}
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: 2, minWidth: 200 }}>
            <Input
              placeholder="Search by email, action, description…"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
          <div style={{ flex: 1, minWidth: 140 }}>
            <Select value={module} onChange={e => { setModule(e.target.value); setPage(1); }}>
              <option value="">All Modules</option>
              {(modules ?? []).map((m: string) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </Select>
          </div>
          <div>
            <input type="date" value={from} onChange={e => { setFrom(e.target.value); setPage(1); }}
              style={{ padding: '8px 10px', background: '#252931', border: '1px solid #353947', borderRadius: 8, color: '#CCD2E3', fontSize: 13 }} />
          </div>
          <div>
            <input type="date" value={to} onChange={e => { setTo(e.target.value); setPage(1); }}
              style={{ padding: '8px 10px', background: '#252931', border: '1px solid #353947', borderRadius: 8, color: '#CCD2E3', fontSize: 13 }} />
          </div>
          <Btn variant="secondary" onClick={() => { setModule(''); setSearch(''); setFrom(''); setTo(''); setPage(1); }}>
            Clear
          </Btn>
        </div>
      </Card>

      {/* Summary */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        <div style={{ padding: '8px 14px', background: '#1C1F27', border: '1px solid #353947', borderRadius: 8, fontSize: 12, color: '#878FA4' }}>
          <span style={{ color: '#F5F8FF', fontWeight: 700 }}>{data?.total ?? 0}</span> total entries
        </div>
        <div style={{ padding: '8px 14px', background: '#1C1F27', border: '1px solid #353947', borderRadius: 8, fontSize: 12, color: '#878FA4' }}>
          Page {data?.page ?? 1} of {data?.pages ?? 1}
        </div>
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><Spinner size={32} /></div>
      ) : (
        <>
          <Card style={{ padding: 0 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #353947' }}>
                  {columns.map(col => (
                    <th key={col.key} style={{
                      padding: '10px 14px', textAlign: 'left',
                      fontSize: 11, fontWeight: 700, color: '#4F5669',
                      letterSpacing: '0.06em', textTransform: 'uppercase',
                      width: col.width,
                    }}>{col.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(data?.logs ?? []).map((row: any) => (
                  <>
                    <tr key={row.id} style={{ borderBottom: '1px solid #252931' }}>
                      {columns.map(col => (
                        <td key={col.key} style={{ padding: '9px 14px', verticalAlign: 'middle' }}>
                          {col.render(row)}
                        </td>
                      ))}
                    </tr>
                    {expanded === row.id && (
                      <tr key={`${row.id}-detail`} style={{ background: '#161920' }}>
                        <td colSpan={columns.length} style={{ padding: '12px 16px' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                            {row.old_data && (
                              <div>
                                <div style={{ fontSize: 11, color: '#EB5454', fontWeight: 700, marginBottom: 6 }}>BEFORE</div>
                                <pre style={{ fontSize: 11, color: '#878FA4', background: '#1C1F27', padding: 10, borderRadius: 6, overflow: 'auto', maxHeight: 200 }}>
                                  {JSON.stringify(typeof row.old_data === 'string' ? JSON.parse(row.old_data) : row.old_data, null, 2)}
                                </pre>
                              </div>
                            )}
                            {row.new_data && (
                              <div>
                                <div style={{ fontSize: 11, color: '#38BA82', fontWeight: 700, marginBottom: 6 }}>AFTER</div>
                                <pre style={{ fontSize: 11, color: '#878FA4', background: '#1C1F27', padding: 10, borderRadius: 6, overflow: 'auto', maxHeight: 200 }}>
                                  {JSON.stringify(typeof row.new_data === 'string' ? JSON.parse(row.new_data) : row.new_data, null, 2)}
                                </pre>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
                {(data?.logs ?? []).length === 0 && (
                  <tr><td colSpan={columns.length} style={{ padding: 40, textAlign: 'center', color: '#4F5669' }}>No audit entries found</td></tr>
                )}
              </tbody>
            </table>
          </Card>

          {data?.pages > 1 && (
            <Pagination page={page} pages={data.pages} onPage={setPage} />
          )}
        </>
      )}
    </div>
  );
}
