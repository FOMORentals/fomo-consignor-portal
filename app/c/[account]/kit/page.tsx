import { load } from "../data";
import { monthName, pounds } from "@/lib/format";

/** My kit (spec §3.2): each item's earnings (their share) for the latest month, the year and since January 2026. */
export default async function Kit({ params }: { params: Promise<{ account: string }> }) {
  const { account: id } = await params;
  const { view } = await load(id);
  const latest = view.latest?.month;
  return (
    <main>
      <h1>My kit</h1>
      <p className="sub">What each item earned you (your share, before VAT), from published statements.</p>
      {view.kit.length === 0 ? (
        <p className="empty">Nothing to show yet.</p>
      ) : (
        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th className="num">{latest ? monthName(latest) : "Latest month"}</th>
                <th className="num">{latest?.slice(0, 4)} so far</th>
                <th className="num">Since Jan 2026</th>
              </tr>
            </thead>
            <tbody>
              {view.kit.map((k) => (
                <tr key={k.name}>
                  <td>{k.name}</td>
                  <td className="num">{k.monthPence ? pounds(k.monthPence) : ""}</td>
                  <td className="num">{pounds(k.yearPence)}</td>
                  <td className="num">{pounds(k.totalPence)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
