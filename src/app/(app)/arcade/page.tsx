"use client";

import { useState, useEffect, useRef } from "react";
import { MemoryMatch } from "@/components/arcade/MemoryMatch";
import { SnakeGame } from "@/components/arcade/SnakeGame";
import { SimonSays } from "@/components/arcade/SimonSays";
import { TicTacToe } from "@/components/arcade/TicTacToe";
import { Minesweeper } from "@/components/arcade/Minesweeper";

// --- RPS GAME ---
function RPSGame() {
  const [wins, setWins] = useState(0);
  const [msg, setMsg] = useState("Choose your weapon!");
  const [flag, setFlag] = useState("");

  function play(choice: string) {
    const choices = ["rock", "paper", "scissors"];
    const cChoice = choices[Math.floor(Math.random() * 3)];
    if (choice === cChoice) {
      setMsg(`Tie! We both chose ${choice}. Streak: ${wins}`);
    } else if (
      (choice === "rock" && cChoice === "scissors") ||
      (choice === "paper" && cChoice === "rock") ||
      (choice === "scissors" && cChoice === "paper")
    ) {
      const newWins = wins + 1;
      setWins(newWins);
      setMsg(`Win! CPU chose ${cChoice}. Streak: ${newWins}`);
      if (newWins >= 3) {
        setFlag("CMINUS{G4M3R_M0D3_4CT1V4T3D}");
        setWins(0);
      }
    } else {
      setWins(0);
      setMsg(`Lose! CPU chose ${cChoice}. Streak: 0`);
    }
  }

  return (
    <div className="border border-border p-4 bg-[#05070a]">
      <h2 className="text-lg font-bold text-accent mb-2">Rock Paper Scissors</h2>
      <p className="text-sm text-ink-dim mb-4">Win 3 times in a row to get the flag.</p>
      <div className="flex gap-2 mb-4">
        {["rock", "paper", "scissors"].map((c) => (
          <button
            key={c}
            onClick={() => play(c)}
            className="px-4 py-2 border border-border hover:border-accent text-ink transition-colors"
          >
            {c}
          </button>
        ))}
      </div>
      <p className="text-ink">{msg}</p>
      {flag && <div className="mt-4 p-2 bg-accent/20 text-accent font-bold">SYSTEM ALERT: {flag}</div>}
    </div>
  );
}

// --- JUMPER GAME ---
function JumperGame() {
  const [score, setScore] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [flag, setFlag] = useState("");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const state = useRef({
    playerY: 0,
    velocity: 0,
    obsX: 400,
    score: 0,
    gameover: false,
  });

  useEffect(() => {
    if (!playing) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    
    let req: number;
    function loop() {
      if (state.current.gameover) return;
      
      // Update
      state.current.velocity += 0.6; // gravity
      state.current.playerY += state.current.velocity;
      if (state.current.playerY > 100) {
        state.current.playerY = 100;
        state.current.velocity = 0;
      }
      
      state.current.obsX -= 5;
      if (state.current.obsX < -20) {
        state.current.obsX = 400;
        state.current.score++;
        setScore(state.current.score);
        if (state.current.score >= 10) {
          setFlag("CMINUS{JUMP_4R0UND}");
          setPlaying(false);
          return;
        }
      }
      
      // Collision
      const pRect = { x: 50, y: state.current.playerY, w: 20, h: 20 };
      const oRect = { x: state.current.obsX, y: 100, w: 20, h: 20 };
      if (pRect.x < oRect.x + oRect.w && pRect.x + pRect.w > oRect.x &&
          pRect.y < oRect.y + oRect.h && pRect.y + pRect.h > oRect.y) {
        state.current.gameover = true;
        setPlaying(false);
      }
      
      // Draw
      ctx!.fillStyle = "#05070a";
      ctx!.fillRect(0, 0, 400, 150);
      
      ctx!.fillStyle = "#4ade80"; // accent
      ctx!.fillRect(pRect.x, pRect.y, pRect.w, pRect.h);
      
      ctx!.fillStyle = "#f87171"; // red
      ctx!.fillRect(oRect.x, oRect.y, oRect.w, oRect.h);
      
      req = requestAnimationFrame(loop);
    }
    req = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(req);
  }, [playing]);

  function jump() {
    if (!playing) {
      state.current = { playerY: 100, velocity: 0, obsX: 400, score: 0, gameover: false };
      setScore(0);
      setFlag("");
      setPlaying(true);
    } else {
      if (state.current.playerY >= 100) {
        state.current.velocity = -10;
      }
    }
  }

  return (
    <div className="border border-border p-4 bg-[#05070a] mt-4">
      <h2 className="text-lg font-bold text-accent mb-2">Block Jumper</h2>
      <p className="text-sm text-ink-dim mb-4">Click inside the game to jump. Score 10 to win.</p>
      <div className="mb-2 text-ink">Score: {score}</div>
      <div className="relative inline-block" onClick={jump}>
        <canvas ref={canvasRef} width={400} height={150} className="border border-border cursor-pointer block" />
        {!playing && !flag && (
          <div className="absolute inset-0 flex items-center justify-center bg-bg/50">
            <button className="px-4 py-2 border border-accent text-accent">Play</button>
          </div>
        )}
      </div>
      {flag && <div className="mt-4 p-2 bg-accent/20 text-accent font-bold">SYSTEM ALERT: {flag}</div>}
    </div>
  );
}

