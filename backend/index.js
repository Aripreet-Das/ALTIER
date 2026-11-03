/**
 * ALTIER · backend/index.js
 * --------------------------
 * Express service — the Node layer in the three-service stack.
 *
 * page1/api.py (FastAPI :8000)   — colour, body, face, rules, RAG, recommender
 * personal-stylist/api.py (:8090) — verdict, wardrobe, outfit, shades, sizing, try-on
 * backend/index.js (Express)      — auth gateway, static assets, web frontend
 *
 * This is a minimal Express app that can:
 *   - proxy to the two FastAPI services
 *   - health-check both services
 *   - serve static frontend assets
 *
 * It is intentionally small: the styling engines all run in Python. Authentication is
 * handled by Supabase (the app sends a JWT straight to page1); there is no Firebase Admin
 * SDK here and this layer does not verify tokens.
 */

const express = require("express");
const cors = require("cors");
const { createProxyMiddleware } = require("http-proxy-middleware");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// --- routes to the two FastAPI services
const PAGE1_API = process.env.PAGE1_API_URL || "http://localhost:8000";
const PERSONAL_STYLIST_API = process.env.PERSONAL_STYLIST_API_URL || "http://localhost:8090";

app.use("/api/page1", createProxyMiddleware({
  target: PAGE1_API,
  changeOrigin: true,
  pathRewrite: { "^/api/page1": "" },
}));

app.use("/api/personal-stylist", createProxyMiddleware({
  target: PERSONAL_STYLIST_API,
  changeOrigin: true,
  pathRewrite: { "^/api/personal-stylist": "" },
}));

// --- health check for both services
app.get("/health", async (req, res) => {
  const results = {};
  for (const [name, url] of [["page1", PAGE1_API], ["personal-stylist", PERSONAL_STYLIST_API]]) {
    try {
      const fetch = (await import("node-fetch")).default;
      const r = await fetch(`${url}/health`, { signal: AbortSignal.timeout(3000) });
      results[name] = { ok: r.ok, status: r.status };
    } catch (e) {
      results[name] = { ok: false, error: e.message };
    }
  }
  res.json({ ok: true, services: results });
});

// --- auth status
// The current stack authenticates with Supabase: the app holds the JWT and sends it to
// page1, which applies Row-Level Security per user. Firebase is NOT used here — the v1
// pages under frontend/ had a client-side Firebase gate, which is disabled unless a local
// firebase-config.local.js is present. Nothing in this service verifies a token yet.
app.get("/auth/status", (req, res) => {
  res.json({
    provider: "supabase",
    configured: !!(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY),
    legacy_firebase: false,
    note: "tokens are verified by page1 against Supabase, not by this gateway",
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`ALTIER backend listening on :${PORT}`);
  console.log(`  page1 API:        ${PAGE1_API}`);
  console.log(`  personal-stylist: ${PERSONAL_STYLIST_API}`);
});
