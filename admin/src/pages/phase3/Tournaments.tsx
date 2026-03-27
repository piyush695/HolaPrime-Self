import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api.js';
import {
  PageHeader, Card, CardHeader, Table, StatCard,
  Btn, Input, Spinner, Badge, StatusBadge, Empty,
} from '../../components/ui.js';

const fmt$ = (v: number) =>
  new Intl.NumberFormat('en-US', { style:'currency', currency:'USD', maximumFractionDigits:0 }).format(v);

const ROUND_LABELS: Record<string,string> = {
  r64:'Round of 64', r32:'Round of 32', r16:'Round of 16',
  qf:'Quarterfinals', sf:'Semifinals', final:'Grand Final',
};
const ROUND_ORDER = ['r64','r32','r16','qf','sf','final'];

export default function Tournaments() {
  const [selected, setSelected] = useState<any>(null);
  const [lbPhase,  setLbPhase]  = useState('phase2');
  const [tab,      setTab]      = useState<'entries'|'bracket'|'leaderboard'>('bracket');
  const [showNew,  setShowNew]  = useState(false);
  const [newT, setNewT] = useState({
    name:'', slug:'', entryFee:'15', prizePool:'100000',
    phase1Start:'', phase1End:'', phase2Start:'', phase2End:'',
    bracketStart:'', finalEnd:'',
  });
  const qc = useQueryClient();

  const { data: stats } = useQuery({
    queryKey: ['tournament-stats'],
    queryFn:  () => api.get('/tournaments/stats').then(r => r.data),
  });

  const { data: list, isLoading } = useQuery({
    queryKey: ['tournaments'],
    queryFn:  () => api.get('/tournaments').then(r => r.data),
  });

  const { data: detail } = useQuery({
    queryKey: ['tournament-detail', selected?.id],
    queryFn:  () => selected ? api.get(`/tournaments/${selected.id}`).then(r => r.data) : null,
    enabled:  !!selected,
  });

  const { data: leaderboard } = useQuery({
    queryKey: ['tournament-lb', selected?.id, lbPhase],
    queryFn:  () => selected
      ? api.get(`/tournaments/${selected.id}/leaderboard`, { params:{ phase: lbPhase } }).then(r => r.data)
      : null,
    enabled: !!selected && tab === 'leaderboard',
  });

  const create = useMutation({
    mutationFn: () => api.post('/tournaments', {
      ...newT, entryFee: parseFloat(newT.entryFee), prizePool: parseFloat(newT.prizePool),
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey:['tournaments'] }); setShowNew(false); },
  });

  const selectChampions = useMutation({
    mutationFn: (id: string) => api.post(`/tournaments/${id}/select-champions`),
    onSuccess:  () => qc.invalidateQueries({ queryKey:['tournament-detail', selected?.id] }),
  });

  const genBracket = useMutation({
    mutationFn: (id: string) => api.post(`/tournaments/${id}/generate-bracket`),
    onSuccess:  () => qc.invalidateQueries({ queryKey:['tournament-detail', selected?.id] }),
  });

  const resolveMatch = useMutation({
    mutationFn: ({ matchId, winnerEntryId }: { matchId:string; winnerEntryId:string }) =>
      api.post(`/tournaments/matches/${matchId}/resolve`, { winnerEntryId }),
    onSuccess: () => qc.invalidateQueries({ queryKey:['tournament-detail', selected?.id] }),
  });

  const bracketByRound = (detail?.bracket ?? []).reduce((acc: any, m: any) => {
    if (!acc[m.round]) acc[m.round] = [];
    acc[m.round].push(m);
    return acc;
  }, {});

  const listCols = [
    { key:'name', label:'Tournament', render:(r:any) => (
      <div>
        <div style={{ fontWeight:600, color:'#F5F8FF' }}>{r.name}</div>
        <div style={{ fontSize:11, color:'#4F5669' }}>{fmt$(parseFloat(r.prize_pool ?? '0'))} prize pool</div>
      </div>
    )},
    { key:'status', label:'Status', width:120, render:(r:any) => <StatusBadge status={r.status} /> },
    { key:'total_entries', label:'Entries', width:80, render:(r:any) => <span style={{ color:'#CCD2E3' }}>{r.total_entries}</span> },
    { key:'paid_entries', label:'Paid', width:80, render:(r:any) => <span style={{ color:'#38BA82', fontWeight:600 }}>{r.paid_entries}</span> },
    { key:'phase1_start', label:'Phase 1 Start', width:130, render:(r:any) => r.phase1_start ? <span style={{ color:'#878FA4', fontSize:11 }}>{new Date(r.phase1_start).toLocaleDateString()}</span> : <span style={{ color:'#4F5669' }}>—</span> },
    { key:'action', label:'', width:80, render:(r:any) => <Btn size="sm" onClick={() => { setSelected(r); setTab('bracket'); }}>Open</Btn> },
  ];

  return (
    <>
      <PageHeader
        title="Tournament Manager"
        sub="World Cup phases, bracket generation, match management"
        action={<Btn onClick={() => setShowNew(true)}>+ New Tournament</Btn>}
      />

      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:20 }}>
        <StatCard label="Total"         value={stats?.total_tournaments   ?? '—'} />
        <StatCard label="In Qualifying" value={stats?.in_qualifying       ?? '—'} color="#3F8FE0" />
        <StatCard label="In Bracket"    value={stats?.in_bracket          ?? '—'} color="#F5B326" />
        <StatCard label="Prize Pool"    value={stats?.total_prize_pool ? fmt$(parseFloat(stats.total_prize_pool)) : '—'} color="#38BA82" />
      </div>

      {/* New tournament modal */}
      {showNew && (
        <div style={{ position:'fixed', inset:0, background:'#00000088', zIndex:100, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div style={{ background:'#1C1F27', border:'1px solid #353947', borderRadius:12, padding:24, width:520, maxHeight:'80vh', overflowY:'auto' }}>
            <div style={{ fontWeight:700, color:'#F5F8FF', marginBottom:16 }}>Create Tournament</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
              {[
                { k:'name',         l:'Name',              full:true },
                { k:'slug',         l:'URL Slug',          full:true },
                { k:'entryFee',     l:'Entry Fee (USD)' },
                { k:'prizePool',    l:'Prize Pool (USD)' },
                { k:'phase1Start',  l:'Phase 1 Start',     type:'date' },
                { k:'phase1End',    l:'Phase 1 End',       type:'date' },
                { k:'phase2Start',  l:'Phase 2 Start',     type:'date' },
                { k:'phase2End',    l:'Phase 2 End',       type:'date' },
                { k:'bracketStart', l:'Bracket Start',     type:'date' },
                { k:'finalEnd',     l:'Grand Final End',   type:'date' },
              ].map((f: any) => (
                <div key={f.k} style={{ gridColumn: f.full ? '1 / -1' : 'auto' }}>
                  <div style={{ fontSize:11, color:'#878FA4', marginBottom:4 }}>{f.l}</div>
                  <input
                    type={f.type ?? 'text'}
                    value={(newT as any)[f.k]}
                    onChange={e => setNewT(p => ({ ...p, [f.k]: e.target.value }))}
                    style={{ width:'100%', background:'#252931', color:'#F5F8FF', border:'1px solid #353947', borderRadius:6, padding:'7px 10px', fontSize:13, outline:'none' }}
                  />
                </div>
              ))}
            </div>
            <div style={{ display:'flex', gap:8, marginTop:16 }}>
              <Btn variant="primary" disabled={!newT.name||create.isPending} onClick={() => create.mutate()}>Create</Btn>
              <Btn variant="secondary" onClick={() => setShowNew(false)}>Cancel</Btn>
            </div>
          </div>
        </div>
      )}

      <div style={{ display:'grid', gridTemplateColumns: selected ? '320px 1fr' : '1fr', gap:16 }}>
        {/* Tournament list */}
        <Card>
          {isLoading ? <Spinner /> : (list ?? []).length === 0
            ? <Empty icon="🌍" message="No tournaments yet" sub="Create your first World Cup" />
            : <Table columns={listCols} data={list ?? []} onRowClick={r => { setSelected(r); setTab('bracket'); }} />
          }
        </Card>

        {/* Tournament detail */}
        {selected && detail && (
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            {/* Header */}
            <Card>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:14 }}>
                <div>
                  <div style={{ fontSize:18, fontWeight:800, color:'#F5F8FF' }}>{detail.name}</div>
                  <div style={{ display:'flex', gap:8, marginTop:6 }}>
                    <StatusBadge status={detail.status} />
                    <Badge label={`${detail.entries?.length ?? 0} entries`} variant="blue" />
                    <Badge label={`${fmt$(parseFloat(detail.prize_pool ?? '0'))} pool`} variant="gold" />
                  </div>
                </div>
                <div style={{ display:'flex', gap:8 }}>
                  {detail.status === 'phase2' && (
                    <Btn size="sm" variant="primary" onClick={() => selectChampions.mutate(selected.id)} disabled={selectChampions.isPending}>
                      Select Champions
                    </Btn>
                  )}
                  {detail.status === 'registration' || detail.status === 'phase2' ? (
                    <Btn size="sm" variant="secondary" onClick={() => genBracket.mutate(selected.id)} disabled={genBracket.isPending}>
                      Generate Bracket
                    </Btn>
                  ) : null}
                  <button onClick={() => setSelected(null)} style={{ background:'none', border:'none', color:'#878FA4', fontSize:20, cursor:'pointer' }}>×</button>
                </div>
              </div>

              {/* Dates row */}
              <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8 }}>
                {[
                  { l:'Phase 1', v:detail.phase1_start ? `${new Date(detail.phase1_start).toLocaleDateString()} – ${new Date(detail.phase1_end).toLocaleDateString()}` : '—' },
                  { l:'Phase 2', v:detail.phase2_start ? `${new Date(detail.phase2_start).toLocaleDateString()} – ${new Date(detail.phase2_end).toLocaleDateString()}` : '—' },
                  { l:'Bracket', v:detail.bracket_start ? new Date(detail.bracket_start).toLocaleDateString() : '—' },
                  { l:'Final',   v:detail.final_end ? new Date(detail.final_end).toLocaleDateString() : '—' },
                ].map(d => (
                  <div key={d.l} style={{ padding:'8px 10px', background:'#252931', borderRadius:6 }}>
                    <div style={{ fontSize:10, color:'#4F5669' }}>{d.l}</div>
                    <div style={{ fontSize:12, fontWeight:600, color:'#CCD2E3' }}>{d.v}</div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Tabs */}
            <div style={{ display:'flex', gap:0, borderBottom:'1px solid #353947' }}>
              {[{id:'bracket',label:'Bracket'},{id:'leaderboard',label:'Leaderboard'},{id:'entries',label:'Entries'}].map(t => (
                <button key={t.id} onClick={() => setTab(t.id as any)} style={{
                  padding:'8px 16px', fontSize:12, fontWeight:tab===t.id?700:400,
                  color:tab===t.id?'#F5F8FF':'#878FA4', background:'none', border:'none', cursor:'pointer',
                  borderBottom:tab===t.id?'2px solid #3F8FE0':'2px solid transparent',
                }}>{t.label}</button>
              ))}
            </div>

            {/* Bracket view */}
            {tab === 'bracket' && (
              <Card>
                {ROUND_ORDER.filter(r => bracketByRound[r]).map(round => (
                  <div key={round} style={{ marginBottom:20 }}>
                    <div style={{ fontSize:12, fontWeight:700, color:'#F5B326', letterSpacing:'0.05em', marginBottom:10 }}>
                      {ROUND_LABELS[round]}
                    </div>
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:8 }}>
                      {(bracketByRound[round] ?? []).slice(0,8).map((m: any) => (
                        <div key={m.id} style={{ padding:'10px', background:'#252931', borderRadius:8, border:'1px solid #353947' }}>
                          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
                            <span style={{ fontSize:10, color:'#4F5669' }}>Match {m.match_number}</span>
                            <StatusBadge status={m.status} />
                          </div>
                          {m.seed1_entry_id ? (
                            <>
                              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'4px 0', borderBottom:'1px solid #35394722' }}>
                                <span style={{ fontSize:12, color: m.winner_entry_id === m.seed1_entry_id ? '#38BA82' : '#CCD2E3', fontWeight: m.winner_entry_id === m.seed1_entry_id ? 700 : 400 }}>
                                  {m.s1_country} · {m.s1_first} {m.s1_last}
                                  {m.seed1_return ? ` (${parseFloat(m.seed1_return).toFixed(2)}%)` : ''}
                                </span>
                                {m.status === 'active' && (
                                  <Btn size="sm" variant="primary" style={{ padding:'2px 8px', fontSize:10 }}
                                    onClick={() => resolveMatch.mutate({ matchId:m.id, winnerEntryId:m.seed1_entry_id })}>
                                    Win
                                  </Btn>
                                )}
                              </div>
                              <div style={{ textAlign:'center', padding:'2px', fontSize:9, color:'#4F5669' }}>VS</div>
                              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'4px 0' }}>
                                <span style={{ fontSize:12, color: m.winner_entry_id === m.seed2_entry_id ? '#38BA82' : '#CCD2E3', fontWeight: m.winner_entry_id === m.seed2_entry_id ? 700 : 400 }}>
                                  {m.s2_country} · {m.s2_first} {m.s2_last}
                                  {m.seed2_return ? ` (${parseFloat(m.seed2_return).toFixed(2)}%)` : ''}
                                </span>
                                {m.status === 'active' && (
                                  <Btn size="sm" variant="primary" style={{ padding:'2px 8px', fontSize:10 }}
                                    onClick={() => resolveMatch.mutate({ matchId:m.id, winnerEntryId:m.seed2_entry_id })}>
                                    Win
                                  </Btn>
                                )}
                              </div>
                            </>
                          ) : (
                            <div style={{ textAlign:'center', color:'#4F5669', fontSize:12, padding:'8px' }}>TBD</div>
                          )}
                        </div>
                      ))}
                    </div>
                    {bracketByRound[round].length > 8 && (
                      <div style={{ textAlign:'center', padding:'6px', background:'#252931', borderRadius:6, marginTop:6, fontSize:11, color:'#4F5669' }}>
                        + {bracketByRound[round].length - 8} more matches
                      </div>
                    )}
                  </div>
                ))}
                {Object.keys(bracketByRound).length === 0 && (
                  <Empty icon="🏆" message="No bracket generated yet" sub="Use Generate Bracket once Phase 2 champions are selected" />
                )}
              </Card>
            )}

            {/* Leaderboard */}
            {tab === 'leaderboard' && (
              <Card>
                <div style={{ display:'flex', gap:8, marginBottom:14 }}>
                  {['phase1','phase2'].map(p => (
                    <button key={p} onClick={() => setLbPhase(p)} style={{
                      padding:'5px 12px', borderRadius:5, fontSize:12, fontWeight:600,
                      cursor:'pointer', border:'1px solid',
                      background:lbPhase===p?'#3F8FE0':'#252931',
                      color:lbPhase===p?'#fff':'#878FA4',
                      borderColor:lbPhase===p?'#3F8FE0':'#353947',
                    }}>Phase {p.slice(-1)}</button>
                  ))}
                </div>
                {!leaderboard ? <Spinner /> : (
                  <Table
                    columns={[
                      { key:'rank', label:'#', width:48, render:(r:any) => <span style={{ fontWeight:700, color: r.rank<=3?'#F5B326':'#878FA4' }}>{r.rank===1?'🥇':r.rank===2?'🥈':r.rank===3?'🥉':r.rank}</span> },
                      { key:'trader', label:'Trader', render:(r:any) => (
                        <div>
                          <div style={{ fontWeight:600, color:'#F5F8FF' }}>{r.first_name} {r.last_name}</div>
                          <div style={{ fontSize:11, color:'#4F5669' }}>{r.country_code}</div>
                        </div>
                      )},
                      { key:'return_pct', label:'Return %', width:100, render:(r:any) => <span style={{ color:'#38BA82', fontWeight:700 }}>{parseFloat(r.return_pct ?? '0').toFixed(2)}%</span> },
                      { key:'is_country_champion', label:'Champion', width:100, render:(r:any) => r.is_country_champion ? <Badge label="🏆 Champion" variant="gold" /> : null },
                      { key:'status', label:'Status', width:110, render:(r:any) => <StatusBadge status={r.status} /> },
                    ]}
                    data={leaderboard ?? []}
                  />
                )}
              </Card>
            )}

            {/* Entries */}
            {tab === 'entries' && (
              <Card>
                <Table
                  columns={[
                    { key:'trader', label:'Trader', render:(r:any) => (
                      <div>
                        <div style={{ fontWeight:600, color:'#F5F8FF' }}>{r.first_name} {r.last_name}</div>
                        <div style={{ fontSize:11, color:'#4F5669' }}>{r.email} · {r.country_code}</div>
                      </div>
                    )},
                    { key:'status', label:'Status', width:120, render:(r:any) => <StatusBadge status={r.status} /> },
                    { key:'phase1_return', label:'P1 Return', width:100, render:(r:any) => r.phase1_return ? <span style={{ color:'#38BA82' }}>{parseFloat(r.phase1_return).toFixed(2)}%</span> : <span style={{ color:'#4F5669' }}>—</span> },
                    { key:'phase2_return', label:'P2 Return', width:100, render:(r:any) => r.phase2_return ? <span style={{ color:'#3F8FE0' }}>{parseFloat(r.phase2_return).toFixed(2)}%</span> : <span style={{ color:'#4F5669' }}>—</span> },
                    { key:'bracket_seed', label:'Seed', width:70, render:(r:any) => r.bracket_seed ? <span style={{ color:'#F5B326', fontWeight:600 }}>#{r.bracket_seed}</span> : <span style={{ color:'#4F5669' }}>—</span> },
                  ]}
                  data={detail?.entries ?? []}
                />
              </Card>
            )}
          </div>
        )}
      </div>
    </>
  );
}
