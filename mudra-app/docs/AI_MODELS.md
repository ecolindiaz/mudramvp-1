# AI Models Integration

## Overview

Mudra platform supports multiple AI models for different use cases, with OpenAI's o3 model as the premium "Deep Think" option.

## Available Models

### Standard Chat (GPT-4)
- **Model**: `gpt-4`
- **Use Case**: General conversations, quick analysis, basic optimization tasks
- **Cost**: $30 input / $60 output per 1M tokens
- **Speed**: Medium
- **Context**: 8K tokens

### Deep Think (OpenAI o3)
- **Model**: `o3` (Currently using `gpt-4-0125-preview` as fallback until o3 is available)
- **Use Case**: Complex problem solving, detailed technical analysis, multi-step reasoning
- **Cost**: $2,000 input / $8,000 output per 1M tokens ⚠️ **Premium Pricing** (when o3 is available)
- **Speed**: Slowest (highest reasoning capability)
- **Context**: 200K tokens
- **Max Output**: 100K tokens

> **Note**: OpenAI o3 is not yet publicly available. The system currently uses `gpt-4-0125-preview` with enhanced reasoning prompts as a fallback. The configuration will automatically switch to o3 once it becomes available.

## When to Use Deep Think (o3)

The o3 model is designed for complex scenarios that require advanced reasoning:

✅ **Recommended For:**
- Complex GEO optimization strategies
- Multi-step technical implementation planning
- Architecture decisions and system design
- Detailed competitive analysis
- Complex debugging and troubleshooting
- Comprehensive audit reports

❌ **Not Recommended For:**
- Simple questions or clarifications
- Basic task guidance
- General conversation
- Quick answers

## Implementation Details

### API Integration
- Located in `/app/api/ai-chat/route.ts`
- Model selection based on `deepThink` parameter
- Configuration managed in `/lib/config/ai-models.ts`

### UI Components
- Deep Think button in chat interface
- Visual indicators for o3 usage
- Enhanced loading states
- Cost awareness features

### Prompt Engineering
- Enhanced system prompts for o3's reasoning capabilities
- Task context integration
- Multi-step reasoning instructions
- Strategic thinking frameworks

## Cost Management

### Estimated Costs (per request)
- **Standard Chat**: ~$0.01-0.05
- **Deep Think (o3)**: ~$0.50-5.00+ depending on complexity

### Best Practices
1. Use o3 only for complex analysis requiring deep reasoning
2. Provide detailed context to maximize value
3. Ask comprehensive questions rather than multiple small ones
4. Monitor usage and costs regularly

## Configuration

Model settings can be adjusted in `/lib/config/ai-models.ts`:

```typescript
export const AI_MODELS: Record<string, AIModelConfig> = {
  'o3': {
    // ... configuration
    settings: {
      defaultTemperature: 0.3, // Lower for focused reasoning
      defaultMaxTokens: 100000  // Full output capacity
    }
  }
}
```

## Future Enhancements

- [ ] Usage analytics and cost tracking
- [ ] Model performance metrics
- [ ] User-specific model preferences
- [ ] Automatic model selection based on query complexity
- [ ] Integration with additional reasoning models