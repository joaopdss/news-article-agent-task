import {
    GoogleGenerativeAI,
    GenerativeModel,
    HarmCategory,
    HarmBlockThreshold,
    GenerateContentRequest,
    GenerationConfig
  } from '@google/generative-ai';
  import config from '../config';
  import logger from '../utils/logger';
  import { Article } from '../types';
  
  // Initialize the Google Generative AI client
  const genAI = new GoogleGenerativeAI(config.geminiApiKey);
  
  // Model instances
  let textModel: GenerativeModel;
  let embedModel: GenerativeModel;
  
  // --- Model Initialization (Unchanged) ---
  try {
 
    textModel = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      safetySettings: [
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
        { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
      ],
    });
  
    // Initialize the embedding model
    embedModel = genAI.getGenerativeModel({ model: 'embedding-001' });
    logger.info('Gemini models initialized successfully.');
  } catch (error) {
    throw new Error(`Gemini service initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
  
  
// Generate text with Gemini
  export async function generateText(prompt: string): Promise<string> {
    try {
      logger.debug('Generating text with prompt', { promptLength: prompt.length });
      
      logger.info('Generating text with prompt', { promptLength: prompt.length });
      const result = await textModel.generateContent(prompt);
      
      const response = result.response;
      const text = response.text(); 
  
      logger.debug('Text generation successful', { responseLength: text.length });
      return text;
    } catch (error) {
      throw new Error(`Gemini text generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
 // Clean and structure HTML content into an Article object
  export async function cleanAndStructureHtml(htmlContent: string, url: string): Promise<Article | null> {
  
    const MAX_HTML_LENGTH = 120000;
    const truncatedHtml = htmlContent.length > MAX_HTML_LENGTH
      ? htmlContent.substring(0, MAX_HTML_LENGTH)
      : htmlContent;
  
    const prompt = `
    You are an expert web scraper and data extractor. Analyze the following HTML content and extract the main article details.
    Return ONLY a single, valid JSON object containing the following fields:
    - "title": The main title of the article. If no title is found, use an empty string "".
    - "content": The primary text content of the article. Clean the text by removing all HTML tags, navigation menus, advertisements, sidebars, footers, and other boilerplate content. Focus solely on the paragraphs that form the body of the article. If no content is found, use an empty string "".
    - "date": The publication date of the article in "YYYY-MM-DD" format. If the date cannot be determined, use an empty string "".
    
    Strictly adhere to the JSON format. Do not include any introductory text, explanations, or markdown formatting like \`\`\`json before or after the JSON object.
    
    HTML Content to analyze:
    \`\`\`html
    ${truncatedHtml}
    \`\`\`
    `;
  
    // Define the request object enabling JSON mode
    const generationConfig: GenerationConfig = {
        responseMimeType: "application/json",
    };
  
    const request: GenerateContentRequest = {
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig,
    };
  
    try {
      const result = await textModel.generateContent(request);
      const response = result.response;
  
      const responseText = response.text();
  
  
      if (!responseText) {
          logger.warn('Gemini returned an empty', { url });
          return null;
      }
  
      // Attempt to parse the response directly as JSON
      let jsonData: { title: string; content: string; date: string };
      try {
        jsonData = JSON.parse(responseText);
      } catch (parseError) {
        logger.error('Failed to parse JSON response:', {
            parseErrorMessage: parseError instanceof Error ? parseError.message : String(parseError),
            rawResponse: responseText,
            url
        });

        return null;
      }
  
      if (typeof jsonData.title === 'undefined' || typeof jsonData.content === 'undefined' || typeof jsonData.date === 'undefined') {
          logger.warn('Parsed JSON from Gemini is missing expected fields (title, content, date)', { url, parsedData: jsonData });
      }
  
      // Create and return the Article object
      const article: Article = {
        title: jsonData.title || 'Untitled Article',
        content: jsonData.content || '',
        date: jsonData.date || '',
        url: url,
      };
  
      return article;
  
    } catch (error) {
      // Catch errors
      logger.error('Gemini API call failed during HTML structuring (JSON mode):', {
          errorMessage: error instanceof Error ? error.message : String(error),
          url
      });
      return null;
    }
  }
  
  
// Generate embeddings for text
  export async function generateEmbeddings(text: string): Promise<number[]> {

    const MAX_EMBED_TEXT_LENGTH = 12000; 
    const truncatedText = text.length > MAX_EMBED_TEXT_LENGTH ? text.substring(0, MAX_EMBED_TEXT_LENGTH) : text;
    if (text.length > MAX_EMBED_TEXT_LENGTH) {
        logger.warn('Text truncated for embedding', { originalLength: text.length, truncatedLength: truncatedText.length });
    }
  
    try {
  
      const embeddingResult = await embedModel.embedContent(truncatedText);
      const embedding = embeddingResult.embedding.values;
  
      if (!embedding) {
        throw new Error('Gemini embedding API returned success but no embedding values.');
      }
  
      return embedding;
    } catch (error) {
      logger.error('Failed to generate embeddings:', error);
      throw new Error(`Gemini embedding generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }