// /api/framer-to-zoho-flow.js
export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", process.env.CORS_ORIGIN || "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });

  try {
    // --- Read body as JSON or form-encoded ---
    let body = req.body;
    if (!body || typeof body !== "object") {
      const chunks = [];
      for await (const c of req) chunks.push(c);
      const raw = Buffer.concat(chunks).toString("utf8") || "";
      body = raw.trim().startsWith("{")
        ? JSON.parse(raw)
        : Object.fromEntries(new URLSearchParams(raw));
    }

    // --- Normalize keys (so Zoho Flow gets consistent names) ---
    const pick = (o, ...ks) => ks.map(k => o?.[k]).find(v => v !== undefined && v !== null && `${v}`.trim() !== "");
    const full_name = pick(body, "full_name", "name", "Name", "fullName") || "";
    const email     = pick(body, "email", "Email") || "";
    const phone     = pick(body, "phone", "Phone", "phoneNumber", "PhoneNumber") || "";

    // Preserve originals, but also provide canonical keys Zoho Flow can rely on
    const out = { ...body, full_name, email, phone, Name: full_name, Phone: phone };

    const zflow = process.env.ZFLOW_URL;
    if (!zflow) return res.status(500).json({ ok: false, error: "ZFLOW_URL not set" });

    // --- Forward to Zoho Flow ---
    const f = await fetch(zflow, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(out),
    });

    const text = await f.text(); // return text for easy debugging in Vercel logs
    return res.status(200).json({ ok: true, zohoStatus: f.status, zohoText: text });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err?.message || "Relay failed" });
  }
}
