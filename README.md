# VS Sudoku

A real-time 1v1 Sudoku game.

## Run locally
1. Install Node.js 18+.
2. In this folder run:
   npm install express ws
3. Run:
   node server.js
4. Open http://localhost:3000 in two browser tabs/devices on the same machine/network.

For internet play, deploy this Node app to a host that supports WebSockets (Render, Railway, Fly.io, etc.).

## Gameplay
Both players receive the exact same generated puzzle. Each player has a private board. Only progress is shared; entered numbers are never broadcast.
