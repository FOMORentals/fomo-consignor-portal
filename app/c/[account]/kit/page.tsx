import { load } from "../data";
import KitGrid from "@/components/KitGrid";

/** My kit (spec §3.2): see components/KitGrid. */
export default async function Kit({ params }: { params: Promise<{ account: string }> }) {
  const { account: id } = await params;
  const { view } = await load(id);
  return <KitGrid view={view} />;
}
