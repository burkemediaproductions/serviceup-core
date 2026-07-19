# Branding and Appearance

Each tenant can customize its dashboard from `/admin/branding` without maintaining a separate CSS fork. Branding is stored in tenant-scoped Settings and applied through CSS variables.

Supported options include dashboard name, Pixel-backed logo/favicon/app icon, light or dark mode, primary/secondary/accent colors, background/surface/text/border colors, corner radius, heading/body font stacks, and powered-by text/link.

The shared stylesheet remains canonical. Client-specific custom CSS is intentionally not the default because it increases upgrade and accessibility risk.
