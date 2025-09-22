// /api/framer-to-zoho-flow.js
export default async function handler(req, res) {
  // -------- CORS (safe and simple) --------
  const allowList = (process.env.CORS_ORIGIN || "").split(",").map(s => s.trim()).filter(Boolean);
  const origin = req.headers.origin || "";
  const isAllowed = !allowList.length
    ? true
    : !!origin && allowList.some(pattern => {
        const o = origin.replace(/^https?:\/\//, "").toLowerCase();
        const h = pattern.replace(/^https?:\/\//, "").toLowerCase();
        if (h.startsWith("*.")) {
          const suf = h.slice(2);
          return o === suf || o.endsWith("." + suf);
        }
        return o === h;
      });

  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Origin", isAllowed ? (origin || "*") : "null");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "Method not allowed" });
    return;
  }

  try {
    // -------- Read body (JSON or x-www-form-urlencoded) --------
    let body = req.body;
    if (!body || typeof body !== "object") {
      const chunks = [];
      for await (const c of req) chunks.push(c);
      const raw = Buffer.concat(chunks).toString("utf8") || "";
      body = raw.trim().startsWith("{")
        ? JSON.parse(raw)
        : Object.fromEntries(new URLSearchParams(raw));
    }

    // -------- Normalize fields --------
    const pick = (obj, ...keys) =>
      keys.map(k => obj?.[k]).find(v => v != null && String(v).trim() !== "") ?? "";

    const rawFullName = pick(body, "full_name", "name", "Name", "fullName");
    const rawFirst = pick(body, "firstName", "first_name", "FirstName", "First");
    const rawLast  = pick(body, "lastName",  "last_name",  "LastName",  "Last");
    const email    = pick(body, "email", "Email", "eMail");
    const phone    = pick(body, "phone", "Phone", "phoneNumber", "PhoneNumber");

    // Derive first/last
    let firstName = String(rawFirst || "").trim();
    let lastName  = String(rawLast  || "").trim();

    if ((!firstName || !lastName) && rawFullName) {
      const parts = String(rawFullName).trim().split(/\s+/);
      if (!firstName) firstName = parts[0] || "";
      if (!lastName)  lastName  = parts.slice(1).join(" ") || "";
    }
    if (!firstName && email) firstName = email.split("@")[0]; // reasonable fallback
    if (!lastName) lastName = "";

    // Canonical payload Zoho Flow can rely on
    const out = {
      ...body,                // keep original fields for reference
      name: rawFullName || `${firstName} ${lastName}`.trim(),
      full_name: rawFullName || `${firstName} ${lastName}`.trim(),
      firstName,
      lastName,
      email,
      phone
    };

    // -------- Forward to Zoho Flow --------
    const zflow = process.env.ZFLOW_URL;
    if (!zflow) {
      res.status(500).json({ ok: false, error: "ZFLOW_URL not set" });
      return;
    }

    // Optional: log once during testing
    // console.log("Forwarding to Zoho Flow:", out);

    const r = await fetch(zflow, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(out),
    });

    const text = await r.text(); // keeps your Vercel logs readable
    res.status(200).json({ ok: true, zohoStatus: r.status, zohoText: text });
  } catch (err) {
    res.status(500).json({ ok: false, error: "Relay failed", detail: String(err?.message || err) });
  }
}
