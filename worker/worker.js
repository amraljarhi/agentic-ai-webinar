/**
 * Cloudflare Worker — Webinar registration relay
 *
 * Receives the registration form POST from the GitHub Pages landing page and
 * appends a row to a CSV stored in a GitHub repo (via the Contents API).
 *
 * IMPORTANT: point this at a PRIVATE repo — the CSV holds registrant PII (emails).
 *
 * Required config (see wrangler.toml [vars] + one secret):
 *   REPO_OWNER      e.g. "amraljarhi"
 *   REPO_NAME       e.g. "webinar-registrations"   (PRIVATE repo)
 *   FILE_PATH       e.g. "registrations.csv"
 *   BRANCH          e.g. "main"
 *   ALLOWED_ORIGIN  e.g. "https://amraljarhi.github.io"
 *   GH_TOKEN        (secret) fine-grained PAT with Contents: Read and write on REPO_NAME
 */

const COLUMNS = [
  ["timestamp_utc", null],
  ["event", "Event"],
  ["full_name", "Full name"],
  ["work_email", "Work email"],
  ["company", "Company"],
  ["job_title", "Job title"],
  ["country", "Country"],
  ["role", "Role / seniority"],
  ["company_size", "Company size"],
  ["timeline", "Timeline to scale AI"],
  ["ai_maturity", "AI maturity"],
  ["primary_interests", "Primary interests"], // multi-value
  ["open_to_followup", "Open to follow-up"],
  ["lead_score", "Lead score"],
  ["lead_tier", "Lead tier"],
  ["consent", "Consent"],
];

const HEADER = COLUMNS.map(([h]) => h).join(",") + "\n";

function csvEscape(value) {
  const s = (value == null ? "" : String(value)).replace(/\r?\n/g, " ").trim();
  return '"' + s.replace(/"/g, '""') + '"';
}

function corsHeaders(origin, allowed) {
  const allow = origin && origin === allowed ? origin : allowed;
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin",
  };
}

function json(body, status, cors) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...cors },
  });
}

async function ghGetFile(env) {
  const url = `https://api.github.com/repos/${env.REPO_OWNER}/${env.REPO_NAME}/contents/${encodeURIComponent(env.FILE_PATH)}?ref=${env.BRANCH}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${env.GH_TOKEN}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "webinar-registration-worker",
    },
  });
  if (res.status === 404) return { exists: false, sha: null, content: "" };
  if (!res.ok) throw new Error(`GitHub GET failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  const content = data.content ? atob(data.content.replace(/\n/g, "")) : "";
  return { exists: true, sha: data.sha, content };
}

