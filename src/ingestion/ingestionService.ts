import { processUrl } from '../processing/contentProcessor';
import * as pineconeService from '../services/pineconeService';
import logger from '../utils/logger';
import { isValidUrl } from '../utils/helpers';

// Ingest a URL
export async function handleUrlIngestion(url: string): Promise<void> {
  if (!url || !isValidUrl(url)) {
    logger.error(`Invalid URL provided for ingestion: "${url}"`);
    return;
  }

  try {
    // Process the URL to extract content
    const result = await processUrl(url);

    // Check if processing was successful
    if (!result || !result.article || !result.vector) {
      return;
    }

    const { article, vector } = result;
  

    try {
      // Store the processed data in Pinecone
      await pineconeService.upsertVector(url, vector, article);
    } catch (storageError) {
      // Handle errors
      logger.error(`Failed to store vector for URL: ${url}`, storageError);
      throw new Error(`Vector storage failed: ${storageError instanceof Error ? storageError.message : String(storageError)}`);
    }
  } catch (processingError) {
    // Handle errors
    logger.error(`Failed to process URL: ${url}`, processingError);
    throw new Error(`URL processing failed: ${processingError instanceof Error ? processingError.message : String(processingError)}`);
  }
} 