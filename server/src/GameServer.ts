// Add module-alias setup
import moduleAlias from 'module-alias';
import path from 'path';

// Calculate path relative to the compiled file's location (__dirname in dist/server/src)
// to the compiled shared files (in dist/src/shared)
const compiledSharedPath = path.join(__dirname, '../../src/shared');
moduleAlias.addAlias('@shared', compiledSharedPath);
// End of added block

import WebSocket, { WebSocketServer } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { GameStateManager } from './GameStateManager';
import { PlayerManager } from './PlayerManager';
import { BulletManager } from './BulletManager';
import { CollisionSystem } from './CollisionSystem';
import { GameLoop } from './GameLoop';
import { logger } from '@shared/logger'; // Import the shared logger

import { EnemyWaveManagerCore } from '@shared/EnemyWaveManagerCore'; // Import actual class

// Removed placeholder class

// Define configuration constants (move to shared/constants later)
const PORT = 8082; // Changed port to avoid conflict with webpack dev server
const COLORS = [ // From original server.js
    '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF',
    '#FFA500', '#800080', '#008000', '#FFC0CB'
];
let colorIndex = 0;

function getRandomColor(): string {
    const color = COLORS[colorIndex % COLORS.length];
    colorIndex++;
    return color;
}


export class GameServer {
    private wss: WebSocketServer;
    private gameStateManager: GameStateManager;
    private playerManager: PlayerManager;
    private bulletManager: BulletManager;
    private collisionSystem: CollisionSystem;
    private gameLoop: GameLoop;
    private enemyWaveManager: EnemyWaveManagerCore;

    // Map WebSocket connections to player IDs
    private clients: Map<WebSocket, string> = new Map();
    private playersReady: Set<string> = new Set();

    constructor() {
        // Instantiate core components
        this.enemyWaveManager = new EnemyWaveManagerCore(); // Now uses the imported class
        this.gameStateManager = new GameStateManager(this.enemyWaveManager);
        this.bulletManager = new BulletManager(this.gameStateManager); // Create BulletManager first
        this.playerManager = new PlayerManager(this.gameStateManager, this.bulletManager); // Pass BulletManager
        // this.bulletManager = new BulletManager(this.gameStateManager); // Moved up
        this.collisionSystem = new CollisionSystem(
            this.gameStateManager,
            this.playerManager,
            this.bulletManager,
            this.enemyWaveManager // Pass if needed by collision logic
        );
        // GameLoop will need a way to call back to broadcast state
        this.gameLoop = new GameLoop(
            this.gameStateManager,
            this.playerManager,
            this.bulletManager,
            this.collisionSystem,
            this.enemyWaveManager,
            this.broadcastState.bind(this) // Pass bound broadcast method as callback
        );

        // Start WebSocket server
        this.wss = new WebSocketServer({ port: PORT });
        this.setupConnections();
        logger.info(`WebSocket server started on port ${PORT}`);
    }

    private setupConnections(): void {
        this.wss.on('connection', (ws: WebSocket) => {
            // 1. Assign Player ID and Color
            const playerId = uuidv4();
            const playerColor = getRandomColor();
            this.clients.set(ws, playerId);
            logger.info(`Client connected. Assigned ID: ${playerId}`);

            // 2. Add player to the game state
            this.playerManager.addPlayer(playerId, playerColor);

            // 3. Send Welcome message
            ws.send(JSON.stringify({ type: 'welcome', payload: { id: playerId, color: playerColor } }));

            // 4. Send current game state to the new player
            ws.send(JSON.stringify({ type: 'authoritative_state', payload: this.gameStateManager.getAuthoritativeState() }));

            // 5. Broadcast updated state to all clients (including the new player)
            this.broadcast(this.gameStateManager.getAuthoritativeState());


            // Handle messages from this client
            ws.on('message', (message: Buffer) => {
                // Pass ws to know which client sent the message
                this.handleMessage(ws, message);
            });

            // Handle client disconnection
            ws.on('close', () => {
                const disconnectedPlayerId = this.clients.get(ws);
                if (disconnectedPlayerId) {
                    logger.info(`Client ${disconnectedPlayerId} disconnected`);
                    this.clients.delete(ws);
                    this.playersReady.delete(disconnectedPlayerId); // Remove from ready set if present
                    this.playerManager.removePlayer(disconnectedPlayerId);
                    // Broadcast updated state after player removal
                    this.broadcast(this.gameStateManager.getAuthoritativeState());

                    // Stop game if no players left
                    if (this.clients.size === 0) {
                        logger.info("No players left. Stopping game.");
                        this.gameLoop.stopGame();
                        this.playersReady.clear(); // Clear ready set
                    }
                }
            });

            ws.on('error', (error: Error) => {
                logger.error('WebSocket error:', error);
                // Attempt to handle disconnection similarly to 'close'
                const errorPlayerId = this.clients.get(ws);
                 if (errorPlayerId) {
                    logger.info(`Client ${errorPlayerId} disconnected due to error`);
                    this.clients.delete(ws);
                    this.playersReady.delete(errorPlayerId);
                    this.playerManager.removePlayer(errorPlayerId);
                    this.broadcast(this.gameStateManager.getAuthoritativeState());
                     if (this.clients.size === 0) {
                        logger.info("No players left. Stopping game.");
                        this.gameLoop.stopGame();
                        this.playersReady.clear();
                    }
                }
            });
        });
    }

    private handleMessage(ws: WebSocket, message: Buffer): void {
        const playerId = this.clients.get(ws);
        if (!playerId) {
            logger.warn('Received message from unknown client');
            return;
        }

        try {
            const parsedMessage = JSON.parse(message.toString());
            logger.debug(`Received message from ${playerId}:`, parsedMessage); // Use debug level

            // Route message based on type
            switch (parsedMessage.type) {
                case 'input':
                    this.playerManager.handleInput(playerId, parsedMessage.payload);
                    break;
                case 'toggleInvincible': // Added based on documentation
                    this.playerManager.handleToggleInvincible(playerId);
                    break;
                case 'ready':
                    logger.info(`Player ${playerId} is ready.`);
                    this.playersReady.add(playerId);
                    // Start game loop only if it hasn't started and at least one player is ready
                    // (Original logic started on first ready, let's keep that for now)
                    if (!this.gameLoop.isRunning() && this.playersReady.size > 0) {
                         this.gameLoop.startGame();
                    }
                    break;
                case 'requestRestart':
                    // Pass request to GameLoop to handle state checking
                    this.gameLoop.handleRestartRequest();
                    break;
                default:
                    logger.warn(`Received unknown message type from ${playerId}: ${parsedMessage.type}`);
            }

        } catch (error) {
            logger.error(`Failed to parse message from ${playerId} or invalid format:`, message.toString(), error);
        }
    }

    // Method for GameLoop to call
    broadcastState(state: any): void {
        this.broadcast(state);
    }

    // Broadcast data to all connected clients
    private broadcast(data: any): void {
        const message = JSON.stringify({ type: 'authoritative_state', payload: data });
        // logger.debug("Broadcasting state:", message.substring(0, 100) + "..."); // Use debug level
        this.wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(message);
            }
        });
    }
}

// Initialize the server
const gameServer = new GameServer();