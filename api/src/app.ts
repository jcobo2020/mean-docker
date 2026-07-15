import express, { Application } from 'express';
import cors from 'cors';
import apiRoutes from './routes/api.routes';
import { errorHandler } from './middlewares/error.middleware';

/**
 * Builds the Express app (middleware + routes + error handler).
 * Does NOT connect to MongoDB or call listen — those stay in server.ts.
 */
export function createApp(): Application {
  const app = express();

  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.use('/api', apiRoutes);

  app.get('/', (_req, res) => {
    res.send('Contact API is running');
  });

  app.use(errorHandler);

  return app;
}
