import Link from "next/link";
import { listAccounts } from "@/lib/store";
import { METHOD_LABEL } from "@/lib/format";
import { shareFor } from "@/lib/payout";

export const dynamic = "force-dynamic";

export default async function Consignors() {
  const accounts = await listAccounts();
  const thisMonth = new Date().toISOString().slice(0, 7);
  return (
    <div>
      <h1>Consignors</h1>
      <p className="sub">{accounts.filter((a) => a.active).length} active</p>
      {accounts.length === 0 ? (
        <p className="empty">No consignor accounts yet.</p>
      ) : (
        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>Consignor</th>
                <th>Xero contact</th>
                <th>Rentman code</th>
                <th className="num">Share</th>
                <th>VAT</th>
                <th>Paid by</th>
                <th>Logins</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((a) => (
                <tr key={a.id}>
                  <td>
                    <Link href={`/c/${a.id}`}>{a.name}</Link>
                  </td>
                  <td>{a.xeroContact}</td>
                  <td>{a.codes.join(", ")}</td>
                  <td className="num">{Math.round(shareFor(a, thisMonth) * 100)}%</td>
                  <td>{a.vat === "NO VAT" ? "No VAT" : "20%"}</td>
                  <td>{METHOD_LABEL[a.method]}</td>
                  <td>{a.loginEmails.length}</td>
                  <td>{a.active ? "Active" : "Left"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
