/**
 * Relay AG-UI Runtime Server
 *
 * CopilotKit runtime server that streams Relay events to the dashboard
 * Runs on port 8789 by default
 */

import express, { Express, Request, Response } from 'express';
import { CopilotRuntime, OpenAIAdapter } from '@copilotkit/runtime';
import { aguiAdapter, AGUIEventHandler } from './event-adapter';
import { RelayAGUIEvent, RelayAGUIState } from './event-types';

export interface RelayAGUIRuntimeConfig {
  port?: number;
  enableCors?: boolean;
  corsOrigin?: string;
}

/**
 * Relay AG-UI Runtime Server
 *
 * Provides CopilotKit-compatible endpoint for streaming Relay events
 */
export class RelayAGUIRuntime {
  private app: Express;
  private runtime: CopilotRuntime;
  private port: number;
  private server: any;
  private eventHandlers: Set<AGUIEventHandler> = new Set();

  constructor(config: RelayAGUIRuntimeConfig = {}) {
    this.port = config.port || 8789;
    this.app = express();

    // Setup middleware
    this.setupMiddleware(config);

    // Initialize CopilotKit runtime
    this.runtime = new CopilotRuntime({
      // We don't need an LLM for just streaming events
      // but CopilotKit requires it, so we provide a minimal config
    });

    // Setup routes
    this.setupRoutes();

    // Subscribe to Relay events
    this.subscribeToRelayEvents();
  }

  /**
   * Start the runtime server
   */
  async start(): Promise<void> {
    return new Promise((resolve) => {
      this.server = this.app.listen(this.port, () => {
        console.log(`🚀 Relay AG-UI Runtime listening on port ${this.port}`);
        console.log(`   Endpoint: http://127.0.0.1:${this.port}/api/copilotkit`);
        resolve();
      });
    });
  }

  /**
   * Stop the runtime server
   */
  async stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.server) {
        this.server.close((err: Error | undefined) => {
          if (err) {
            reject(err);
          } else {
            console.log('✓ Relay AG-UI Runtime stopped');
            resolve();
          }
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * Get current AG-UI state
   */
  getState(): RelayAGUIState {
    return aguiAdapter.getState();
  }

  /**
   * Setup Express middleware
   */
  private setupMiddleware(config: RelayAGUIRuntimeConfig): void {
    // CORS for local development
    if (config.enableCors !== false) {
      this.app.use((req, res, next) => {
        // Allow both localhost and 127.0.0.1 for local development
        const requestOrigin = req.headers.origin;
        const allowedOrigins = [
          'http://localhost:8787',
          'http://127.0.0.1:8787',
          config.corsOrigin,
        ].filter(Boolean);

        if (requestOrigin && allowedOrigins.includes(requestOrigin)) {
          res.header('Access-Control-Allow-Origin', requestOrigin);
        } else if (config.corsOrigin) {
          res.header('Access-Control-Allow-Origin', config.corsOrigin);
        } else {
          // Default: accept localhost
          res.header('Access-Control-Allow-Origin', 'http://localhost:8787');
        }

        res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.header('Access-Control-Allow-Headers', 'Content-Type');
        if (req.method === 'OPTIONS') {
          res.sendStatus(200);
        } else {
          next();
        }
      });
    }

    // JSON body parser
    this.app.use(express.json());
  }

  /**
   * Setup API routes
   */
  private setupRoutes(): void {
    // Health check
    this.app.get('/health', (req: Request, res: Response) => {
      res.json({
        status: 'healthy',
        service: 'relay-agui-runtime',
        port: this.port,
        timestamp: Date.now(),
      });
    });

    // Get current state
    this.app.get('/api/state', (req: Request, res: Response) => {
      res.json(this.getState());
    });

    // Server-Sent Events endpoint for real-time streaming
    this.app.get('/api/events', (req: Request, res: Response) => {
      // Set headers for SSE
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      // Send initial state
      res.write(`data: ${JSON.stringify({ type: 'init', state: this.getState() })}\n\n`);

      // Subscribe to events
      const handler: AGUIEventHandler = (event: RelayAGUIEvent) => {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      };

      const unsubscribe = aguiAdapter.subscribe(handler);
      this.eventHandlers.add(handler);

      // Cleanup on connection close
      req.on('close', () => {
        unsubscribe();
        this.eventHandlers.delete(handler);
      });
    });

    // CopilotKit endpoint (for future integration with CopilotKit UI)
    this.app.post('/api/copilotkit', async (req: Request, res: Response) => {
      try {
        // Forward to CopilotKit runtime
        // This allows CopilotKit UI components to work
        res.json({
          message: 'CopilotKit endpoint ready',
          state: this.getState(),
        });
      } catch (error) {
        console.error('CopilotKit endpoint error:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // WebSocket upgrade for CopilotKit (future enhancement)
    // CopilotKit can use WebSocket for better real-time performance
  }

  /**
   * Subscribe to Relay events via adapter
   */
  private subscribeToRelayEvents(): void {
    aguiAdapter.subscribe((event: RelayAGUIEvent) => {
      // Log events for debugging
      console.log('[AG-UI Event]', event.type, event.data);

      // Events are automatically streamed to connected clients
      // via the event handlers registered in /api/events
    });
  }
}

// Export singleton instance for use in start-local-stack
let runtimeInstance: RelayAGUIRuntime | null = null;

export function getRelayAGUIRuntime(config?: RelayAGUIRuntimeConfig): RelayAGUIRuntime {
  if (!runtimeInstance) {
    runtimeInstance = new RelayAGUIRuntime(config);
  }
  return runtimeInstance;
}
