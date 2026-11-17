import { monthName, monthShort, pounds } from "@/lib/format";
import type { ConsignorView } from "@/lib/consignor-view";
import styles from "./KitGrid.module.css";

/**
 * My kit (spec §3.2): what each item earned the consignor (their share, before VAT), one column per published
 * month, newest first, with the lifetime total pinned on the right. The latest month and the total are tinted
 * (Jamie, 17 Nov 2026). On a phone the table scrolls sideways with the item names and total held in place.
 */
export default function KitGrid({ view }: { view: Pick<ConsignorView, "months" | "firstMonth" | "kit"> }) {
  const front = view.months[0];
  const monthTotal = (m: string) => view.kit.reduce((a, k) => a + (k.byMonth[m] ?? 0), 0);
  const lifetime = view.kit.reduce((a, k) => a + k.totalPence, 0);
  return (
    <div>
      <h1>My kit</h1>
      <p className="sub">
        What each item earned you, your share before VAT
        {view.firstMonth ? `, since ${monthName(view.firstMonth)}` : ""}.
      </p>
      {view.kit.length === 0 ? (
        <p className="empty">Nothing to show yet.</p>
      ) : (
        <div className={`tableWrap ${styles.wrap}`}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.item}>Item</th>
                {view.months.map((m) => (
                  <th key={m} className={`num ${m === front ? styles.front : ""}`} title={monthName(m)}>
                    {monthShort(m)}
                  </th>
                ))}
                <th className={`num ${styles.total}`}>Lifetime</th>
              </tr>
            </thead>
            <tbody>
              {view.kit.map((k) => (
                <tr key={k.name}>
                  <td className={styles.item} title={k.name}>
                    {k.name}
                  </td>
                  {view.months.map((m) => (
                    <td key={m} className={`num ${m === front ? styles.front : ""}`}>
                      {k.byMonth[m] ? pounds(k.byMonth[m]) : <span className={styles.none}>–</span>}
                    </td>
                  ))}
                  <td className={`num ${styles.total}`}>{pounds(k.totalPence)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td className={styles.item}>All kit</td>
                {view.months.map((m) => (
                  <td key={m} className={`num ${m === front ? styles.front : ""}`}>
                    {pounds(monthTotal(m))}
                  </td>
                ))}
                <td className={`num ${styles.total}`}>{pounds(lifetime)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
      <p className="note">Item totals are before any deductions, so they can differ from your statements&apos; net payout.</p>
    </div>
  );
}
