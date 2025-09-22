export default async function handler(req, res) {
  // ---------------- CORS: run FIRST, never crash ----------------
  try {
    const allowRaw = process.env.CORS_ORIGIN || "";
    const allow = allowRaw.split(",").map(s => s.trim()).filter(Boolean);
    const origin = req.headers.origin || "";

    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    // match exact host (with or without protocol) and wildcard like *.framer.app
    const isAllowed = (() => {
      if (!allow.length) return true;            // if you forgot to set CORS_ORIGIN, be permissive
      if (!origin) return false;
      const o = origin.replace(/^https?:\/\//, "").toLowerCase();
      return allow.some(p => {
        const h = p.replace(/^https?:\/\//, "").toLowerCase();
        if (h.startsWith("*.")) {
          const suf = h.slice(2);
          return o === suf || o.endsWith("." + suf);
        }
        return o === h;
      });
    })();

    res.setHeader("Access-Control-Allow-Origin", isAllowed ? (origin || "*") : "null");

    if (req.method === "OPTIONS") {
      // preflight: no body, no network calls
      res.status(204).end();
      return;
    }
    if (req.method !== "POST") {
      res.status(405).json({ ok: false, error: "Method not allowed" });
      return;
    }
  } catch (e) {
    // Never crash on CORS — allow and exit if preflight
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") { res.status(204).end(); return; }
    if (req.method !== "POST")   { res.status(405).json({ ok: false, error: "Method not allowed" }); return; }
  }

  // ---------------- Read body (JSON or form-encoded) ----------------
  let body = req.body;
  if (!body || typeof body !== "object") {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const raw = Buffer.concat(chunks).toString("utf8");
    body = raw.trim().startsWith("{")
      ? JSON.parse(raw)
      : Object.fromEntries(new URLSearchParams(raw));
  }

  // ---------------- Normalize fields (name/email/phone) ----------------
  const pick = (obj, ...keys) =>
    keys.map(k => [k, obj?.[k]])
        .find(([, v]) => v != null && String(v).trim() !== "")?.[1] ?? "";

  const full_name = pick(body, "full_name", "name", "Name", "fullName") || "";
  const email     = pick(body, "email", "Email") || "";
  const phone     = pick(body, "phone", "Phone", "phoneNumber", "PhoneNumber") || "";

  // Preserve originals, but also provide canonical keys Zoho Flow expects
  const out = { ...body, full_name, email, phone, name: full_name };

  // ---------------- Forward to Zoho Flow ----------------
  const zflow = process.env.ZFLOW_URL;
  if (!zflow) {
    res.status(500).json({ ok: false, error: "ZFLOW_URL not set" });
    return;
  }

  try {
    const r = await fetch(zflow, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(out),
    });
    const text = await r.text(); // return text for easy debugging in Vercel logs
    res.status(200).json({ ok: true, zohoStatus: r.status, zohoText: text });
  } catch (err) {
    res.status(500).json({ ok: false, error: "Relay failed", detail: String(err?.message || err) });
  }
}
