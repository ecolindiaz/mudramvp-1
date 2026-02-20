"use client"

import React, { useMemo } from "react"
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"

/**
 * Custom dark theme inspired by Linear's code rendering.
 * Darker background, muted palette, clean type hierarchy.
 */
const linearDarkTheme: Record<string, React.CSSProperties> = {
  'code[class*="language-"]': {
    color: "#c9d1d9",
    fontFamily: '"JetBrains Mono", "Fira Code", "SF Mono", Menlo, Monaco, "Courier New", monospace',
    fontSize: "13px",
    lineHeight: "1.6",
    direction: "ltr",
    textAlign: "left",
    whiteSpace: "pre",
    wordSpacing: "normal",
    wordBreak: "normal",
    tabSize: 2,
  },
  'pre[class*="language-"]': {
    color: "#c9d1d9",
    fontFamily: '"JetBrains Mono", "Fira Code", "SF Mono", Menlo, Monaco, "Courier New", monospace',
    fontSize: "13px",
    lineHeight: "1.6",
    direction: "ltr",
    textAlign: "left",
    whiteSpace: "pre",
    wordSpacing: "normal",
    wordBreak: "normal",
    tabSize: 2,
    padding: "16px",
    margin: "0",
    overflow: "auto",
    background: "#0d0d0d",
    borderRadius: "8px",
  },
  // Comments — muted gray
  comment: { color: "#6b7280" },
  prolog: { color: "#6b7280" },
  doctype: { color: "#6b7280" },
  cdata: { color: "#6b7280" },
  // Punctuation — subtle gray
  punctuation: { color: "#6b7280" },
  // Tags — soft blue
  tag: { color: "#7aa2f7" },
  // Attribute names — muted lavender
  "attr-name": { color: "#bb9af7" },
  // Attribute values / strings — cyan-blue
  "attr-value": { color: "#9ecbff" },
  string: { color: "#9ecbff" },
  // Numbers — warm orange
  number: { color: "#f0a672" },
  // Booleans, constants — orange
  boolean: { color: "#f0a672" },
  constant: { color: "#f0a672" },
  // Keywords — soft purple
  keyword: { color: "#c792ea" },
  // Functions — light blue
  function: { color: "#82aaff" },
  // Property names (JSON keys) — white
  property: { color: "#e6edf3" },
  // Operators — gray
  operator: { color: "#8b949e" },
  // Selectors, class names — green
  selector: { color: "#7ee787" },
  "class-name": { color: "#7ee787" },
  // Regex — cyan
  regex: { color: "#56d4dd" },
  // Important — bold
  important: { fontWeight: "bold" },
  bold: { fontWeight: "bold" },
  italic: { fontStyle: "italic" },
  // Namespace — dimmed
  namespace: { opacity: 0.7 },
}

function detectLanguage(code: string): string {
  const trimmed = code.trim()

  // JSON-LD or JSON
  if (
    trimmed.startsWith("{") ||
    trimmed.startsWith("[") ||
    trimmed.includes('"@context"') ||
    trimmed.includes('"@type"')
  ) {
    return "json"
  }

  // HTML / XML (tags, comments, doctype)
  if (
    trimmed.startsWith("<") ||
    trimmed.includes("<!") ||
    trimmed.includes("</") ||
    /^<[a-zA-Z!]/.test(trimmed)
  ) {
    return "html"
  }

  // JavaScript patterns
  if (
    trimmed.includes("function ") ||
    trimmed.includes("const ") ||
    trimmed.includes("let ") ||
    trimmed.includes("var ") ||
    trimmed.includes("=>") ||
    trimmed.includes("document.") ||
    trimmed.includes("window.")
  ) {
    return "javascript"
  }

  // CSS
  if (trimmed.includes("{") && (trimmed.includes(":") && trimmed.includes(";"))) {
    return "css"
  }

  return "html" // Default for schema/markup content
}

interface CodeBlockProps {
  code: string
  language?: string
  maxHeight?: string
  className?: string
  wrapLines?: boolean
  showLineNumbers?: boolean
}

export function CodeBlock({
  code,
  language,
  maxHeight = "50vh",
  className = "",
  wrapLines = true,
  showLineNumbers = false,
}: CodeBlockProps) {
  const detectedLanguage = useMemo(
    () => language || detectLanguage(code),
    [code, language]
  )

  return (
    <div className={`relative rounded-lg overflow-hidden ${className}`}>
      <div
        className="overflow-auto"
        style={{ maxHeight }}
      >
        <SyntaxHighlighter
          language={detectedLanguage}
          style={linearDarkTheme}
          showLineNumbers={showLineNumbers}
          wrapLongLines={wrapLines}
          customStyle={{
            background: "#0d0d0d",
            borderRadius: "8px",
            border: "1px solid rgba(255, 255, 255, 0.06)",
            margin: 0,
            padding: "16px",
          }}
          codeTagProps={{
            style: {
              fontFamily: '"JetBrains Mono", "Fira Code", "SF Mono", Menlo, Monaco, "Courier New", monospace',
              fontSize: "13px",
              lineHeight: "1.6",
            },
          }}
          lineNumberStyle={{
            color: "rgba(255, 255, 255, 0.15)",
            fontSize: "11px",
            minWidth: "2.5em",
            paddingRight: "1em",
            userSelect: "none",
          }}
        >
          {code}
        </SyntaxHighlighter>
      </div>
    </div>
  )
}
