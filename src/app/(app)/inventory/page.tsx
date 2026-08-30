import Link from "next/link";
import { requireUser } from "@/lib/session";
import { getItemCatalog } from "@/lib/game";
import { getInventory, getCreds } from "@/lib/inventory";
import { Markdown } from "@/components/Markdown";

const TYPE_ORDER = ["keycard", "fragment", "loot", "trophy"];
const TYPE_LABEL: Record<string, string> = {
  keycard: "🔑 keycards",
  fragment: "🧩 fragments",
  loot: "💾 loot",
  trophy: "🏆 trophies",
};

export default async function InventoryPage() {
  const user = await requireUser();
  const [entries, creds, catalog] = await Promise.all([
    getInventory(user.id),
    getCreds(user.id),
    getItemCatalog(user.eventId),
  ]);

  const held = entries
    .filter((e) => e.itemKey !== "cred" && e.quantity > 0)
    .map((e) => ({ entry: e, item: catalog.get(e.itemKey) }))
    .sort(
      (a, b) =>
        TYPE_ORDER.indexOf(a.item?.type ?? "loot") -
          TYPE_ORDER.indexOf(b.item?.type ?? "loot") ||
        (a.item?.name ?? "").localeCompare(b.item?.name ?? ""),
    );

  const groups = TYPE_ORDER.map((t) => ({
    type: t,
    items: held.filter((h) => (h.item?.type ?? "loot") === t),
  })).filter((g) => g.items.length);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <div className="kicker">{"// the satchel"}</div>
          <h1 className="mt-1 font-display text-2xl font-bold">Inventory</h1>
        </div>
        <span className="hud-chip text-signal">💰 {creds} creds</span>
      </div>

      {groups.length === 0 && (
        <p className="panel p-4 text-sm text-ink-dim">
          Empty. Crack some rooms — they drop loot.
        </p>
      )}

      {groups.map((g) => (
        <section key={g.type}>
          <div className="kicker">{TYPE_LABEL[g.type] ?? g.type}</div>
          <div className="mt-2 space-y-2">
            {g.items.map(({ entry, item }) => (
              <div key={entry.itemKey} className="panel p-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold">
                    {item?.icon ?? "📦"} {item?.name ?? entry.itemKey}
                  </span>
                  {entry.quantity > 1 && (
                    <span className="text-sm text-ink-dim">×{entry.quantity}</span>
                  )}
                </div>
                {item?.descriptionMd && (
                  <Markdown className="mt-1 text-sm text-ink-dim">
                    {item.descriptionMd}
                  </Markdown>
                )}
              </div>
            ))}
          </div>
        </section>
      ))}

      <Link href="/market" className="btn">
        take it to the Shop →
      </Link>
    </div>
  );
}
