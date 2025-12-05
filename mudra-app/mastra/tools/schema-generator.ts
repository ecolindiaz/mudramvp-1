import { createTool } from '@mastra/core';
import CodeInterpreter from '@e2b/code-interpreter';
import { z } from 'zod';

/**
 * Schema Markup Generator Tool
 * Generates JSON-LD structured data for FAQ, Article, and HowTo schemas
 * Uses E2B sandbox for validation and formatting
 */
export const generateSchemaMarkupTool = createTool({
  id: 'generate_schema_markup',
  description: `
    Generates JSON-LD schema markup optimized for AI citations.
    Creates structured data for:
    - FAQ schema (FAQPage) with mainEntity questions
    - Article schema with author credentials and publisher info
    - HowTo schema for step-by-step tutorials
    - Organization schema for brand authority
    Returns production-ready JSON-LD that can be directly inserted into HTML.
  `,
  inputSchema: z.object({
    schemaType: z.enum(['FAQ', 'Article', 'HowTo', 'Organization']).describe('Type of schema to generate'),
    content: z.object({
      // FAQ specific
      questions: z.array(z.object({
        question: z.string(),
        answer: z.string(),
      })).optional().describe('FAQ questions and answers'),
      
      // Article specific
      headline: z.string().optional(),
      description: z.string().optional(),
      author: z.object({
        name: z.string(),
        jobTitle: z.string().optional(),
        url: z.string().optional(),
      }).optional(),
      publisher: z.object({
        name: z.string(),
        logo: z.string().url().optional(),
      }).optional(),
      datePublished: z.string().optional(),
      dateModified: z.string().optional(),
      
      // HowTo specific
      name: z.string().optional(),
      totalTime: z.string().optional().describe('ISO 8601 duration (e.g., PT30M for 30 minutes)'),
      steps: z.array(z.object({
        name: z.string(),
        text: z.string(),
        url: z.string().optional(),
        image: z.string().optional(),
      })).optional(),
      
      // Organization specific
      organizationName: z.string().optional(),
      organizationUrl: z.string().url().optional(),
      logo: z.string().url().optional(),
      socialProfiles: z.array(z.string().url()).optional(),
    }),
  }),
  outputSchema: z.object({
    schemaType: z.string(),
    jsonLd: z.string().describe('JSON-LD markup ready to insert'),
    htmlSnippet: z.string().describe('Complete <script> tag with JSON-LD'),
    validation: z.object({
      isValid: z.boolean(),
      errors: z.array(z.string()),
      warnings: z.array(z.string()),
    }),
    recommendations: z.array(z.string()).describe('Best practices for this schema type'),
  }),
  execute: async ({ context }) => {
    const input = context;
    const sandbox = await CodeInterpreter.create();
    
    try {
      const schemaGenerationScript = `
import json
from datetime import datetime

def generate_faq_schema(questions):
    """Generate FAQPage schema"""
    main_entity = []
    
    for qa in questions:
        main_entity.append({
            "@type": "Question",
            "name": qa['question'],
            "acceptedAnswer": {
                "@type": "Answer",
                "text": qa['answer']
            }
        })
    
    schema = {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": main_entity
    }
    
    recommendations = [
        "Keep answers concise (50-300 words)",
        "Use natural question phrasing that users actually search",
        "Include 5-10 questions for optimal AI visibility",
        "Update answers regularly to maintain freshness",
        "Link to detailed content pages from answers"
    ]
    
    return schema, recommendations

def generate_article_schema(content):
    """Generate Article schema"""
    schema = {
        "@context": "https://schema.org",
        "@type": "Article",
        "headline": content.get('headline', ''),
        "description": content.get('description', ''),
        "author": {
            "@type": "Person",
            "name": content.get('author', {}).get('name', ''),
        },
        "publisher": {
            "@type": "Organization",
            "name": content.get('publisher', {}).get('name', ''),
        },
        "datePublished": content.get('datePublished', datetime.now().isoformat()),
        "dateModified": content.get('dateModified', datetime.now().isoformat()),
    }
    
    # Add optional author fields
    author = content.get('author', {})
    if author.get('jobTitle'):
        schema['author']['jobTitle'] = author['jobTitle']
    if author.get('url'):
        schema['author']['url'] = author['url']
    
    # Add publisher logo if available
    publisher = content.get('publisher', {})
    if publisher.get('logo'):
        schema['publisher']['logo'] = {
            "@type": "ImageObject",
            "url": publisher['logo']
        }
    
    recommendations = [
        "Include author credentials (jobTitle) to signal expertise",
        "Add author profile URL to establish authority",
        "Keep headline under 110 characters",
        "Update dateModified when content changes",
        "Add image property with high-quality visuals (1200x630px)"
    ]
    
    return schema, recommendations

def generate_howto_schema(content):
    """Generate HowTo schema"""
    steps = []
    
    for i, step in enumerate(content.get('steps', []), 1):
        step_obj = {
            "@type": "HowToStep",
            "position": i,
            "name": step['name'],
            "text": step['text']
        }
        
        if step.get('url'):
            step_obj['url'] = step['url']
        if step.get('image'):
            step_obj['image'] = step['image']
        
        steps.append(step_obj)
    
    schema = {
        "@context": "https://schema.org",
        "@type": "HowTo",
        "name": content.get('name', ''),
        "step": steps
    }
    
    if content.get('totalTime'):
        schema['totalTime'] = content['totalTime']
    
    recommendations = [
        "Include 3-10 clear steps",
        "Use action verbs in step names (Click, Enter, Navigate)",
        "Add images for each step to improve clarity",
        "Specify totalTime in ISO 8601 format (PT30M = 30 minutes)",
        "Break complex steps into sub-steps if needed"
    ]
    
    return schema, recommendations

def generate_organization_schema(content):
    """Generate Organization schema"""
    schema = {
        "@context": "https://schema.org",
        "@type": "Organization",
        "name": content.get('organizationName', ''),
        "url": content.get('organizationUrl', ''),
    }
    
    if content.get('logo'):
        schema['logo'] = content['logo']
    
    if content.get('socialProfiles'):
        schema['sameAs'] = content['socialProfiles']
    
    recommendations = [
        "Add company logo (square format, min 112x112px)",
        "Include all social media profiles in sameAs array",
        "Add description field (max 250 characters)",
        "Include contactPoint for customer support",
        "Add address for local businesses"
    ]
    
    return schema, recommendations

def validate_schema(schema):
    """Basic schema validation"""
    errors = []
    warnings = []
    
    # Check required fields
    if '@context' not in schema:
        errors.append('Missing @context field')
    if '@type' not in schema:
        errors.append('Missing @type field')
    
    # Type-specific validation
    schema_type = schema.get('@type')
    
    if schema_type == 'FAQPage':
        if 'mainEntity' not in schema or len(schema['mainEntity']) == 0:
            errors.append('FAQPage requires at least one question in mainEntity')
        elif len(schema['mainEntity']) < 3:
            warnings.append('Consider adding more questions (current: {}, recommended: 5-10)'.format(len(schema['mainEntity'])))
    
    elif schema_type == 'Article':
        if not schema.get('headline'):
            errors.append('Article requires headline')
        if not schema.get('author'):
            errors.append('Article requires author')
        if not schema.get('publisher'):
            errors.append('Article requires publisher')
    
    elif schema_type == 'HowTo':
        if 'step' not in schema or len(schema['step']) < 3:
            warnings.append('HowTo should have at least 3 steps for clarity')
    
    return {
        'isValid': len(errors) == 0,
        'errors': errors,
        'warnings': warnings
    }

# Main execution
schema_type = '${input.schemaType}'
content = ${JSON.stringify(input.content)}

if schema_type == 'FAQ':
    schema, recommendations = generate_faq_schema(content.get('questions', []))
elif schema_type == 'Article':
    schema, recommendations = generate_article_schema(content)
elif schema_type == 'HowTo':
    schema, recommendations = generate_howto_schema(content)
elif schema_type == 'Organization':
    schema, recommendations = generate_organization_schema(content)
else:
    raise ValueError(f'Unsupported schema type: {schema_type}')

# Validate schema
validation = validate_schema(schema)

# Format JSON-LD
json_ld = json.dumps(schema, indent=2, ensure_ascii=False)

# Create HTML snippet
html_snippet = f'<script type="application/ld+json">\\n{json_ld}\\n</script>'

result = {
    'schemaType': schema_type,
    'jsonLd': json_ld,
    'htmlSnippet': html_snippet,
    'validation': validation,
    'recommendations': recommendations
}

print(json.dumps(result, indent=2))
`;

      // Execute schema generation in sandbox
      const execution = await sandbox.runCode(schemaGenerationScript);
      
      if (execution.error) {
        throw new Error(`Schema generation failed: ${execution.error}`);
      }

      // Parse results
      const output = execution.logs.stdout.join('\n');
      const result = JSON.parse(output);

      return result;
    } catch (error) {
      console.error('Schema generation error:', error);
      throw error;
    } finally {
      await sandbox.kill();
    }
  },
});
