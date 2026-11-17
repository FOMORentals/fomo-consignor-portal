import { notFound } from "next/navigation";
import { getMonth, listAccounts } from "@/lib/store";
import { METHOD_LABEL, monthName, pounds } from "@/lib/format";

export const dynamic = "force-dynamic";

/** Sam's month view (spec §6): every consignor's figures, the safety checks, and Publish. */
export default async function MonthPage({ params }: { params: Promise<{ month: string }> }) {
  const { month } = await params;
  if (!/^\d{4}-\d{2}$/.test(month)) notFound();
  const [record, accounts] = await Promise.all([getMonth(month), listAccounts()]);
  if (!record) notFound();
  const names = new Map(accounts.map((a) => [a.id, a.name]));
  const open = record.warnings.filter((w) => !record.signOffs[w.id]);
  const rows = [...record.statements].sort((a, b) => (names.get(a.accountId) ?? a.accountId).localeCompare(names.get(b.accountId) ?? b.accountId));
  const sum = (f: (s: (typeof rows)[number]) => number) => rows.reduce((a, s) => a + f(s), 0);

  return (
    <main>
      <h1>{monthName(month)}</h1>
      <p className="sub">
        <span className={`status ${record.status}`}>{record.status}</span> · Worked out from Rentman{" "}
        {new Date(record.builtAt).toLocaleString("en-GB", { timeZone: "Europe/London", dateStyle: "medium", timeStyle: "short" })} (UK)
        {record.publishedAt && ` · Published by ${record.publishedBy}`}
      </p>

      {open.length > 0 ? (
        <section className="warnings">
          <h2>
            {open.length} check{open.length === 1 ? "" : "s"} to clear before publishing
          </h2>
          <ul>
            {open.map((w) => (
              <li key={w.id}>{w.message}</li>
            ))}
          </ul>
        </section>
      ) : (
        <section className="ok">All checks clear.</section>
      )}

      <div className="tableWrap">
        <table>
          <thead>
            <tr>
              <th>Consignor</th>
              <th className="num">Hire revenue</th>
              <th className="num">Share</th>
              <th className="num">Adjustments</th>
              <th className="num">Net</th>
              <th className="num">VAT</th>
              <th className="num">Total</th>
              <th>Paid by</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => {
              const adj = s.adjustments.reduce((a, x) => a + x.pence, 0);
              return (
                <tr key={s.accountId}>
                  <td>{names.get(s.accountId) ?? s.accountId}</td>
                  <td className="num">{pounds(s.revenuePence)}</td>
                  <td className="num">{Math.round(s.share * 100)}%</td>
                  <td className="num" title={s.adjustments.map((x) => `${pounds(x.pence)}: ${x.reason}`).join("\n")}>
                    {adj ? pounds(adj) : ""}
                  </td>
                  <td className="num">{pounds(s.netPence)}</td>
                  <td className="num">{s.vatPence ? pounds(s.vatPence) : ""}</td>
                  <td className="num">{pounds(s.totalPence)}</td>
                  <td>{METHOD_LABEL[s.method]}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td>Total</td>
              <td className="num">{pounds(sum((s) => s.revenuePence))}</td>
              <td />
              <td className="num">{pounds(sum((s) => s.adjustments.reduce((a, x) => a + x.pence, 0)))}</td>
              <td className="num">{pounds(sum((s) => s.netPence))}</td>
              <td className="num">{pounds(sum((s) => s.vatPence))}</td>
              <td className="num">{pounds(sum((s) => s.totalPence))}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="actions">
        <button type="button" disabled>
          Publish {monthName(month)}
        </button>
        <span className="note">
          {record.status === "published"
            ? "Published: consignors can see these statements."
            : "Publishing (statements, self-billing invoices, Xero draft bills, emails) arrives in the next update."}
        </span>
      </div>
    </main>
  );
}
