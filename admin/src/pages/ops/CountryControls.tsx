import { useState, useEffect, useCallback } from 'react';
import { A, api, sel, Card, Pill, Toggle } from './_shared.js';

// Debounce helper - prevents hammering API on rapid changes
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debouncedValue;
}

export default function CountryControls() {
  const [countries, setCountries] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [tier, setTier] = useState('all');
  const [saving, setSaving] = useState<Set<string>>(new Set());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api('/api/v1/country-controls')
      .then(d => { setCountries(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  // Optimistic update: change UI immediately, fire API in background
  async function patch(code: string, changes: Partial<{ registration: boolean; payouts: boolean; kyc_required: boolean; risk_tier: string }>) {
    // 1. Update UI immediately
    setCountries(cs => cs.map(x => x.country_code === code ? { ...x, ...changes } : x));
    setSaving(s => new Set(s).add(code));
    setErrors(e => { const n = {...e}; delete n[code]; return n; });

    // 2. Get the full current country state (after optimistic update)
    const country = countries.find(c => c.country_code === code);
    if (!country) return;
    const merged = { ...country, ...changes };

    try {
      await api(`/api/v1/country-controls/${code}`, {
        method: 'PATCH',
        body: JSON.stringify({
          registration: merged.registration,
          payouts:      merged.payouts,
          kyc_required: merged.kyc_required,
          risk_tier:    merged.risk_tier,
        }),
      });
    } catch (e: any) {
      // Rollback on error
      setCountries(cs => cs.map(x => x.country_code === code ? country : x));
      setErrors(err => ({ ...err, [code]: e.message ?? 'Save failed' }));
    } finally {
      setSaving(s => { const n = new Set(s); n.delete(code); return n; });
    }
  }

  const TIER_COL: Record<string, string> = { standard: A.green, enhanced: A.gold, restricted: A.red };

  const filtered = countries.filter(c =>
    (tier === 'all' || c.risk_tier === tier) &&
    (c.country_name?.toLowerCase().includes(search.toLowerCase()) ||
     c.country_code?.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif" }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: A.white, marginBottom: 4 }}>Country Controls</h1>
        <p style={{ fontSize: 13, color: A.txtB }}>Toggle registration, payouts, and KYC per country. Changes apply instantly.</p>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 18 }}>
        {[
          { l: 'Total Countries', val: countries.length,                                      col: A.white },
          { l: 'Open',           val: countries.filter(c => c.registration).length,            col: A.green },
          { l: 'Enhanced',       val: countries.filter(c => c.risk_tier === 'enhanced').length, col: A.gold },
          { l: 'Restricted',     val: countries.filter(c => c.risk_tier === 'restricted').length, col: A.red },
        ].map(s => (
          <Card key={s.l}>
            <div style={{ fontSize: 24, fontWeight: 800, color: s.col }}>{s.val}</div>
            <div style={{ fontSize: 11, color: A.txtC, marginTop: 2 }}>{s.l}</div>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center' }}>
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search country name or code…"
          style={{ width: 240, background: 'rgba(255,255,255,.05)', color: A.white, border: `1px solid ${A.bord}`, borderRadius: 8, padding: '8px 12px', fontSize: 13, outline: 'none', fontFamily: 'inherit' }}
          onFocus={e => e.currentTarget.style.borderColor = A.blue}
          onBlur={e => e.currentTarget.style.borderColor = A.bord}
        />
        {['all', 'standard', 'enhanced', 'restricted'].map(t => (
          <button key={t} onClick={() => setTier(t)} style={{
            padding: '7px 14px', borderRadius: 20,
            border: `1px solid ${tier === t ? A.blue : A.bord}`,
            background: tier === t ? 'rgba(63,143,224,.15)' : 'transparent',
            color: tier === t ? A.blueL : A.txtB,
            fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
          }}>{t.charAt(0).toUpperCase() + t.slice(1)}</button>
        ))}
        <div style={{ marginLeft: 'auto', fontSize: 12, color: A.txtC }}>
          {filtered.length} of {countries.length} countries
        </div>
      </div>

      {loading && <div style={{ textAlign: 'center', padding: 60, color: A.txtC }}>Loading countries…</div>}

      {!loading && (
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ maxHeight: 'calc(100vh - 320px)', overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                <tr style={{ background: A.surf2 }}>
                  {['Country', 'Code', 'Risk Tier', 'Registration', 'Payouts', 'KYC Required'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: A.txtC, borderBottom: `1px solid ${A.bord}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => (
                  <tr key={c.country_code} style={{ borderBottom: `1px solid ${A.bord}`, background: saving.has(c.country_code) ? 'rgba(255,255,255,.02)' : 'transparent' }}>
                    <td style={{ padding: '8px 14px', fontSize: 13, color: A.white, fontWeight: 600 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {c.country_name}
                        {saving.has(c.country_code) && (
                          <span style={{ fontSize: 10, color: A.txtC }}>saving…</span>
                        )}
                        {errors[c.country_code] && (
                          <span style={{ fontSize: 10, color: A.red }} title={errors[c.country_code]}>⚠ error</span>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: '8px 14px' }}>
                      <code style={{ fontSize: 12, color: A.blueL }}>{c.country_code}</code>
                    </td>
                    <td style={{ padding: '8px 14px' }}>
                      <select
                        value={c.risk_tier}
                        onChange={e => patch(c.country_code, { risk_tier: e.target.value })}
                        style={{ ...sel, width: 'auto', padding: '4px 10px', fontSize: 12, color: TIER_COL[c.risk_tier] || A.txtB }}>
                        <option value="standard">Standard</option>
                        <option value="enhanced">Enhanced</option>
                        <option value="restricted">Restricted</option>
                      </select>
                    </td>
                    <td style={{ padding: '8px 14px' }}>
                      <Toggle checked={c.registration} onChange={(v: boolean) => patch(c.country_code, { registration: v })} />
                    </td>
                    <td style={{ padding: '8px 14px' }}>
                      <Toggle checked={c.payouts} onChange={(v: boolean) => patch(c.country_code, { payouts: v })} />
                    </td>
                    <td style={{ padding: '8px 14px' }}>
                      <Toggle checked={c.kyc_required} onChange={(v: boolean) => patch(c.country_code, { kyc_required: v })} />
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && !loading && (
                  <tr><td colSpan={6} style={{ padding: 40, textAlign: 'center', color: A.txtC }}>No countries match your filter</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
