import express, { Request, Response, NextFunction } from 'express';
import config from '../config';
import routes from './routes';
import logger from '../utils/logger';

// Create Express application
const app = express();

// Middleware
app.use(express.json());

// Health check endpoint
app.get('/', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString()
  });
});

// API routes
app.use('/api', routes);

// 404 handler
app.use((req: Request, res: Response) => {
  logger.debug(`Route not found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({ error: 'Not Found' });
});

// error handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  const isDevelopment = !config.isProduction;
  
  // Log error details
  logger.error('Unhandled error in request:', {
    method: req.method,
    path: req.path,
    error: err.message,
    stack: isDevelopment ? err.stack : undefined
  });

  // Send error response
  res.status(500).json({
    error: 'Internal Server Error',
    ...(isDevelopment && { message: err.message })
  });
});


export function startServer(): express.Application {
  const port = config.port || 3000;
  
  app.listen(port, () => {
    logger.info(`Server running portt ${port}`);
    logger.info(`Environment: ${config.nodeEnv}`);
    logger.info(`API available at http://localhost:${port}/api`);
  });

  return app;
}

export default app; 