async function ghPutFile(env, newContent, sha, message) {
  const url = `https://api.github.com/repos/${env.REPO_OWNER}/${env.REPO_NAME}/contents/${encodeURIComponent(env.FILE_PATH)}`;
  const body = {
    message,
    content: btoa(unescape(encodeURIComponent(newContent))),
    branch: env.BRANCH,
  };
  if (sha) body.sha = sha;
  return fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${env.GH_TOKEN}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "webinar-registration-worker",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

// ---------------------------------------------------------------------------
// Confirmation email (Resend) — optional. Enabled when EMAIL_ENABLED === "true"
// and RESEND_API_KEY + FROM_EMAIL are configured. Sending never blocks or fails
// the registration: it runs via ctx.waitUntil and swallows its own errors.
// ---------------------------------------------------------------------------

// Teams join details — keep in sync with email/confirmation.* and the calendar invite.
const JOIN_URL = "https://teams.microsoft.com/meet/27227699504930?p=ZoOx13Z5h7R7pPrAS9";
const MEETING_ID = "272 276 995 049 30";
const PASSCODE = "dh3D5kB9";
const DIAL_IN = "+1 323-849-4874,,782105735#";
const CONF_ID = "782 105 735#";
const EVENT_TITLE = "Beyond Copilot: Building Autonomous Developer Workflows";
const EVENT_WHEN = "Tuesday, 23 September 2026 · 10:00–11:10 CEST";
const REG_PAGE = "https://amraljarhi.github.io/agentic-ai-webinar/";

function htmlEscape(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function firstNameFrom(fullName) {
  const n = String(fullName || "").trim().split(/\s+/)[0];
  return n || "there";
}

function renderEmailHtml(firstName) {
  const fn = htmlEscape(firstName);
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background:#f4f5f7;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#f4f5f7;font-size:1px;">You're in. Tue 23 Sep, 10:00 CEST — your Microsoft Teams join link is inside.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;background:#fff;border-radius:14px;overflow:hidden;border:1px solid #e1e4e8;">
<tr><td style="background:linear-gradient(90deg,#0d1117 0%,#1b1030 60%,#2a1a4a 100%);padding:28px 32px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td style="font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:bold;color:#fff;">GitHub <span style="color:#8b949e;font-weight:normal;">&times;</span> Eficode</td>
<td align="right" style="font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:bold;color:#d8bfff;letter-spacing:1.5px;">LIVE WEBINAR</td>
</tr></table></td></tr>
<tr><td style="padding:36px 32px 8px 32px;font-family:Arial,Helvetica,sans-serif;">
<div style="display:inline-block;background:#dafbe1;color:#116329;font-size:12px;font-weight:bold;padding:6px 12px;border-radius:20px;">&#10003; YOU'RE REGISTERED</div>
<h1 style="margin:18px 0 6px 0;font-size:26px;line-height:1.25;color:#0d1117;">${htmlEscape(EVENT_TITLE)}</h1>
<p style="margin:0;font-size:15px;color:#57606a;">Hi ${fn}, thanks for registering. We've saved your spot.</p></td></tr>
<tr><td style="padding:24px 32px 8px 32px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e1e4e8;border-radius:12px;"><tr><td style="padding:20px 22px;font-family:Arial,Helvetica,sans-serif;">
<div style="font-size:13px;color:#57606a;">&#128197; Date &amp; time</div>
<div style="font-size:17px;font-weight:bold;color:#0d1117;padding:2px 0 14px 0;">${htmlEscape(EVENT_WHEN)}</div>
<div style="font-size:13px;color:#57606a;">&#128187; Where</div>
<div style="font-size:15px;color:#0d1117;padding-top:2px;">Online — Microsoft Teams (link below)</div>
</td></tr></table></td></tr>
<tr><td style="padding:16px 32px 8px 32px;font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;"><tr><td align="center" style="border-radius:10px;background:#6b3fd4;">
<a href="${JOIN_URL}" style="display:inline-block;padding:14px 40px;font-size:16px;font-weight:bold;color:#fff;text-decoration:none;border-radius:10px;">Join the webinar</a>
</td></tr></table>
<p style="text-align:center;margin:14px 0 0 0;font-size:13px;color:#57606a;">Meeting ID: <strong style="color:#0d1117;">${MEETING_ID}</strong> &nbsp;·&nbsp; Passcode: <strong style="color:#0d1117;">${PASSCODE}</strong></p>
<p style="text-align:center;margin:6px 0 0 0;font-size:12px;color:#8b949e;">Dial-in (US): ${DIAL_IN} &nbsp;·&nbsp; Conf ID: ${CONF_ID}</p></td></tr>
<tr><td style="padding:26px 32px 8px 32px;font-family:Arial,Helvetica,sans-serif;">
<h2 style="margin:0 0 12px 0;font-size:16px;color:#0d1117;">What you'll walk away with</h2>
<div style="font-size:14px;color:#24292f;line-height:1.6;">
&bull; A practical picture of <strong>agentic AI</strong> across the software lifecycle — beyond IDE coding assistants.<br/>
&bull; How teams automate planning, dev, testing, review &amp; delivery with AI and GitHub Actions.<br/>
&bull; How to <strong>evaluate, test and govern</strong> AI agents for quality and trust at scale.<br/>
&bull; Patterns for scaling AI adoption across engineering with the right controls.</div></td></tr>
<tr><td style="padding:20px 32px 8px 32px;font-family:Arial,Helvetica,sans-serif;">
<h2 style="margin:0 0 12px 0;font-size:16px;color:#0d1117;">Your speakers</h2>
<div style="font-size:14px;color:#24292f;"><strong>Ahmed Magdy</strong> — <span style="color:#57606a;">Eficode</span> &nbsp;&nbsp;|&nbsp;&nbsp; <strong>Rickard Hole Falck</strong> — <span style="color:#57606a;">Eficode</span></div></td></tr>
<tr><td style="padding:18px 32px 0 32px;"><div style="border-top:1px solid #e1e4e8;"></div></td></tr>
<tr><td style="padding:18px 32px 30px 32px;font-family:Arial,Helvetica,sans-serif;">
<p style="margin:0 0 8px 0;font-size:13px;color:#57606a;">Can't make it live? Reply to this email and we'll send the recording.</p>
<p style="margin:0;font-size:12px;color:#8b949e;">You're receiving this because you registered at <a href="${REG_PAGE}" style="color:#6b3fd4;">the webinar page</a>. Questions? Just reply. &nbsp;|&nbsp; GitHub &times; Eficode</p></td></tr>
</table></td></tr></table></body></html>`;
}

function renderEmailText(firstName) {
  return `You're registered — ${EVENT_TITLE}
(GitHub x Eficode live webinar)

Hi ${firstName},

Thanks for registering — your spot is saved.

WHEN: ${EVENT_WHEN}
WHERE: Online — Microsoft Teams

JOIN THE WEBINAR
${JOIN_URL}
Meeting ID: ${MEETING_ID}
Passcode: ${PASSCODE}
Dial-in (US): ${DIAL_IN}
Phone conference ID: ${CONF_ID}

WHAT YOU'LL WALK AWAY WITH
- A practical picture of agentic AI across the software lifecycle.
- How teams automate planning, dev, testing, review & delivery with AI and GitHub Actions.
- How to evaluate, test and govern AI agents for quality and trust at scale.
- Patterns for scaling AI adoption across engineering with the right controls.

SPEAKERS: Ahmed Magdy (Eficode), Rickard Hole Falck (Eficode)

Can't make it live? Reply and we'll send the recording.
Registered at ${REG_PAGE}

GitHub x Eficode`;
}

async function sendConfirmationEmail(env, toEmail, fullName) {
  if (env.EMAIL_ENABLED !== "true") return;
  if (!env.RESEND_API_KEY || !env.FROM_EMAIL) return;
  const firstName = firstNameFrom(fullName);
  const from = env.FROM_NAME ? `${env.FROM_NAME} <${env.FROM_EMAIL}>` : env.FROM_EMAIL;
  const payload = {
    from,
    to: [toEmail],
    subject: `You're registered: Beyond Copilot (23 Sep, 10:00 CEST) — your Teams link inside`,
    html: renderEmailHtml(firstName),
    text: renderEmailText(firstName),
  };
  if (env.REPLY_TO) payload.reply_to = env.REPLY_TO;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) console.log("Resend send failed:", res.status, await res.text());
  } catch (e) {
    console.log("Resend send error:", e.message);
  }
}

