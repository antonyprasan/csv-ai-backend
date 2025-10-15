require("dotenv").config();
const { ChatGroq } = require("@langchain/groq");
const { ChatOpenAI } = require("@langchain/openai");
const { BufferMemory } = require("langchain/memory");
const { ConversationChain } = require("langchain/chains");
const { PromptTemplate } = require("@langchain/core/prompts");

// Store conversation memories per session
const conversationMemories = new Map();

/**
 * Get or create conversation memory for a session
 */
function getConversationMemory(sessionId) {
  if (!conversationMemories.has(sessionId)) {
    conversationMemories.set(sessionId, new BufferMemory({
      returnMessages: true,
      memoryKey: "chat_history",
    }));
  }
  return conversationMemories.get(sessionId);
}

/**
 * Clear conversation memory for a session
 */
function clearConversationMemory(sessionId) {
  conversationMemories.delete(sessionId);
}

/**
 * Get AI model based on provider
 */
function getAIModel(provider = 'groq') {
  switch (provider) {
    case 'groq':
      return new ChatGroq({
        apiKey: process.env.GROQ_API_KEY,
        model: "llama-3.3-70b-versatile", // Updated to current model
        temperature: 0.7,
      });
    
    case 'openai':
      return new ChatOpenAI({
        apiKey: process.env.OPENAI_API_KEY,
        model: "gpt-4",
        temperature: 0.7,
      });
    
    case 'claude':
      // Will add Claude later if needed
      throw new Error('Claude provider not yet implemented');
    
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

/**
 * Chat with AI agent using conversation memory
 */
async function chatWithAgent(sessionId, userMessage, csvContext, provider = 'groq') {
  try {
    const model = getAIModel(provider);
    const memory = getConversationMemory(sessionId);

    // For the first message, include CSV context
    const messageCount = await memory.chatHistory?.getMessages?.()?.length || 0;
    let fullMessage = userMessage;
    
    if (messageCount === 0) {
      // First message - include CSV context
      fullMessage = `You are an expert data analyst. Analyze this CSV data and answer questions about it.

CSV Data Summary:
${csvContext}

Respond in JSON format with these fields:
- answer: string
- keyInsights: array (optional)
- recommendations: array (optional)
- chartData: object with labels, data, type (optional)

User Question: ${userMessage}`;
    }

    const chain = new ConversationChain({
      llm: model,
      memory: memory,
      verbose: false,
    });

    // Execute the chain
    const response = await chain.invoke({
      input: fullMessage,
    });

    // Parse the response
    let parsedResponse;
    try {
      // Try to extract JSON from the response
      const jsonMatch = response.response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedResponse = JSON.parse(jsonMatch[0]);
      } else {
        // If no JSON, wrap text response
        parsedResponse = {
          answer: response.response,
        };
      }
    } catch (e) {
      // Fallback to text response
      parsedResponse = {
        answer: response.response,
      };
    }

    return parsedResponse;
  } catch (error) {
    console.error('Error in chatWithAgent:', error);
    throw error;
  }
}

/**
 * Simple one-off analysis without memory (for quick insights)
 */
async function quickAnalysis(userMessage, csvContext, provider = 'groq') {
  try {
    const model = getAIModel(provider);

    const prompt = `You are an expert data analyst. Analyze this CSV data and answer the user's question.

CSV Data:
${csvContext}

User Question: ${userMessage}

Provide a JSON response with: answer, keyInsights, recommendations, chartData (with labels, data, type).`;

    const response = await model.invoke(prompt);
    
    // Parse response
    try {
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return { answer: response.content };
    } catch (e) {
      return { answer: response.content };
    }
  } catch (error) {
    console.error('Error in quickAnalysis:', error);
    throw error;
  }
}

module.exports = {
  chatWithAgent,
  quickAnalysis,
  clearConversationMemory,
  getConversationMemory,
};
