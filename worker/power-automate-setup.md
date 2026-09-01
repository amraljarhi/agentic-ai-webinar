# Confirmation emails via Power Automate — DRAFT approach

The Worker calls a Power Automate flow that **creates a draft** in your Outlook
mailbox for each registration. You review the draft and hit **Send** yourself.

## Why a draft (and not an automatic send)

The Microsoft tenant has a security mail-flow rule that **blocks Power Platform
/ Flow from _sending_ email to external recipients**. Automatic sends via Flow
bounce with *"Security Policy at Microsoft does not allow emails to external
recipients using Power Platforms like FLOW."*

Creating a **draft** is **not** a send, so the rule doesn't apply. When you then
click **Send** in Outlook, it goes out as a normal user email (also not blocked).

Trade-off: it's semi-automated — one draft per registrant lands in **Drafts**,
and you send each manually. Fine for modest volume. For fully hands-off sending
to external recipients, switch to a transactional provider (Brevo / SendGrid /
Resend) instead — see "Fully automated alternative" below.

## The flow (2 actions)

1. **Trigger:** *When an HTTP request is received* (the URL is already wired into
   the Worker secret `POWER_AUTOMATE_URL` — don't recreate it).
2. **Action:** *Send an HTTP request* (**Office 365 Outlook** connector — not the
   premium "HTTP"):
   - **Method:** `POST`
   - **Uri:** `https://graph.microsoft.com/v1.0/me/messages`
   - **Headers:** `Content-Type` -> `application/json`
   - **Body:** expression `triggerBody()`

That's it. The Worker posts a ready-made Microsoft Graph *message* object
(`subject`, HTML `body`, `toRecipients`), and the flow forwards it straight to
Graph with `triggerBody()`, so Power Automate handles all JSON escaping.

### If the Uri errors

Some tenants want a relative path on the Office 365 Outlook "Send an HTTP
request" action. If the full URL fails, try Uri `/v1.0/me/messages`.

The connection needs `Mail.ReadWrite` (the Office 365 Outlook connector has it by
default).

## Using it

1. A registration comes in -> a **draft** addressed to the registrant appears in
   your Outlook **Drafts** folder (subject: "You're registered: Beyond Copilot...").
2. Open it, glance over it, click **Send**.

## Fully automated alternative (no manual sends)

If you'd rather not click Send per registrant, rewire the Worker to a
transactional email API that allows external delivery with a single verified
sender (no domain needed): **Brevo** (300/day free) or **SendGrid** (100/day
free, "Single Sender Verification"). The Worker already has a provider branch;
ask to switch and it's a few-minute change.

## Notes

- Email content is rendered in the Worker (`renderEmailHtml` / `renderEmailText`
  in `worker.js`) and mirrors `email/confirmation.*`.
- The draft is created in the mailbox connected to the Office 365 Outlook
  connection (`/me`).
