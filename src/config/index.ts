import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file
const envPath = path.resolve(process.cwd(), '.env');
const result = dotenv.config({ path: envPath });

if (result.error) {
  console.warn(`Warning: Could not find .env file at ${envPath}. Ensure environment variables are set.`);
}

interface AppConfig {
  geminiApiKey: string;
  pineconeApiKey: string;
  pineconeEnvironment: string;
  pineconeIndexName: string;
  kafkaBroker: string;
  kafkaUsername: string;
  kafkaPassword: string;
  kafkaTopicName: string;
  kafkaGroupIdPrefix: string;
  port: number;
  isProduction: boolean;
  nodeEnv: string;
}

function getEnvVar(key: string, required: boolean = true): string {
  const value = process.env[key];
  if (required && (value === undefined || value === null || value === '')) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value || '';
}

function getEnvVarAsInt(key: string, defaultValue: number, required: boolean = true): number {
    const valueStr = getEnvVar(key, required);
    if (!valueStr && !required) {
        return defaultValue;
    }
    const valueInt = parseInt(valueStr, 10);
    if (isNaN(valueInt)) {
        throw new Error(`Environment variable ${key} must be an integer, but received: ${valueStr}`);
    }
    return valueInt;
}


// Load and export configuration
const config: AppConfig = {
  geminiApiKey: getEnvVar('GEMINI_API_KEY'),
  pineconeApiKey: getEnvVar('PINECONE_API_KEY'),
  pineconeEnvironment: getEnvVar('PINECONE_ENVIRONMENT'),
  pineconeIndexName: getEnvVar('PINECONE_INDEX_NAME'),
  kafkaBroker: getEnvVar('KAFKA_BROKER'),
  kafkaUsername: getEnvVar('KAFKA_USERNAME'),
  kafkaPassword: getEnvVar('KAFKA_PASSWORD'),
  kafkaTopicName: getEnvVar('KAFKA_TOPIC_NAME'),
  kafkaGroupIdPrefix: getEnvVar('KAFKA_GROUP_ID_PREFIX') + Date.now(),
  port: getEnvVarAsInt('PORT', 3000, false),
  nodeEnv: getEnvVar('NODE_ENV', false) || 'development',
  isProduction: (getEnvVar('NODE_ENV', false) || 'development') === 'production',
};

export default config; 