# Send confirmation emails from your Outlook via Power Automate

This lets the Worker send the confirmation email **from your Microsoft/Outlook
mailbox** — no domain or DNS needed. You sign in once; the flow does the rest.

## Build the flow (~5 minutes, all clicks)

1. Go to **https://make.powerautomate.com** (sign in with your work account).
2. Left menu → **Create** → **Instant cloud flow**.
3. Name: `Webinar confirmation email`. Choose trigger
   **"When an HTTP request is received"** → **Create**.
4. In that trigger, click **"Use sample payload to generate schema"** and paste:

   ```json
   { "to": "a@b.com", "subject": "x", "html": "<p>x</p>", "text": "x", "firstName": "x" }
   ```

   Click **Done**.
5. Click **+ New step** → search **"Send an email (V2)"** (Office 365 Outlook).
   Sign in if prompted.
   - **To:** click the field → Dynamic content → **to**
   - **Subject:** Dynamic content → **subject**
   - **Body:** click the field, then the small **</>** (code view) icon, and pick
     Dynamic content → **html**
   - (Optional) Advanced options → **Importance: Normal**. Leave "Is HTML" = Yes.
6. Click **Save**.
7. Open the **first step** (the HTTP trigger) again — it now shows
   **"HTTP POST URL"**. Click the copy icon.

## Give me the URL

Paste that HTTP POST URL back into the chat. I'll:
- store it as the Worker secret `POWER_AUTOMATE_URL`,
- set `EMAIL_ENABLED = "true"` and redeploy,
- send a test registration and confirm the email arrives.

> The URL contains a signature and acts like a password — anyone with it can
> trigger the flow. If it ever leaks, open the flow, edit the trigger, and
> regenerate (or delete + recreate the flow).

## Notes

- The email content is rendered inside the Worker (`renderEmailHtml` /
  `renderEmailText` in `worker.js`) and mirrors `email/confirmation.*`.
- If you later get a domain, you can switch to Resend instead by setting
  `RESEND_API_KEY` + `FROM_EMAIL` and clearing `POWER_AUTOMATE_URL`.
