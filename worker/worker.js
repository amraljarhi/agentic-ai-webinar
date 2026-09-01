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

export default {
  async fetch(request, env) {
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
        if (res.ok) return json({ ok: true }, 200, cors);
        if (res.status === 409 || res.status === 422) { lastErr = String(res.status); continue; } // conflict → retry
        return json({ ok: false, error: `GitHub PUT ${res.status}: ${await res.text()}` }, 502, cors);
      } catch (e) {
        lastErr = e.message;
      }
    }
    return json({ ok: false, error: `Failed after retries: ${lastErr}` }, 502, cors);
  },
};
