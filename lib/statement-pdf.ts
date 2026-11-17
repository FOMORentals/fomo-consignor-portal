/**
 * The PDF for one consignor's published month (spec §4–5): a self-billed invoice for consignors on self-billing
 * (HMRC VAT Notice 700/62), otherwise a payout statement. Attached to the Xero draft bill and downloadable later.
 * Pure: everything it shows comes in as arguments, taken from the frozen month.
 */
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { billDates, selfBillingNumber, type Account, type Statement } from "./payout.ts";
import type { Party } from "./store.ts";
import { monthName, pounds } from "./format.ts";

export const HMRC_VAT_WORDING = "The VAT shown is your output tax due to HMRC.";
export const SELF_BILLING_WORDING = "Self-billed invoice: issued by FOMO under a self-billing agreement with the supplier.";

export type PdfInput = { account: Pick<Account, "codes" | "method">; statement: Statement; consignor: Party; fomo: Party };

export function pdfTitle(input: PdfInput): string {
  return input.account.method === "self_billing" ? "Self-billed invoice" : "Consignment statement";
}

export function pdfFilename(input: PdfInput): string {
  return `${selfBillingNumber(input.account, input.statement.month)}.pdf`;
}

/** The lines of text the PDF carries, in order: kept separate from layout so the wording can be tested. */
export function pdfFacts(input: PdfInput): { label: string; value: string }[] {
  const { statement: s, account } = input;
  const { invoiceDate } = billDates(s.month);
  const date = new Date(invoiceDate + "T12:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  return [
    { label: account.method === "self_billing" ? "Invoice number" : "Reference", value: selfBillingNumber(account, s.month) },
    { label: "Date", value: date },
    ...(account.method === "self_billing" ? [{ label: "Tax point", value: date }] : []),
    { label: "Period", value: monthName(s.month) },
  ];
}

const A4: [number, number] = [595.28, 841.89];
const INK = rgb(0.1, 0.1, 0.1);
const GREY = rgb(0.42, 0.42, 0.42);

export async function statementPdf(input: PdfInput): Promise<Uint8Array> {
  const { statement: s, consignor, fomo, account } = input;
  const doc = await PDFDocument.create();
  doc.setTitle(`${pdfTitle(input)} ${selfBillingNumber(account, s.month)}`);
  doc.setAuthor(fomo.name);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const selfBilling = account.method === "self_billing";

  let page: PDFPage = doc.addPage(A4);
  let y = A4[1] - 56;
  const left = 50;
  const right = A4[0] - 50;
  // Standard PDF fonts only cover Western European letters: anything else prints as "?" rather than failing.
  const safe = (f: PDFFont, t: string) => [...t].map((ch) => { try { f.encodeText(ch); return ch; } catch { return "?"; } }).join("");
  const text = (t: string, x: number, size = 10, f = font, color = INK) => page.drawText(safe(f, t), { x, y, size, font: f, color });
  const textRight = (t: string, x: number, size = 10, f = font) => {
    const v = safe(f, t);
    page.drawText(v, { x: x - f.widthOfTextAtSize(v, size), y, size, font: f, color: INK });
  };
  const line = () => page.drawLine({ start: { x: left, y: y + 4 }, end: { x: right, y: y + 4 }, thickness: 0.5, color: GREY });
  const next = (h = 14) => {
    y -= h;
    if (y < 70) {
      page = doc.addPage(A4);
      y = A4[1] - 56;
    }
  };

  text(pdfTitle(input), left, 18, bold);
  next(30);

  // Supplier (the consignor) and customer (FOMO), side by side.
  const block = (heading: string, p: Party, x: number, startY: number) => {
    y = startY;
    text(heading, x, 8, bold, GREY);
    y -= 13;
    text(p.name, x, 10, bold);
    for (const l of p.address) {
      y -= 12;
      text(l, x, 9);
    }
    if (p.vatNumber) {
      y -= 12;
      text(`VAT number ${p.vatNumber}`, x, 9);
    }
    return y;
  };
  const top = y;
  const endA = block(selfBilling ? "SUPPLIER" : "CONSIGNOR", consignor, left, top);
  const endB = block(selfBilling ? "CUSTOMER (ISSUED BY)" : "FROM", fomo, 320, top);
  y = Math.min(endA, endB);
  next(26);

  for (const f of pdfFacts(input)) {
    text(f.label, left, 9, font, GREY);
    text(f.value, left + 100, 9);
    next(13);
  }
  next(14);

  // Items.
  text("Item", left, 9, bold, GREY);
  textRight("Hire revenue", right, 9, bold);
  next(6);
  line();
  next(12);
  for (const i of s.items) {
    text(i.name.length > 80 ? i.name.slice(0, 79) + "..." : i.name, left, 9);
    textRight(pounds(i.pence), right, 9);
    next(13);
  }
  if (!s.items.length) {
    text("No hire revenue this month.", left, 9, font, GREY);
    next(13);
  }
  line();
  next(12);

  const row = (label: string, value: string, f = font) => {
    text(label, 320, 10, f);
    textRight(value, right, 10, f);
    next(15);
  };
  row("Hire revenue", pounds(s.revenuePence));
  row(`Your share (${Math.round(s.share * 1000) / 10}%)`, pounds(s.grossPence));
  for (const a of s.adjustments) {
    const reason = a.reason.length > 40 ? a.reason.slice(0, 39) + "..." : a.reason;
    row(reason, pounds(a.pence));
  }
  row(selfBilling ? "Total excluding VAT" : "Net payout", pounds(s.netPence), bold);
  row(s.vatRate ? `VAT at ${Math.round(s.vatRate * 100)}%` : "VAT", s.vatRate ? pounds(s.vatPence) : "No VAT", font);
  row("Total", pounds(s.totalPence), bold);
  next(16);

  if (selfBilling) {
    text(SELF_BILLING_WORDING, left, 9);
    next(13);
    if (s.vatRate) {
      text(HMRC_VAT_WORDING, left, 9, bold);
      next(13);
    }
  }
  return doc.save();
}
