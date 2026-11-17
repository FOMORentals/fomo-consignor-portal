import { auth } from "@/auth";
import { accountsFor, publishedMonths } from "@/lib/access";
import { pdfFilename, statementPdf } from "@/lib/statement-pdf";

/** The month's PDF, made from the frozen month (same as the one attached to the Xero bill). */
export async function GET(_req: Request, { params }: { params: Promise<{ account: string; month: string }> }) {
  const { account: id, month } = await params;
  const account = (await accountsFor(await auth())).find((a) => a.id === id);
  if (!account) return new Response("Not found", { status: 404 });
  const record = (await publishedMonths()).find((m) => m.month === month);
  const statement = record?.statements.find((s) => s.accountId === id);
  const consignor = record?.parties?.[id];
  if (!record || !statement || !consignor || !record.fomo) return new Response("Not found", { status: 404 });
  const input = { account, statement, consignor, fomo: record.fomo };
  const pdf = await statementPdf(input);
  return new Response(Buffer.from(pdf), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${pdfFilename(input)}"`, "Cache-Control": "private, no-store" },
  });
}
