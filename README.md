# Multiplayer Arcade Space Shooter

A real-time multiplayer arcade-style space shooter built with Phaser (TypeScript) and Node.js (TypeScript).

## Overview (Post-Refactor)

This project implements a classic top-down arcade shooter experience where multiple players can join a game session, control their ships, and collaboratively fight waves of incoming enemies.

The game uses a **server-authoritative architecture**:
*   The Node.js server (written in TypeScript, located in `server/src/`) manages the canonical game state (player positions, enemy movements, bullets, collisions, wave progression). Server logic is modularized into classes like `GameServer`, `GameLoop`, `GameStateManager`, `PlayerManager`, `BulletManager`, `CollisionSystem`, and uses shared core logic (`src/shared/`).
*   Clients (built with Phaser and TypeScript, located in `src/`) send player inputs to the server and render the game world based on the authoritative state updates received via WebSockets. Client logic is also modularized using managers (`ClientStateManager`, `ClientPlayerManager`, etc.) orchestrated by `GameScene`.
*   Client-side prediction for player actions (like firing) and interpolation for remote entity movement are used to provide a smoother perceived experience.

## Dependencies

*   **Node.js** (Version used during development: v20.10.0 or similar LTS recommended)
*   **npm** (comes with Node.js)

Key runtime dependencies (installed via `npm install`):
*   `phaser`: Game framework for the client.
*   `ws`: WebSocket library for server-client communication.
*   `uuid`: For generating unique IDs.

Key development dependencies:
*   `typescript`: For compiling TypeScript code (client & server).
*   `ts-loader`: Webpack loader for TypeScript (client).
*   `webpack`, `webpack-cli`, `webpack-dev-server`: For building and serving the client.
*   `@types/node`, `@types/ws`: Type definitions for Node.js and ws library.
*   `cross-env`: For setting environment variables (used in older scripts, might be removable).
*   `tsconfig-paths`: For handling path aliases during compilation/runtime (used in older scripts).

## Setup

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/mzeman/multiplayerArcadeSpaceGame.git
    cd multiplayerArcadeSpaceGame
    ```
2.  **Install dependencies:**
    ```bash
    npm install
    ```

## Running for Development

You need to run both the server and the client simultaneously.

1.  **Build the server:**
    Compile the server's TypeScript code to JavaScript.
    ```bash
    npm run build:server
    ```
    This compiles files from `server/src/` to `dist/`.

2.  **Start the server:**
    Open a terminal in the project directory and run the compiled server code:
    ```bash
    npm run start:server
    ```
    The server will start listening for WebSocket connections (port defined in `src/shared/constants.ts`, currently 8080, but check `GameServer.ts` if modified).

3.  **Start the client (with hot-reloading):**
    Open a *second* terminal in the project directory and run:
    ```bash
    npm run start:client
    ```
    This will build the client, start a webpack development server (usually on port 8081), and automatically open the game in your default web browser. Changes to client-side code (`src/`) should trigger automatic reloading.

4.  **Play:** Open additional browser tabs/windows pointing to the client URL (e.g., `http://localhost:8081`) to simulate multiple players joining the game.

**Stopping the Server:** Press `Ctrl + C` in the terminal where the server is running (`npm run start:server`).

## Production Build

To create an optimized build of both the client and server code (output to `dist/` directory):
```bash
npm run build
```
This command executes both `npm run build:client` (using Webpack) and `npm run build:server` (using `tsc`).

To run the production build:
1.  Ensure the build is complete (`npm run build`).
2.  Run the compiled server: `node -r tsconfig-paths/register dist/server/src/GameServer.js` (or use `npm run start:server`, which includes the flag).
3.  Serve the static client files from the `dist/` directory using a separate static file server (like `serve`, `http-server`, Nginx, Apache, etc.). The client files will be in the root of `dist/` (e.g., `dist/index.html`, `dist/bundle.js`).

## More Information

For detailed technical architecture, component breakdowns, data flow, and known issues, please refer to the [Comprehensive Game Documentation](docs/comprehensive_game_documentation.md).