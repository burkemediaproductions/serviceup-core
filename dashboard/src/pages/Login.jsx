import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
// Import your Supabase client
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { getThemeBackground } from '../lib/branding';

/**
 * JWT-based login for the admin UI.
 * Calls POST /api/auth/login with { email, password }.
 * Stores token + user in localStorage and then signs into Supabase Auth.
 */
export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { settings, themeMode } = useSettings();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const background = getThemeBackground(settings, themeMode, 'login');
  const loginLogo = settings?.loginLogoUrl || settings?.logoUrl;
  const backgroundStyle = {
    '--su-page-image': background.imageUrl
      ? `url("${String(background.imageUrl).replace(/"/g, '%22')}")`
      : 'none',
    '--su-page-gradient': background.gradient || 'none',
    '--su-page-overlay': background.overlay || '#00000000',
  };

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.post('/api/auth/login', { email, password });
      if (!res || !res.token) {
        throw new Error('Invalid response from server');
      }
      if (!res.user) {
        throw new Error('Login response is missing the user');
      }

      // Update both React auth state and localStorage before navigating. This
      // keeps permission-protected routes from seeing a stale null user.
      login(res.token, res.user);
      if (res.tenant) {
        localStorage.setItem('serviceup.tenant', JSON.stringify(res.tenant));
      }
      // NEW: sign into Supabase Auth so file/image uploads work
      try {
        const { error: sbErr } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (sbErr) {
          console.warn('[Login] Supabase sign-in failed', sbErr.message);
          localStorage.setItem('serviceup.storageAuthError', sbErr.message);
        } else {
          localStorage.removeItem('serviceup.storageAuthError');
        }
      } catch (sbErr) {
        console.warn('[Login] Supabase sign-in exception', sbErr);
        localStorage.setItem('serviceup.storageAuthError', sbErr?.message || 'Storage sign-in failed');
      }
      // Redirect to admin dashboard
      navigate('/admin', { replace: true });
    } catch (err) {
      console.error('Login failed', err);
      setError('Invalid email or password.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="su-login-page"
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div className="su-brand-background" style={backgroundStyle} aria-hidden="true">
        {background.videoUrl && <video key={`${themeMode}-${background.videoUrl}`} autoPlay muted loop playsInline><source src={background.videoUrl} /></video>}
        <div className="su-brand-background-image" />
        <div className="su-brand-background-overlay" />
      </div>
      <div
        className="su-card"
        style={{
          width: '100%',
          maxWidth: 420,
          boxShadow: '0 18px 45px rgba(15,23,42,0.45)',
        }}
      >
        {settings?.showLoginLogo !== false && loginLogo && <img className="su-brand-logo su-brand-logo--login" src={loginLogo} alt={settings?.appName || settings?.app_name || 'ServiceUp'} />}
        <h1 style={{ marginTop: 0, marginBottom: 8 }}>{settings?.appName || settings?.app_name || 'ServiceUp'} Login</h1>
        <p style={{ marginTop: 0, opacity: 0.8, fontSize: 14 }}>
          Sign in to manage your clients, content, dashboard, and more.
        </p>

        {error && (
          <div className="su-alert su-error" style={{ marginBottom: 12, fontSize: 14 }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <label style={{ display: 'block', marginBottom: 10 }}>
            <span style={{ display: 'block', marginBottom: 4 }}>Email</span>
            <input
              type="email"
              className="su-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </label>

          <label style={{ display: 'block', marginBottom: 12 }}>
            <span style={{ display: 'block', marginBottom: 4 }}>Password</span>
            <input
              type="password"
              className="su-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </label>

          <button
            className="su-btn primary"
            type="submit"
            disabled={loading}
            style={{ width: '100%', marginTop: 4 }}
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
