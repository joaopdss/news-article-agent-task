import { Pinecone, PineconeRecord, RecordMetadata } from '@pinecone-database/pinecone';
import config from '../config';
import logger from '../utils/logger';
import { Article, Source } from '../types';

// Pinecone client instance
let pineconeClient: Pinecone | null = null;

// The dimension of the embeddings model
const EMBEDDING_DIMENSION = 768;

// Initialize Pinecone client
export async function initializePinecone(): Promise<void> {
  try {
    logger.info('Initializing Pinecone client');
    
    // Initialize the Pinecone client
    pineconeClient = new Pinecone({
      apiKey: config.pineconeApiKey,
    });

    if (!pineconeClient) {
      throw new Error('Failed to create Pinecone client instance');
    }

    const indexName = config.pineconeIndexName;
    logger.debug(`Checking for index existence: ${indexName}`);

    // List existing indexes
    const existingIndexes = await pineconeClient.listIndexes();
    const indexExists = existingIndexes.indexes?.some((idx: { name: string }) => idx.name === indexName) || false;

    if (!indexExists) {
      logger.info(`Index "${indexName}" not found, creating...`);
      
      // Create the index with the appropriate dimension
      await pineconeClient.createIndex({
        name: indexName,
        dimension: EMBEDDING_DIMENSION, // Dimension from Gemini embedding model
        metric: 'cosine',
        spec: {
          serverless: {
            cloud: 'aws',
            region: 'us-east-1',
          },
        },
      });

      logger.info(`Waiting for index "${indexName}" to be ready...`);
      
      // Wait for the index to be ready
      await new Promise<void>((resolve, reject) => {
        const checkInterval = setInterval(async () => {
          try {
            const indexDescription = await pineconeClient?.describeIndex(indexName);
            if (indexDescription?.status?.ready) {
              clearInterval(checkInterval);
              logger.info(`Index "${indexName}" is ready`);
              resolve();
            }
          } catch (error) {
            clearInterval(checkInterval);
            reject(new Error(`Failed to check index status: ${error instanceof Error ? error.message : String(error)}`));
          }
        }, 5000);
      });
    } else {
      logger.info(`Index "${indexName}" already exists`);
      
      // Verify that the index has the correct dimension
      const indexDescription = await pineconeClient.describeIndex(indexName);
      const indexDimension = indexDescription.dimension;
      
      if (indexDimension !== EMBEDDING_DIMENSION) {
        logger.warn(`Index dimension mismatch: expected ${EMBEDDING_DIMENSION}, got ${indexDimension}`);
      }
    }
    
    logger.info('Pinecone initialization completed successfully');
  } catch (error) {
    logger.error('Pinecone initialization failed:', error);
    throw new Error(`Failed to initialize Pinecone: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function vectorExists(id: string): Promise<boolean> {
  if (!pineconeClient) {
    throw new Error('Pinecone client not initialized. Call initializePinecone() first.');
  }

  const indexName = config.pineconeIndexName;
  const index = pineconeClient.index(indexName);
  
  try {
    // Use fetch to check if the vector exists
    const response = await index.fetch([id]);
    return response.records && Object.keys(response.records).length > 0;
  } catch (error) {
    logger.error(`Error checking if vector exists: ${id}`, error);
    // In case of error, return false to be safe (might lead to attempted re-insertion)
    return false;
  }
}


export async function upsertVector(id: string, vector: number[], metadata: Article): Promise<void> {
  if (!pineconeClient) {
    throw new Error('Pinecone client not initialized. Call initializePinecone() first.');
  }

  const indexName = config.pineconeIndexName;
  const index = pineconeClient.index(indexName);
  
  // Check if the vector already exists
  const exists = await vectorExists(id);
  if (exists) {
    logger.info(`Vector with ID ${id} already exists, skipping upsert`);
    return;
  }

  // Create a record with the vector and metadata
  const record: PineconeRecord<RecordMetadata & Article> = {
    id,
    values: vector,
    metadata: {
      title: metadata.title,
      content: metadata.content,
      url: metadata.url,
      date: metadata.date
    }
  };

  // retry logic
  const MAX_RETRIES = 2;
  let retryCount = 0;
  let lastError: any = null;

  while (retryCount <= MAX_RETRIES) {
    try {
      await index.upsert([record]);
      logger.debug(`Successfully upserted vector: ${id}`);
      return;
    } catch (error) {
      lastError = error;
      retryCount++;
      
      if (retryCount <= MAX_RETRIES) {
        const delay = Math.pow(2, retryCount) * 1000;
        logger.warn(`Retrying upsert for ID ${id} after ${delay}ms (attempt ${retryCount}/${MAX_RETRIES}): ${error instanceof Error ? error.message : String(error)}`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        break;
      }
    }
  }
  
  // all retries failed
  throw new Error(`Failed to upsert vector to Pinecone: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
}

// Query Pinecone for similar vectors
export async function querySimilarVectors(vector: number[], topK: number = 1): Promise<Source[]> {
  if (!pineconeClient) {
    throw new Error('Pinecone client not initialized.');
  }

  const indexName = config.pineconeIndexName;
  const index = pineconeClient.index(indexName);
  
  logger.debug(`Querying for similar vectors, topK: ${topK}`);

  try {
    // Query
    const queryResponse = await index.query({
      vector,
      topK,
      includeMetadata: true,
    });

    // Check if matches exist
    if (!queryResponse.matches || queryResponse.matches.length === 0) {
      logger.info('No similar vectors found in query');
      return [];
    }

    // Map Pinecone results to Source
    const sources: Source[] = queryResponse.matches
      .filter(match => match.metadata)
      .map(match => {
        const metadata = match.metadata as unknown as Article;
        return {
          title: metadata.title || 'Unknown Title',
          url: metadata.url || '',
          date: metadata.date || '',
          content: metadata.content || '',
        };
      });

    logger.info(`Found ${sources.length} similar vectors`);
    
    // Log similarity scores
    if (logger.debug) {
      const scores = queryResponse.matches.map(match => ({
        id: match.id,
        score: match.score
      }));
      logger.debug('Similarity scores:', scores);
    }

    return sources;
  } catch (error) {
    logger.error('Failed to query similar vectors:', error);
    throw new Error(`Pinecone query failed: ${error instanceof Error ? error.message : String(error)}`);
  }
} 