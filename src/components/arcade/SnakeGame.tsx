"use client";

import { useEffect, useRef, useState } from "react";

const GRID_SIZE = 20;
const SPEED = 100;
const WIN_SCORE = 15;

export function SnakeGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [gameWon, setGameWon] = useState(false);
  const [flag, setFlag] = useState("");
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!running) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let snake = [{ x: 10, y: 10 }];
    let food = { x: 15, y: 15 };
    let dx = 0;
    let dy = 0;
    let nextDx = 1;
    let nextDy = 0;
    let lastTime = 0;
    let currentScore = 0;
    let req: number;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent default scrolling for arrow keys
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
        e.preventDefault();
      }
      switch (e.key) {
        case "ArrowUp": if (dy === 0) { nextDx = 0; nextDy = -1; } break;
        case "ArrowDown": if (dy === 0) { nextDx = 0; nextDy = 1; } break;
        case "ArrowLeft": if (dx === 0) { nextDx = -1; nextDy = 0; } break;
        case "ArrowRight": if (dx === 0) { nextDx = 1; nextDy = 0; } break;
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    function loop(time: number) {
      req = requestAnimationFrame(loop);
      if (time - lastTime < SPEED) return;
      lastTime = time;

      dx = nextDx;
      dy = nextDy;

      const head = { x: snake[0]!.x + dx, y: snake[0]!.y + dy };
      
      // Wall collision
      if (head.x < 0 || head.x >= GRID_SIZE || head.y < 0 || head.y >= GRID_SIZE) {
        endGame(false);
        return;
      }

      // Self collision
      if (snake.some(segment => segment.x === head.x && segment.y === head.y)) {
        endGame(false);
        return;
      }

      snake.unshift(head);

      if (head.x === food.x && head.y === food.y) {
        currentScore += 1;
        setScore(currentScore);
        if (currentScore >= WIN_SCORE) {
          endGame(true);
          return;
        }
        // Spawn food
        let newFood: { x: number; y: number };
        while (true) {
          newFood = { x: Math.floor(Math.random() * GRID_SIZE), y: Math.floor(Math.random() * GRID_SIZE) };
          // eslint-disable-next-line no-loop-func
          if (!snake.some(s => s.x === newFood.x && s.y === newFood.y)) break;
        }
        food = newFood;
      } else {
        snake.pop();
      }

      draw();
    }

    function draw() {
      ctx!.fillStyle = "#05070a";
      ctx!.fillRect(0, 0, canvas!.width, canvas!.height);
      
      ctx!.fillStyle = "#ef4444"; // signal
      ctx!.fillRect(food.x * 20, food.y * 20, 20, 20);

      ctx!.fillStyle = "#10b981"; // accent
      snake.forEach(s => ctx!.fillRect(s.x * 20, s.y * 20, 19, 19));
    }

    function endGame(won: boolean) {
      setRunning(false);
      setGameOver(!won);
      if (won) {
        setGameWon(true);
        setFlag("CMINUS{SN4K3_CH4RM3R}");
      }
    }

    draw();
    req = requestAnimationFrame(loop);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      cancelAnimationFrame(req);
    };
  }, [running]);

  function startGame() {
    setScore(0);
    setGameOver(false);
    setGameWon(false);
    setFlag("");
    setRunning(true);
    // Draw initial state before loop starts if possible
    setTimeout(() => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d");
        if (ctx) {
            ctx.fillStyle = "#05070a";
            ctx.fillRect(0, 0, canvas!.width, canvas!.height);
        }
    }, 0);
  }

  return (
    <div className="border border-border p-4 bg-[#05070a] mt-4 w-fit">
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-lg font-bold text-accent">Terminal Snake</h2>
        <span className="text-sm text-ink-dim">Score: {score} / {WIN_SCORE}</span>
      </div>
      <p className="text-xs text-ink-dim mb-4">Use arrow keys. Reach score {WIN_SCORE} to win.</p>
      <div className="relative border border-border w-[400px] h-[400px]">
        <canvas ref={canvasRef} width={400} height={400} className="w-full h-full" />
        
        {!running && !gameWon && (
          <div className="absolute inset-0 bg-[#05070a]/80 flex flex-col items-center justify-center">
            {gameOver && <span className="text-signal font-bold mb-2">GAME OVER</span>}
            <button onClick={startGame} className="px-4 py-2 border border-accent text-accent hover:bg-accent/20">
              {gameOver ? "TRY AGAIN" : "START"}
            </button>
          </div>
        )}
      </div>
      {flag && <div className="mt-4 p-2 bg-accent/20 text-accent font-bold text-center">SYSTEM ALERT: {flag}</div>}
    </div>
  );
}
