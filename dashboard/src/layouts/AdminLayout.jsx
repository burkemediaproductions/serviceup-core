import React, { useEffect, useState, useCallback } from 'react';
import Sidebar from '../components/Sidebar';
import Topbar from '../components/Topbar';
import Footer from '../components/Footer';
import { useSettings } from '../context/SettingsContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';

/**
 * AdminLayout wraps all admin pages in a consistent layout with a sidebar,
 * a topbar and a footer.  It accepts an optional `role` prop to control
 * which navigation items are shown based on the current user's role.
 *
 * The layout handles mobile sidebar toggling (hamburger menu) and
 * automatically adds or removes a `su-sidebar-open` class on the document
 * body when the sidebar is open.  This class is used by the CSS to slide
 * the sidebar in and out on small screens.
 */
export default function AdminLayout({ children, role }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const { settings } = useSettings();
  const { user, logout } = useAuth();
  const effectiveRole = String(role || user?.role || 'VIEWER').toUpperCase();
  const hideChrome = settings?.hideChromeByRole?.[effectiveRole];

  const handleLogout = useCallback(async () => {
    try {
      await supabase.auth.signOut();
    } catch {
      // The ServiceUp session should still be cleared if Supabase is unavailable.
    }
    logout();
    window.localStorage.removeItem('serviceup.tenant');
    window.location.href = '/login';
  }, [logout]);

  // Close the sidebar on ESC key
  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') {
        setSidebarOpen(false);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Toggle a body class when the sidebar is open.  This is used by the CSS
  // to slide the sidebar on mobile screens without darkening the rest of the
  // page.
  useEffect(() => {
    if (sidebarOpen) {
      document.body.classList.add('su-sidebar-open');
    } else {
      document.body.classList.remove('su-sidebar-open');
    }
  }, [sidebarOpen]);

  // In viewer/embed mode (hideChrome), render only the content without
  // navigation or footer chrome.
  if (hideChrome) {
    return <main className="su-content">{children}</main>;
  }

  return (
    <div className={`su-layout${collapsed ? ' collapsed' : ''}`}>
      <Sidebar onClose={closeSidebar} role={effectiveRole} onLogout={handleLogout} />
      <Topbar
        onToggleSidebar={() => setSidebarOpen((v) => !v)}
        isSidebarOpen={sidebarOpen}
        role={effectiveRole}
      />
      <main className="su-content">{children}</main>
      <Footer />
    </div>
  );
}