// --- SUDOKU GAME ---
const initialSudoku = [
  [5, 3, 0, 0, 7, 0, 0, 0, 0],
  [6, 0, 0, 1, 9, 5, 0, 0, 0],
  [0, 9, 8, 0, 0, 0, 0, 6, 0],
  [8, 0, 0, 0, 6, 0, 0, 0, 3],
  [4, 0, 0, 8, 0, 3, 0, 0, 1],
  [7, 0, 0, 0, 2, 0, 0, 0, 6],
  [0, 6, 0, 0, 0, 0, 2, 8, 0],
  [0, 0, 0, 4, 1, 9, 0, 0, 5],
  [0, 0, 0, 0, 8, 0, 0, 7, 9],
];

const solutionSudoku = [
  [5, 3, 4, 6, 7, 8, 9, 1, 2],
  [6, 7, 2, 1, 9, 5, 3, 4, 8],
  [1, 9, 8, 3, 4, 2, 5, 6, 7],
  [8, 5, 9, 7, 6, 1, 4, 2, 3],
  [4, 2, 6, 8, 5, 3, 7, 9, 1],
  [7, 1, 3, 9, 2, 4, 8, 5, 6],
  [9, 6, 1, 5, 3, 7, 2, 8, 4],
  [2, 8, 7, 4, 1, 9, 6, 3, 5],
  [3, 4, 5, 2, 8, 6, 1, 7, 9],
];

function SudokuGame() {
  const [grid, setGrid] = useState(initialSudoku);
  const [flag, setFlag] = useState("");

  function checkWin(g: number[][]) {
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (g[r]![c] !== solutionSudoku[r]![c]) return;
      }
    }
    setFlag("CMINUS{SUD0KU_M4ST3R}");
  }

  function handleInput(r: number, c: number, val: string) {
    const n = parseInt(val) || 0;
    const newGrid = grid.map((row, i) =>
      row.map((cell, j) => (i === r && j === c ? n : cell))
    );
    setGrid(newGrid);
    checkWin(newGrid);
  }

  return (
    <div className="border border-border p-4 bg-[#05070a] mt-4">
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-lg font-bold text-accent">Sudoku</h2>
        <button 
          onClick={() => { setGrid(solutionSudoku); checkWin(solutionSudoku); }}
          className="text-xs px-2 py-1 border border-border text-ink-dim hover:text-accent hover:border-accent transition-colors"
        >
          I give up (Solve for me)
        </button>
      </div>
      <p className="text-sm text-ink-dim mb-4">Fill in the missing numbers (1-9). The puzzle checks automatically.</p>
      <div className="grid grid-cols-9 gap-0 border border-border w-fit">
        {grid.map((row, r) =>
          row.map((val, c) => (
            <input
              key={`${r}-${c}`}
              value={val === 0 ? "" : val}
              readOnly={initialSudoku[r]![c] !== 0}
              onChange={(e) => handleInput(r, c, e.target.value)}
              maxLength={1}
              className={`w-8 h-8 text-center outline-none border border-border/50 ${
                initialSudoku[r]![c] !== 0 ? "bg-bg text-ink-dim" : "bg-transparent text-ink"
              } ${(r % 3 === 2) ? "border-b-border border-b-2" : ""} ${(c % 3 === 2) ? "border-r-border border-r-2" : ""}`}
            />
          ))
        )}
      </div>
      {flag && <div className="mt-4 p-2 bg-accent/20 text-accent font-bold">SYSTEM ALERT: {flag}</div>}
    </div>
  );
}

