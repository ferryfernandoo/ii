/**
 * Memory Writer Service
 * Automatically writes key points to global memory using qwen-flash (cheap model)
 * Called every 2 messages to summarize conversation insights
 */

const TOKENMIX_API_KEY = process.env.TOKENMIX_API_KEY || 'sk-tm-VOB9Vj6BAMSjUBJeJyNkQg0hKhoB7pfUpPL1dzaZpArOADLd';
const TOKENMIX_API_URL = 'https://api.tokenmix.ai/v1/chat/completions';

/**
 * Extract key points from recent conversation and update global memory
 * @param {string} userId - User ID
 * @param {Array} recentMessages - Last 4-5 messages (2 user + 2 AI)
 * @param {string} currentMemory - Current global memory content
 * @returns {Promise<string>} Updated memory content
 */
export async function updateGlobalMemory(userId, recentMessages, currentMemory = '') {
  try {
    // Build conversation context from recent messages
    const conversationText = recentMessages
      .map((msg, idx) => {
        const role = msg.role === 'user' ? 'User' : 'AI';
        const text = typeof msg.content === 'string' ? msg.content : '';
        return `${idx + 1}. ${role}: ${text.substring(0, 200)}`;
      })
      .join('\n');

    // Build prompt for qwen-flash to extract key points
    const systemPrompt = `You are a memory manager for an AI assistant. Extract key insights from the conversation below and update the global memory with important points that will help provide better responses in future sessions.

Current Global Memory (if any):
${currentMemory || '(empty)'}

Guidelines:
- Extract only IMPORTANT key points, preferences, or facts about the user
- Keep it concise (2-3 sentences per point)
- Use bullet points format
- Don't repeat existing memory
- Focus on: user preferences, important facts, learning patterns, goals`;

    const userPrompt = `Recent conversation:\n${conversationText}\n\nUpdate the global memory with new key insights. Format as bullet points. Return ONLY the updated memory content, nothing else.`;

    // Call qwen-flash for memory writing (cheap model)
    const response = await fetch(TOKENMIX_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TOKENMIX_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'qwen-flash',
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: userPrompt
          }
        ],
        temperature: 0.3, // Low temperature for consistent memory writing
        max_tokens: 300,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`TokenMix API error: ${response.status} ${errorText.substring(0, 200)}`);
    }

    const data = await response.json();
    const updatedMemory = data.choices?.[0]?.message?.content || currentMemory;

    console.log(`[MEMORY_WRITER] Updated memory for user ${userId}`);
    console.log(`[MEMORY_WRITER] New memory length: ${updatedMemory.length} chars`);

    return updatedMemory.trim();
  } catch (error) {
    console.error('[MEMORY_WRITER] Error updating global memory:', error.message);
    // Return current memory if update fails
    return currentMemory;
  }
}

export default {
  updateGlobalMemory
};
