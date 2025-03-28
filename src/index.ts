import { startServer } from './api/server';
import * as pineconeService from './services/pineconeService';
import { startKafkaConsumer } from './ingestion/kafkaConsumer';
import logger from './utils/logger';
import config from './config';

// Starts application and run data ingestion process

async function main(): Promise<void> {
  // Log version and environment details
  logger.info('Starting application', {
    env: config.nodeEnv,
    version: process.env.npm_package_version || 'unknown'
  });

  // Initialize Pinecone
  try {
    logger.info('Initializing Pinecone service...');
    await pineconeService.initializePinecone();
    logger.info('Pinecone service initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize Pinecone service:', error);
    console.log('Failed to initialize Pinecone service:', error);
    process.exit(1);
  }
  logger.info('PINECONE CCCCCCCCCCCCCC');
  // Initialize Kafka consumer
  if (process.env.ENABLE_KAFKA === 'true') {
    try {
      logger.info('Starting Kafka consumer...');
      await startKafkaConsumer();
      logger.info('Kafka consumer started successfully');
    } catch (error) {
      logger.error('Failed to start Kafka consumer:', error);
    }
  } else {
    logger.info('Kafka consumer disabled (ENABLE_KAFKA not set to true)');
  }

  // Start the Express server
  try {
    logger.info('Starting API server...');
    startServer();
    logger.info('Server started successfully');
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }

  logger.info('Application startup completed');
}

// error handling
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection:', reason);
});

// Execute the main function
main().catch(error => {
  logger.error('Unhandled error during startup:', error);
  process.exit(1);
}); 