export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get("Origin") || "";
    const cors = corsHeaders(origin, env.ALLOWED_ORIGIN);

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (request.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405, cors);

    let form;
    try {
      const ct = request.headers.get("Content-Type") || "";
      if (ct.includes("application/json")) {
        const obj = await request.json();
        form = {
          get: (k) => obj[k],
          getAll: (k) => (Array.isArray(obj[k]) ? obj[k] : obj[k] != null ? [obj[k]] : []),
        };
      } else {
        form = await request.formData();
      }
    } catch (e) {
      return json({ ok: false, error: "Invalid body" }, 400, cors);
    }

    // Honeypot: silently accept, do not record.
    if (form.get("_gotcha")) return json({ ok: true }, 200, cors);

    // Basic required-field guard
    if (!form.get("Full name") || !form.get("Work email")) {
      return json({ ok: false, error: "Missing required fields" }, 422, cors);
    }

    const row = COLUMNS.map(([key, field]) => {
      if (key === "timestamp_utc") return csvEscape(new Date().toISOString());
      if (field === "Primary interests") return csvEscape(form.getAll(field).join("; "));
      return csvEscape(form.get(field));
    }).join(",") + "\n";

    // Read-modify-write with retry on sha conflicts (concurrent submissions)
    let lastErr = "";
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        const file = await ghGetFile(env);
        let base = file.exists ? file.content : HEADER;
        if (!base.startsWith("timestamp_utc")) base = HEADER + base;
        const updated = base.endsWith("\n") ? base + row : base + "\n" + row;
        const res = await ghPutFile(env, updated, file.sha, `Registration: ${form.get("Work email")}`);
        if (res.ok) {
          // Fire-and-forget confirmation email; never blocks or fails the registration.
          ctx.waitUntil(sendConfirmationEmail(env, form.get("Work email"), form.get("Full name")));
          return json({ ok: true }, 200, cors);
        }
        if (res.status === 409 || res.status === 422) { lastErr = String(res.status); continue; } // conflict → retry
        return json({ ok: false, error: `GitHub PUT ${res.status}: ${await res.text()}` }, 502, cors);
      } catch (e) {
        lastErr = e.message;
      }
    }
    return json({ ok: false, error: `Failed after retries: ${lastErr}` }, 502, cors);
  },
};
