"use client";

import { useSyncExternalStore } from "react";
import { DungeonMap } from "@/components/DungeonMap";
import { ModuleCard } from "@/components/ModuleCard";
import type { ModuleCardView } from "@/lib/game";

const KEY = "pb:roomsview";
const listeners = new Set<() => void>();

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
function readView(): "map" | "list" {
  try {
    return localStorage.getItem(KEY) === "list" ? "list" : "map";
  } catch {
    return "map";
  }
}
function writeView(v: "map" | "list") {
  try {
    localStorage.setItem(KEY, v);
  } catch {}
  listeners.forEach((l) => l());
}

export function RoomsView({ cards }: { cards: ModuleCardView[] }) {
  const view = useSyncExternalStore(subscribe, readView, () => "map" as const);
  const set = writeView;

  return (
    <div>
      <div className="mb-3 flex items-center gap-1 text-xs">
        {(["map", "list"] as const).map((v) => (
          <button
            key={v}
            onClick={() => set(v)}
            className={`border px-2 py-1 transition-colors ${
              view === v
                ? "border-accent text-accent"
                : "border-border text-ink-dim hover:border-border-bright"
            }`}
          >
            {v}
          </button>
        ))}
      </div>

      {view === "map" ? (
        <div className="panel p-3 sm:p-4">
          <DungeonMap rooms={cards} />
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((m) => (
            <ModuleCard key={m.slug} m={m} />
          ))}
        </div>
      )}
    </div>
  );
}
