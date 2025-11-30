"use client"

import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext"
import {
  $getSelection,
  $isRangeSelection,
  FORMAT_TEXT_COMMAND,
  FORMAT_ELEMENT_COMMAND,
  UNDO_COMMAND,
  REDO_COMMAND,
  SELECTION_CHANGE_COMMAND,
  COMMAND_PRIORITY_CRITICAL,
} from "lexical"
import {
  $createHeadingNode,
  $createQuoteNode,
  HeadingTagType,
  $isHeadingNode,
  $isQuoteNode,
} from "@lexical/rich-text"
import {
  INSERT_UNORDERED_LIST_COMMAND,
  INSERT_ORDERED_LIST_COMMAND,
  REMOVE_LIST_COMMAND,
} from "@lexical/list"
import { $createLinkNode, $isLinkNode } from "@lexical/link"
import { $setBlocksType, $findMatchingParent } from "@lexical/selection"
import { $getRoot, $createParagraphNode, $isParagraphNode } from "lexical"
import { useCallback, useState, useEffect } from "react"

import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Code,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Link as LinkIcon,
  Image as ImageIcon,
  Undo2,
  Redo2,
} from "lucide-react"

export function Toolbar() {
  const [editor] = useLexicalComposerContext()
  const [isLink, setIsLink] = useState(false)
  const [currentFormat, setCurrentFormat] = useState<string>("paragraph")

  // Update current format based on selection - defined first so it can be used by other functions
  const updateCurrentFormat = useCallback(() => {
    editor.getEditorState().read(() => {
      const selection = $getSelection()
      if ($isRangeSelection(selection)) {
        const anchorNode = selection.anchor.getNode()
        // Get the top-level element (block-level node)
        const element = anchorNode.getTopLevelElementOrThrow()

        if ($isHeadingNode(element)) {
          const tag = element.getTag()
          setCurrentFormat(tag)
        } else if ($isQuoteNode(element)) {
          setCurrentFormat("quote")
        } else if ($isParagraphNode(element)) {
          setCurrentFormat("paragraph")
        } else {
          setCurrentFormat("paragraph")
        }
      } else {
        // No selection, default to paragraph
        setCurrentFormat("paragraph")
      }
    })
  }, [editor])

  const formatText = useCallback(
    (format: "bold" | "italic" | "underline" | "strikethrough" | "code") => {
      editor.update(() => {
        const selection = $getSelection()
        if ($isRangeSelection(selection)) {
          editor.dispatchCommand(FORMAT_TEXT_COMMAND, format)
        }
      })
    },
    [editor]
  )

  const formatHeading = useCallback(
    (headingSize: "h1" | "h2" | "h3") => {
      editor.update(() => {
        const selection = $getSelection()
        if ($isRangeSelection(selection)) {
          $setBlocksType(selection, () => $createHeadingNode(headingSize))
        }
      })
      // Update format after a brief delay to ensure editor state has updated
      setTimeout(() => updateCurrentFormat(), 10)
    },
    [editor, updateCurrentFormat]
  )

  const formatParagraph = useCallback(() => {
    editor.update(() => {
      const selection = $getSelection()
      if ($isRangeSelection(selection)) {
        $setBlocksType(selection, () => $createParagraphNode())
      }
    })
    setTimeout(() => updateCurrentFormat(), 10)
  }, [editor, updateCurrentFormat])

  const formatQuote = useCallback(() => {
    editor.update(() => {
      const selection = $getSelection()
      if ($isRangeSelection(selection)) {
        $setBlocksType(selection, () => $createQuoteNode())
      }
    })
    setTimeout(() => updateCurrentFormat(), 10)
  }, [editor, updateCurrentFormat])

  const formatList = useCallback(
    (listType: "bullet" | "number") => {
      editor.update(() => {
        if (listType === "bullet") {
          editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined)
        } else {
          editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined)
        }
      })
    },
    [editor]
  )

  const insertLink = useCallback(() => {
    const url = prompt("Enter URL:")
    const text = prompt("Enter link text (optional):") || url
    if (url) {
      editor.update(() => {
        const selection = $getSelection()
        if ($isRangeSelection(selection)) {
          if (selection.isCollapsed()) {
            // Insert link at cursor
            const linkNode = $createLinkNode(url)
            linkNode.append($createParagraphNode().appendText(text))
            selection.insertNodes([linkNode])
          } else {
            // Wrap selected text in link
            const linkNode = $createLinkNode(url)
            selection.insertNodes([linkNode])
          }
        }
      })
    }
  }, [editor])

  const insertImage = useCallback(() => {
    const url = prompt("Enter image URL:")
    const alt = prompt("Enter alt text (optional):") || "Image"
    if (url) {
      editor.update(() => {
        const root = $getRoot()
        const paragraph = $createParagraphNode()
        const textNode = paragraph.appendText(`![${alt}](${url})`)
        root.append(paragraph)
        textNode.select()
      })
    }
  }, [editor])

  // Listen to selection changes
  useEffect(() => {
    return editor.registerCommand(
      SELECTION_CHANGE_COMMAND,
      () => {
        updateCurrentFormat()
        return false
      },
      COMMAND_PRIORITY_CRITICAL
    )
  }, [editor, updateCurrentFormat])

  // Initial format check
  useEffect(() => {
    updateCurrentFormat()
  }, [updateCurrentFormat])

  const handleUndo = useCallback(() => {
    editor.dispatchCommand(UNDO_COMMAND, undefined)
  }, [editor])

  const handleRedo = useCallback(() => {
    editor.dispatchCommand(REDO_COMMAND, undefined)
  }, [editor])

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {/* Undo/Redo */}
      <Button
        variant="ghost"
        size="sm"
        className="h-8 w-8 p-0 bg-white/5 hover:bg-white/10 border-white/[0.08] text-white/90"
        onClick={handleUndo}
        title="Undo"
      >
        <Undo2 className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-8 w-8 p-0 bg-white/5 hover:bg-white/10 border-white/[0.08] text-white/90"
        onClick={handleRedo}
        title="Redo"
      >
        <Redo2 className="h-4 w-4" />
      </Button>

      <div className="h-4 w-px bg-white/20 mx-1" />

      {/* Block Format */}
      <Select 
        value={currentFormat}
        onValueChange={(value) => {
          if (value === "paragraph") formatParagraph()
          else if (value === "h1") formatHeading("h1")
          else if (value === "h2") formatHeading("h2")
          else if (value === "h3") formatHeading("h3")
          else if (value === "quote") formatQuote()
        }}
      >
        <SelectTrigger className="h-8 w-[140px] bg-white/5 border-white/[0.08] text-white/90 text-xs">
          <SelectValue placeholder="Format" />
        </SelectTrigger>
        <SelectContent className="bg-[#1a1a1a] border-white/[0.08]">
          <SelectItem value="paragraph" className="text-white/90">Paragraph</SelectItem>
          <SelectItem value="h1" className="text-white/90">Heading 1</SelectItem>
          <SelectItem value="h2" className="text-white/90">Heading 2</SelectItem>
          <SelectItem value="h3" className="text-white/90">Heading 3</SelectItem>
          <SelectItem value="quote" className="text-white/90">Quote</SelectItem>
        </SelectContent>
      </Select>

      <div className="h-4 w-px bg-white/20 mx-1" />

      {/* Text Format */}
      <Button
        variant="ghost"
        size="sm"
        className="h-8 w-8 p-0 bg-white/5 hover:bg-white/10 border-white/[0.08] text-white/90"
        onClick={() => formatText("bold")}
        title="Bold"
      >
        <Bold className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-8 w-8 p-0 bg-white/5 hover:bg-white/10 border-white/[0.08] text-white/90"
        onClick={() => formatText("italic")}
        title="Italic"
      >
        <Italic className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-8 w-8 p-0 bg-white/5 hover:bg-white/10 border-white/[0.08] text-white/90"
        onClick={() => formatText("underline")}
        title="Underline"
      >
        <Underline className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-8 w-8 p-0 bg-white/5 hover:bg-white/10 border-white/[0.08] text-white/90"
        onClick={() => formatText("strikethrough")}
        title="Strikethrough"
      >
        <Strikethrough className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-8 w-8 p-0 bg-white/5 hover:bg-white/10 border-white/[0.08] text-white/90"
        onClick={() => formatText("code")}
        title="Code"
      >
        <Code className="h-4 w-4" />
      </Button>

      <div className="h-4 w-px bg-white/20 mx-1" />

      {/* Lists */}
      <Button
        variant="ghost"
        size="sm"
        className="h-8 w-8 p-0 bg-white/5 hover:bg-white/10 border-white/[0.08] text-white/90"
        onClick={() => formatList("bullet")}
        title="Bullet List"
      >
        <List className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-8 w-8 p-0 bg-white/5 hover:bg-white/10 border-white/[0.08] text-white/90"
        onClick={() => formatList("number")}
        title="Numbered List"
      >
        <ListOrdered className="h-4 w-4" />
      </Button>

      <div className="h-4 w-px bg-white/20 mx-1" />

      {/* Link & Image */}
      <Button
        variant="ghost"
        size="sm"
        className="h-8 w-8 p-0 bg-white/5 hover:bg-white/10 border-white/[0.08] text-white/90"
        onClick={insertLink}
        title="Insert Link"
      >
        <LinkIcon className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-8 w-8 p-0 bg-white/5 hover:bg-white/10 border-white/[0.08] text-white/90"
        onClick={insertImage}
        title="Insert Image"
      >
        <ImageIcon className="h-4 w-4" />
      </Button>
    </div>
  )
}

