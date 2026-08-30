import { requireUser } from "@/lib/session";
import { listTrades } from "@/lib/trade";
import { getCreds } from "@/lib/inventory";
import { Markdown } from "@/components/Markdown";
import { TradeList, type ItemInfo } from "@/components/TradeList";

export default async function MarketPage() {
  const user = await requireUser();
  const [data, creds] = await Promise.all([
    listTrades(user.id, user.eventId, "sudo"),
    getCreds(user.id),
  ]);

  if (!data) {
    return (
      <div className="mx-auto max-w-2xl">
        <p className="border border-border bg-panel/60 p-4 text-sm text-ink-dim">
          No vendor in this event.
        </p>
      </div>
    );
  }

  const catalog: Record<string, ItemInfo> = {};
  for (const [k, it] of data.catalog)
    catalog[k] = { icon: it.icon, name: it.name, type: it.type };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="border border-accent-cyan/30 bg-accent-cyan/[0.05] p-5">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight">
            {data.npc.icon} {data.npc.name}
          </h1>
          <span className="text-accent-amber">💰 {creds}</span>
        </div>
        {data.npc.blurbMd && (
          <Markdown className="mt-2 text-sm text-ink-dim">{data.npc.blurbMd}</Markdown>
        )}
      </div>

      <TradeList trades={data.trades} catalog={catalog} />
    </div>
  );
}
