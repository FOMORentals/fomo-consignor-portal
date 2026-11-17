import { notFound } from "next/navigation";
import { load } from "../../data";
import { METHOD_LABEL, monthName, pounds } from "@/lib/format";
import { selfBillingNumber } from "@/lib/payout";

/** One month's statement (spec §3.3): items, share, adjustments with reasons, net, VAT, total, and the PDF. */
export default async function Statement({ params }: { params: Promise<{ account: string; month: string }> }) {
  const { account: id, month } = await params;
  const { account, view, months } = await load(id);
  const s = view.statements.find((x) => x.month === month);
  if (!s) notFound();
  const record = months.find((m) => m.month === month);
  const hasPdf = !!record?.parties?.[account.id];
  const selfBilling = s.method === "self_billing";
  return (
    <main>
      <h1>{monthName(month)}</h1>
      <p className="sub">
        {record?.history
          ? "From FOMO's 2026 consignment records"
          : selfBilling
            ? `Self-billed invoice ${selfBillingNumber(account, month)}`
            : `Reference ${selfBillingNumber(account, month)}`}{" "}
        · Paid by{" "}
        {METHOD_LABEL[s.method].toLowerCase()}
        {s.method === "rentman_credit" && " (FOMO adds this as credit on your Rentman account)"}
        {hasPdf && (
          <>
            {" "}
            · <a href={`/c/${account.id}/statements/${month}/pdf`}>Download PDF</a>
          </>
        )}
      </p>
      <div className="tableWrap">
        <table>
          <thead>
            <tr>
              <th>Item</th>
              <th className="num">Hire revenue</th>
            </tr>
          </thead>
          <tbody>
            {s.items.map((i, n) => (
              <tr key={n}>
                <td>{i.name}</td>
                <td className="num">{pounds(i.pence)}</td>
              </tr>
            ))}
            {s.items.length === 0 && (
              <tr>
                <td colSpan={2} className="note">
                  No hire revenue this month.
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr>
              <td>Hire revenue</td>
              <td className="num">{pounds(s.revenuePence)}</td>
            </tr>
            <tr>
              <td>Your share ({Math.round(s.share * 1000) / 10}%)</td>
              <td className="num">{pounds(s.grossPence)}</td>
            </tr>
            {s.adjustments.map((a, n) => (
              <tr key={n}>
                <td>{a.reason}</td>
                <td className="num">{pounds(a.pence)}</td>
              </tr>
            ))}
            <tr>
              <td>
                <strong>Net</strong>
              </td>
              <td className="num">
                <strong>{pounds(s.netPence)}</strong>
              </td>
            </tr>
            <tr>
              <td>{s.vatRate ? `VAT at ${Math.round(s.vatRate * 100)}%` : "VAT"}</td>
              <td className="num">{s.vatRate ? pounds(s.vatPence) : "No VAT"}</td>
            </tr>
            <tr>
              <td>
                <strong>Total</strong>
              </td>
              <td className="num">
                <strong>{pounds(s.totalPence)}</strong>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </main>
  );
}
