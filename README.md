# News Article Agent

A Node.js application that provides a RAG (Retrieval-Augmented Generation) system for news articles. It ingests news article URLs from various sources (Kafka or CSV), processes the content using Gemini 2.0 Flash API with Structured Output (JSON), stores vector embeddings in Pinecone, and provides a query API to answer questions using the ingested knowledge.

# Observation
Its not a good practice to provide API keys in public responses like I am in this project, but for the purpose of the interview, I'll let in the repo until a response of my candidature .

## Features

- **RAG System**: Query engine that uses external knowledge to provide accurate answers
- **Dual Query Types**: Process either knowledge-based queries or direct URL analysis
- **Multiple Ingestion Options**: Kafka streaming or CSV file batch processing
- **Vector Embeddings**: Store and search article content using semantic similarity
- **Gemini AI Integration**: Extract structured content from HTML and generate responses
- **REST API**: Simple HTTP interface for queries with proper error handling
- **Docker Support**: Production-ready containerization with Docker and docker-compose
- **TypeScript**: Type-safe implementation with clear interfaces

## Setup

### Prerequisites

- Node.js 18 or higher
- npm or yarn
- Gemini API key
- Pinecone account and API key
- Kafka cluster

### Environment Variables

```
# Gemini API
GEMINI_API_KEY=YOUR_GEMINI_API_KEY

# Pinecone
PINECONE_API_KEY=PINECONE_API_KEY
PINECONE_ENVIRONMENT=PINECONE_ENVIRONMENT
PINECONE_INDEX_NAME=index_name

# Kafka 
KAFKA_BROKER="pkc-ewzgj.europe-west4.gcp.confluent.cloud:9092"
KAFKA_USERNAME="OXQDOMDXAEIPZDEG"
KAFKA_PASSWORD="Rq9Jv5kKr4kfMTG0xkJZazgwOIKqduM+vbXjyxBK9EpE7FDLbcMRcbbx17TYEhZm"
KAFKA_TOPIC_NAME="news"
KAFKA_GROUP_ID_PREFIX="test-task-"

# Application Settings
PORT=3000

# Feature Flags
ENABLE_KAFKA=true

```

### Local Development

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development
   ```bash
   npm run dev
   ```

3. Build the TypeScript code:
   ```bash
   npm run build
   ```

4. Run in production mode:
   ```bash
   npm start
   ```

### Docker Deployment

#### Using docker-compose

1. Build and start the containers:
   ```bash
   docker-compose up -d
   ```

2. View logs:
   ```bash
   docker-compose logs -f app
   ```

3. Stop the containers:
   ```bash
   docker-compose down
   ```

## API Usage

### Query Endpoint

**POST /api/agent**

This endpoint accepts two types of queries:
1. Knowledge-based queries that search the vector database
2. URL queries that analyze a specific article URL

#### Request Format

```json
{
  "query": "string"
}
```

#### Response Format

```json
{
  "answer": "string",
  "sources": [
    {
      "title": "string",
      "url": "string",
      "date": "string"
    }
  ]
}
```

#### Examples

**Knowledge-based query:**

```bash
curl -X POST http://localhost:3000/api/agent \
  -H "Content-Type: application/json" \
  -d '{"query": "can you give me a quick summary of 3 lines of wildifres in los angeles"}'
```

**URL analysis query:**

```bash
curl -X POST http://localhost:3000/api/agent \
  -H "Content-Type: application/json" \
  -d '{"query": "https://www.bbc.com/news/articles/clyxypryrnko"}'
```


## Design Decisions

### Technology Stack

- **Node.js & TypeScript**: Provides type safety and better development experience
- **Express**: Lightweight, flexible web framework with extensive middleware ecosystem
- **Pinecone**: Vector database optimized for similarity search, essential for RAG systems
- **Gemini API**: Powerful LLM for content extraction and question answering
- **Kafka**: Preferred for real-time streaming ingestion with high throughput
- **Docker**: Containerization for consistent deployment across environments

### Architecture

- **Modular Structure**: Separate services for different concerns (Gemini, Pinecone, ingestion)
- **Error Handling**: Comprehensive try/catch blocks with appropriate error responses
- **Configuration**: Environment-based configuration with validation
- **Logging**: Structured logging for easier debugging and monitoring

## Future quality improvements

- Develop specialized prompts for different types of articles (news, opinion, technical)
- Implement web search with the LLM to use other website sources to have more information to generate a response
- Use reasoning models for better answers based on the query

## Future cost optimization

- Implement cache for frequent queries and responses
