"use client";

import { useState, useEffect } from "react";

const ROWS = 8;
const COLS = 8;
const MINES = 10;

type Cell = {
  r: number;
  c: number;
  isMine: boolean;
  isRevealed: boolean;
  isFlagged: boolean;
  neighborMines: number;
};

export function Minesweeper() {
  const [grid, setGrid] = useState<Cell[][]>([]);
  const [gameOver, setGameOver] = useState(false);
  const [gameWon, setGameWon] = useState(false);
  const [flag, setFlag] = useState("");
  const [minesLeft, setMinesLeft] = useState(MINES);

  useEffect(() => {
    resetGame();
  }, []);

  function resetGame() {
    let newGrid: Cell[][] = Array(ROWS).fill(null).map((_, r) =>
      Array(COLS).fill(null).map((_, c) => ({
        r, c, isMine: false, isRevealed: false, isFlagged: false, neighborMines: 0
      }))
    );

    let placed = 0;
    while (placed < MINES) {
      const r = Math.floor(Math.random() * ROWS);
      const c = Math.floor(Math.random() * COLS);
      if (!newGrid[r]![c]!.isMine) {
        newGrid[r]![c]!.isMine = true;
        placed++;
      }
    }

    const dirs = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (newGrid[r]![c]!.isMine) continue;
        let count = 0;
        dirs.forEach(([dr, dc]) => {
          const nr = r + dr;
          const nc = c + dc;
          if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS && newGrid[nr]![nc]!.isMine) {
            count++;
          }
        });
        newGrid[r]![c]!.neighborMines = count;
      }
    }

    setGrid(newGrid);
    setGameOver(false);
    setGameWon(false);
    setFlag("");
    setMinesLeft(MINES);
  }

  function reveal(r: number, c: number) {
    if (gameOver || gameWon || grid[r]![c]!.isRevealed || grid[r]![c]!.isFlagged) return;

    let newGrid = [...grid.map(row => [...row])];
    
    if (newGrid[r]![c]!.isMine) {
      // Game Over
      newGrid.forEach(row => row.forEach(cell => { if (cell.isMine) cell.isRevealed = true; }));
      setGrid(newGrid);
      setGameOver(true);
      return;
    }

    // BFS Reveal
    const queue = [[r, c]];
    while (queue.length > 0) {
      const [currR, currC] = queue.shift()!;
      const cell = newGrid[currR]![currC]!;
      if (cell.isRevealed || cell.isFlagged) continue;
      
      cell.isRevealed = true;
      
      if (cell.neighborMines === 0) {
        const dirs = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
        dirs.forEach(([dr, dc]) => {
          const nr = currR + dr;
          const nc = currC + dc;
          if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS) {
            queue.push([nr, nc]);
          }
        });
      }
    }

    setGrid(newGrid);
    checkWin(newGrid);
  }

  function toggleFlag(e: React.MouseEvent, r: number, c: number) {
    e.preventDefault();
    if (gameOver || gameWon || grid[r]![c]!.isRevealed) return;

    let newGrid = [...grid.map(row => [...row])];
    const cell = newGrid[r]![c]!;
    
    if (cell.isFlagged) {
      cell.isFlagged = false;
      setMinesLeft(prev => prev + 1);
    } else {
      if (minesLeft > 0) {
        cell.isFlagged = true;
        setMinesLeft(prev => prev - 1);
      }
    }

    setGrid(newGrid);
    checkWin(newGrid);
  }

  function checkWin(currentGrid: Cell[][]) {
    let unrevealedSafeCells = 0;
    currentGrid.forEach(row => row.forEach(cell => {
      if (!cell.isMine && !cell.isRevealed) {
        unrevealedSafeCells++;
      }
    }));

    if (unrevealedSafeCells === 0) {
      setGameWon(true);
      setFlag("CMINUS{M1N3_SW33P3R}");
    }
  }

  return (
    <div className="border border-border p-4 bg-[#05070a] mt-4 w-full max-w-sm">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-bold text-accent">Firewall Sweeper</h2>
        <span className="text-sm text-signal font-mono font-bold">MINES: {String(minesLeft).padStart(3, '0')}</span>
      </div>

      <div className="grid border-border w-fit mx-auto border-t border-l" style={{ gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))` }}>
        {grid.map((row, r) =>
          row.map((cell, c) => (
            <button
              key={`${r}-${c}`}
              onClick={() => reveal(r, c)}
              onContextMenu={(e) => toggleFlag(e, r, c)}
              className={`w-8 h-8 sm:w-10 sm:h-10 border-b border-r border-border flex items-center justify-center font-bold text-lg transition-colors
                ${cell.isRevealed 
                  ? (cell.isMine ? "bg-signal text-bg" : "bg-[#0a0f17] text-accent") 
                  : "bg-border hover:bg-border/80 text-ink"
                }`}
            >
              {cell.isRevealed ? (
                cell.isMine ? "💣" : (cell.neighborMines > 0 ? cell.neighborMines : "")
              ) : (
                cell.isFlagged ? "🚩" : ""
              )}
            </button>
          ))
        )}
      </div>

      <div className="mt-4 flex gap-2 justify-center">
        <button onClick={resetGame} className="px-4 py-2 border border-border text-xs hover:border-accent hover:text-accent transition-colors w-full font-bold">
          {gameOver ? "REBOOT SYSTEM" : (gameWon ? "PLAY AGAIN" : "RESET")}
        </button>
      </div>

      {flag && <div className="mt-4 p-2 bg-accent/20 text-accent font-bold text-center">SYSTEM ALERT: {flag}</div>}
    </div>
  );
}
