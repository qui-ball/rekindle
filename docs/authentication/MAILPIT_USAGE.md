# Mailpit Usage Guide

## What is Mailpit?

Mailpit is an email testing tool that captures all emails sent by your local Supabase instance. Instead of actually sending emails, Supabase sends them to Mailpit, where you can view them in a web interface.

## Accessing Mailpit

When Supabase is running locally, Mailpit is available at:

**URL:** http://localhost:54324

Simply open this URL in your browser to view all emails sent by your application.

## How It Works

1. **Email Confirmations Enabled:** In `supabase/config.toml`, `enable_confirmations = true` means users must confirm their email before they can sign in.

2. **When a User Signs Up:**
   - User creates an account via `/sign-up`
   - Supabase sends a confirmation email
   - Email is captured by Mailpit (not actually sent)
   - User is redirected to `/sign-up/success` page

3. **Viewing the Email:**
   - Open http://localhost:54324 in your browser
   - You'll see a list of all emails sent
   - Click on the confirmation email to view it
   - The email contains a confirmation link

4. **Testing Email Confirmation:**
   - Copy the confirmation link from Mailpit
   - Open it in your browser
   - User's email is now confirmed
   - User can now sign in

## Testing Scenarios

### Scenario 1: User Signs Up But Doesn't Confirm Email

1. User signs up at `/sign-up`
2. Check Mailpit at http://localhost:54324 - you'll see the confirmation email
3. User tries to sign in at `/sign-in`
4. **Expected:** Sign-in should fail with "Email not confirmed" error
5. User must click the confirmation link in Mailpit first

### Scenario 2: User Confirms Email Then Signs In

1. User signs up at `/sign-up`
2. Check Mailpit at http://localhost:54324 - find the confirmation email
3. Click the confirmation link in the email (opens in browser)
4. User is redirected and email is confirmed
5. User signs in at `/sign-in`
6. **Expected:** Sign-in succeeds, user redirected to `/upload`

### Scenario 3: Password Reset Flow

1. User clicks "Forgot password?" on `/sign-in`
2. User enters email and submits
3. Check Mailpit at http://localhost:54324 - you'll see the password reset email
4. Click the reset link in Mailpit
5. User can reset their password

## Mailpit Features

- **View All Emails:** See every email sent by your app
- **Email Preview:** View HTML and plain text versions
- **Click Links:** Click confirmation/reset links directly in Mailpit
- **Search:** Search through emails
- **Delete:** Clear old emails to keep the interface clean

## Important Notes

- **Local Development Only:** Mailpit only works with local Supabase instance
- **No Real Emails:** Emails are never actually sent - they're only captured by Mailpit
- **Email Persistence:** Emails persist until you clear them or restart Supabase
- **Multiple Emails:** Each sign-up/reset generates a new email in Mailpit

## Troubleshooting

### Emails Not Appearing in Mailpit

1. **Check Supabase is Running:**
   ```bash
   supabase status
   ```
   Should show Mailpit URL: http://127.0.0.1:54324

2. **Check Email Confirmations Enabled:**
   - Open `supabase/config.toml`
   - Verify `enable_confirmations = true` under `[auth.email]`

3. **Restart Supabase:**
   ```bash
   supabase stop
   supabase start
   ```

### Confirmation Link Not Working

1. Make sure you're copying the full link from Mailpit
2. The link should point to your Supabase instance (localhost:54321)
3. Check browser console for any errors when clicking the link

## Quick Reference

```bash
# Check Supabase status (shows Mailpit URL)
supabase status

# View Mailpit in browser
open http://localhost:54324

# Restart Supabase (clears Mailpit emails)
supabase stop
supabase start
```

---

**Next Steps:**
- Test sign-up flow with email confirmation
- Test sign-in with unconfirmed email (should fail)
- Test sign-in after email confirmation (should succeed)
- Test password reset flow

