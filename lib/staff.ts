/**
 * Who can check and publish months (spec §2: Sam publishes, Jamie is the backup and sees everything).
 * Override with STAFF_EMAILS (comma-separated) in Vercel.
 */
const DEFAULT_STAFF = ["sam@fomorentals.co.uk", "jamie@fomorentals.co.uk"];

export function staffEmails(): string[] {
  const raw = process.env.STAFF_EMAILS;
  return (raw ? raw.split(",") : DEFAULT_STAFF).map((e) => e.trim().toLowerCase()).filter(Boolean);
}

export function isStaffEmail(email: string | null | undefined): boolean {
  return !!email && staffEmails().includes(email.trim().toLowerCase());
}
