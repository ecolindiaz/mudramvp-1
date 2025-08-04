import OpenAI from 'openai';
import { getDefaultModel, getModelForDeepThinking } from '@/lib/config/ai-models';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  try {
    const { messages, taskContext, deepThink } = await req.json();

    // Build context-aware system prompt
    let systemPrompt = `You are Mudra AI, an intelligent assistant for the Mudra GEO platform. You help users with:

1. **GEO Optimization Tasks**: Provide step-by-step guidance on SEO, structured data, content optimization, and technical improvements
2. **Platform Navigation**: Help users understand and use the Mudra platform features
3. **Marketing Strategy**: Offer advice on improving AI visibility, content marketing, and digital presence
4. **Task Management**: Guide users through completing their generated tasks

Key capabilities:
- Break down complex optimization tasks into simple, actionable steps
- Explain technical concepts in beginner-friendly language
- Provide specific code examples and implementation guidance
- Help prioritize optimization efforts based on impact

Always be helpful, concise, and actionable. When explaining steps, number them clearly and include practical examples.`;

    // Add deep thinking instructions if requested
    if (deepThink) {
      systemPrompt += `\n\n**DEEP THINKING MODE ACTIVATED (OpenAI o3):**
You are now powered by OpenAI's most advanced reasoning model. Use your enhanced capabilities to:

**REASONING APPROACH:**
- Apply multi-step logical reasoning to break down complex problems
- Consider edge cases, dependencies, and interconnections
- Analyze potential failure points and mitigation strategies
- Think through the full implementation lifecycle

**COMPREHENSIVE ANALYSIS:**
- Provide detailed analysis with thorough reasoning chains
- Compare multiple approaches with quantified pros/cons
- Include technical implementation details, code architecture patterns
- Explain the "why" behind each recommendation with supporting evidence
- Consider scalability, performance, and maintainability implications

**ACTIONABLE INSIGHTS:**
- Create detailed step-by-step implementation guides
- Provide specific code examples with explanations
- Include testing strategies and validation approaches
- Give realistic timelines with breakdown of effort estimation
- Identify required resources, skills, and potential blockers

**STRATEGIC THINKING:**
- Connect solutions to broader business goals and GEO objectives
- Consider user experience and technical debt implications
- Analyze impact on existing systems and future extensibility
- Provide prioritization frameworks for implementation order

Use your advanced reasoning to provide the most thorough, accurate, and actionable response possible.`;
    }

    // Add current tasks context if available
    if (taskContext && taskContext.length > 0) {
      systemPrompt += `\n\n**CURRENT USER TASKS:**\nThe user currently has the following tasks:\n\n`;
      
      taskContext.forEach((task, index) => {
        systemPrompt += `**Task ${index + 1}: ${task.header}**\n`;
        systemPrompt += `- Type: ${task.type}\n`;
        systemPrompt += `- Status: ${task.status}\n`;
        systemPrompt += `- Description: ${task.description}\n`;
        systemPrompt += `- Estimated Time: ${task.estimatedTime}\n`;
        systemPrompt += `- Difficulty: ${task.difficulty}\n`;
        
        if (task.detailedSteps && task.detailedSteps.length > 0) {
          systemPrompt += `- Steps:\n`;
          task.detailedSteps.forEach((step, stepIndex) => {
            systemPrompt += `  ${stepIndex + 1}. ${step.title} (${step.estimatedTime})\n     ${step.description}\n`;
          });
        }
        
        if (task.resources && task.resources.length > 0) {
          systemPrompt += `- Resources: ${task.resources.map(r => r.title).join(', ')}\n`;
        }
        
        systemPrompt += `\n`;
      });
      
      systemPrompt += `When users ask "how to do this" or similar questions, refer to these specific tasks and provide detailed guidance based on the steps outlined above.`;
    }

    // Get model configuration
    const modelConfig = deepThink ? getModelForDeepThinking() : getDefaultModel()
    
    let response;
    try {
      response = await openai.chat.completions.create({
        model: modelConfig.model,
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          ...messages,
        ],
        temperature: modelConfig.settings.defaultTemperature,
        max_tokens: modelConfig.settings.defaultMaxTokens,
      });
    } catch (modelError) {
      console.error('Model error, falling back to GPT-4:', modelError);
      // Fallback to GPT-4 if the specified model fails
      const fallbackConfig = getDefaultModel();
      response = await openai.chat.completions.create({
        model: fallbackConfig.model,
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          ...messages,
        ],
        temperature: fallbackConfig.settings.defaultTemperature,
        max_tokens: fallbackConfig.settings.defaultMaxTokens,
      });
    }

    const content = response.choices[0]?.message?.content || 'Sorry, I could not process your request.';

    return new Response(
      JSON.stringify({ content }),
      { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('AI Chat error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to process chat request' }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}