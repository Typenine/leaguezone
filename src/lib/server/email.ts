import { Resend } from 'resend';

function getResend(): Resend {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) throw new Error('RESEND_API_KEY is not configured');
  return new Resend(key);
}

function getFromAddress(): string {
  const configured = process.env.EMAIL_FROM?.trim();
  if (configured) return configured;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('EMAIL_FROM is not configured');
  }
  return 'LeagueZone <onboarding@resend.dev>';
}

async function sendEmail(input: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  // CI/browser tests exercise the token and verification flow without sending
  // messages through the production email provider.
  if (process.env.E2E_TEST_MODE === 'true' || process.env.E2E_TEST_MODE === '1') {
    return;
  }

  const resend = getResend();
  const result = await resend.emails.send({
    from: getFromAddress(),
    to: input.to,
    subject: input.subject,
    html: input.html,
  });

  if (result.error) {
    const message = result.error.message || 'Unknown Resend error';
    throw new Error(`Resend rejected the email: ${message}`);
  }
  if (!result.data?.id) {
    throw new Error('Resend did not confirm email acceptance');
  }
}

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  await sendEmail({
    to,
    subject: 'Reset your LeagueZone password',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px;background:#fff">
        <h2 style="margin:0 0 8px;color:#111">Password reset</h2>
        <p style="color:#555;margin:0 0 24px;line-height:1.5">
          Someone requested a password reset for your LeagueZone account.
          If that was you, click the button below. This link expires in <strong>1 hour</strong>.
        </p>
        <a href="${resetUrl}"
           style="display:inline-block;background:#6366f1;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">
          Reset password
        </a>
        <p style="color:#999;font-size:12px;margin-top:24px">
          If you didn't request this, you can safely ignore this email.<br>
          Link: ${resetUrl}
        </p>
      </div>
    `,
  });
}

export async function sendEmailVerification(to: string, verifyUrl: string): Promise<void> {
  await sendEmail({
    to,
    subject: 'Verify your LeagueZone email address',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px;background:#fff">
        <h2 style="margin:0 0 8px;color:#111">Verify your email</h2>
        <p style="color:#555;margin:0 0 24px;line-height:1.5">
          Click the button below to verify your email address and activate your LeagueZone account.
        </p>
        <a href="${verifyUrl}"
           style="display:inline-block;background:#6366f1;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">
          Verify email
        </a>
        <p style="color:#999;font-size:12px;margin-top:24px">
          Link: ${verifyUrl}
        </p>
      </div>
    `,
  });
}
