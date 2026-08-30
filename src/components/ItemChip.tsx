import type { Item } from "@prisma/client";

const typeColor: Record<string, string> = {
  cred: "border-signal/40 text-signal",
  keycard: "border-accent/40 text-accent",
  fragment: "border-accent-magenta/40 text-accent-magenta",
  loot: "border-border text-ink",
  trophy: "border-signal/40 text-signal",
};

export function ItemChip({
  item,
  qty,
  fallbackKey,
}: {
  item?: Item | null;
  qty: number;
  fallbackKey?: string;
}) {
  const icon = item?.icon ?? "📦";
  const name = item?.name ?? fallbackKey ?? "unknown item";
  const cls = typeColor[item?.type ?? "loot"] ?? "border-border text-ink";
  return (
    <span
      className={`inline-flex items-center gap-1 border px-1.5 py-0.5 text-xs ${cls}`}
      title={item?.descriptionMd || name}
    >
      <span>{icon}</span>
      <span>{name}</span>
      {qty > 1 && <span className="opacity-70">×{qty}</span>}
    </span>
  );
}
