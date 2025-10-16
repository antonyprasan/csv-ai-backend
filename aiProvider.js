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
 * Simplified approach: manually manage chat history
 */
async function chatWithAgent(sessionId, userMessage, csvContext, provider = 'groq') {
  try {
    const model = getAIModel(provider);
    const memory = getConversationMemory(sessionId);

    // Get chat history
    const chatHistory = await memory.loadMemoryVariables({});
    const previousMessages = chatHistory.chat_history || [];

    // Build messages array for AI
    const messages = [];
    
    // Always include CSV context for every message
    messages.push({
      role: 'system',
      content: `You are an expert data analyst. Analyze this CSV data and help answer questions.

CSV Data:
${csvContext}

Respond in JSON format with:
- answer: your analysis
- keyInsights: key findings (optional)
- recommendations: suggestions (optional)
- chartData: {labels: [], data: [], type: "pie|bar|line"} (optional)`
    });

    // Add conversation history
    if (Array.isArray(previousMessages)) {
      previousMessages.forEach((msg) => {
        messages.push({
          role: msg._getType() === 'human' ? 'user' : 'assistant',
          content: msg.content
        });
      });
    }

    // Add current message
    messages.push({
      role: 'user',
      content: userMessage
    });

    // Call AI directly
    console.log('Calling AI with messages:', messages.length);
    const response = await model.invoke(messages);
    console.log('AI Response:', {
      content: response.content?.substring(0, 100) + '...',
      hasContent: !!response.content,
      responseType: typeof response
    });

    // Save to memory
    await memory.saveContext(
      { input: userMessage },
      { output: response.content }
    );

    // Parse the response
    let parsedResponse;
    try {
      const content = response.content || response.text || response.message || '';
      
      // If content is empty, provide a default response
      if (!content || content.trim() === '') {
        parsedResponse = {
          answer: "I'm sorry, I didn't receive a response. Please try asking your question again.",
        };
      } else {
        // Try to extract JSON from the response
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            parsedResponse = JSON.parse(jsonMatch[0]);
          } catch (jsonError) {
            // JSON parsing failed, use content as answer
            parsedResponse = {
              answer: content,
            };
          }
        } else {
          // No JSON found, use content as answer
          parsedResponse = {
            answer: content,
          };
        }
      }
    } catch (e) {
      console.error('Error parsing response:', e);
      // Fallback to text response
      parsedResponse = {
        answer: response.content || response.text || response.message || "I'm sorry, I couldn't process your request. Please try again.",
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
