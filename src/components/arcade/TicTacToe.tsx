"use client";

import { useState } from "react";

type Player = "X" | "O" | null;

export function TicTacToe() {
  const [board, setBoard] = useState<Player[]>(Array(9).fill(null));
  const [winner, setWinner] = useState<Player | "Draw">(null);
  const [flag, setFlag] = useState("");
  const [xTurn, setXTurn] = useState(true);

  const checkWinner = (squares: Player[]) => {
    const lines = [
      [0, 1, 2], [3, 4, 5], [6, 7, 8],
      [0, 3, 6], [1, 4, 7], [2, 5, 8],
      [0, 4, 8], [2, 4, 6]
    ];
    for (let i = 0; i < lines.length; i++) {
      const [a, b, c] = lines[i]!;
      if (squares[a] && squares[a] === squares[b] && squares[a] === squares[c]) {
        return squares[a];
      }
    }
    if (!squares.includes(null)) return "Draw";
    return null;
  };

  const minimax = (squares: Player[], depth: number, isMaximizing: boolean): number => {
    const result = checkWinner(squares);
    if (result === "O") return 10 - depth;
    if (result === "X") return depth - 10;
    if (result === "Draw") return 0;
    if (depth > 5) return 0; // limit depth for simple ai

    if (isMaximizing) {
      let bestScore = -Infinity;
      for (let i = 0; i < 9; i++) {
        if (!squares[i]) {
          squares[i] = "O";
          const score = minimax(squares, depth + 1, false);
          squares[i] = null;
          bestScore = Math.max(score, bestScore);
        }
      }
      return bestScore;
    } else {
      let bestScore = Infinity;
      for (let i = 0; i < 9; i++) {
        if (!squares[i]) {
          squares[i] = "X";
          const score = minimax(squares, depth + 1, true);
          squares[i] = null;
          bestScore = Math.min(score, bestScore);
        }
      }
      return bestScore;
    }
  };

  const aiMove = (currentBoard: Player[]) => {
    // Basic AI - randomly choose sometimes to let player win, but mostly try to block/win
    const chance = Math.random();
    
    let move = -1;
    if (chance > 0.4) {
      // 60% chance to make best move
      let bestScore = -Infinity;
      for (let i = 0; i < 9; i++) {
        if (!currentBoard[i]) {
          currentBoard[i] = "O";
          const score = minimax(currentBoard, 0, false);
          currentBoard[i] = null;
          if (score > bestScore) {
            bestScore = score;
            move = i;
          }
        }
      }
    } else {
      // 40% chance to make random valid move
      const emptyIndices = currentBoard.map((val, idx) => val === null ? idx : null).filter(val => val !== null) as number[];
      if (emptyIndices.length > 0) {
        move = emptyIndices[Math.floor(Math.random() * emptyIndices.length)]!;
      }
    }

    if (move !== -1) {
      const newBoard = [...currentBoard];
      newBoard[move] = "O";
      setBoard(newBoard);
      const gameWinner = checkWinner(newBoard);
      if (gameWinner) {
        setWinner(gameWinner);
      } else {
        setXTurn(true);
      }
    } else {
        // Fallback for no moves
        setWinner("Draw");
    }
  };

  const handleClick = (i: number) => {
    if (board[i] || winner || !xTurn) return;

    const newBoard = [...board];
    newBoard[i] = "X";
    setBoard(newBoard);
    
    const gameWinner = checkWinner(newBoard);
    if (gameWinner) {
      setWinner(gameWinner);
      if (gameWinner === "X") setFlag("CMINUS{T1C_T4C_W1N}");
    } else {
      setXTurn(false);
      setTimeout(() => aiMove(newBoard), 500);
    }
  };

  const resetGame = () => {
    setBoard(Array(9).fill(null));
    setWinner(null);
    setXTurn(true);
    setFlag("");
  };

  return (
    <div className="border border-border p-4 bg-[#05070a] mt-4 w-full max-w-sm">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-bold text-accent">Tic-Tac-Toe vs AI</h2>
        <span className="text-sm text-ink-dim">{winner ? (winner === "Draw" ? "Draw!" : `${winner} Wins!`) : (xTurn ? "Your Turn (X)" : "AI's Turn (O)")}</span>
      </div>

      <div className="grid grid-cols-3 gap-1 bg-border w-fit mx-auto border border-border">
        {board.map((cell, idx) => (
          <button
            key={idx}
            onClick={() => handleClick(idx)}
            className={`w-20 h-20 bg-[#05070a] flex items-center justify-center text-4xl transition-colors hover:bg-border/20 ${cell === "X" ? "text-accent" : "text-signal"}`}
          >
            {cell}
          </button>
        ))}
      </div>

      <div className="mt-4 flex gap-2">
        <button onClick={resetGame} className="px-3 py-1 border border-border text-xs hover:border-accent hover:text-accent transition-colors w-full">Restart</button>
      </div>

      {flag && <div className="mt-4 p-2 bg-accent/20 text-accent font-bold text-center">SYSTEM ALERT: {flag}</div>}
    </div>
  );
}
