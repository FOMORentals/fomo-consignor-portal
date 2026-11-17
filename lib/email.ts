/**
 * Email through Resend, as the client portal does. Sender is EMAIL_FROM (default consignors@, an address on the
 * fomorentals.co.uk domain Resend already sends for); replies go to EMAIL_REPLY_TO (default accounts@).
 * No figures ever go in an email (spec §5.4): the consignor signs in to see them.
 */
const FROM = process.env.EMAIL_FROM || "FOMO Rentals <consignors@fomorentals.co.uk>";
const REPLY_TO = process.env.EMAIL_REPLY_TO || "accounts@fomorentals.co.uk";
export const APP_URL = process.env.AUTH_URL || "http://localhost:3000";

export async function sendEmail(opts: { to: string; subject: string; text: string; html: string }): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    // Nothing fails silently: on the live site a missing key is an error, locally it's a log line.
    if (process.env.VERCEL_ENV === "production") throw new Error("Email not sent: RESEND_API_KEY is not set");
    console.log("[email:dev]", { to: opts.to, subject: opts.subject, text: opts.text });
    return;
  }
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM, to: opts.to, reply_to: REPLY_TO, subject: opts.subject, text: opts.text, html: opts.html }),
  });
  if (!r.ok) throw new Error(`Email send failed (${r.status}): ${(await r.text()).slice(0, 300)}`);
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

export function signInLinkEmail(token: string) {
  const url = `${APP_URL}/signin/link?token=${encodeURIComponent(token)}`;
  return {
    subject: "Your FOMO consignor sign-in link",
    text: `Sign in to see your FOMO consignor statements:\n\n${url}\n\nThe link works once, for 30 minutes. If you didn't ask for it, ignore this email.`,
    html: `<p>Sign in to see your FOMO consignor statements:</p><p><a href="${esc(url)}">Sign in</a></p><p style="color:#5e5e5c">The link works once, for 30 minutes. If you didn't ask for it, ignore this email.</p>`,
  };
}
