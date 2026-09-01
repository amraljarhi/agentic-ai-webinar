# Registration relay — Cloudflare Worker → CSV in a private GitHub repo

This Worker receives the webinar registration POST and appends a row to
`registrations.csv` in a GitHub repo using the Contents API. Free tier is plenty.

> ⚠️ **Use a PRIVATE repo for the CSV.** It contains registrant PII (names, work
> emails). Do **not** store it in this public Pages repo.

## 1. Create the private data repo

Create a new **private** repo, e.g. `amraljarhi/webinar-registrations`. Leave it empty —
the Worker creates `registrations.csv` (with headers) on the first submission.

## 2. Create a fine-grained token

GitHub → Settings → Developer settings → **Fine-grained tokens** → Generate:

- **Resource owner:** your account/org
- **Repository access:** only `webinar-registrations`
- **Permissions:** Repository → **Contents: Read and write**
- Copy the token (starts with `github_pat_…`).

## 3. Deploy

```bash
cd agentic-ai-webinar/worker
npm i -g wrangler        # or: npm i -D wrangler
wrangler login           # opens browser to your Cloudflare account (free)

# set your values in wrangler.toml [vars] first (REPO_OWNER, REPO_NAME, ALLOWED_ORIGIN)
wrangler secret put GH_TOKEN     # paste the fine-grained token when prompted

wrangler deploy
```

`wrangler deploy` prints your Worker URL, e.g.
`https://webinar-registrations.<your-subdomain>.workers.dev`.

## 4. Wire the form to the Worker

In `agentic-ai-webinar/index.html`, set the form `action` to your Worker URL:

```html
<form id="registerForm" action="https://webinar-registrations.<your-subdomain>.workers.dev" method="POST" novalidate>
```

Commit + push. Submit a test registration and confirm a new row lands in
`registrations.csv` in your private repo. Download it anytime — it's already CSV.

## Config reference

| Var | Meaning |
| --- | --- |
| `REPO_OWNER` | Owner of the private CSV repo |
| `REPO_NAME` | Private CSV repo name |
| `FILE_PATH` | CSV path in that repo (default `registrations.csv`) |
| `BRANCH` | Branch to commit to (default `main`) |
| `ALLOWED_ORIGIN` | CORS origin of the site (`https://amraljarhi.github.io`) |
| `GH_TOKEN` | **secret** — fine-grained PAT, Contents: Read and write |

## CSV columns

`timestamp_utc, event, full_name, work_email, company, job_title, country, role,
company_size, timeline, ai_maturity, primary_interests, open_to_followup,
lead_score, lead_tier, consent`

`lead_score` / `lead_tier` are computed in the page (`script.js`) and posted with each
submission, so the CSV is already qualified (Hot ≥ 80 · Warm 50–79 · Nurture < 50).

## Notes

- Concurrent submissions are handled with a read-modify-write retry on sha conflicts.
- A hidden honeypot (`_gotcha`) is accepted but never written.
- To keep an email confirmation too, you can add a second POST (e.g. to an email API)
  inside the Worker — out of scope here.
