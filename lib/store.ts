/**
 * Firestore (project fomo-bookings-board-v2, shared with the other FOMO apps). This app's own collections only,
 * all prefixed consignor_. Pages read single documents; no whole-collection reads except the small accounts list.
 *
 *   consignor_accounts/{id}   one per consignor (23 today)
 *   consignor_months/{YYYY-MM} the month: draft or published statements, warnings and Sam's sign-offs
 *   consignor_audit/{auto}    every rate/VAT change, adjustment, sign-off and publish (spec §6)
 */
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import type { Account, Adjustment, Statement } from "@/lib/payout";
import type { Warning } from "@/lib/checks";

export const ACCOUNTS = "consignor_accounts";
export const MONTHS = "consignor_months";
export const AUDIT = "consignor_audit";

export type AccountRecord = Account & {
  /** Contact name in Xero, for the draft bill. */
  xeroContact: string;
  /** Emails that can sign in to see this account (spec §2: several per account, and one email can see several). */
  loginEmails: string[];
  /** Left FOMO: kept for history, no new statements. */
  active: boolean;
  /** Codes this account used to have, still counted as known so they don't raise "unknown code". */
  oldCodes?: string[];
  /** Paid on a separate arrangement, not Rentman revenue (Apollo, F&M Media at 100% until Jamie and Sam settle it):
   *  their statement starts empty and Sam adds the amount as a manual line. */
  manual?: boolean;
};

export type SignOff = { by: string; at: string; note: string };

/** Name, address and VAT number as Xero holds them, copied at Publish so a statement never changes afterwards. */
export type Party = { name: string; address: string[]; vatNumber: string; xeroContactId?: string };

/** What happened to an account's Xero draft bill. Kept on the month so a retry never makes a second bill. */
export type BillResult =
  | { state: "created"; number: string; invoiceId: string; at: string; attached: boolean }
  | { state: "skipped"; number: string; reason: string; at: string }
  | { state: "failed"; number: string; error: string; at: string };

export type MonthRecord = {
  month: string;
  status: "draft" | "published";
  /** When the figures were last worked out from Rentman, and Rentman's own total for consigned kit (pence). */
  builtAt: string;
  rentmanTotalPence: number;
  statements: Statement[];
  warnings: Warning[];
  signOffs: Record<string, SignOff>;
  /** Sam's adjustments by account id, kept apart so a Refresh from Rentman never loses them. */
  adjustments: Record<string, Adjustment[]>;
  publishedBy?: string;
  publishedAt?: string;
  /** Set at Publish: FOMO's and each consignor's details for the self-billing invoices. */
  fomo?: Party;
  parties?: Record<string, Party>;
  /** Xero draft bill per account id, filled in at Publish (and by Retry). */
  bills?: Record<string, BillResult>;
};

export function db() {
  if (getApps().length === 0) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
    if (raw) initializeApp({ credential: cert(JSON.parse(Buffer.from(raw, "base64").toString("utf8"))) });
    else initializeApp({ projectId: process.env.FIRESTORE_PROJECT_ID || "fomo-bookings-board-v2" }); // scripts: gcloud ADC
  }
  return getFirestore();
}

export async function listAccounts(): Promise<AccountRecord[]> {
  const snap = await db().collection(ACCOUNTS).get();
  return snap.docs.map((d) => ({ ...(d.data() as AccountRecord), id: d.id })).sort((a, b) => a.name.localeCompare(b.name));
}

export async function getMonth(month: string): Promise<MonthRecord | null> {
  const snap = await db().collection(MONTHS).doc(month).get();
  return snap.exists ? (snap.data() as MonthRecord) : null;
}

/** Months that exist, newest first (ids only). */
export async function listMonthIds(): Promise<string[]> {
  const refs = await db().collection(MONTHS).listDocuments();
  return refs.map((r) => r.id).sort().reverse();
}

export async function audit(by: string, action: string, details: Record<string, unknown>) {
  await db().collection(AUDIT).add({ at: new Date().toISOString(), by, action, details });
}
