#!/usr/bin/env tsx

import { readFileSync, statSync } from 'node:fs'
import { join, relative, extname } from 'node:path'
import { glob } from 'glob'
import { upsertDocument } from '../lib/ai/rag/upsert'
import { getServiceClient } from '../lib/db/supabase-server'

// Knowledge base directories to crawl
const KB_DIRECTORIES = [
  'lib/analysis/technical/kb/**/*.md',
  'lib/ai/rag/kb/**/*.md',
  'docs/**/*.md',
  'output/**/*.md',
  'public/**/*.md',
  'lib/Mudra Prompts/**/*.txt',
] as const

type SourceKind = 'kb' | 'docs' | 'markdown' | 'site'

interface FileInfo {
  path: string
  kind: SourceKind
  title: string
  content: string
  lastModified: Date
}

function inferSourceKind(filePath: string): SourceKind {
  if (filePath.includes('/kb/') || filePath.includes('/analysis/')) return 'kb'
  if (filePath.includes('/docs/')) return 'docs'
  if (filePath.includes('/output/')) return 'markdown'
  if (filePath.includes('/public/')) return 'site'
  return 'kb' // default fallback
}

function extractTitleFromContent(content: string, filePath: string): string {
  // Try to extract title from first H1
  const h1Match = content.match(/^#\s+(.+)$/m)
  if (h1Match) {
    return h1Match[1].trim()
  }
  
  // Try to extract from <name> tags (for prompt files)
  const nameMatch = content.match(/<name>\s*(.+?)\s*<\/name>/s)
  if (nameMatch) {
    return nameMatch[1].trim()
  }
  
  // Fall back to filename without extension
  const fileName = filePath.split('/').pop() || 'Unknown'
  return fileName.replace(/\.(md|txt)$/, '').replace(/[-_]/g, ' ')
}

function normalizeContent(content: string): string {
  // Remove XML-style tags from prompt files
  return content
    .replace(/<\/?[^>]+>/g, '') // Remove all XML tags
    .replace(/\n{3,}/g, '\n\n') // Normalize multiple newlines
    .trim()
}

async function crawlFiles(): Promise<FileInfo[]> {
  const files: FileInfo[] = []
  
  console.log('🔍 Crawling knowledge base directories...')
  
  for (const pattern of KB_DIRECTORIES) {
    const matches = await glob(pattern, { 
      cwd: process.cwd(),
      ignore: ['node_modules/**', '.git/**', '.next/**']
    })
    
    console.log(`📁 Found ${matches.length} files in ${pattern}`)
    
    for (const filePath of matches) {
      try {
        const stats = statSync(filePath)
        if (!stats.isFile()) continue
        
        const content = readFileSync(filePath, 'utf-8')
        if (!content.trim()) continue // Skip empty files
        
        const kind = inferSourceKind(filePath)
        const title = extractTitleFromContent(content, filePath)
        const normalizedContent = normalizeContent(content)
        
        files.push({
          path: filePath,
          kind,
          title,
          content: normalizedContent,
          lastModified: stats.mtime,
        })
        
        console.log(`✅ Processed: ${filePath} (${title})`)
      } catch (error) {
        console.error(`❌ Failed to process ${filePath}:`, error)
      }
    }
  }
  
  return files
}

async function updateSourcesRegistry(fileInfo: FileInfo): Promise<void> {
  const supabase = getServiceClient()
  
  const { error } = await supabase
    .from('sources')
    .upsert({
      kind: fileInfo.kind,
      uri: fileInfo.path,
      etag: fileInfo.lastModified.toISOString(),
      last_ingested_at: new Date().toISOString(),
      is_public: true, // KB content is public
      metadata: {
        title: fileInfo.title,
        file_size: fileInfo.content.length,
        last_modified: fileInfo.lastModified.toISOString(),
      },
    }, {
      onConflict: 'uri',
    })
  
  if (error) {
    console.error(`Failed to update sources registry for ${fileInfo.path}:`, error)
  }
}

async function shouldSkipFile(fileInfo: FileInfo): Promise<boolean> {
  const supabase = getServiceClient()
  
  // Check if file exists in sources registry with same etag (lastModified)
  const { data, error } = await supabase
    .from('sources')
    .select('etag, last_ingested_at')
    .eq('uri', fileInfo.path)
    .maybeSingle()
  
  if (error) {
    console.error(`Error checking sources registry for ${fileInfo.path}:`, error)
    return false // Process on error to be safe
  }
  
  if (!data) {
    return false // New file, needs processing
  }
  
  const existingEtag = data.etag
  const currentEtag = fileInfo.lastModified.toISOString()
  
  if (existingEtag === currentEtag) {
    console.log(`⏭️  Skipping unchanged file: ${fileInfo.path}`)
    return true
  }
  
  return false
}

async function ingestFile(fileInfo: FileInfo): Promise<void> {
  console.log(`🔄 Ingesting: ${fileInfo.title} (${fileInfo.path})`)
  
  try {
    const result = await upsertDocument({
      source: fileInfo.kind,
      path: fileInfo.path,
      title: fileInfo.title,
      content: fileInfo.content,
      metadata: {
        kind: fileInfo.kind,
        last_modified: fileInfo.lastModified.toISOString(),
        file_size: fileInfo.content.length,
        word_count: fileInfo.content.split(/\s+/).length,
      },
    })
    
    if (result.skipped) {
      console.log(`⏭️  Document unchanged: ${fileInfo.title}`)
    } else {
      console.log(`✅ Upserted: ${fileInfo.title} (${result.insertedChunks} chunks)`)
    }
    
    // Update sources registry
    await updateSourcesRegistry(fileInfo)
    
  } catch (error) {
    console.error(`❌ Failed to ingest ${fileInfo.path}:`, error)
    throw error
  }
}

async function main(): Promise<void> {
  console.log('🚀 Starting knowledge base ingestion...')
  
  // Check environment variables
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY environment variable is required')
  }
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Supabase environment variables are required')
  }
  
  const startTime = Date.now()
  let processed = 0
  let skipped = 0
  let errors = 0
  
  try {
    // Crawl all files
    const files = await crawlFiles()
    console.log(`\n📊 Found ${files.length} total files`)
    
    // Process each file
    for (const fileInfo of files) {
      try {
        // Check if we should skip this file (unchanged)
        if (await shouldSkipFile(fileInfo)) {
          skipped++
          continue
        }
        
        // Ingest the file
        await ingestFile(fileInfo)
        processed++
        
        // Add small delay to avoid overwhelming the API
        await new Promise(resolve => setTimeout(resolve, 100))
        
      } catch (error) {
        console.error(`❌ Error processing ${fileInfo.path}:`, error)
        errors++
      }
    }
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(1)
    
    console.log('\n🎉 Knowledge base ingestion complete!')
    console.log(`📊 Summary:`)
    console.log(`   • Total files found: ${files.length}`)
    console.log(`   • Files processed: ${processed}`)
    console.log(`   • Files skipped (unchanged): ${skipped}`)
    console.log(`   • Errors: ${errors}`)
    console.log(`   • Duration: ${duration}s`)
    
    if (errors > 0) {
      console.log(`\n⚠️  ${errors} files failed to process. Check logs above.`)
      process.exit(1)
    }
    
  } catch (error) {
    console.error('💥 Fatal error during ingestion:', error)
    process.exit(1)
  }
}

// Run the script
if (require.main === module) {
  main().catch((error) => {
    console.error('💥 Unhandled error:', error)
    process.exit(1)
  })
}

export { main as ingestKnowledgeBase }
