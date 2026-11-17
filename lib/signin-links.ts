/**
 * One-time sign-in links for consignors (spec §2: magic link, no password). The token is only ever in the email;
 * Firestore keeps its SHA-256, so a database read can't sign anyone in. Links last 30 minutes and work once.
 *
 *   consignor_signin_links/{sha256(token)}  { email, expiresAt, usedAt, createdAt }
 */
import { createHash, randomBytes } from "node:crypto";
import { db } from "./store.ts";

export const SIGNIN_LINKS = "consignor_signin_links";
export const LINK_MINUTES = 30;
export const PER_EMAIL_PER_HOUR = 5;

export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export async function createLink(email: string): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  const now = Date.now();
  await db()
    .collection(SIGNIN_LINKS)
    .doc(hashToken(token))
    .set({ email: email.toLowerCase(), createdAt: new Date(now).toISOString(), expiresAt: new Date(now + LINK_MINUTES * 60_000).toISOString(), usedAt: null });
  return token;
}

export async function removeLink(token: string) {
  await db().collection(SIGNIN_LINKS).doc(hashToken(token)).delete();
}

/** Uses the link up, once (a transaction, so two clicks can't both sign in). The email, or null if used, expired or unknown. */
export async function claimLink(token: string): Promise<string | null> {
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) return null;
  const ref = db().collection(SIGNIN_LINKS).doc(hashToken(token));
  return db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const link = snap.data() as { email: string; expiresAt: string; usedAt: string | null } | undefined;
    if (!link || link.usedAt || Date.parse(link.expiresAt) < Date.now()) return null;
    tx.update(ref, { usedAt: new Date().toISOString() });
    return link.email;
  });
}

export async function linksSentSince(email: string, sinceIso: string): Promise<number> {
  const snap = await db().collection(SIGNIN_LINKS).where("email", "==", email.toLowerCase()).get();
  return snap.docs.filter((d) => String(d.get("createdAt")) >= sinceIso).length;
}
