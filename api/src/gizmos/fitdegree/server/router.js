// api/src/gizmos/fitdegree/server/router.js
import express from "express";
import { fitdegreeFetchJson } from "./client.js";
import { FITDEGREE_ENDPOINTS } from "./endpoints.js";

const router = express.Router();

function resolveEndpoint(value, fallback) {
  if (typeof value === "function") return value();
  if (typeof value === "string" && value.trim()) return value.trim();
  return fallback;
}

async function getTenantFitDegreeConfig(req) {
  const credentialsKey = process.env.SERVICEUP_CREDENTIALS_KEY || '';
  const { rows } = await req.db.query(
    `select config,
            case
              when credentials_encrypted is null then '{}'::jsonb
              else pgp_sym_decrypt(credentials_encrypted, $1)::jsonb
            end as credentials
       from tenant_integrations
      where slug = 'fitdegree' and is_enabled = true
      limit 1`,
    [credentialsKey],
  );
  const config = rows[0]?.config || {};
  const credentials = rows[0]?.credentials || {};
  return {
    baseUrl: config.base_url || process.env.FITDEGREE_API_BASE || 'https://api.fitdegree.com',
    apiKey: credentials.api_key || process.env.FITDEGREE_API_KEY || '',
    authHeader: config.auth_header || process.env.FITDEGREE_AUTH_HEADER || 'Authorization',
    authScheme: config.auth_scheme ?? process.env.FITDEGREE_AUTH_SCHEME ?? 'Bearer',
    companyId:
      config.company_id ||
      config.fitspot_id ||
      process.env.FITDEGREE_COMPANY_ID ||
      process.env.FITDEGREE_FITSPOT_ID ||
      '',
  };
}

function pickCompanyId(req, config) {
  // Prefer explicit query param for testing
  if (req.query.company_id) return String(req.query.company_id).trim();

  // Prefer a dedicated env var if you add it
  if (config.companyId) return String(config.companyId).trim();

  return "";
}

router.get("/public/__ping", (_req, res) => {
  res.json({ ok: true, pack: "fitdegree", scope: "public" });
});

router.get("/__ping", (_req, res) => {
  res.json({ ok: true, pack: "fitdegree" });
});

// PUBLIC: instructors (employees / team members)
router.get("/public/instructors", async (req, res) => {
  try {
    const config = await getTenantFitDegreeConfig(req);
    const endpoint = resolveEndpoint(
      FITDEGREE_ENDPOINTS.instructors,
      FITDEGREE_ENDPOINTS.EMPLOYEES
    );

    const companyId = pickCompanyId(req, config);
    if (!companyId) {
      return res.status(400).json({
        ok: false,
        error:
          "Missing company_id. Provide ?company_id=### or set FITDEGREE_COMPANY_ID in Render env.",
      });
    }

    const data = await fitdegreeFetchJson(endpoint, {
      config,
      query: {
        company_id: companyId,
        page: req.query.page || 1,
        limit: req.query.limit || 50,
      },
    });

    res.json({ ok: true, data });
  } catch (err) {
    res.status(err.status || 500).json({
      ok: false,
      error: err.message || "Failed to fetch instructors",
      details: err.details || null,
    });
  }
});

// PUBLIC: upcoming classes (placeholder until we confirm FitDegree classes endpoint)
router.get("/public/classes", async (req, res) => {
  try {
    const config = await getTenantFitDegreeConfig(req);
    const endpoint = resolveEndpoint(
      FITDEGREE_ENDPOINTS.classes,
      FITDEGREE_ENDPOINTS.UPCOMING_CLASSES
    );

    const companyId = pickCompanyId(req, config);

    const data = await fitdegreeFetchJson(endpoint, {
      config,
      query: {
        ...(companyId ? { company_id: companyId } : {}),
        page: req.query.page || 1,
        limit: req.query.limit || 50,
      },
    });

    res.json({ ok: true, data });
  } catch (err) {
    res.status(err.status || 500).json({
      ok: false,
      error: err.message || "Failed to fetch classes",
      details: err.details || null,
    });
  }
});

export default router;
