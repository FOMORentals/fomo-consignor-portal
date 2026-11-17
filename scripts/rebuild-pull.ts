/**
 * Step 1 of the consignor portal (docs/SPEC.md §8): pull, once, everything needed to rebuild
 * Jan–Oct 2026 consignor revenue from Rentman, and save it to data/ for offline comparison
 * with the Consignment Tracker 2026 ("Report - Consignment (dont delete)" in Rentman).
 *
 * READ ONLY. Every call goes through the shared guard (rule 4). If the circuit is open the
 * script exits 2 before any read.
 *
 * Call budget for one run (rule 4), all list calls at 1500 a page:
 *   /statuses               1
 *   /equipment              ~3   (custom fields come back on the list endpoint: probed by fomo-kit-onboarding, 5 Oct 2026)
 *   /subprojects            ~9
 *   /projectequipmentgroup  ~30  (created since PULL_FROM)
 *   /projectequipment       ~140 (created since PULL_FROM; filtered to consignor kit before saving)
 * About 185 GETs, one at a time, 200 ms apart: a few minutes. Run it once, not on a schedule.
 *
 * Run (on Jamie's Mac, with RENTMAN_TOKEN set and gcloud application-default credentials):
 *   npm run rebuild:pull
 * Output: data/rebuild-pull-<timestamp>.json (git-ignored).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { isRentmanCircuitOpen, rentmanGet, callCount } from "@fomo/rentman-core/rentman-guard";

const BASE_URL = "https://api.rentman.net";
const PAGE = 1500;
/** Lines for 2026 hires can be booked months ahead; start well before January. */
const PULL_FROM = "2025-06-01T00:00:00+00:00";
/** Rentman custom field "Consigned" holds the owner's initials. */
const CONSIGNED_FIELD = "custom_4";

type Row = Record<string, unknown> & { id: number };

async function pageAll(path: string, fields: string, filter: Record<string, string> = {}): Promise<Row[]> {
  const out: Row[] = [];
  const extra = Object.entries(filter)
    .map(([k, v]) => `&${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("");
  for (let offset = 0; ; ) {
    const url = `${BASE_URL}${path}?fields=${fields}&limit=${PAGE}&offset=${offset}&sort=%2Bid${extra}`;
    const r = await rentmanGet(url);
    if (!r.ok) throw new Error(`GET ${path} failed: ${r.status} ${(await r.text()).slice(0, 300)}`);
    const page = (await r.json()) as { data: Row[]; limit?: number };
    out.push(...page.data);
    const size = Number(page.limit) > 0 ? Math.min(Number(page.limit), PAGE) : PAGE;
    process.stdout.write(`  ${path}: ${out.length}\r`);
    if (page.data.length === 0 || page.data.length < size) break;
    offset += page.data.length;
  }
  process.stdout.write(`  ${path}: ${out.length} rows\n`);
  return out;
}

function idOf(link: unknown): number | null {
  if (typeof link !== "string") return null;
  const n = Number(link.split("/").pop());
  return Number.isFinite(n) ? n : null;
}

async function main() {
  if (await isRentmanCircuitOpen()) {
    console.error("Rentman circuit is open (another app hit the limit). Nothing read. Try again in an hour.");
    process.exit(2);
  }
  const startedAt = new Date().toISOString();

  const statuses = await pageAll("/statuses", "id,name,displayname,type");
  const equipmentAll = await pageAll("/equipment", "id,code,name,type,in_archive,is_combination,current_quantity,custom");
  const equipment = equipmentAll
    .map((e) => ({ ...e, consigned: String((e.custom as Record<string, unknown> | undefined)?.[CONSIGNED_FIELD] ?? "").trim() }))
    .filter((e) => e.consigned !== "");
  const consignorIds = new Set(equipment.map((e) => e.id));
  console.log(`  ${equipment.length} equipment records carry a Consigned code`);

  const subprojects = await pageAll(
    "/subprojects",
    "id,project,status,in_financial,name,discount_rental,discount_subproject,discount_fixed,fixed_price,usageperiod_start,usageperiod_end,planperiod_start,planperiod_end"
  );
  const groups = await pageAll("/projectequipmentgroup", "id,subproject,project,in_price_calculation,usageperiod_start,usageperiod_end", {
    "created[gte]": PULL_FROM,
  });
  const linesAll = await pageAll(
    "/projectequipment",
    "id,equipment,parent,equipment_group,quantity,quantity_total,unit_price,discount,factor,is_option,usageperiod_start,usageperiod_end,planperiod_start,planperiod_end,created",
    { "created[gte]": PULL_FROM }
  );
  // Keep consignor lines, plus every line inside a consignor kit (revenue can sit on a child line).
  const consignorLineIds = new Set(linesAll.filter((l) => consignorIds.has(idOf(l.equipment) ?? -1)).map((l) => l.id));
  const lines = linesAll.filter((l) => consignorLineIds.has(l.id) || consignorLineIds.has(idOf(l.parent) ?? -1));
  const usedGroups = new Set(lines.map((l) => idOf(l.equipment_group)));
  const keptGroups = groups.filter((g) => usedGroups.has(g.id));
  const usedSubs = new Set(keptGroups.map((g) => idOf(g.subproject)));
  const keptSubs = subprojects.filter((s) => usedSubs.has(s.id));

  mkdirSync("data", { recursive: true });
  const file = `data/rebuild-pull-${startedAt.replace(/[:.]/g, "-")}.json`;
  writeFileSync(
    file,
    JSON.stringify({ startedAt, pullFrom: PULL_FROM, rentmanCalls: callCount, statuses, equipment, subprojects: keptSubs, groups: keptGroups, lines }, null, 1)
  );
  console.log(`Saved ${lines.length} lines (${keptSubs.length} subprojects) to ${file}. Rentman calls: ${callCount}.`);
}

main().catch((e) => {
  console.error("rebuild-pull FAILED:", e instanceof Error ? e.message : e);
  process.exit(1);
});
