"use client"

import { useCallback, useEffect, useRef } from "react"
import { LexicalComposer } from "@lexical/react/LexicalComposer"
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin"
import { ContentEditable } from "@lexical/react/LexicalContentEditable"
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin"
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin"
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary"
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext"
import { EditorState } from "lexical"
import { HeadingNode, QuoteNode } from "@lexical/rich-text"
import { ListItemNode, ListNode } from "@lexical/list"
import { LinkNode } from "@lexical/link"
import { CodeNode, CodeHighlightNode } from "@lexical/code"
import { $getRoot } from "lexical"
import { $convertFromMarkdownString, $convertToMarkdownString } from "@lexical/markdown"
import { TRANSFORMERS } from "@lexical/markdown"

import { Toolbar } from "./toolbar"
import { editorTheme } from "./editor-theme"

const initialConfig = {
  namespace: "CampaignEditor",
  theme: editorTheme,
  nodes: [
    HeadingNode,
    ListNode,
    ListItemNode,
    QuoteNode,
    CodeNode,
    CodeHighlightNode,
    LinkNode,
  ],
  onError: (error: Error) => {
    console.error("Lexical error:", error)
  },
}

interface CampaignEditorProps {
  value?: string // Markdown string
  onChange?: (value: string) => void
  placeholder?: string
  readOnly?: boolean
}

// Component to initialize editor with markdown
function InitializePlugin({ value, isInitialized }: { value?: string; isInitialized: React.MutableRefObject<boolean> }) {
  const [editor] = useLexicalComposerContext()
  const initializedValue = useRef<string | undefined>(undefined)
  const hasInitialized = useRef(false)

  useEffect(() => {
    // Only initialize when we have a value and haven't initialized yet
    // This handles both initial mount with content and content loading after mount
    if (value && value.trim().length > 0 && !hasInitialized.current) {
      // Use a small delay to ensure editor is fully ready
      const timeoutId = setTimeout(() => {
        editor.getEditorState().read(() => {
          const root = $getRoot()
          // Check if editor is effectively empty (only has empty paragraph or no content)
          const children = root.getChildren()
          const isEmpty = children.length === 0 || 
            (children.length === 1 && children[0].getTextContent().trim() === '')
          
          if (isEmpty && initializedValue.current !== value) {
            editor.update(() => {
              const root = $getRoot()
              root.clear()
              try {
                $convertFromMarkdownString(value, TRANSFORMERS)
                isInitialized.current = true
                hasInitialized.current = true
                initializedValue.current = value
              } catch (error) {
                console.error('Failed to convert markdown:', error)
              }
            })
          }
        })
      }, 150) // Increased delay to ensure editor is ready
      
      return () => clearTimeout(timeoutId)
    }
    // Handle case where value changes externally (e.g., loaded from database after mount)
    // This happens when content loads after the editor has already mounted empty
    else if (value && value.trim().length > 0 && hasInitialized.current && initializedValue.current !== value) {
      // Get current editor content
      const currentContent = editor.getEditorState().read(() => {
        const root = $getRoot()
        const children = root.getChildren()
        const isEmpty = children.length === 0 || 
          (children.length === 1 && children[0].getTextContent().trim() === '')
        
        if (isEmpty) {
          return '' // Editor is empty
        }
        return $convertToMarkdownString(TRANSFORMERS)
      })
      
      // If editor is empty but we have a value, this is an external load
      // Or if the value is significantly different (more than 50% length difference)
      const isEditorEmpty = currentContent.trim() === ''
      const lengthDiff = Math.abs(value.length - currentContent.length)
      const avgLength = (value.length + currentContent.length) / 2
      const isSignificantlyDifferent = avgLength > 0 && (lengthDiff / avgLength) > 0.5
      
      if (isEditorEmpty || isSignificantlyDifferent) {
        editor.update(() => {
          const root = $getRoot()
          root.clear()
          try {
            $convertFromMarkdownString(value, TRANSFORMERS)
            initializedValue.current = value
          } catch (error) {
            console.error('Failed to convert markdown:', error)
          }
        })
      }
    }
  }, [editor, value, isInitialized])

  return null
}

export function CampaignEditor({
  value,
  onChange,
  placeholder = "Start typing...",
  readOnly = false,
}: CampaignEditorProps) {
  const isInitialized = useRef(false)

  const handleChange = useCallback(
    (editorState: EditorState) => {
      editorState.read(() => {
        const markdown = $convertToMarkdownString(TRANSFORMERS)
        onChange?.(markdown)
      })
    },
    [onChange]
  )

  return (
    <div className="flex flex-col h-full w-full">
      <LexicalComposer initialConfig={initialConfig}>
        <div className="flex flex-col h-full w-full rounded-lg border border-white/[0.08] bg-white/[0.02] overflow-hidden">
          {/* Toolbar - fixed at top */}
          {!readOnly && (
            <div className="border-b border-white/[0.08] bg-white/[0.03] px-3 py-2.5 flex-shrink-0 z-10">
              <Toolbar />
            </div>
          )}

          {/* Editor Content - scrollable area with fixed height */}
          <div className="relative flex-1 overflow-y-auto overflow-x-hidden min-h-0">
            <RichTextPlugin
              contentEditable={
                <ContentEditable
                  className="min-h-full px-4 py-4 outline-none prose prose-invert max-w-none
                    prose-headings:text-white prose-p:text-white/90 prose-strong:text-white
                    prose-code:text-white/90 prose-pre:bg-white/[0.05] prose-blockquote:border-white/30
                    prose-a:text-primary focus:outline-none"
                />
              }
              placeholder={
                <div className="absolute top-4 left-4 text-white/40 pointer-events-none text-sm">
                  {placeholder}
                </div>
              }
              ErrorBoundary={LexicalErrorBoundary}
            />
          </div>
        </div>

        <InitializePlugin value={value} isInitialized={isInitialized} />
        <HistoryPlugin />
        <OnChangePlugin onChange={handleChange} ignoreSelectionChange />
      </LexicalComposer>
    </div>
  )
}

