import * as geminiService from '../services/geminiService';
import { Article } from '../types';
import logger from '../utils/logger';
import { isValidUrl } from '../utils/helpers';

 // Process a URL and extract article text, generates embeddings
export async function processUrl(url: string): Promise<{ article: Article; vector: number[] } | null> {
  try {
    if (!url || !isValidUrl(url)) {
      logger.error(`Invalid URL provided for processing: "${url}"`);
      return null;
    }


    const htmlContent = await fetchUrlContent(url);
    if (!htmlContent) {
      logger.warn(`Failed to fetch content from URL: ${url}`);
      return null;
    }

    // Extract structured article from HTML using Gemini
    const article = await geminiService.cleanAndStructureHtml(htmlContent, url);
    if (!article) {
      logger.warn(`Failed to extract article from URL: ${url}`);
      return null;
    }

    // Generate embeddings for the article content
    const contentForEmbedding = `${article.title}. ${article.content.substring(0, 8000)}`; // Use title + truncated content
    const vector = await geminiService.generateEmbeddings(contentForEmbedding);

    return {
      article,
      vector
    };
  } catch (error) {
    logger.error(`Error processing URL ${url}:`, error);
    return null;
  }
}

// Fetch HTML content from a URL
async function fetchUrlContent(url: string): Promise<string | null> {
  try {
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    if (!response.ok) {
      logger.warn(`Failed to fetch URL ${url}: HTTP ${response.status}`);
      return null;
    }

    const html = await response.text();
    return html;
  } catch (error) {
    logger.error(`Error fetching URL ${url}:`, error);
    return null;
  }
} 