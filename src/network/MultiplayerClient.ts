/**
 * MultiplayerClient handles WebSocket communication with the multiplayer server.
 */

// Import shared types
import {
    PlayerId,
    AuthoritativeState,
    WelcomePayload,
    InputPayload
} from '@shared/types';
import { logger } from '@shared/logger'; // Import logger

export class MultiplayerClient {
  private ws: WebSocket;
  public playerId: PlayerId | null = null; // Use shared PlayerId
  public playerColor: string | null = null;

  // Callbacks
  public onWelcome: ((payload: WelcomePayload) => void) | null = null; // Use shared WelcomePayload
  public onAuthoritativeState: ((state: AuthoritativeState) => void) | null = null; // Use shared AuthoritativeState

  // Buffering logic
  private isReady: boolean = false; // Flag to indicate if GameScene is ready
  private messageBuffer: string[] = []; // Buffer for messages received before ready

  constructor(
    serverUrl: string,
    opts: {
      onWelcome?: (payload: WelcomePayload) => void, // Use shared type
      onAuthoritativeState?: (state: AuthoritativeState) => void, // Use shared type
    } = {}
  ) {
    this.onWelcome = opts.onWelcome || null;
    this.onAuthoritativeState = opts.onAuthoritativeState || null;

    this.ws = new WebSocket(serverUrl);

    this.ws.onopen = () => {
        logger.info("WebSocket connection established.");
    };

    this.ws.onerror = (event) => {
        logger.error("WebSocket error:", event);
    };

    this.ws.onclose = (event) => {
        logger.info(`WebSocket connection closed. Code: ${event.code}, Reason: ${event.reason}`);
        this.isReady = false; // Reset ready state on close
    };

    this.ws.onmessage = (event: MessageEvent) => {
        const rawData = event.data as string;
        if (this.isReady) {
            // If ready, process immediately
            this._processMessage(rawData);
        } else {
            // If not ready, buffer the raw message data
            logger.debug("Client not ready, buffering message.");
            this.messageBuffer.push(rawData);
        }
    };
  }

  /** Signals that the client (GameScene) is ready to process messages. */
  public signalReady(): void {
      logger.info("MultiplayerClient signaled ready. Processing buffered messages...");
      this.isReady = true;
      // Process any messages that were buffered
      while (this.messageBuffer.length > 0) {
          const rawData = this.messageBuffer.shift();
          if (rawData) {
              this._processMessage(rawData);
          }
      }
  }

  /** Internal method to parse and handle a received message. */
  private _processMessage(rawData: string): void {
      try {
          // Assuming server sends messages with { type: string, payload: any } structure
          const message = JSON.parse(rawData);
          if (!message || typeof message.type !== 'string') {
              logger.warn('Received invalid message structure from server:', rawData);
              return;
          }

          // logger.debug(`Processing message: ${message.type}`); // Optional: Log processed type

          switch (message.type) {
              case 'welcome':
                  const welcomePayload = message.payload as WelcomePayload;
                  this.playerId = welcomePayload.id;
                  this.playerColor = welcomePayload.color;
                  if (this.onWelcome) this.onWelcome(welcomePayload);
                  break;
              case 'authoritative_state':
                  const statePayload = message.payload as AuthoritativeState;
                  if (this.onAuthoritativeState) this.onAuthoritativeState(statePayload);
                  break;
              default:
                  logger.warn(`Received unknown message type: ${message.type}`);
          }
      } catch (error) {
          logger.error("Failed to parse or process message:", error, "Raw data:", rawData);
      }
  }


  // Send the current input state to the server
  // Use shared InputPayload type
  sendInput(payload: InputPayload) {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.send({ type: 'input', payload });
    } else {
        logger.warn("Attempted to send input while WebSocket was not open.");
    }
  }

  // Send an arbitrary message to the server
  send(msg: any) {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    } else {
        logger.warn("Attempted to send message while WebSocket was not open:", msg);
    }
  }
}