import { type ReactNode, type CSSProperties } from 'react';

// ── Badge ─────────────────────────────────────────────────────────────────────
type BadgeVariant = 'blue'|'green'|'gold'|'red'|'purple'|'teal'|'silver'|'default';

const BADGE_STYLES: Record<BadgeVariant, CSSProperties> = {
  blue:    { background:'#162F4F', color:'#3F8FE0', border:'1px solid #3F8FE044' },
  green:   { background:'#123B26', color:'#38BA82', border:'1px solid #38BA8244' },
  gold:    { background:'#362A0A', color:'#F5B326', border:'1px solid #F5B32644' },
  red:     { background:'#3D1313', color:'#EB5454', border:'1px solid #EB545444' },
  purple:  { background:'#2D1B69', color:'#8B5CF6', border:'1px solid #8B5CF644' },
  teal:    { background:'#0D2E2A', color:'#14B8A6', border:'1px solid #14B8A644' },
  silver:  { background:'#1C2230', color:'#9CAABF', border:'1px solid #9CAABF44' },
  default: { background:'#252931', color:'#878FA4', border:'1px solid #45455B44' },
};

export function Badge({ label, variant = 'default', size = 'sm' }: {
  label: string; variant?: BadgeVariant; size?: 'xs'|'sm';
}) {
  return (
    <span style={{
      ...BADGE_STYLES[variant],
      display:'inline-flex', alignItems:'center',
      padding: size === 'xs' ? '1px 6px' : '2px 8px',
      borderRadius: 4,
      fontSize: size === 'xs' ? 10 : 11,
      fontWeight: 700,
      letterSpacing: '0.05em',
      textTransform: 'uppercase',
      whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  );
}

// Status badge helpers
const STATUS_MAP: Record<string, BadgeVariant> = {
  active:'green', approved:'green', funded:'green', passed:'green', paid:'green',
  completed:'green', healthy:'green',
  pending:'gold', processing:'gold', under_review:'gold', fee_paid:'gold',
  breached:'red', failed:'red', rejected:'red', banned:'red', suspended:'red',
  disputed:'red', down:'red',
  evaluation:'blue', verification:'blue', registration:'blue', scheduled:'blue',
  draft:'default', archived:'default', closed:'default', not_submitted:'default',
  refunded:'silver',
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge
      label={status.replace(/_/g, ' ')}
      variant={STATUS_MAP[status] ?? 'default'}
    />
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────
export function StatCard({ label, value, sub, color, icon }: {
  label: string; value: string | number; sub?: string;
  color?: string; icon?: string;
}) {
  return (
    <div style={{
      padding: '14px 16px',
      background: '#1C1F27',
      border: '1px solid #353947',
      borderRadius: 10,
    }}>
      <div style={{ fontSize: 11, color: '#4F5669', marginBottom: 6, display:'flex', alignItems:'center', gap:6 }}>
        {icon && <span style={{ fontSize:14 }}>{icon}</span>}
        {label.toUpperCase()}
      </div>
      <div style={{ fontSize: 24, fontWeight: 700, color: color ?? '#F5F8FF' }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 11, color: '#878FA4', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

// ── Card wrapper ──────────────────────────────────────────────────────────────
export function Card({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div style={{
      background: '#1C1F27',
      border: '1px solid #353947',
      borderRadius: 10,
      padding: 20,
      ...style,
    }}>
      {children}
    </div>
  );
}

export function CardHeader({ title, sub, action }: {
  title: string; sub?: string; action?: ReactNode;
}) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end', marginBottom:16 }}>
      <div>
        <div style={{ fontSize:15, fontWeight:700, color:'#F5F8FF' }}>{title}</div>
        {sub && <div style={{ fontSize:12, color:'#878FA4', marginTop:2 }}>{sub}</div>}
      </div>
      {action}
    </div>
  );
}

// ── Table ─────────────────────────────────────────────────────────────────────
export function Table({ columns, data, onRowClick, emptyMessage = 'No records found' }: {
  columns: Array<{ key: string; label: string; width?: number; render?: (row: any) => ReactNode }>;
  data:    any[];
  onRowClick?: (row: any) => void;
  emptyMessage?: string;
}) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width:'100%', borderCollapse:'collapse' }}>
        <thead>
          <tr style={{ borderBottom:'1px solid #353947' }}>
            {columns.map(c => (
              <th key={c.key} style={{
                padding: '8px 10px', fontSize:10, fontWeight:700,
                color:'#4F5669', textAlign:'left',
                letterSpacing:'0.06em', textTransform:'uppercase',
                width: c.width,
              }}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr><td colSpan={columns.length} style={{ padding:'32px 10px', textAlign:'center', color:'#4F5669', fontSize:13 }}>
              {emptyMessage}
            </td></tr>
          ) : data.map((row, i) => (
            <tr
              key={row.id ?? i}
              onClick={() => onRowClick?.(row)}
              style={{
                borderBottom: '1px solid #35394722',
                cursor: onRowClick ? 'pointer' : 'default',
                transition: 'background 0.1s',
              }}
              onMouseEnter={e => { if (onRowClick) (e.currentTarget as HTMLElement).style.background = '#252931'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
            >
              {columns.map(c => (
                <td key={c.key} style={{ padding:'9px 10px', fontSize:13, color:'#CCD2E3' }}>
                  {c.render ? c.render(row) : row[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Pagination ────────────────────────────────────────────────────────────────
export function Pagination({ page, pages, total, limit, onChange }: {
  page: number; pages: number; total: number; limit: number;
  onChange: (page: number) => void;
}) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:14, fontSize:12, color:'#878FA4' }}>
      <span>
        {((page-1)*limit)+1}–{Math.min(page*limit, total)} of {total.toLocaleString()}
      </span>
      <div style={{ display:'flex', gap:6 }}>
        {[1, page-1, page, page+1, pages].filter((p,i,a) => p>=1 && p<=pages && a.indexOf(p)===i).map(p => (
          <button
            key={p}
            onClick={() => onChange(p)}
            style={{
              padding:'4px 10px',
              background: p === page ? '#3F8FE0' : '#252931',
              color:      p === page ? '#fff' : '#878FA4',
              border:     '1px solid #353947',
              borderRadius: 5,
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            {p}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Btn ───────────────────────────────────────────────────────────────────────
export function Btn({ children, onClick, variant = 'primary', size = 'md', disabled, style }: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary'|'secondary'|'danger'|'ghost';
  size?: 'sm'|'md';
  disabled?: boolean;
  style?: CSSProperties;
}) {
  const base: CSSProperties = {
    display:'inline-flex', alignItems:'center', gap:6,
    borderRadius: 6, fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1, transition:'background 0.15s',
    padding: size === 'sm' ? '5px 10px' : '8px 14px',
    fontSize: size === 'sm' ? 12 : 13,
  };
  const vars: Record<string, CSSProperties> = {
    primary:   { background:'#3F8FE0', color:'#fff', border:'none' },
    secondary: { background:'transparent', color:'#878FA4', border:'1px solid #353947' },
    danger:    { background:'#EB5454', color:'#fff', border:'none' },
    ghost:     { background:'transparent', color:'#3F8FE0', border:'none' },
  };
  return (
    <button
      onClick={disabled ? undefined : onClick}
      style={{ ...base, ...vars[variant], ...style }}
    >
      {children}
    </button>
  );
}

// ── Input ─────────────────────────────────────────────────────────────────────
export function Input({ placeholder, value, onChange, type = 'text', style }: {
  placeholder?: string; value?: string;
  onChange?: (v: string) => void;
  type?: string; style?: CSSProperties;
}) {
  return (
    <input
      type={type}
      placeholder={placeholder}
      value={value}
      onChange={e => onChange?.(e.target.value)}
      style={{
        background:'#252931', color:'#F5F8FF',
        border:'1px solid #353947', borderRadius:6,
        padding:'7px 10px', fontSize:13, outline:'none',
        ...style,
      }}
    />
  );
}

// ── Select ────────────────────────────────────────────────────────────────────
export function Select({ value, onChange, options, placeholder, style }: {
  value?: string;
  onChange?: (v: string) => void;
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
  style?: CSSProperties;
}) {
  return (
    <select
      value={value ?? ''}
      onChange={e => onChange?.(e.target.value)}
      style={{
        background:'#252931', color: value ? '#F5F8FF' : '#878FA4',
        border:'1px solid #353947', borderRadius:6,
        padding:'7px 10px', fontSize:13, outline:'none',
        ...style,
      }}
    >
      {placeholder && <option value="" disabled>{placeholder}</option>}
      {options.map(o => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────
export function Empty({ icon = '📭', message = 'No data found', sub }: {
  icon?: string; message?: string; sub?: string;
}) {
  return (
    <div style={{ textAlign:'center', padding:'48px 24px' }}>
      <div style={{ fontSize:40, marginBottom:12 }}>{icon}</div>
      <div style={{ fontSize:14, fontWeight:600, color:'#CCD2E3' }}>{message}</div>
      {sub && <div style={{ fontSize:12, color:'#878FA4', marginTop:6 }}>{sub}</div>}
    </div>
  );
}

// ── Loading spinner ───────────────────────────────────────────────────────────
export function Spinner({ size = 24 }: { size?: number }) {
  return (
    <div style={{
      width: size, height: size,
      border: `2px solid #353947`,
      borderTopColor: '#3F8FE0',
      borderRadius: '50%',
      animation: 'hp-spin 0.7s linear infinite',
    }}>
      <style>{`@keyframes hp-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ── Page header ───────────────────────────────────────────────────────────────
export function PageHeader({ title, sub, action }: {
  title: string; sub?: string; action?: ReactNode;
}) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:24 }}>
      <div>
        <h1 style={{ fontSize:22, fontWeight:800, color:'#F5F8FF', letterSpacing:'-0.02em' }}>{title}</h1>
        {sub && <p style={{ fontSize:13, color:'#878FA4', marginTop:3 }}>{sub}</p>}
      </div>
      {action}
    </div>
  );
}
