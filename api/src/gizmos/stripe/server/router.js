

import express from "express";
import Stripe from "stripe";
import { buildShippingOptions } from "./shipping.js";

const router = express.Router();

router.get("/public/__ping", (req, res) => {
  res.json({
    ok: true,
    gizmo: "stripe",
    ts: Date.now(),
  });
});


/**
 * IMPORTANT:
 * - /webhook uses express.raw() so Stripe signature verification works.
 * - All other routes use JSON (already handled in api/index.js).
 */

function getPool(req) {
  const pool = req.db;
  if (!pool) throw new Error("DB pool not found on app.locals.pool");
  return pool;
}

async function getStripeConfig(req) {
  const db = getPool(req);
  const credentialsKey = process.env.SERVICEUP_CREDENTIALS_KEY || '';
  const { rows } = await db.query(
    `select config,
            case
              when credentials_encrypted is null then '{}'::jsonb
              else pgp_sym_decrypt(credentials_encrypted, $1)::jsonb
            end as credentials
       from tenant_integrations
      where slug = 'stripe' and is_enabled = true
      limit 1`,
    [credentialsKey],
  );
  const config = rows[0]?.config || {};
  const credentials = rows[0]?.credentials || {};
  const stripeSecret = credentials.secret_key || process.env.STRIPE_SECRET_KEY;
  const webhookSecret = credentials.webhook_secret || process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripeSecret) throw new Error('Stripe is not configured for this client');
  return {
    stripeSecret,
    webhookSecret,
    automaticTax:
      config.automatic_tax === true || process.env.STRIPE_AUTOMATIC_TAX === 'true',
    siteUrl: config.site_url || '',
  };
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    String(value || "").trim()
  );
}

async function lookupArtEntry(pool, entryKey) {
  if (!entryKey) return null;

  const key = String(entryKey).trim();
  if (!key) return null;

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(key);

  const q = `
    SELECT
      e.*,
      COALESCE(e.slug, e.data->>'slug', e.data->>'_slug') AS slug,
      COALESCE(e.status, e.data->>'status', e.data->>'_status') AS status
    FROM entries e
    WHERE
      e.content_type_id = (SELECT id FROM content_types WHERE slug = 'art' LIMIT 1)
      AND (
        ${isUuid ? "e.id::text = $1" : "FALSE"}
        OR COALESCE(e.slug, e.data->>'slug', e.data->>'_slug') = $1
      )
    LIMIT 1
  `;

  const { rows } = await pool.query(q, [key]);
  return rows[0] || null;
}


function readPriceCents(entry) {
  const data = entry?.data && typeof entry.data === "object" ? entry.data : {};
  const raw =
    data.price_cents ??
    data.priceCents ??
    data.price ??
    data.amount_cents ??
    data.amountCents;
  const n = Number(raw);
  return Number.isFinite(n) ? Math.round(n) : null;
}

function readTitle(entry) {
  return String(entry?.title || "").trim() || "Artwork";
}

function readImage(entry) {
  const data = entry?.data && typeof entry.data === "object" ? entry.data : {};
  const img =
    data.image_url ||
    data.imageUrl ||
    data.primary_image ||
    data.primaryImage ||
    data.cover ||
    null;

  if (!img) return null;
  if (typeof img === "string") return img;
  if (typeof img === "object") {
    return img.publicUrl || img.url || img.src || null;
  }
  return null;
}

function readCurrency(entry) {
  const data = entry?.data && typeof entry.data === "object" ? entry.data : {};
  return String(data.currency || "usd").toLowerCase();
}

function readShippingClass(entry) {
  const data = entry?.data && typeof entry.data === "object" ? entry.data : {};
  return String(data.shipping_class || data.shippingClass || "standard");
}

function readSoldFlag(entry) {
  const data = entry?.data && typeof entry.data === "object" ? entry.data : {};
  return !!(data.sold || data.is_sold || data.sold_at || data.soldAt);
}

function baseSiteUrl(req, configuredUrl = '') {
  // Prefer env SITE_URL / FRONTEND_URL if set; else derive from request origin.
  const env = configuredUrl ||
    process.env.SITE_URL ||
    process.env.FRONTEND_URL ||
    process.env.PUBLIC_SITE_URL ||
    "";
  if (env) return env.replace(/\/$/, "");

  const origin = req.headers.origin || "";
  if (origin) return origin.replace(/\/$/, "");

  // Fallback — should be set in env in production.
  return "http://localhost:5173";
}

function buildSuccessUrl(req, configuredUrl) {
  // Using hash routing on the frontend:
  //   /#/success?session_id={CHECKOUT_SESSION_ID}
  return `${baseSiteUrl(req, configuredUrl)}/#/success?session_id={CHECKOUT_SESSION_ID}`;
}

function buildCancelUrl(req, configuredUrl) {
  return `${baseSiteUrl(req, configuredUrl)}/#/cancel`;
}

/**
 * PUBLIC: Create checkout session for a single art entry
 * Body:
 *  { entry: "<uuid|slug>" }
 *
 * Response:
 *  { id, url }
 */
