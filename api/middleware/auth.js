
import jwt from "jsonwebtoken";

export default async function auth(req, res, next) {
  try {
    const header = req.headers["authorization"] || "";
    if (!header.startsWith("Bearer ")) {
      return res.status(401).json({ error: "No token provided" });
    }

    const token = header.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.tenant_id && decoded.tenant_id !== req.tenantId) {
      return res.status(403).json({ error: 'Token belongs to another tenant' });
    }

    const { rows } = await req.db.query(
      `SELECT u.id, u.email, u.name, tu.role, tu.status
         FROM users u
         JOIN tenant_users tu ON tu.user_id = u.id
        WHERE u.id = $1 AND tu.tenant_id = $2
        LIMIT 1`,
      [decoded.id, req.tenantId]
    );

    const user = rows[0];
    if (!user || user.status !== 'active') {
      return res.status(401).json({ error: "Invalid user" });
    }

    req.user = { ...user, tenant_id: req.tenantId };
    next();
  } catch (err) {
    console.error("Auth middleware error:", err);
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}
