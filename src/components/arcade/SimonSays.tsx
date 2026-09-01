"use client";

import { useState, useEffect, useRef } from "react";

const SEQUENCE_LENGTH = 6;
const COLORS = [
  { id: 0, color: "bg-red-500", glow: "shadow-[0_0_20px_rgba(239,68,68,1)]" },
  { id: 1, color: "bg-blue-500", glow: "shadow-[0_0_20px_rgba(59,130,246,1)]" },
  { id: 2, color: "bg-green-500", glow: "shadow-[0_0_20px_rgba(16,185,129,1)]" },
  { id: 3, color: "bg-yellow-500", glow: "shadow-[0_0_20px_rgba(234,179,8,1)]" },
];

export function SimonSays() {
  const [sequence, setSequence] = useState<number[]>([]);
  const [playerInput, setPlayerInput] = useState<number[]>([]);
  const [playing, setPlaying] = useState(false);
  const [showingSequence, setShowingSequence] = useState(false);
  const [activeColor, setActiveColor] = useState<number | null>(null);
  const [flag, setFlag] = useState("");
  const [gameOver, setGameOver] = useState(false);
  const [level, setLevel] = useState(0);

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function startGame() {
    setSequence([]);
    setPlayerInput([]);
    setPlaying(true);
    setGameOver(false);
    setFlag("");
    setLevel(1);
    nextRound([]);
  }

  function nextRound(currentSeq: number[]) {
    const nextSeq = [...currentSeq, Math.floor(Math.random() * 4)];
    setSequence(nextSeq);
    setPlayerInput([]);
    playSequence(nextSeq);
  }

  function playSequence(seq: number[]) {
    setShowingSequence(true);
    let i = 0;
    
    function flashNext() {
      if (i >= seq.length) {
        setShowingSequence(false);
        setActiveColor(null);
        return;
      }
      setActiveColor(seq[i]!);
      timeoutRef.current = setTimeout(() => {
        setActiveColor(null);
        timeoutRef.current = setTimeout(() => {
          i++;
          flashNext();
        }, 200);
      }, 500);
    }
    
    timeoutRef.current = setTimeout(flashNext, 500);
  }

  function handleColorClick(id: number) {
    if (!playing || showingSequence || gameOver) return;

    setActiveColor(id);
    setTimeout(() => setActiveColor(null), 200);

    const newInput = [...playerInput, id];
    setPlayerInput(newInput);

    // Check if correct so far
    const isCorrect = newInput.every((val, idx) => val === sequence[idx]);

    if (!isCorrect) {
      setGameOver(true);
      setPlaying(false);
      return;
    }

    if (newInput.length === sequence.length) {
      if (sequence.length >= SEQUENCE_LENGTH) {
        setFlag("CMINUS{S1M0N_H4CK3D}");
        setPlaying(false);
      } else {
        setLevel(l => l + 1);
        setTimeout(() => nextRound(sequence), 1000);
      }
    }
  }

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return (
    <div className="border border-border p-4 bg-[#05070a] mt-4 w-full max-w-sm">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-bold text-accent">Security Override (Simon)</h2>
        <span className="text-sm text-ink-dim">Level: {level} / {SEQUENCE_LENGTH}</span>
      </div>
      
      <div className="grid grid-cols-2 gap-4 p-4 aspect-square">
        {COLORS.map(c => (
          <button
            key={c.id}
            onClick={() => handleColorClick(c.id)}
            disabled={!playing || showingSequence}
            className={`rounded-lg transition-all duration-150 ${c.color} ${activeColor === c.id ? `opacity-100 ${c.glow} scale-95` : "opacity-40"}`}
          />
        ))}
      </div>

      <div className="mt-4 flex gap-2 justify-between items-center min-h-10">
        {!playing && !flag && (
          <button onClick={startGame} className="px-4 py-2 border border-accent text-accent hover:bg-accent/20 w-full font-bold transition-colors">
            {gameOver ? "ACCESS DENIED - RETRY" : "INITIATE OVERRIDE"}
          </button>
        )}
        {playing && showingSequence && <span className="text-signal text-sm animate-pulse w-full text-center">OBSERVE PATTERN...</span>}
        {playing && !showingSequence && <span className="text-accent text-sm w-full text-center">INPUT PATTERN...</span>}
      </div>

      {flag && <div className="mt-4 p-2 bg-accent/20 text-accent font-bold text-center">SYSTEM ALERT: {flag}</div>}
    </div>
  );
}
