# Multiplayer Arcade Space Shooter

A real-time multiplayer arcade-style space shooter built with Phaser and Node.js.

## Overview

This project implements a classic top-down arcade shooter experience where multiple players can join a game session, control their ships, and collaboratively fight waves of incoming enemies.

The game uses a **server-authoritative architecture**:
*   The Node.js server (`server/server.js`) manages the canonical game state (player positions, enemy movements, bullets, collisions, wave progression).
*   Clients (built with Phaser) send player inputs to the server and render the game world based on the authoritative state updates received via WebSockets.
*   Client-side prediction for player actions (like firing) and interpolation for remote entity movement are used to provide a smoother perceived experience.

## Dependencies

*   **Node.js** (Version used during development: v20.10.0 or similar LTS recommended)
*   **npm** (comes with Node.js) or **yarn**

Key runtime dependencies (installed via npm/yarn):
*   `phaser`: Game framework for the client.
*   `ws`: WebSocket library for server-client communication.
*   `uuid`: For generating unique IDs.

## Setup

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/mzeman/multiplayerArcadeSpaceGame.git
    cd multiplayerArcadeSpaceGame
    ```
2.  **Install dependencies:**
    ```bash
    npm install
    # or
    # yarn install
    ```

## Running for Development

You need to run both the server and the client simultaneously.

1.  **Start the server:**
    Open a terminal in the project directory and run:
    ```bash
    npm run start:server
    ```
    The server will start listening for WebSocket connections (typically on port 8080, check `server/server.js` for details).

2.  **Start the client (with hot-reloading):**
    Open a *second* terminal in the project directory and run:
    ```bash
    npm run start:client
    ```
    This will build the client, start a development server (usually on port 8081), and automatically open the game in your default web browser. Changes to client-side code (`src/`) should trigger automatic reloading.

3.  **Play:** Open additional browser tabs/windows pointing to the client URL (e.g., `http://localhost:8081`) to simulate multiple players joining the game.

## Production Build

To create an optimized build of the client code (output to `dist/` directory):
```bash
npm run build
```
You would then need a separate static file server to serve the contents of the `dist/` directory.

## More Information

For detailed technical architecture, component breakdowns, data flow, and known issues, please refer to the [Comprehensive Game Documentation](docs/comprehensive_game_documentation.md).