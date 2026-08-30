import { requireUser } from "@/lib/session";
import { listTrades } from "@/lib/trade";
import { getCreds } from "@/lib/inventory";
import { Markdown } from "@/components/Markdown";
import { TradeList, type ItemInfo } from "@/components/TradeList";

export default async function MarketPage() {
  const user = await requireUser();
  const [data, creds] = await Promise.all([
    listTrades(user.id, user.eventId, "shop"),
    getCreds(user.id),
  ]);

  if (!data) {
    return (
      <div className="mx-auto max-w-2xl">
        <p className="panel p-4 text-sm text-ink-dim">No Shop in this event.</p>
      </div>
    );
  }

  const catalog: Record<string, ItemInfo> = {};
  for (const [k, it] of data.catalog)
    catalog[k] = { icon: it.icon, name: it.name, type: it.type };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="panel p-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="kicker">{"// requisitions"}</div>
            <h1 className="mt-1 font-display text-2xl font-bold">
              {data.npc.icon} {data.npc.name}
            </h1>
          </div>
          <span className="hud-chip text-signal">💰 {creds}</span>
        </div>
        {data.npc.blurbMd && (
          <Markdown className="mt-2 text-sm text-ink-dim">{data.npc.blurbMd}</Markdown>
        )}
      </div>

      <TradeList trades={data.trades} catalog={catalog} />
    </div>
  );
}
