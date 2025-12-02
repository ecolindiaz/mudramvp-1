import type { MultilineElementTransformer } from "@lexical/markdown"
import {
  $createTableCellNode,
  $createTableNode,
  $createTableRowNode,
  $isTableCellNode,
  $isTableNode,
  $isTableRowNode,
  TableCellHeaderStates,
  TableCellNode,
  TableNode,
  TableRowNode,
} from "@lexical/table"
import { $createParagraphNode, $createTextNode, $isParagraphNode, type LexicalNode } from "lexical"
import { marked } from "marked"

// Configure marked for GFM tables
marked.setOptions({
  gfm: true, // Enable GitHub Flavored Markdown (includes tables)
  breaks: false,
})

// Parse a table row into cells - handles both with and without leading/trailing pipes
function parseTableRow(line: string): string[] {
  const trimmed = line.trim()
  // Remove leading and trailing pipes if present
  let content = trimmed
  if (content.startsWith("|")) {
    content = content.slice(1)
  }
  if (content.endsWith("|")) {
    content = content.slice(0, -1)
  }
  // Split by | and trim each cell
  return content.split("|").map((cell) => cell.trim())
}

// Check if a line is a table separator (e.g., |---|---|--- or ---|---|---)
function isTableSeparator(line: string): boolean {
  const trimmed = line.trim()
  if (!trimmed) return false
  // Remove leading/trailing pipes
  let content = trimmed
  if (content.startsWith("|")) {
    content = content.slice(1)
  }
  if (content.endsWith("|")) {
    content = content.slice(0, -1)
  }
  // Check if it only contains dashes, colons, pipes, and spaces (alignment indicators)
  return /^[\s:\-|]+$/.test(content) && content.includes("-")
}

// Check if a line looks like a table row (has at least 2 pipes)
function isTableRow(line: string): boolean {
  const trimmed = line.trim()
  if (!trimmed) return false
  const pipeCount = (trimmed.match(/\|/g) || []).length
  return pipeCount >= 2
}

/**
 * MultilineElementTransformer for markdown tables
 * Uses marked library to convert markdown tables to HTML, then creates Lexical nodes
 */
export const TABLE_TRANSFORMER: MultilineElementTransformer = {
  dependencies: [TableNode, TableRowNode, TableCellNode],
  type: "multiline-element",
  
  // Match the start of a table (header row with pipes)
  regExpStart: /^\|?.+\|.+\|?\s*$/,
  
  // Tables don't have a specific end marker
  regExpEnd: {
    optional: true,
    regExp: /^$/,  // Empty line ends the table
  },
  
  // Custom handler for importing table content
  handleImportAfterStartMatch: ({ lines, rootNode, startLineIndex }) => {
    // Check if the next line is a separator (required for valid markdown table)
    if (startLineIndex + 1 >= lines.length) {
      return null // Not a valid table
    }
    
    const separatorLine = lines[startLineIndex + 1]
    if (!isTableSeparator(separatorLine)) {
      return null // Not a valid table - no separator line
    }
    
    // Parse header row
    const headerCells = parseTableRow(lines[startLineIndex])
    if (headerCells.length < 2) {
      return null // Not a valid table - needs at least 2 columns
    }
    
    // Find all body rows
    const bodyRows: string[][] = []
    let lastLineIndex = startLineIndex + 1 // Start after separator
    
    for (let i = startLineIndex + 2; i < lines.length; i++) {
      const line = lines[i]
      const trimmed = line.trim()
      
      if (!trimmed) {
        // Empty line - end of table
        lastLineIndex = i - 1
        break
      }
      if (!isTableRow(line)) {
        // Not a table row - end of table
        lastLineIndex = i - 1
        break
      }
      if (isTableSeparator(line)) {
        // Another separator (shouldn't happen but skip it)
        lastLineIndex = i
        continue
      }
      bodyRows.push(parseTableRow(line))
      lastLineIndex = i
    }
    
    // Create the table node
    const tableNode = $createTableNode()
    
    // Create header row
    const headerRowNode = $createTableRowNode()
    for (const cellText of headerCells) {
      const cellNode = $createTableCellNode(TableCellHeaderStates.ROW)
      const paragraphNode = $createParagraphNode()
      paragraphNode.append($createTextNode(cellText))
      cellNode.append(paragraphNode)
      headerRowNode.append(cellNode)
    }
    tableNode.append(headerRowNode)
    
    // Create body rows
    for (const rowCells of bodyRows) {
      const rowNode = $createTableRowNode()
      // Ensure we have the same number of cells as headers
      for (let i = 0; i < headerCells.length; i++) {
        const cellText = rowCells[i] || ""
        const cellNode = $createTableCellNode(TableCellHeaderStates.NO_STATUS)
        const paragraphNode = $createParagraphNode()
        paragraphNode.append($createTextNode(cellText))
        cellNode.append(paragraphNode)
        rowNode.append(cellNode)
      }
      tableNode.append(rowNode)
    }
    
    // Append the table to the root node
    rootNode.append(tableNode)
    
    // Return [true, lastLineIndex] to indicate successful import
    return [true, lastLineIndex] as [boolean, number]
  },
  
  // Replace function (fallback, not typically used)
  replace: () => {
    return false
  },
  
  // Export function - convert table node to markdown
  export: (node: LexicalNode) => {
    if (!$isTableNode(node)) {
      return null
    }

    const rows = node.getChildren()
    if (rows.length === 0) {
      return null
    }

    const lines: string[] = []
    let isFirstRow = true

    for (const row of rows) {
      if (!$isTableRowNode(row)) {
        continue
      }

      const cells = row.getChildren()
      const cellContents: string[] = []

      for (const cell of cells) {
        if (!$isTableCellNode(cell)) {
          continue
        }

        // Get the text content of the cell
        const paragraphs = cell.getChildren()
        const textParts: string[] = []
        
        for (const paragraph of paragraphs) {
          if ($isParagraphNode(paragraph)) {
            textParts.push(paragraph.getTextContent())
          } else {
            textParts.push(paragraph.getTextContent())
          }
        }
        
        cellContents.push(textParts.join(" "))
      }

      // Build the row string
      const rowString = "| " + cellContents.join(" | ") + " |"
      lines.push(rowString)

      // After the first row (header), add the separator
      if (isFirstRow) {
        const separator = "| " + cellContents.map(() => "---").join(" | ") + " |"
        lines.push(separator)
        isFirstRow = false
      }
    }

    return lines.join("\n")
  },
}

