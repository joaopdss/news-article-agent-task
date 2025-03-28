import express, { Request, Response, NextFunction } from 'express';
import * as ragService from '../services/ragService';
import { QueryPayload } from '../types';
import logger from '../utils/logger';

const router = express.Router();

const validateQueryPayload = (req: Request, res: Response, next: NextFunction) => {
  const { query } = req.body as Partial<QueryPayload>;

  if (!query || typeof query !== 'string' || query.trim() === '') {
    logger.warn('Invalid query payload received', { payload: req.body });
    res.status(400).json({
      error: 'Invalid request body. Query must be a non-empty string.'
    });
    return;
  }

  // Trim the query and update body
  req.body.query = query.trim();
  next();
};

// Process query using RAG 
router.post('/agent', validateQueryPayload, async (req: Request, res: Response) => {
  try {
    const payload = req.body as QueryPayload;
    logger.info('Received agent request', { queryLength: payload.query.length });

    const response = await ragService.handleQuery(payload);
    
    res.status(200).json(response);
  } catch (error) {
    logger.error('Error handling agent request:', error);
    res.status(500).json({
      error: 'Error while processing request.'
    });
  }
});

export default router; 