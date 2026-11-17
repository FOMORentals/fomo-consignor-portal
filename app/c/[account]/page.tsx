import Link from "next/link";
import { load } from "./data";
import { monthName, pounds } from "@/lib/format";

/** Overview (spec §3.1): what they earned in the latest published month, this year and since January 2026. */
export default async function Overview({ params }: { params: Promise<{ account: string }> }) {
  const { account: id } = await params;
  const { account, view } = await load(id);
  if (!view.latest) {
    return (
      <div>
        <h1>Overview</h1>
        <p className="empty">Your first statement will appear here once FOMO publishes the month.</p>
      </div>
    );
  }
  const year = view.latest.month.slice(0, 4);
  return (
    <div>
      <h1>Overview</h1>
      <p className="sub">Your payouts before VAT. Figures change only when FOMO publishes a month.</p>
      <div className="tiles">
        <div className="tile">
          <div className="label">{monthName(view.latest.month)}</div>
          <div className="value">{pounds(view.latestNet)}</div>
        </div>
        <div className="tile">
          <div className="label">{year} so far</div>
          <div className="value">{pounds(view.yearNet)}</div>
        </div>
        <div className="tile">
          <div className="label">Since January 2026</div>
          <div className="value">{pounds(view.allNet)}</div>
        </div>
      </div>
      <p>
        <Link href={`/c/${account.id}/statements/${view.latest.month}`}>See the {monthName(view.latest.month)} statement</Link> ·{" "}
        <Link href={`/c/${account.id}/kit`}>What each item earned</Link>
      </p>
    </div>
  );
}