/**
 * Converts markdown tables to HTML using the marked library.
 * This is used as an alternative approach for importing tables.
 */
export function convertMarkdownTablesToHtml(markdown: string): string {
  // Use marked to convert markdown to HTML (it handles GFM tables)
  const html = marked.parse(markdown)
  return typeof html === 'string' ? html : ''
}

/**
 * Pre-processes markdown content and normalizes tables for better parsing.
 * Ensures tables have pipes at start and end of each row.
 */
export function preprocessMarkdownTables(markdown: string): string {
  const lines = markdown.split("\n")
  const result: string[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]
    const trimmed = line.trim()

    // Check if this might be a table row (contains multiple |)
    const pipeCount = (trimmed.match(/\|/g) || []).length
    
    // If we have at least 2 pipes and the next line is a separator, it's a table
    if (pipeCount >= 2 && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      // Found a table! Process it
      const tableLines: string[] = []
      
      // Add header row (ensure it has pipes at start and end)
      tableLines.push(normalizeTableRow(trimmed))
      i++
      
      // Add separator row
      tableLines.push(normalizeTableRow(lines[i].trim()))
      i++
      
      // Add body rows
      while (i < lines.length) {
        const bodyLine = lines[i].trim()
        if (!bodyLine) {
          // Empty line - end of table, add it to preserve structure
          tableLines.push("")
          i++
          break
        }
        const bodyPipeCount = (bodyLine.match(/\|/g) || []).length
        
        if (bodyPipeCount >= 2 && !isTableSeparator(bodyLine)) {
          tableLines.push(normalizeTableRow(bodyLine))
          i++
        } else {
          break
        }
      }
      
      // Add all table lines
      result.push(...tableLines)
    } else {
      result.push(line)
      i++
    }
  }

  return result.join("\n")
}

// Normalize a table row to have pipes at start and end
function normalizeTableRow(row: string): string {
  let normalized = row.trim()
  if (!normalized.startsWith("|")) {
    normalized = "| " + normalized
  }
  if (!normalized.endsWith("|")) {
    normalized = normalized + " |"
  }
  return normalized
}

/**
 * Extracts table sections from markdown and returns them separately.
 * Useful for handling tables with HTML import while keeping other content as markdown.
 */
export function extractTableSections(markdown: string): {
  sections: Array<{ type: 'markdown' | 'table', content: string }>,
  hasTable: boolean
} {
  const lines = markdown.split("\n")
  const sections: Array<{ type: 'markdown' | 'table', content: string }> = []
  let currentMarkdown: string[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]
    const trimmed = line.trim()
    const pipeCount = (trimmed.match(/\|/g) || []).length

    // Check if this is the start of a table
    if (pipeCount >= 2 && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      // Save any accumulated markdown
      if (currentMarkdown.length > 0) {
        sections.push({ type: 'markdown', content: currentMarkdown.join("\n") })
        currentMarkdown = []
      }

      // Collect table lines
      const tableLines: string[] = []
      tableLines.push(normalizeTableRow(trimmed))
      i++
      tableLines.push(normalizeTableRow(lines[i].trim()))
      i++

      while (i < lines.length) {
        const bodyLine = lines[i].trim()
        if (!bodyLine) {
          i++
          break
        }
        const bodyPipeCount = (bodyLine.match(/\|/g) || []).length
        if (bodyPipeCount >= 2 && !isTableSeparator(bodyLine)) {
          tableLines.push(normalizeTableRow(bodyLine))
          i++
        } else {
          break
        }
      }

      sections.push({ type: 'table', content: tableLines.join("\n") })
    } else {
      currentMarkdown.push(line)
      i++
    }
  }

  // Save any remaining markdown
  if (currentMarkdown.length > 0) {
    sections.push({ type: 'markdown', content: currentMarkdown.join("\n") })
  }

  return {
    sections,
    hasTable: sections.some(s => s.type === 'table')
  }
}
