import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { router } from './routes.js';
import { getDb } from './db.js';

dotenv.config();

export function createApp(dbPath?: string): Express {
  // Initialize DB instance
  getDb(dbPath);

  const app: Express = express();

  // Middleware
  app.use(
    cors({
      origin: process.env.CORS_ORIGIN || '*',
      methods: ['GET', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    })
  );

  app.use(express.json());

  // Mount API routes
  app.use('/', router);

  // Catch-all 404 for undefined endpoints
  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: 'Endpoint not found' });
  });

  // Global error handler
  app.use(
    (err: Error, _req: Request, res: Response, _next: NextFunction) => {
      console.error('Unhandled server error:', err);
      res.status(500).json({
        error: 'Internal server error',
        message: err.message,
      });
    }
  );

  return app;
}
