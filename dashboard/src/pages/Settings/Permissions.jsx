// admin/src/pages/Settings/Permissions.jsx
import { useEffect, useState } from 'react';
import { api } from '../../lib/api';

export default function PermissionsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [rolePerms, setRolePerms] = useState([]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError('');
      try {
        const res = await api.get('/api/permissions');
        setRoles(res.roles || []);
        setPermissions(res.permissions || []);
        setRolePerms(res.role_permissions || []);
      } catch (err) {
        console.error('Failed to load permissions', err);
        setError(err.message || 'Failed to load permissions');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const allowed = (role, permission) => role.slug === 'ADMIN' || rolePerms.some((item) => item.role_slug === role.slug && item.permission_slug === permission.slug && item.allowed);
  const toggle = async (role, permission) => {
    if (role.slug === 'ADMIN') return;
    const next = !allowed(role, permission);
    try {
      const saved = await api.post('/api/permissions/assign', { role_slug: role.slug, permission_slug: permission.slug, allowed: next });
      setRolePerms((items) => [...items.filter((item) => !(item.role_slug === role.slug && item.permission_slug === permission.slug)), saved]);
    } catch (err) { setError(err.message || 'Failed to update permission'); }
  };
  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Permissions</h1>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : <div style={{overflowX:'auto'}}><table className="su-table" style={{width:'100%'}}><thead><tr><th align="left">Permission</th>{roles.map((role)=><th key={role.slug}>{role.label}</th>)}</tr></thead><tbody>{permissions.map((permission)=><tr key={permission.slug}><td><strong>{permission.label}</strong><div style={{fontSize:12,opacity:.7}}>{permission.description || permission.slug}</div></td>{roles.map((role)=><td key={role.slug} style={{textAlign:'center'}}><input type="checkbox" aria-label={`${permission.label} for ${role.label}`} checked={allowed(role,permission)} disabled={role.slug==='ADMIN'} onChange={()=>toggle(role,permission)}/></td>)}</tr>)}</tbody></table></div>}
    </div>
  );
}
