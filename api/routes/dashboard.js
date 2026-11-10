import express from "express";
const router = express.Router();

const DEFAULT_DASHBOARD_ROLES = ["ADMIN", "EDITOR", "VIEWER"];

function roleName(value) {
  return String(value || "VIEWER").toUpperCase();
}

function widgetVisibleToRole(widget, role) {
  const roles = Array.isArray(widget?.roles)
    ? widget.roles.map(roleName).filter(Boolean)
    : [];
  return roles.length === 0 || roles.includes(roleName(role));
}

function layoutForRole(layout, role) {
  return (Array.isArray(layout) ? layout : []).filter((widget) =>
    widgetVisibleToRole(widget, role)
  );
}

// GET — load the team layout for this role. Older releases stored dashboard
// edits as user-specific overrides even though only admins could customize the
// dashboard. Prefer a newer legacy override so it can be promoted on the next
// save instead of silently losing the admin's latest dashboard.
router.get("/", async (req, res) => {
  const role = roleName(req.user.role);

  try {
    const roleRes = await req.db.query(
      "SELECT layout, updated_at FROM dashboard_layouts WHERE role = $1 LIMIT 1",
      [role]
    );
    const legacyRes = await req.db.query(
      `SELECT layout, updated_at
         FROM dashboard_layouts
        WHERE user_id IS NOT NULL
        ORDER BY updated_at DESC
        LIMIT 1`
    );

    const roleRow = roleRes.rows[0];
    const legacyRow = legacyRes.rows[0];
    const useLegacy = legacyRow && (
      !roleRow || new Date(legacyRow.updated_at).getTime() > new Date(roleRow.updated_at).getTime()
    );
    const layout = useLegacy ? legacyRow.layout : roleRow?.layout;

    return res.json(layoutForRole(layout, role));
  } catch (err) {
    console.error("dashboard GET", err);
    return res.status(500).json({ error: "Failed to load dashboard layout" });
  }
});

// POST — admins publish one team dashboard. Each role receives only the
// widgets whose role visibility includes that role.
router.post("/", async (req, res) => {
  const { layout } = req.body;

  if (!Array.isArray(layout)) {
    return res.status(400).json({ error: "Layout must be array" });
  }
  if (roleName(req.user.role) !== "ADMIN") {
    return res.status(403).json({ error: "Only administrators can customize the team dashboard" });
  }

  try {
    const configuredRoles = Array.from(new Set([
      ...DEFAULT_DASHBOARD_ROLES,
      ...layout.flatMap((widget) => Array.isArray(widget?.roles) ? widget.roles.map(roleName) : []),
    ])).filter(Boolean);

    await req.db.query("SAVEPOINT dashboard_team_save");
    for (const role of configuredRoles) {
      await req.db.query(
        `INSERT INTO dashboard_layouts (tenant_id, role, layout)
         VALUES ($1, $2, $3::jsonb)
         ON CONFLICT (tenant_id, role) WHERE role IS NOT NULL
         DO UPDATE SET layout = EXCLUDED.layout, updated_at = now()`,
        [req.tenantId, role, JSON.stringify(layoutForRole(layout, role))]
      );
    }
    // Personal dashboard editing was never exposed to non-admins. Remove old
    // overrides after promoting the latest admin layout to the team layouts.
    await req.db.query("DELETE FROM dashboard_layouts WHERE user_id IS NOT NULL");
    await req.db.query("RELEASE SAVEPOINT dashboard_team_save");

    return res.json(layoutForRole(layout, "ADMIN"));
  } catch (err) {
    await req.db.query("ROLLBACK TO SAVEPOINT dashboard_team_save").catch(() => {});
    console.error("dashboard POST", err);
    return res.status(500).json({ error: "Failed to save dashboard layout" });
  }
});

export default router;
