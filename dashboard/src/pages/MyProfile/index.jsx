import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';

export default function MyProfilePage() {
  const { user, updateCurrentUser } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => { setName(user?.name || ''); }, [user?.name]);

  async function save(event) {
    event.preventDefault();
    setMessage('');
    setError('');
    if (password && password.length < 8) return setError('Password must be at least 8 characters.');
    if (password !== confirmPassword) return setError('The new passwords do not match.');
    try {
      setSaving(true);
      const updated = await api.patch('/api/users/me', { name, ...(password ? { password } : {}) });
      updateCurrentUser(updated);
      setPassword('');
      setConfirmPassword('');
      setMessage('Profile saved.');
    } catch (saveError) {
      setError(saveError.message || 'Unable to save profile.');
    } finally {
      setSaving(false);
    }
  }

  return <div className="su-page su-page--profile">
    <div className="su-page-header">
      <div><h1 className="su-page-title">My Profile</h1><p className="su-page-subtitle">Update your own name and password.</p></div>
    </div>
    <form className="su-card su-my-profile" onSubmit={save}>
      <label className="su-label">Email<input className="su-input" value={user?.email || ''} disabled /></label>
      <label className="su-label">Name<input className="su-input" value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" /></label>
      <div className="su-grid cols-2">
        <label className="su-label">New password<input className="su-input" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" placeholder="Leave blank to keep current password" /></label>
        <label className="su-label">Confirm new password<input className="su-input" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" /></label>
      </div>
      {error && <div className="su-alert su-alert--error">{error}</div>}
      {message && <div className="su-alert su-alert--success">{message}</div>}
      <div><button className="su-btn primary" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save My Profile'}</button></div>
    </form>
  </div>;
}
