import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api.js';
import { PageHeader, Card, Btn, Spinner, Badge } from '../../components/ui.js';

const ROLES = [
  { key: 'super_admin', label: 'Super Admin', color: '#EB5454', desc: 'Full access to everything' },
  { key: 'admin',       label: 'Admin',       color: '#3F8FE0', desc: 'Manage operations, no role editing' },
  { key: 'support',     label: 'Support',     color: '#38BA82', desc: 'Read-only + basic actions' },
];

const MODULE_ICONS: Record<string, string> = {
  users: '👥', kyc: '🪪', payments: '💳', payouts: '💸',
  accounts: '📊', risk: '🛡️', reports: '📈', settings: '⚙️',
  integrations: '📡', admin: '🔐', audit: '📋', trading: '📉',
};

export default function RolesPermissions() {
  const [activeRole, setActiveRole] = useState('admin');
  const [dirty, setDirty] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['permissions-matrix'],
    queryFn: () => api.get('/permissions/matrix').then(r => r.data),
  });

  const updateRole = useMutation({
    mutationFn: ({ role, permissions }: { role: string; permissions: string[] }) =>
      api.put(`/permissions/${role}`, { permissions }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['permissions-matrix'] });
      setDirty({});
    },
  });

  if (isLoading || !data) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}><Spinner size={32} /></div>;
  }

  const { modules, matrix } = data;

  // Build effective grants: start from matrix, apply dirty overrides
  const getGranted = (permKey: string) => {
    if (dirty[permKey] !== undefined) return dirty[permKey];
    return matrix[activeRole]?.[permKey] ?? false;
  };

  const togglePerm = (permKey: string) => {
    if (activeRole === 'super_admin') return; // super_admin is always full
    setDirty(d => ({ ...d, [permKey]: !getGranted(permKey) }));
  };

  const saveChanges = async () => {
    setSaving(true);
    // Build full permission list for this role
    const all = Object.values(modules as Record<string, any[]>).flat();
    const granted = all
      .map((p: any) => p.key)
      .filter((k: string) => getGranted(k));
    await updateRole.mutateAsync({ role: activeRole, permissions: granted });
    setSaving(false);
  };

  const hasDirty = Object.keys(dirty).length > 0;

  return (
    <div>
      <PageHeader
        title="Role Permissions"
        subtitle="Control what each admin role can see and do across the platform"
      />

      {/* Role selector */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
        {ROLES.map(role => (
          <button key={role.key}
            onClick={() => { setActiveRole(role.key); setDirty({}); }}
            style={{
              padding: '12px 20px', borderRadius: 10, cursor: 'pointer',
              border: `2px solid ${activeRole === role.key ? role.color : '#353947'}`,
              background: activeRole === role.key ? `${role.color}15` : '#1C1F27',
              textAlign: 'left', transition: 'all 0.15s',
            }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: activeRole === role.key ? role.color : '#F5F8FF' }}>
              {role.label}
            </div>
            <div style={{ fontSize: 11, color: '#878FA4', marginTop: 2 }}>{role.desc}</div>
          </button>
        ))}

        {hasDirty && (
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 10, alignItems: 'center' }}>
            <Btn variant="secondary" onClick={() => setDirty({})}>Discard</Btn>
            <Btn variant="primary" onClick={saveChanges} disabled={saving}>
              {saving ? 'Saving…' : `Save Changes (${Object.keys(dirty).length})`}
            </Btn>
          </div>
        )}
      </div>

      {activeRole === 'super_admin' && (
        <div style={{ padding: '12px 16px', background: '#3D1313', border: '1px solid #EB545444', borderRadius: 8, marginBottom: 20, fontSize: 13, color: '#EB5454' }}>
          🔒 Super Admin always has all permissions and cannot be restricted.
        </div>
      )}

      {/* Permission matrix by module */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {Object.entries(modules as Record<string, any[]>).map(([mod, perms]) => (
          <Card key={mod}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <span style={{ fontSize: 20 }}>{MODULE_ICONS[mod] ?? '🔧'}</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#F5F8FF', textTransform: 'capitalize' }}>{mod}</span>
              <span style={{ fontSize: 11, color: '#4F5669' }}>({perms.length} permissions)</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
              {perms.map((perm: any) => {
                const granted = getGranted(perm.key);
                const isDirtyItem = dirty[perm.key] !== undefined;
                const locked = activeRole === 'super_admin';

                return (
                  <button key={perm.key}
                    onClick={() => togglePerm(perm.key)}
                    disabled={locked}
                    style={{
                      padding: '10px 14px', borderRadius: 8, cursor: locked ? 'default' : 'pointer',
                      border: `1px solid ${granted ? (isDirtyItem ? '#F5B326' : '#3F8FE044') : '#353947'}`,
                      background: granted ? (isDirtyItem ? '#362A0A' : '#162F4F') : '#252931',
                      textAlign: 'left', transition: 'all 0.15s', width: '100%',
                    }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: granted ? '#F5F8FF' : '#878FA4' }}>
                        {perm.label}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {perm.is_destructive && (
                          <span style={{ fontSize: 10, color: '#EB5454' }}>⚠</span>
                        )}
                        {isDirtyItem && (
                          <Badge label="changed" variant="gold" size="xs" />
                        )}
                        <div style={{
                          width: 14, height: 14, borderRadius: '50%',
                          background: granted ? '#38BA82' : '#353947',
                          border: `2px solid ${granted ? '#38BA82' : '#4F5669'}`,
                          flexShrink: 0,
                        }} />
                      </div>
                    </div>
                    <div style={{ fontSize: 10, color: '#4F5669', fontFamily: 'monospace' }}>{perm.key}</div>
                    {perm.description && (
                      <div style={{ fontSize: 11, color: '#4F5669', marginTop: 3 }}>{perm.description}</div>
                    )}
                  </button>
                );
              })}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
