/**
 * MultiplayerClient handles WebSocket communication with the multiplayer server.
 */

export type PlayerState = {
  id: string;
  color: string;
  x: number;
  y: number;
  lives: number;
};

type GameState = {
  type: 'game_state';
  players: { [id: string]: PlayerState };
};

type WelcomeMsg = {
  type: 'welcome';
  id: string;
  color: string;
};

type AuthoritativeStateMsg = {
  type: 'authoritative_state';
  // ...arbitrary state fields (enemies, bullets, wave, etc.)
  [key: string]: any;
};

type MainPlayerMsg = {
  type: 'main_player';
};

type ServerMsg = GameState | WelcomeMsg | AuthoritativeStateMsg | MainPlayerMsg;

// Represents the state of player inputs sent to the server
// Represents the state of player inputs sent to the server
type InputMsg = {
  type: 'input';
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  fire: boolean; // Indicates fire button pressed this frame
  playerId?: string; // Optional: Server might infer from connection

  // Optional fields for when 'fire' is true and a bullet is created client-side
  newBulletId?: string;
  newBulletX?: number;
  newBulletY?: number;
  newBulletVelocityY?: number;
};

export class MultiplayerClient {
  private ws: WebSocket;
  public playerId: string | null = null;
  public playerColor: string | null = null;
  public players: { [id: string]: PlayerState } = {};
  public isMainPlayer: boolean = false;
  public onGameState: ((state: GameState) => void) | null = null;
  public onWelcome: ((msg: WelcomeMsg) => void) | null = null;
  public onMainPlayer: (() => void) | null = null;
  public onAuthoritativeState: ((state: AuthoritativeStateMsg) => void) | null = null;

  constructor(
    serverUrl: string,
    opts: {
      onWelcome?: (msg: WelcomeMsg) => void,
      onGameState?: (state: GameState) => void,
      onMainPlayer?: () => void,
      onAuthoritativeState?: (state: AuthoritativeStateMsg) => void,
    } = {}
  ) {
    this.onWelcome = opts.onWelcome || null;
    this.onGameState = opts.onGameState || null;
    this.onMainPlayer = opts.onMainPlayer || null;
    this.onAuthoritativeState = opts.onAuthoritativeState || null;

    this.ws = new WebSocket(serverUrl);

    this.ws.onmessage = (event) => {
      const msg: ServerMsg = JSON.parse(event.data);
      if (msg.type === 'welcome') {
        this.playerId = msg.id;
        this.playerColor = msg.color;
        if (this.onWelcome) this.onWelcome(msg);
      } else if (msg.type === 'game_state') {
        this.players = msg.players;
        if (this.onGameState) this.onGameState(msg);
      } else if (msg.type === 'main_player') {
        this.isMainPlayer = true;
        if (this.onMainPlayer) this.onMainPlayer();
      } else if (msg.type === 'authoritative_state') {
        if (this.onAuthoritativeState) this.onAuthoritativeState(msg);
      }
    };
  }

  // Send the current input state to the server
  // Send the current input state, including optional new bullet info if firing
  sendInput(inputState: {
    left: boolean;
    right: boolean;
    up: boolean;
    down: boolean;
    fire: boolean; // Fire button state this frame
    newBullet?: { // Optional: Include details if a bullet was just fired locally
      id: string;
      x: number;
      y: number;
      velocityY: number;
    }
  }) {
    if (this.ws.readyState === WebSocket.OPEN) {
      const msg: InputMsg = {
        type: 'input',
        left: inputState.left,
        right: inputState.right,
        up: inputState.up,
        down: inputState.down,
        fire: inputState.fire, // Send the fire button state
        playerId: this.playerId || undefined,
        // Add new bullet info if provided (when fire is true and cooldown allows)
        ...(inputState.newBullet && {
          newBulletId: inputState.newBullet.id,
          newBulletX: inputState.newBullet.x,
          newBulletY: inputState.newBullet.y,
          newBulletVelocityY: inputState.newBullet.velocityY,
        })
      };
      this.ws.send(JSON.stringify(msg));
    }
  }

  sendGameStateUpdate(state: any) {
    if (this.isMainPlayer) {
      this.ws.send(JSON.stringify({ type: 'game_state_update', state }));
    }
  }

  // Removed sendFire method, as firing is now included in sendInput

  // Send an arbitrary message to the server
  send(msg: any) {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }
}