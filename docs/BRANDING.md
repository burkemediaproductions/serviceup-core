# Branding and Appearance

Each tenant can customize its dashboard from `/admin/branding` without maintaining a separate CSS fork. Branding is stored in tenant-scoped Settings and applied through CSS variables.

Supported options include dashboard name, independent Pixel-backed topbar/sidebar/login logos, logo and topbar-title visibility, a configurable mobile-menu close label, a configurable loading image, favicon/app icon, separately branded Light and Dark palettes, configurable menu-button colors, corner radius, heading/body font stacks, and powered-by text/link. Administrators can optionally enable a simplified Reading mode and allow each user to switch modes; the preference is remembered per tenant and browser.

Light and Dark modes can each use separate Pixel-backed background images or videos, CSS gradients, and readability overlays for the login page and the authenticated ServiceUp dashboard. Reading mode intentionally suppresses decorative backgrounds. Tenant administrators also have an optional Custom CSS editor for dashboard-specific refinements. Custom CSS is injected only into that tenant's ServiceUp interface and should normally be scoped beneath `.su-layout` or `.su-login-page`.

The shared stylesheet remains canonical. Custom CSS is an escape hatch rather than the default because broad overrides can increase upgrade and accessibility risk.
