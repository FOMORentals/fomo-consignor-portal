/**
 * Xero for Publish (spec §5.4): read FOMO's and consignors' details, create DRAFT bills, attach the PDF.
 * Approved scope (Jamie, 17 Nov): draft bills and attachments only. Nothing here approves, pays or edits a bill.
 *
 * Credentials: XERO_CLIENT_ID / XERO_CLIENT_SECRET (a Xero custom connection, as fomo-cloud-function uses).
 * Scopes it needs: accounting.transactions accounting.contacts.read accounting.attachments accounting.settings.read
 * (override with XERO_SCOPES if the app uses Xero's newer granular scopes).
 */
import type { Party } from "./store.ts";
import type { VatSetting } from "./payout.ts";

const API = "https://api.xero.com/api.xro/2.0";
const DEFAULT_SCOPES = "accounting.transactions accounting.contacts.read accounting.attachments accounting.settings.read";

/** Xero's codes for the two VAT settings consignors have. */
export const TAX_TYPE: Record<VatSetting, string> = { "20% (VAT on Expenses)": "INPUT2", "NO VAT": "NONE" };
export const ACCOUNT_CODE = "327";

export type XeroSession = { token: string; tenant: string };
type XeroAddress = { AddressType?: string; AddressLine1?: string; AddressLine2?: string; AddressLine3?: string; AddressLine4?: string; City?: string; Region?: string; PostalCode?: string; Country?: string };

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function connect(): Promise<XeroSession> {
  const id = process.env.XERO_CLIENT_ID;
  const secret = process.env.XERO_CLIENT_SECRET;
  if (!id || !secret) throw new Error("Xero isn't set up for this portal yet (XERO_CLIENT_ID / XERO_CLIENT_SECRET missing in Vercel).");
  const r = await fetch("https://identity.xero.com/connect/token", {
    method: "POST",
    headers: { Authorization: "Basic " + Buffer.from(`${id}:${secret}`).toString("base64"), "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "client_credentials", scope: process.env.XERO_SCOPES || DEFAULT_SCOPES }).toString(),
  });
  if (!r.ok) throw new Error(`Xero sign-in refused (${r.status}): ${(await r.text()).slice(0, 300)}`);
  const token = (await r.json()).access_token as string;
  const c = await fetch("https://api.xero.com/connections", { headers: { Authorization: `Bearer ${token}` } });
  if (!c.ok) throw new Error(`Xero connections ${c.status}`);
  const orgs = (await c.json()) as { tenantId: string }[];
  if (!orgs.length) throw new Error("No Xero organisation is connected to this Xero app.");
  return { token, tenant: orgs[0].tenantId };
}

/** One Xero call, paced under Xero's 60-a-minute limit, retrying once on 429. */
async function call(x: XeroSession, method: string, path: string, body?: BodyInit, contentType = "application/json"): Promise<Record<string, unknown>> {
  for (let attempt = 0; ; attempt++) {
    await pause(1100);
    const r = await fetch(API + path, {
      method,
      headers: { Authorization: `Bearer ${x.token}`, "Xero-tenant-id": x.tenant, Accept: "application/json", ...(body ? { "Content-Type": contentType } : {}) },
      body,
    });
    if (r.status === 429 && attempt === 0) {
      await pause(Number(r.headers.get("retry-after") ?? 60) * 1000);
      continue;
    }
    const text = await r.text();
    if (!r.ok) throw new Error(`Xero ${method} ${path.split("?")[0]} ${r.status}: ${text.slice(0, 300)}`);
    return text ? JSON.parse(text) : {};
  }
}

const where = (clause: string) => `where=${encodeURIComponent(clause)}`;
const quote = (s: string) => s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');

export function partyFrom(name: string, taxNumber: string | undefined, addresses: XeroAddress[] | undefined): Party {
  const all = addresses ?? [];
  const filled = (a: XeroAddress) => [a.AddressLine1, a.AddressLine2, a.AddressLine3, a.AddressLine4, a.City, a.Region, a.PostalCode, a.Country].map((v) => v?.trim()).filter((v): v is string => !!v);
  const best = all.find((a) => a.AddressType === "POBOX" && filled(a).length) ?? all.find((a) => filled(a).length);
  return { name, address: best ? filled(best) : [], vatNumber: (taxNumber ?? "").trim() };
}

export async function organisation(x: XeroSession): Promise<Party> {
  const j = await call(x, "GET", "/Organisation");
  const o = (j.Organisations as Record<string, unknown>[])[0];
  return partyFrom(String(o.LegalName || o.Name), o.TaxNumber as string | undefined, o.Addresses as XeroAddress[]);
}

export async function contactByName(x: XeroSession, name: string): Promise<{ id: string; party: Party }> {
  const j = await call(x, "GET", `/Contacts?${where(`Name=="${quote(name)}"`)}`);
  const found = (j.Contacts as Record<string, unknown>[]) ?? [];
  if (found.length !== 1) throw new Error(`Xero has ${found.length ? found.length + " contacts" : "no contact"} called "${name}". Fix the Xero contact on the Consignors page.`);
  const c = found[0];
  return { id: String(c.ContactID), party: partyFrom(String(c.Name), c.TaxNumber as string | undefined, c.Addresses as XeroAddress[]) };
}

/** A bill with this number already in Xero (any status), so Publish and Retry never make a second one. */
export async function findBill(x: XeroSession, number: string): Promise<{ id: string; status: string } | null> {
  const j = await call(x, "GET", `/Invoices?${where(`Type=="ACCPAY" AND InvoiceNumber=="${quote(number)}"`)}`);
  const b = ((j.Invoices as Record<string, unknown>[]) ?? [])[0];
  return b ? { id: String(b.InvoiceID), status: String(b.Status) } : null;
}

export type DraftBill = { contactId: string; number: string; date: string; dueDate: string; description: string; netPence: number; vat: VatSetting };

/** Xero's own JSON for the bill: built here so it can be checked in tests. */
export function billBody(b: DraftBill) {
  return {
    Invoices: [
      {
        Type: "ACCPAY",
        Status: "DRAFT",
        Contact: { ContactID: b.contactId },
        InvoiceNumber: b.number,
        Date: b.date,
        DueDate: b.dueDate,
        LineAmountTypes: "Exclusive",
        LineItems: [{ Description: b.description, Quantity: 1, UnitAmount: b.netPence / 100, AccountCode: ACCOUNT_CODE, TaxType: TAX_TYPE[b.vat] }],
      },
    ],
  };
}

export async function createDraftBill(x: XeroSession, b: DraftBill): Promise<{ id: string; totalPence: number }> {
  const j = await call(x, "PUT", "/Invoices", JSON.stringify(billBody(b)));
  const inv = (j.Invoices as Record<string, unknown>[])[0];
  return { id: String(inv.InvoiceID), totalPence: Math.round(Number(inv.Total) * 100) };
}

export async function attachPdf(x: XeroSession, invoiceId: string, filename: string, pdf: Uint8Array): Promise<void> {
  await call(x, "PUT", `/Invoices/${invoiceId}/Attachments/${encodeURIComponent(filename)}`, Buffer.from(pdf), "application/pdf");
}
