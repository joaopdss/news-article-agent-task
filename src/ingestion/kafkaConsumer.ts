import { Kafka, logLevel, Consumer, EachMessagePayload } from 'kafkajs';
import config from '../config';
import { handleUrlIngestion } from './ingestionService';
import logger from '../utils/logger';
import { randomUUID } from 'crypto';


const consumerIdSuffix = randomUUID().substring(0, 8);
const groupId = `${config.kafkaGroupIdPrefix}${consumerIdSuffix}`;

// KafkaJS client
let kafkaClient: Kafka;
let consumer: Consumer;

// Cache of recently processed URLs to avoid duplicates in quick succession
const recentlyProcessedUrls = new Set<string>();
const MAX_CACHE_SIZE = 1000; // Limit cache size
const CACHE_EXPIRY_MS = 30 * 60 * 1000; // 30 minutes

// Start the Kafka consumer
export async function startKafkaConsumer(): Promise<void> {
  logger.info('Initializing Kafka consumer');

  // Initialize Kafka client with SASL_SSL
  kafkaClient = new Kafka({
    clientId: `news-article-agent`,
    brokers: [config.kafkaBroker],
    ssl: true,
    sasl: {
      mechanism: 'plain',
      username: config.kafkaUsername,
      password: config.kafkaPassword
    }
  });

  logger.info('Kafka client configured', {
    broker: config.kafkaBroker,
    username: config.kafkaUsername,
    groupId
  });

  // Create consumer
  consumer = kafkaClient.consumer({
    groupId,
    heartbeatInterval: 3000,
    sessionTimeout: 30000,
  });

  // Set up logging
  consumer.on(consumer.events.CONNECT, () => {
    logger.info('Kafka consumer connected');
  });

  consumer.on(consumer.events.DISCONNECT, () => {
    logger.warn('Kafka consumer disconnected');
  });

  consumer.on(consumer.events.CRASH, ({ payload: { error, groupId } }) => {
    logger.error(`Kafka consumer crashed: ${error.message}`, {
      groupId,
      stack: error.stack
    });
  });


  try {
    // Connect to Kafka
    await consumer.connect();
    
    await consumer.subscribe({
      topic: config.kafkaTopicName,
      fromBeginning: true
    });

    logger.info(`Subscribed to Kafka topic: ${config.kafkaTopicName}`);

    // consuming messages
    await consumer.run({
      eachMessage: handleKafkaMessage
    });

    logger.info('Kafka consumer started successfully');
  } catch (error) {
    throw new Error(`Kafka consumer startup failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Handle each Kafka message
async function handleKafkaMessage({ topic, partition, message }: EachMessagePayload): Promise<void> {
  const startTime = Date.now();
  const offset = message.offset;
  
  try {
    // Skip messages
    if (!message.value) {
      logger.warn(`Empty message received at offset ${offset}, skipping`);
      return;
    }

    // Parse message value as JSON
    const messageStr = message.value.toString();
    
    let url: string;
    try {
      // Try to parse as JSON and extract URL
      const messageJson = JSON.parse(messageStr);
      
      // Handle different message formats
      if (messageJson.value && messageJson.value.url) {
        url = messageJson.value.url;
      } else if (messageJson.url) {
        url = messageJson.url;
      } else {
        url = messageStr;
      }
      
    } catch (parseError) {
      // If not valid JSON, use the raw string
      logger.warn(`Could not parse message as JSON, treating as raw URL: ${messageStr}`);
      url = messageStr;
    }

    // Check if we've recently processed this URL
    if (recentlyProcessedUrls.has(url)) {
      logger.info(`Skipping recently processed URL: ${url}`);
      return;
    }

    // Process the URL
    await handleUrlIngestion(url);
    
    // Add to recently processed cache
    recentlyProcessedUrls.add(url);
    
    // Clean up cache if it gets too large
    if (recentlyProcessedUrls.size > MAX_CACHE_SIZE) {

      logger.debug(`Clearing URL cache (size: ${recentlyProcessedUrls.size})`);
      recentlyProcessedUrls.clear();
    }
    
    // Record processing time for backpressure detection
    const processingTime = Date.now() - startTime;
    
  } catch (error) {
    // Handle errors
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Error processing message at offset ${offset}: ${errorMessage}`, {
      topic,
      partition,
      errorStack: error instanceof Error ? error.stack : undefined
    });
  }
}

// Periodically clear the cache to prevent memory leaks
setInterval(() => {
  const cacheSize = recentlyProcessedUrls.size;
  if (cacheSize > 0) {
    logger.debug(`Clearing URL cache after expiry period (size: ${cacheSize})`);
    recentlyProcessedUrls.clear();
  }
}, CACHE_EXPIRY_MS);