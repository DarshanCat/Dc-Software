import nodemailer from "nodemailer";

export interface PasswordResetEmailOptions {
  to: string;
  recipientName: string;
  resetUrl: string;
}

export interface CapturedMail {
  to: string;
  subject: string;
  text: string;
  html: string;
  resetUrl: string;
  sentAt: Date;
}

// In-memory capture store for automated tests when PASSWORD_RESET_MAIL_TRANSPORT=memory
const capturedTestMails: CapturedMail[] = [];

/**
 * Access in-memory captured test emails (Used ONLY in Vitest and Playwright test harness).
 */
export function getTestCapturedMails(toEmail?: string): CapturedMail[] {
  if (toEmail) {
    const normalized = toEmail.toLowerCase().trim();
    return capturedTestMails.filter((m) => m.to.toLowerCase() === normalized);
  }
  return [...capturedTestMails];
}

/**
 * Clear captured test emails (Used in test setup/reset).
 */
export function clearTestCapturedMails(): void {
  capturedTestMails.length = 0;
}

/**
 * Send Password Reset Email.
 * In production: Uses configured SMTP credentials via nodemailer.
 * In test mode (PASSWORD_RESET_MAIL_TRANSPORT=memory): Captures in-memory without external calls or stdout logging.
 */
export async function sendPasswordResetEmail(
  options: PasswordResetEmailOptions
): Promise<boolean> {
  const { to, recipientName, resetUrl } = options;
  const isMemoryTransport =
    process.env.PASSWORD_RESET_MAIL_TRANSPORT === "memory" ||
    process.env.NODE_ENV === "test" ||
    (!process.env.SMTP_HOST && !process.env.SMTP_USER);

  const subject = "Password Reset Request — Vijay Spheroidals";
  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Password Reset Request</title>
</head>
<body style="font-family: Arial, sans-serif; background-color: #f8fafc; color: #1e293b; margin: 0; padding: 24px;">
  <div style="max-width: 560px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0; padding: 32px;">
    <div style="text-align: center; margin-bottom: 24px;">
      <h2 style="color: #0f172a; margin: 0; font-size: 20px; font-weight: 700;">Vijay Spheroidals</h2>
      <p style="color: #64748b; font-size: 13px; margin-top: 4px;">DC &amp; Vendor Material Management</p>
    </div>

    <h3 style="font-size: 16px; color: #0f172a; margin-top: 0;">Hello ${recipientName || "Administrator"},</h3>
    <p style="font-size: 14px; line-height: 1.5; color: #334155;">
      A password reset was requested for your administrator account (<strong>${to}</strong>).
    </p>
    <p style="font-size: 14px; line-height: 1.5; color: #334155;">
      Click the button below to establish your new password. This link is single-use and valid for <strong>30 minutes</strong>.
    </p>

    <div style="text-align: center; margin: 28px 0;">
      <a href="${resetUrl}" style="background-color: #0f172a; color: #ffffff; text-decoration: none; padding: 12px 24px; font-size: 14px; font-weight: 600; border-radius: 6px; display: inline-block;">
        Reset Administrator Password
      </a>
    </div>

    <p style="font-size: 12px; color: #64748b; line-height: 1.5;">
      If you did not request this password reset, please ignore this message. Your account remains secure.
    </p>

    <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 24px 0;" />

    <p style="font-size: 11px; color: #94a3b8; text-align: center; margin: 0;">
      &copy; ${new Date().getFullYear()} Vijay Spheroidals &bull; Secure Enterprise Authentication
    </p>
  </div>
</body>
</html>
  `.trim();

  const textContent = `Hello ${recipientName},\n\nA password reset was requested for your account (${to}). Please use the following one-time link to set your new password (valid for 30 minutes):\n\n${resetUrl}\n\nIf you did not request this, please ignore this email.`;

  if (isMemoryTransport) {
    capturedTestMails.push({
      to,
      subject,
      text: textContent,
      html: htmlContent,
      resetUrl,
      sentAt: new Date(),
    });
    return true;
  }

  // Production SMTP Transport
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = parseInt(process.env.SMTP_PORT || "587", 10);
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const smtpFrom = process.env.SMTP_FROM || `"Vijay Spheroidals Auth" <noreply@vijayspheroidals.com>`;

  if (!smtpHost || !smtpUser || !smtpPass) {
    // SMTP not configured in production environment
    // Catch silently server-side without outputting raw tokens or secrets
    return false;
  }

  try {
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });

    await transporter.sendMail({
      from: smtpFrom,
      to,
      subject,
      text: textContent,
      html: htmlContent,
    });

    return true;
  } catch {
    // Catch SMTP failure silently server-side without outputting secrets or links
    return false;
  }
}
