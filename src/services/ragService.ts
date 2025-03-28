import * as geminiService from './geminiService';
import * as pineconeService from './pineconeService';
import { processUrl } from '../processing/contentProcessor';
import logger from '../utils/logger';
import { isValidUrl, truncateString } from '../utils/helpers';
import { ApiResponse, QueryPayload, Source } from '../types';

// Handles a query by either processing a URL or searching the vector database
export async function handleQuery(payload: QueryPayload): Promise<ApiResponse> {
  const { query } = payload;
  
  // Log the query
  const truncatedQuery = truncateString(query, 100);
  logger.info(`Handling query: "${truncatedQuery}"`);

  // Check if is a url
  const isUrl = isValidUrl(query);
  logger.info(`Query is being treated as a ${isUrl ? 'URL' : 'knowledge base query'}`);

  try {
    if (isUrl) {
      // URL-based query - process the URL directly
      return await handleUrlQuery(query);
    } else {
      // Knowledge base query - search for relevant content
      return await handleKnowledgeBaseQuery(query);
    }
  } catch (error) {
    // Handle errors
    logger.error('Unhandled error in query handling:', error);
    return {
      answer: "Sorry, I encountered an unexpected error while processing your request.",
      sources: []
    };
  }
}

// Extracts content from a URL and generates a response
async function handleUrlQuery(url: string): Promise<ApiResponse> {
  try {
    
    // Process the URL to extract content
    const result = await processUrl(url);
    
    if (!result || !result.article) {
      logger.warn(`Failed to process URL: ${url}`);
      return {
        answer: "I couldn't process this URL. It may be inaccessible or doesn't contain extractable content.",
        sources: []
      };
    }
    
    const { article } = result;
    
    // Construct a prompt for Gemini to analyze the article
    const prompt = `
    You are analyzing a web article. Please provide a comprehensive summary of the main points.

    Article Title: ${article.title}
    Article URL: ${article.url}
    Article Date: ${article.date || 'Unknown'}

    Article Content:
    ${article.content}

    Provide a clear, factual summary of this article. Focus on the key information, main arguments, and important details.
    `;

    // Generate text response
    logger.debug('Generating text response for URL content');
    const answer = await geminiService.generateText(prompt);
    
    // First create a complete source object for use in prompt generation
    const fullSource: Source = {
      title: article.title,
      url: article.url,
      date: article.date,
      content: article.content
    };
    
    const cleanedSource = {
      title: article.title,
      url: article.url,
      date: article.date
    };
    
    // Return formatted response with cleaned source
    return {
      answer,
      sources: [cleanedSource]
    };
  } catch (error) {
    logger.error(`Error handling URL query: ${url}`, error);
    return {
      answer: "Encountered an error while processing this URL.",
      sources: []
    };
  }
}


async function handleKnowledgeBaseQuery(query: string): Promise<ApiResponse> {
  try {
    logger.info(`Processing knowledge base query: "${query}"`);
    
    // Generate embedding for the query
    let queryVector: number[];
    try {
      queryVector = await geminiService.generateEmbeddings(query);
      logger.debug('Successfully generated query embedding', { vectorSize: queryVector.length });
    } catch (embeddingError) {
      logger.error('Failed to generate query embedding:', embeddingError);
      return {
        answer: "encountered an error while processing your query.",
        sources: []
      };
    }
    
    // Search for similar vectors
    let sources: Source[];
    try {
      sources = await pineconeService.querySimilarVectors(queryVector, 1);
      logger.debug(`Found ${sources.length} relevant sources for query`);
    } catch (searchError) {
      logger.error('Failed to search knowledge base:', searchError);
      return {
        answer: "couldn't search our knowledge base at the moment.",
        sources: []
      };
    }
    
    // Check if any sources were found
    if (!sources || sources.length === 0) {
      logger.info('No relevant sources found for query');
      return {
        answer: "No information related to the query in our knowledge base.",
        sources: []
      };
    }
    
    
    // Construct a prompt with the sources for context
    const sourcesContext = sources.map((source, index) => {
      return `Source ${index + 1}:
      Title: ${source.title}
      URL: ${source.url}
      Date: ${source.date || 'Unknown'}
      Content: ${source.content || 'Unknown'}
      ---`;
    }).join('\n\n');
    
    const prompt = `
      You are answering a question based on provided sources and content. 
      Only use information from these sources and content to formulate your answer.

      QUESTION: ${query}

      INFORMATION:
      ${sourcesContext}

      Instructions:
      1. Answer based ONLY on the information in the provided sources.
      2. If the sources don't contain enough information to answer fully, acknowledge the limitations.
      3. Do not make up or infer information not present in the sources.
      4. Provide a clear answer.
    `;

    try {
      // Generate text response
      logger.debug('Generating text response from knowledge base sources');
      const answer = await geminiService.generateText(prompt);
      
      const cleanedSources = sources.map(({ title, url, date }) => ({
        title,
        url,
        date
      }));
      
      // Return the formatted response with sources (without content)
      return {
        answer,
        sources: cleanedSources
      };
    } catch (generationError) {
      logger.error('Failed to generate text response:', generationError);
      
      // Remove content from sources before returning the response
      const cleanedSources = sources.map(({ title, url, date }) => ({
        title,
        url,
        date
      }));
      
      return {
        answer: "Couldn't generate a response.",
        sources: cleanedSources
      };
    }
  } catch (error) {
    logger.error('Error handling knowledge base query:', error);
    return {
      answer: "Encountered an error while searching for information.",
      sources: []
    };
  }
} 