async function handleCreateCheckoutSession(req, res) {
  try {
    const stripeConfig = await getStripeConfig(req);
    const stripeSecret = stripeConfig.stripeSecret;
    const stripe = new Stripe(stripeSecret, { apiVersion: "2024-06-20" });

    const { entry } = req.body || {};
    const pool = getPool(req);

    const found = await lookupArtEntry(pool, entry);
    if (!found) return res.status(404).json({ error: "Art not found" });

    if (String(found.status || "").toLowerCase() !== "published") {
      return res.status(400).json({ error: "This piece is not available." });
    }
    if (readSoldFlag(found)) {
      return res.status(400).json({ error: "This piece has already been sold." });
    }

    const priceCents = readPriceCents(found);
    if (!priceCents || priceCents < 50) {
      return res.status(400).json({ error: "Invalid price on this entry." });
    }

    const title = readTitle(found);
    const currency = readCurrency(found);
    const image = readImage(found);
    const shippingClass = readShippingClass(found);

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency,
            unit_amount: priceCents,
            product_data: {
              name: title,
              images: image ? [image] : [],
              metadata: {
                entry_id: found.id,
                entry_slug: found.slug,
                content_type: "art",
                shipping_class: shippingClass,
                tenant_id: req.tenantId,
              },
            },
          },
        },
      ],
      shipping_address_collection: { allowed_countries: ["US"] }, // USA-only
      shipping_options: buildShippingOptions({ shippingClass, currency }),
      success_url: buildSuccessUrl(req, stripeConfig.siteUrl),
      cancel_url: buildCancelUrl(req, stripeConfig.siteUrl),
      automatic_tax: stripeConfig.automaticTax ? { enabled: true } : undefined,
      metadata: {
        entry_id: found.id,
        entry_slug: found.slug,
        entry_title: title,
        content_type: "art",
        shipping_class: shippingClass,
        tenant_id: req.tenantId,
      },
    });

    return res.json({ id: session.id, url: session.url });
  } catch (err) {
    console.error("[stripe] create-checkout-session error:", err);
    return res.status(500).json({ error: err?.message || "Server error" });
  }
}

// Accept both paths so you can hit it directly while testing,
// AND the canonical public path for storefront usage.
router.post("/public/create-checkout-session", handleCreateCheckoutSession);
router.post("/create-checkout-session", handleCreateCheckoutSession);

/**
 * PUBLIC: Retrieve a session (for Success page verification)
 */
router.get("/public/session/:id", async (req, res) => {
  try {
    const { stripeSecret } = await getStripeConfig(req);
    const stripe = new Stripe(stripeSecret, { apiVersion: "2024-06-20" });

    const id = String(req.params.id || "").trim();
    if (!id) return res.status(400).json({ error: "Missing session id" });

    const session = await stripe.checkout.sessions.retrieve(id, {
      expand: ["line_items", "payment_intent", "shipping_cost.shipping_rate"],
    });
    if (session.metadata?.tenant_id && session.metadata.tenant_id !== req.tenantId) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Keep response minimal/safe for public page.
    return res.json({
      id: session.id,
      status: session.status,
      payment_status: session.payment_status,
      amount_total: session.amount_total,
      currency: session.currency,
      metadata: session.metadata || {},
      line_items: (session.line_items?.data || []).map((li) => ({
        description: li.description,
        quantity: li.quantity,
        amount_total: li.amount_total,
        currency: li.currency,
      })),
      shipping_details: session.shipping_details || null,
    });
  } catch (err) {
    console.error("[stripe] retrieve session error:", err);
    return res.status(500).json({ error: err?.message || "Server error" });
  }
});

/**
 * WEBHOOK: marks art as sold when checkout completes
 * Env required:
 *   STRIPE_WEBHOOK_SECRET
 */
async function handleWebhook(req, res) {
    let stripeConfig;
    try {
      stripeConfig = await getStripeConfig(req);
    } catch (error) {
      return res.status(500).send(error.message);
    }
    const stripeSecret = stripeConfig.stripeSecret;
    const webhookSecret = stripeConfig.webhookSecret;

    if (!webhookSecret) return res.status(500).send("Stripe webhook is not configured");

    const stripe = new Stripe(stripeSecret, { apiVersion: "2024-06-20" });

    let event;
    try {
      const sig = req.headers["stripe-signature"];
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (e) {
      console.error("[stripe] webhook signature verify failed:", e?.message || e);
      return res.status(400).send(`Webhook Error: ${e?.message || "Invalid signature"}`);
    }

    try {
      if (event.type === "checkout.session.completed") {
        const session = event.data.object;
        if (session?.metadata?.tenant_id && session.metadata.tenant_id !== req.tenantId) {
          return res.status(400).send('Webhook tenant mismatch');
        }
        const entryId = session?.metadata?.entry_id;
        const pool = getPool(req);

        if (entryId) {
          await pool.query(
            `
            UPDATE entries
               SET status = 'sold',
                   data = jsonb_set(
                     jsonb_set(COALESCE(data, '{}'::jsonb), '{sold_at}', to_jsonb(now()), true),
                     '{stripe_session_id}', to_jsonb($2::text), true
                   ),
                   updated_at = now()
             WHERE id = $1::uuid
            `,
            [entryId, session.id]
          );
        }
      }

      return res.json({ received: true });
    } catch (e) {
      console.error("[stripe] webhook handler error:", e?.message || e);
      return res.status(500).send("Webhook handler failed");
    }
}

router.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  handleWebhook,
);

router.post(
  "/webhook/:tenantKey",
  express.raw({ type: "application/json" }),
  handleWebhook,
);

export default router;
