# Confirmation email

Sent to each registrant after they submit the form. Two versions are provided —
send both as a multipart email (HTML + plain-text fallback):

| File | Use |
|------|-----|
| `confirmation.html` | HTML body (email-safe: table layout, inline styles, 600px) |
| `confirmation.txt`  | Plain-text fallback |

## Subject line

```
You're registered: Beyond Copilot (23 Sep, 10:00 CEST) — your Teams link inside
```

## Merge fields to replace before sending

| Token | Replace with |
|-------|--------------|
| `{{first_name}}` | Registrant's first name (fall back to "there") |
| `{{calendar_ics_url}}` | Link to an `.ics` file, or remove the "Add to calendar" line |

## Teams join details (already baked in)

- **Join:** https://teams.microsoft.com/meet/27227699504930?p=ZoOx13Z5h7R7pPrAS9
- **Meeting ID:** 272 276 995 049 30
- **Passcode:** dh3D5kB9
- **Dial-in (US):** +1 323-849-4874,,782105735# · Conf ID: 782 105 735#

> If you ever regenerate the Teams meeting, update the join link/ID/passcode in
> both `confirmation.html` and `confirmation.txt`.

## How to send it

The registration backend (Cloudflare Worker) only **stores** rows to the private
CSV — it does not send email. Pick one of:

1. **Manual / batch (simplest):** periodically read `registrations.csv` from the
   private `webinar-registrations` repo and mail-merge this template (e.g. Outlook
   mail merge, Gmail + Apps Script, or any ESP's CSV import).
2. **Automated:** extend the Worker to also call an email API (Resend, SendGrid,
   Mailgun, MS Graph sendMail) after the CSV write succeeds. Add the provider API
   key as a `wrangler secret` and POST the rendered HTML/text. (Not wired up yet.)

## Calendar attachment (optional)

To let recipients one-click add the event, attach an `.ics` for
2026-09-23 10:00–11:10 Europe/Copenhagen and point `{{calendar_ics_url}}` at it
(or attach the file directly and delete the "Add to calendar" line).
