import Link from "next/link";
import { redirect } from "next/navigation";
import { listMonthIds } from "@/lib/store";
import { monthName } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function Months() {
  const months = await listMonthIds();
  if (months.length === 1) redirect(`/admin/months/${months[0]}`);
  return (
    <div>
      <h1>Months</h1>
      {months.length === 0 ? (
        <p className="empty">No months yet. The first draft is built on the 1st of the month from Rentman.</p>
      ) : (
        <ul>
          {months.map((m) => (
            <li key={m}>
              <Link href={`/admin/months/${m}`}>{monthName(m)}</Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
