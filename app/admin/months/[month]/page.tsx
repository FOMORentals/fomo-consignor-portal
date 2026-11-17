import { notFound } from "next/navigation";
import { getMonth, listAccounts } from "@/lib/store";
import { METHOD_LABEL, monthName, pounds } from "@/lib/format";
import { addAdjustmentAction, publishAction, removeAdjustmentAction, retryBillsAction, signOffAction } from "./actions";

export const dynamic = "force-dynamic";
/** Publish makes up to 23 Xero bills at Xero's pace (about 4 calls each, one a second). */
export const maxDuration = 300;

const xeroBillUrl = (id: string) => `https://go.xero.com/AccountsPayable/Edit.aspx?InvoiceID=${id}`;

/** Sam's month view (spec §6): every consignor's figures, the safety checks, and Publish. */
export default async function MonthPage({
  params,
  searchParams,
}: {
  params: Promise<{ month: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { month } = await params;
  const { error } = await searchParams;
  if (!/^\d{4}-\d{2}$/.test(month)) notFound();
  const [record, accounts] = await Promise.all([getMonth(month), listAccounts()]);
  if (!record) notFound();
  const names = new Map(accounts.map((a) => [a.id, a.name]));
  const open = record.warnings.filter((w) => !record.signOffs[w.id]);
  const rows = [...record.statements].sort((a, b) => (names.get(a.accountId) ?? a.accountId).localeCompare(names.get(b.accountId) ?? b.accountId));
  const draft = record.status === "draft";
  const signedOff = record.warnings.filter((w) => record.signOffs[w.id]);
  const sum = (f: (s: (typeof rows)[number]) => number) => rows.reduce((a, s) => a + f(s), 0);

  return (
    <div>
      <h1>{monthName(month)}</h1>
      <p className="sub">
        <span className={`status ${record.status}`}>{record.status}</span> · Worked out from Rentman{" "}
        {new Date(record.builtAt).toLocaleString("en-GB", { timeZone: "Europe/London", dateStyle: "medium", timeStyle: "short" })} (UK)
        {record.publishedAt && ` · Published by ${record.publishedBy}`}
      </p>

      {error && <p className="warnings">{error}</p>}

      {open.length > 0 ? (
        <section className="warnings">
          <h2>
            {open.length} check{open.length === 1 ? "" : "s"} to clear before publishing
          </h2>
          <ul>
            {open.map((w) => (
              <li key={w.id}>
                {w.message}
                {draft && (
                  <form className="inline" action={signOffAction.bind(null, month, w.id)}>
                    <input name="note" placeholder="Why it's OK" required maxLength={300} />
                    <button type="submit">Sign off</button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <section className="ok">All checks clear.</section>
      )}
      {signedOff.length > 0 && (
        <details className="signedOff">
          <summary>{signedOff.length} signed off</summary>
          <ul>
            {signedOff.map((w) => (
              <li key={w.id}>
                {w.message} <span className="note">{record.signOffs[w.id].by}: {record.signOffs[w.id].note}</span>
              </li>
            ))}
          </ul>
        </details>
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

      <h2 className="section">Adjustments</h2>
      <p className="note">Deductions for money owed to FOMO are negative (e.g. -120), credits positive. The consignor sees the reason on their statement.</p>
      {rows.map((s) => (
        <details key={s.accountId} className="adjust" open={s.adjustments.length > 0}>
          <summary>
            {names.get(s.accountId) ?? s.accountId}
            {s.adjustments.length > 0 && ` · ${pounds(s.adjustments.reduce((a, x) => a + x.pence, 0))}`}
          </summary>
          <ul>
            {s.adjustments.map((x, i) => (
              <li key={i}>
                {pounds(x.pence)}: {x.reason} <span className="note">({x.by})</span>
                {draft && (
                  <form className="inline" action={removeAdjustmentAction.bind(null, month, s.accountId, i)}>
                    <button type="submit" className="quiet">Remove</button>
                  </form>
                )}
              </li>
            ))}
          </ul>
          {draft && (
            <form className="inline" action={addAdjustmentAction.bind(null, month, s.accountId)}>
              <input name="amount" placeholder="£ amount" required inputMode="decimal" size={10} />
              <input name="reason" placeholder="Reason" required maxLength={200} />
              <button type="submit">Add</button>
            </form>
          )}
        </details>
      ))}

      {draft ? (
        <form className="actions" action={publishAction.bind(null, month)}>
          <label className="note">
            <input type="checkbox" name="confirm" required disabled={open.length > 0} /> I&apos;ve checked these figures
          </label>
          <button type="submit" disabled={open.length > 0}>
            Publish {monthName(month)}
          </button>
          <span className="note">
            {open.length > 0
              ? "Clear the checks above first."
              : "Fixes the figures, makes the Xero draft bills with their PDFs (Sam approves them in Xero). Consignor pages and emails come in a later update."}
          </span>
        </form>
      ) : record.history ? (
        <p className="note actions">Loaded from the Consignment Tracker 2026 as it was paid. Billed in Xero from the tracker, not from here.</p>
      ) : (
        <section>
          <h2 className="section">Xero draft bills</h2>
          {(() => {
            const bills = record.bills ?? {};
            const failed = rows.filter((s) => bills[s.accountId]?.state === "failed" || !bills[s.accountId]);
            return (
              <>
                <ul className="bills">
                  {rows.map((s) => {
                    const b = bills[s.accountId];
                    const name = names.get(s.accountId) ?? s.accountId;
                    if (!b) return <li key={s.accountId}>{name}: not made yet.</li>;
                    if (b.state === "created")
                      return (
                        <li key={s.accountId}>
                          {name}: <a href={xeroBillUrl(b.invoiceId)}>{b.number}</a> draft in Xero, {pounds(s.totalPence)}
                          {!b.attached && <span className="note"> (check the PDF is attached in Xero)</span>}
                        </li>
                      );
                    if (b.state === "skipped") return <li key={s.accountId}>{name}: {b.reason}</li>;
                    return (
                      <li key={s.accountId} className="failed">
                        {name}: {b.number} not made. {b.error}
                      </li>
                    );
                  })}
                </ul>
                {failed.length > 0 && (
                  <form className="actions" action={retryBillsAction.bind(null, month)}>
                    <button type="submit">Try the {failed.length} missing bill{failed.length === 1 ? "" : "s"} again</button>
                    <span className="note">Bills already in Xero are never made twice.</span>
                  </form>
                )}
              </>
            );
          })()}
        </section>
      )}
    </div>
  );
}
