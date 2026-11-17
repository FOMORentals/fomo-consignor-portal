import Link from "next/link";
import { load } from "../data";
import { monthName, pounds } from "@/lib/format";

/** Statements (spec §3.3): one per published month. */
export default async function Statements({ params }: { params: Promise<{ account: string }> }) {
  const { account: id } = await params;
  const { account, view } = await load(id);
  return (
    <div>
      <h1>Statements</h1>
      {view.statements.length === 0 ? (
        <p className="empty">Your first statement will appear here once FOMO publishes the month.</p>
      ) : (
        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>Month</th>
                <th className="num">Net</th>
                <th className="num">VAT</th>
                <th className="num">Total</th>
              </tr>
            </thead>
            <tbody>
              {view.statements.map((s) => (
                <tr key={s.month}>
                  <td>
                    <Link href={`/c/${account.id}/statements/${s.month}`}>{monthName(s.month)}</Link>
                  </td>
                  <td className="num">{pounds(s.netPence)}</td>
                  <td className="num">{s.vatPence ? pounds(s.vatPence) : ""}</td>
                  <td className="num">{pounds(s.totalPence)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
