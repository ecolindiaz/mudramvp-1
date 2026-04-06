"use client"

import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext"
import {
  $getSelection,
  $isRangeSelection,
  FORMAT_TEXT_COMMAND,
  UNDO_COMMAND,
  REDO_COMMAND,
  SELECTION_CHANGE_COMMAND,
  COMMAND_PRIORITY_CRITICAL,
  $createTextNode,
  $getRoot,
  $createParagraphNode,
  $isParagraphNode,
} from "lexical"
import {
  $createHeadingNode,
  $createQuoteNode,
  $isHeadingNode,
  $isQuoteNode,
} from "@lexical/rich-text"
import {
  INSERT_UNORDERED_LIST_COMMAND,
  INSERT_ORDERED_LIST_COMMAND,
  $isListNode,
  ListNode,
} from "@lexical/list"
import { $isListItemNode } from "@lexical/list"
import { $createLinkNode, TOGGLE_LINK_COMMAND } from "@lexical/link"
import { $setBlocksType } from "@lexical/selection"
import { useCallback, useState, useEffect } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
  List,
  ListOrdered,
  Link as LinkIcon,
  Undo2,
  Redo2,
} from "lucide-react"

export function Toolbar() {
  const [editor] = useLexicalComposerContext()
  const [isLink, setIsLink] = useState(false)
  const [currentFormat, setCurrentFormat] = useState<string>("paragraph")
  const [isBulletList, setIsBulletList] = useState(false)
  const [isNumberList, setIsNumberList] = useState(false)
  
  // Dialog states
  const [linkDialogOpen, setLinkDialogOpen] = useState(false)
  const [linkUrl, setLinkUrl] = useState("")
  const [linkText, setLinkText] = useState("")
  const [hasSelectedText, setHasSelectedText] = useState(false)

  // Update current format based on selection - defined first so it can be used by other functions
  const updateCurrentFormat = useCallback(() => {
    editor.getEditorState().read(() => {
      const selection = $getSelection()
      if ($isRangeSelection(selection)) {
        const anchorNode = selection.anchor.getNode()
        // Get the top-level element (block-level node)
        const element = anchorNode.getTopLevelElementOrThrow()

        // Check for list - traverse up to find ListNode
        let parent = anchorNode.getParent()
        let foundBulletList = false
        let foundNumberList = false
        
        while (parent !== null) {
          if ($isListNode(parent)) {
            const listType = parent.getListType()
            if (listType === 'bullet') {
              foundBulletList = true
            } else if (listType === 'number') {
              foundNumberList = true
            }
            break
          }
          parent = parent.getParent()
        }
        
        setIsBulletList(foundBulletList)
        setIsNumberList(foundNumberList)

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
        setIsBulletList(false)
        setIsNumberList(false)
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
      // Simply dispatch the list command - Lexical handles the conversion
      if (listType === "bullet") {
        editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined)
      } else {
        editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined)
      }
      setTimeout(() => updateCurrentFormat(), 20)
    },
    [editor, updateCurrentFormat]
  )

  const openLinkDialog = useCallback(() => {
    editor.getEditorState().read(() => {
      const selection = $getSelection()
      const hasSelection = $isRangeSelection(selection) && !selection.isCollapsed()
      const selectedText = hasSelection ? selection.getTextContent() : ""
      
      setHasSelectedText(hasSelection && selectedText.length > 0)
      setLinkText(selectedText || "")
      setLinkUrl("https://")
      setLinkDialogOpen(true)
    })
  }, [editor])

  const insertLink = useCallback(() => {
    if (!linkUrl || linkUrl === "https://") {
      setLinkDialogOpen(false)
      return
    }
    
    if (hasSelectedText) {
      // Text is selected - wrap it in a link using TOGGLE_LINK_COMMAND
      editor.dispatchCommand(TOGGLE_LINK_COMMAND, linkUrl)
    } else {
      // No selection - insert link with text
      const textToUse = linkText || linkUrl
      editor.update(() => {
        const selection = $getSelection()
        if ($isRangeSelection(selection)) {
          const linkNode = $createLinkNode(linkUrl)
          const textNode = $createTextNode(textToUse)
          linkNode.append(textNode)
          selection.insertNodes([linkNode])
        }
      })
    }
    
    setLinkDialogOpen(false)
    setLinkUrl("")
    setLinkText("")
  }, [editor, linkUrl, linkText, hasSelectedText])

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

  const iconBtn = "h-7 w-7 p-0 rounded-lg text-white/60 hover:text-white hover:bg-white/[0.08] transition-colors"
  const iconBtnActive = "h-7 w-7 p-0 rounded-lg bg-white/[0.12] text-white transition-colors"
  const divider = "h-4 w-px bg-white/[0.08] mx-0.5"

  return (
    <div className="flex items-center gap-0.5">
      {/* Undo/Redo */}
      <button type="button" className={iconBtn} onClick={handleUndo} title="Undo">
        <Undo2 className="h-3.5 w-3.5 mx-auto" />
      </button>
      <button type="button" className={iconBtn} onClick={handleRedo} title="Redo">
        <Redo2 className="h-3.5 w-3.5 mx-auto" />
      </button>

      <div className={divider} />

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
        <SelectTrigger className="h-7 w-[110px] bg-transparent border-0 text-white/60 text-[11px] font-medium hover:text-white hover:bg-white/[0.06] rounded-lg px-2 gap-1 focus:ring-0 focus:ring-offset-0">
          <SelectValue placeholder="Format" />
        </SelectTrigger>
        <SelectContent className="bg-[#1e1e1e] border-white/[0.10] rounded-lg shadow-xl shadow-black/40">
          <SelectItem value="paragraph" className="text-white/80 text-xs">Paragraph</SelectItem>
          <SelectItem value="h1" className="text-white/80 text-xs">Heading 1</SelectItem>
          <SelectItem value="h2" className="text-white/80 text-xs">Heading 2</SelectItem>
          <SelectItem value="h3" className="text-white/80 text-xs">Heading 3</SelectItem>
          <SelectItem value="quote" className="text-white/80 text-xs">Quote</SelectItem>
        </SelectContent>
      </Select>

      <div className={divider} />

      {/* Text Format */}
      <button type="button" className={iconBtn} onClick={() => formatText("bold")} title="Bold">
        <Bold className="h-3.5 w-3.5 mx-auto" />
      </button>
      <button type="button" className={iconBtn} onClick={() => formatText("italic")} title="Italic">
        <Italic className="h-3.5 w-3.5 mx-auto" />
      </button>
      <button type="button" className={iconBtn} onClick={() => formatText("underline")} title="Underline">
        <Underline className="h-3.5 w-3.5 mx-auto" />
      </button>
      <button type="button" className={iconBtn} onClick={() => formatText("strikethrough")} title="Strikethrough">
        <Strikethrough className="h-3.5 w-3.5 mx-auto" />
      </button>
      <button type="button" className={iconBtn} onClick={() => formatText("code")} title="Code">
        <Code className="h-3.5 w-3.5 mx-auto" />
      </button>

      <div className={divider} />

      {/* Lists */}
      <button type="button" className={isBulletList ? iconBtnActive : iconBtn} onClick={() => formatList("bullet")} title="Bullet List">
        <List className="h-3.5 w-3.5 mx-auto" />
      </button>
      <button type="button" className={isNumberList ? iconBtnActive : iconBtn} onClick={() => formatList("number")} title="Numbered List">
        <ListOrdered className="h-3.5 w-3.5 mx-auto" />
      </button>

      <div className={divider} />

      {/* Link */}
      <button type="button" className={iconBtn} onClick={openLinkDialog} title="Insert Link">
        <LinkIcon className="h-3.5 w-3.5 mx-auto" />
      </button>

      {/* Link Dialog */}
      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent className="bg-[#1a1a1a] border-white/[0.08] text-white sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="text-white">Insert Link</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="link-url" className="text-white/80">URL</Label>
              <Input
                id="link-url"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="https://example.com"
                className="bg-white/5 border-white/[0.08] text-white placeholder:text-white/40"
              />
            </div>
            {!hasSelectedText && (
              <div className="grid gap-2">
                <Label htmlFor="link-text" className="text-white/80">Link Text</Label>
                <Input
                  id="link-text"
                  value={linkText}
                  onChange={(e) => setLinkText(e.target.value)}
                  placeholder="Click here"
                  className="bg-white/5 border-white/[0.08] text-white placeholder:text-white/40"
                />
              </div>
            )}
            {hasSelectedText && (
              <p className="text-sm text-white/60">
                Selected text &quot;{linkText}&quot; will be linked
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setLinkDialogOpen(false)}
              className="text-white/70 hover:text-white hover:bg-white/10"
            >
              Cancel
            </Button>
            <Button
              onClick={insertLink}
              className="bg-primary hover:bg-primary/90"
            >
              Insert Link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