// --- UNIFIED SUBMITTER ---
function ArcadeSubmitter() {
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim() || busy) return;
    
    // Determine slug from code
    let val = code.trim().toUpperCase();
    // Auto-wrap if they forgot CMINUS{}
    if (!val.startsWith("CMINUS{")) {
      val = `CMINUS{${val}}`;
    }
    if (!val.endsWith("}")) {
      val = `${val}}`;
    }
    
    let slug = "";
    if (val === "CMINUS{UP_UP_DOWN_DOWN_LEFT_RIGHT_LEFT_RIGHT_B_A}") slug = "cheat-code";
    else if (val === "CMINUS{G4M3R_M0D3_4CT1V4T3D}") slug = "mini-game";
    else if (val === "CMINUS{JUMP_4R0UND}") slug = "jumper";
    else if (val === "CMINUS{SUD0KU_M4ST3R}") slug = "sudoku";
    else if (val === "CMINUS{M3M0RY_M4TCH}") slug = "memory-match";
    else if (val === "CMINUS{SN4K3_CH4RM3R}") slug = "snake-game";
    else if (val === "CMINUS{S1M0N_H4CK3D}") slug = "simon-says";
    else if (val === "CMINUS{T1C_T4C_W1N}") slug = "tic-tac-toe";
    else if (val === "CMINUS{M1N3_SW33P3R}") slug = "minesweeper";
    else if (val === "CMINUS{READ_THE_MANUAL}") slug = "arcade-code";
    else {
      setMsg("Invalid arcade code.");
      return;
    }

    setBusy(true);
    setMsg("Submitting...");
    try {
      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ puzzleSlug: slug, value: val }),
      });
      const data = await res.json();
      if (res.status === 429) {
        setMsg("Slow down — submitting too fast.");
      } else if (!data.outcome) {
        setMsg(data.error ?? "Something went wrong.");
      } else if (data.outcome.status === "correct") {
        setMsg("Correct! Points awarded.");
      } else if (data.outcome.status === "already_solved") {
        setMsg("You already solved this one!");
      } else {
        setMsg("Incorrect code.");
      }
    } catch (err) {
      setMsg("Network error.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 items-center">
      <input 
        type="text" 
        value={code}
        onChange={e => setCode(e.target.value)}
        placeholder="Paste your CMINUS{...} flag here"
        className="flex-1 bg-[#05070a] border border-border px-3 py-1.5 text-ink outline-none focus:border-accent max-w-sm"
      />
      <button type="submit" disabled={busy} className="px-4 py-1.5 bg-accent text-bg font-bold hover:bg-accent-amber transition-colors disabled:opacity-50">
        {busy ? "..." : "Submit"}
      </button>
      {msg && <span className="text-sm text-ink-dim ml-2">{msg}</span>}
    </form>
  );
}

export default function ArcadePage() {
  return (
    <div>
      <h1 className="text-2xl font-bold tracking-wider text-accent mb-6">ARCADE</h1>
      
      <div className="bg-bg border border-accent p-4 mb-8">
        <h3 className="font-bold text-accent mb-1">How to get points:</h3>
        <p className="text-ink-dim text-sm mb-4">
          Play the games below. When you win, a <strong className="text-accent">SYSTEM ALERT</strong> will appear with a secret flag. You can submit that flag right here to claim your points!
        </p>
        <ArcadeSubmitter />
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <RPSGame />
        <JumperGame />
        <SudokuGame />
        <MemoryMatch />
        <SnakeGame />
        <SimonSays />
        <TicTacToe />
        <Minesweeper />
      </div>
    </div>
  );
}
