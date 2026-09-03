# Beyond Copilot: Building Autonomous Developer Workflows — Webinar Landing Page

A static, **co-branded GitHub × Eficode** landing page that invites people to the live webinar and
**registers + qualifies** them as leads for GitHub and Eficode's AI-adoption motion.

- **Event:** Beyond Copilot: Building Autonomous Developer Workflows
- **When:** Thursday, 1 October, 10:00 CEST (same as Denmark) · ~70 min incl. live Q&A
- **Format:** Live online webinar
- **Live path:** `https://amraljarhi.github.io/agentic-ai-webinar/`

## What the page does

1. **Invites** — hero, outcomes ("what you'll walk away with"), full agenda, and speakers.
2. **Registers** — a single, grouped registration form.
3. **Qualifies leads** — BANT-style questions, scored client-side and posted with each submission.

### Fields captured

**Your details:** Full name, Work email, Company, Job title, Country/Region, Role/seniority.

**Qualification (BANT):** Company size, Timeline to scale AI, Current AI/Copilot maturity,
Primary interests (multi-select), Open to a follow-up with GitHub/Eficode?, Consent.

A hidden honeypot (`_gotcha`) is included for basic spam protection.

### Lead scoring (automatic)

`script.js` computes a score + tier on submit and posts them as hidden fields, so every
submission arrives already qualified in the email and CSV export.

| Signal | Points |
| --- | --- |
| Company size | 5,000+ = 30 · 1,001–5,000 = 25 · 201–1,000 = 15 · 51–200 = 8 · 1–50 = 3 |
| Seniority | C-level/VP = 25 · Director = 18 · Manager = 12 · IC = 5 |
| AI maturity | Rolling out = 25 · Scaled = 20 · Piloting = 15 · Not started = 5 |
| Timeline | Now = 25 · This year = 18 · Next 12 mo = 10 · Exploring = 3 |
| Open to follow-up | Yes = +15 |

**Tiers:** Hot ≥ 80 · Warm 50–79 · Nurture < 50. Adjust weights in `computeLeadScore()`.

## Backend: Cloudflare Worker → CSV in a private repo

The form posts to a small Cloudflare Worker that appends each registration as a row in
`registrations.csv` in a **private** GitHub repo (via the GitHub Contents API). The CSV is
already lead-scored (`Lead score` / `Lead tier` columns) and downloadable anytime.

> ⚠️ Store the CSV in a **private** repo — it contains registrant PII (work emails).
> This Pages repo is public, so the Worker writes to a separate private repo instead.

Setup + deploy steps are in [`worker/README.md`](worker/README.md). In short:
1. Create a private repo for the CSV (e.g. `webinar-registrations`).
2. Create a fine-grained token (Contents: Read and write on that repo).
3. `cd worker && wrangler login && wrangler secret put GH_TOKEN && wrangler deploy`.
4. Put the deployed Worker URL in the form `action` in `index.html` (currently
   `https://REPLACE-ME.workers.dev`).

**Confirmation email + join link:** add these later. The Teams/webinar join link goes in
the confirmation email (e.g. an email step added inside the Worker, or a mail-merge from the
CSV). It is intentionally *not* on the page yet.

## To confirm before launch

- **Deploy the Worker + set the form `action`** (see `worker/README.md`) — the form points
  to `https://REPLACE-ME.workers.dev` until you do.
- **Webinar platform + join link** (Teams) — add later, in the confirmation email (not the page).
- **Timezone label** — currently shown as `10:00 CEST`.
- **Speaker details** — initial-based avatars are in place for **Ahmed Magdy** (Eficode) and
  **Rickard Hole Falck** (Eficode). Swap in real headshots anytime — see below.
- **Privacy links** — GitHub + Eficode privacy policy URLs in the consent copy/footer.

## Swapping in real speaker photos (optional)

The page uses initial-based avatars. To use real photos:

1. Drop `ahmed.jpg` and `rickard.jpg` into `assets/`.
2. In `index.html`, replace each `<div class="avatar" ...>AM</div>` with
   `<img class="avatar" src="./assets/ahmed.jpg" alt="Ahmed Magdy" />` (and likewise for Rickard).

## Files

| File | Purpose |
| --- | --- |
| `index.html` | The webinar landing + registration page |
| `styles.css` | GitHub-inspired dark theme, co-brand, agenda, outcomes, speakers |
| `script.js` | Async submit, UI feedback, and lead scoring |
| `assets/eficode-logo.png` | Eficode logo (co-branding) |
| `worker/` | Cloudflare Worker relay → appends `registrations.csv` in a private repo |
| `README.md` | This file |

## Local preview

```bash
# from this repo's root
python3 -m http.server 8080
# open http://localhost:8080/
```
