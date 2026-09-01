"use client";

import { useState, useEffect } from "react";

const EMOJIS = ["💾", "👾", "🔋", "📟", "💻", "🔌", "📡", "🖱️"];

export function MemoryMatch() {
  const [cards, setCards] = useState<{ id: number; emoji: string; flipped: boolean; matched: boolean }[]>([]);
  const [flippedIds, setFlippedIds] = useState<number[]>([]);
  const [turns, setTurns] = useState(0);
  const [flag, setFlag] = useState("");

  useEffect(() => {
    resetGame();
  }, []);

  function resetGame() {
    const shuffled = [...EMOJIS, ...EMOJIS]
      .sort(() => Math.random() - 0.5)
      .map((emoji, idx) => ({ id: idx, emoji, flipped: false, matched: false }));
    setCards(shuffled);
    setFlippedIds([]);
    setTurns(0);
    setFlag("");
  }

  function handleCardClick(id: number) {
    if (flippedIds.length === 2) return;
    const card = cards.find(c => c.id === id);
    if (!card || card.flipped || card.matched) return;

    const newFlipped = [...flippedIds, id];
    setFlippedIds(newFlipped);
    setCards(cards.map(c => c.id === id ? { ...c, flipped: true } : c));

    if (newFlipped.length === 2) {
      setTurns(t => t + 1);
      const c1 = cards.find(c => c.id === newFlipped[0]);
      const c2 = { emoji: card.emoji };
      
      if (c1?.emoji === c2.emoji) {
        // match
        setCards(prev => {
          const next = prev.map(c => newFlipped.includes(c.id) ? { ...c, matched: true } : c);
          if (next.every(c => c.matched)) {
            setFlag("CMINUS{M3M0RY_M4TCH}");
          }
          return next;
        });
        setFlippedIds([]);
      } else {
        // no match
        setTimeout(() => {
          setCards(prev => prev.map(c => newFlipped.includes(c.id) ? { ...c, flipped: false } : c));
          setFlippedIds([]);
        }, 1000);
      }
    }
  }

  return (
    <div className="border border-border p-4 bg-[#05070a] mt-4 w-full max-w-md">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-bold text-accent">Memory Match</h2>
        <span className="text-sm text-ink-dim">Turns: {turns}</span>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {cards.map(c => (
          <button
            key={c.id}
            onClick={() => handleCardClick(c.id)}
            className={`h-16 sm:h-20 flex items-center justify-center text-3xl border transition-all duration-300 ${c.flipped || c.matched ? "bg-bg border-accent" : "bg-border border-border/50"}`}
            style={{ transform: c.flipped || c.matched ? "rotateY(0deg)" : "rotateY(180deg)" }}
          >
            <span className={c.flipped || c.matched ? "opacity-100" : "opacity-0"}>{c.emoji}</span>
          </button>
        ))}
      </div>
      <div className="mt-4 flex gap-2">
        <button onClick={resetGame} className="px-3 py-1 border border-border text-xs hover:border-accent hover:text-accent transition-colors">Restart</button>
      </div>
      {flag && <div className="mt-4 p-2 bg-accent/20 text-accent font-bold text-center">SYSTEM ALERT: {flag}</div>}
    </div>
  );
}
