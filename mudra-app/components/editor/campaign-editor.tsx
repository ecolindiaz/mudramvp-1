"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { LexicalComposer } from "@lexical/react/LexicalComposer"
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin"
import { ContentEditable } from "@lexical/react/LexicalContentEditable"
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin"
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin"
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary"
import { ListPlugin } from "@lexical/react/LexicalListPlugin"
import { LinkPlugin } from "@lexical/react/LexicalLinkPlugin"
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext"
import { EditorState, $getSelection, $isRangeSelection } from "lexical"
import { HeadingNode, QuoteNode } from "@lexical/rich-text"
import { ListItemNode, ListNode } from "@lexical/list"
import { LinkNode, $isLinkNode } from "@lexical/link"
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
  showToolbar?: boolean
}

// Floating link preview component
function FloatingLinkPlugin() {
  const [editor] = useLexicalComposerContext()
  const [linkUrl, setLinkUrl] = useState<string | null>(null)
  const [position, setPosition] = useState({ top: 0, left: 0 })
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const handleMouseOver = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      const linkElement = target.closest('a')
      
      if (linkElement && linkElement.href) {
        const rect = linkElement.getBoundingClientRect()
        const editorElement = document.querySelector('[data-lexical-editor]')
        const editorRect = editorElement?.getBoundingClientRect()
        
        if (editorRect) {
          setLinkUrl(linkElement.href)
          setPosition({
            top: rect.bottom - editorRect.top + 4,
            left: rect.left - editorRect.left,
          })
          setIsVisible(true)
        }
      }
    }

    const handleMouseOut = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      const relatedTarget = event.relatedTarget as HTMLElement
      
      // Check if we're leaving a link and not entering the tooltip
      if (target.closest('a') && !relatedTarget?.closest('.link-preview-tooltip')) {
        setIsVisible(false)
      }
    }

    const editorElement = document.querySelector('[data-lexical-editor]')
    if (editorElement) {
      editorElement.addEventListener('mouseover', handleMouseOver as EventListener)
      editorElement.addEventListener('mouseout', handleMouseOut as EventListener)
    }

    return () => {
      if (editorElement) {
        editorElement.removeEventListener('mouseover', handleMouseOver as EventListener)
        editorElement.removeEventListener('mouseout', handleMouseOut as EventListener)
      }
    }
  }, [editor])

  if (!isVisible || !linkUrl) return null

  return (
    <div
      className="link-preview-tooltip absolute z-50 px-3 py-1.5 rounded-md bg-[#1a1a1a] border border-white/[0.12] shadow-lg text-xs text-white/80 max-w-[300px] truncate"
      style={{ top: position.top, left: position.left }}
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      <span className="text-primary/80 mr-1">🔗</span>
      {linkUrl}
    </div>
  )
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
  showToolbar = false,
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
      <LexicalComposer initialConfig={{ ...initialConfig, editable: !readOnly }}>
        <div className="flex flex-col h-full w-full rounded-lg border border-white/[0.08] bg-white/[0.02] overflow-hidden">
          {/* Toolbar - fixed at top, only shown when showToolbar is true and not readOnly */}
          {!readOnly && showToolbar && (
            <div className="border-b border-white/[0.08] bg-white/[0.03] px-3 py-2.5 flex-shrink-0 z-10">
              <Toolbar />
            </div>
          )}

          {/* Editor Content - scrollable area with fixed height */}
          <div className="relative flex-1 overflow-y-auto overflow-x-hidden min-h-0">
            <style jsx global>{`
              /* Block type labels - positioned in left margin */
              .editor-with-labels .editor-h1,
              .editor-with-labels .editor-h2,
              .editor-with-labels .editor-h3,
              .editor-with-labels .editor-h4,
              .editor-with-labels .editor-p {
                position: relative;
              }
              .editor-with-labels .editor-h1::before,
              .editor-with-labels .editor-h2::before,
              .editor-with-labels .editor-h3::before,
              .editor-with-labels .editor-h4::before,
              .editor-with-labels .editor-p::before {
                position: absolute;
                left: -40px;
                top: 50%;
                transform: translateY(-50%);
                font-size: 9px;
                font-weight: 600;
                padding: 2px 5px;
                border-radius: 3px;
                font-family: ui-monospace, monospace;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                white-space: nowrap;
              }
              .editor-with-labels .editor-h1::before {
                content: 'H1';
                color: rgba(255, 255, 255, 0.65);
                background: rgba(255, 255, 255, 0.08);
              }
              .editor-with-labels .editor-h2::before {
                content: 'H2';
                color: rgba(255, 255, 255, 0.65);
                background: rgba(255, 255, 255, 0.08);
              }
              .editor-with-labels .editor-h3::before {
                content: 'H3';
                color: rgba(255, 255, 255, 0.65);
                background: rgba(255, 255, 255, 0.08);
              }
              .editor-with-labels .editor-h4::before {
                content: 'H4';
                color: rgba(255, 255, 255, 0.65);
                background: rgba(255, 255, 255, 0.08);
              }
              .editor-with-labels .editor-p::before {
                content: 'P';
                color: rgba(255, 255, 255, 0.4);
                background: rgba(255, 255, 255, 0.04);
              }
              /* Lists - label above the list */
              .editor-with-labels .editor-ul,
              .editor-with-labels .editor-ol {
                position: relative;
                margin-top: 1.5rem;
              }
              .editor-with-labels .editor-ul::before,
              .editor-with-labels .editor-ol::before {
                position: absolute;
                top: -1.25rem;
                left: 0;
                font-size: 9px;
                font-weight: 600;
                padding: 2px 5px;
                border-radius: 3px;
                font-family: ui-monospace, monospace;
                text-transform: uppercase;
                letter-spacing: 0.5px;
              }
              .editor-with-labels .editor-ul::before {
                content: 'BULLET LIST';
                color: rgba(255, 255, 255, 0.6);
                background: rgba(255, 255, 255, 0.06);
              }
              .editor-with-labels .editor-ol::before {
                content: 'NUMBERED LIST';
                color: rgba(255, 255, 255, 0.6);
                background: rgba(255, 255, 255, 0.06);
              }
              /* Quote - label above */
              .editor-with-labels .editor-quote {
                position: relative;
                margin-top: 1.5rem;
              }
              .editor-with-labels .editor-quote::before {
                content: 'QUOTE';
                position: absolute;
                top: -1.25rem;
                left: 0;
                font-size: 9px;
                font-weight: 600;
                color: rgba(255, 255, 255, 0.6);
                background: rgba(255, 255, 255, 0.06);
                padding: 2px 5px;
                border-radius: 3px;
                font-family: ui-monospace, monospace;
                text-transform: uppercase;
                letter-spacing: 0.5px;
              }
            `}</style>
            <RichTextPlugin
              contentEditable={
                <ContentEditable
                  className="editor-with-labels min-h-full pl-12 pr-4 py-4 outline-none prose prose-invert max-w-none
                    prose-headings:text-white prose-p:text-white/90 prose-strong:text-white
                    prose-code:text-white/90 prose-pre:bg-white/[0.05] prose-blockquote:border-white/30
                    prose-a:text-blue-400 focus:outline-none"
                />
              }
              placeholder={
                <div className="absolute top-4 left-12 text-white/40 pointer-events-none text-sm">
                  {placeholder}
                </div>
              }
              ErrorBoundary={LexicalErrorBoundary}
            />
            <FloatingLinkPlugin />
          </div>
        </div>

        <InitializePlugin value={value} isInitialized={isInitialized} />
        <HistoryPlugin />
        <ListPlugin />
        <LinkPlugin />
        <OnChangePlugin onChange={handleChange} ignoreSelectionChange />
      </LexicalComposer>
    </div>
  )
}

