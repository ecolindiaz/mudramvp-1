"use client"

// Force dynamic rendering for dashboard pages
export const dynamic = 'force-dynamic'

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  Plus, 
  Search, 
  Trash2, 
  Edit, 
  Sparkles, 
  Target, 
  Users, 
  TrendingUp,
  FileText,
  Check,
  X
} from "lucide-react"
import { useBrandProfile } from "@/components/brand-profile-context"
import { toast } from "sonner"

interface Prompt {
  id: string
  brandProfileId: number
  text: string
  category: string
  isCustom: boolean
  isActive: boolean
  createdAt: string
  updatedAt: string
}

const CATEGORIES = [
  { value: 'Organic', label: 'Organic', icon: Search, color: 'bg-blue-500' },
  { value: 'Competitor', label: 'Competitor', icon: Users, color: 'bg-purple-500' },
  { value: 'How-to Guides', label: 'How-to Guides', icon: FileText, color: 'bg-green-500' },
  { value: 'Brand-Specific', label: 'Brand-Specific', icon: Target, color: 'bg-orange-500' },
]

export default function PromptsPage() {
  const { profile } = useBrandProfile()
  const [prompts, setPrompts] = useState<Prompt[]>([])
  const [filteredPrompts, setFilteredPrompts] = useState<Prompt[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<string>("all")
  const [editingPrompt, setEditingPrompt] = useState<string | null>(null)
  const [editText, setEditText] = useState("")
  const [newPromptText, setNewPromptText] = useState("")
  const [newPromptCategory, setNewPromptCategory] = useState("Organic")
  const [isGenerating, setIsGenerating] = useState(false)

  // Load prompts
  useEffect(() => {
    if (profile.id) {
      loadPrompts()
    }
  }, [profile.id])

  // Filter prompts
  useEffect(() => {
    let filtered = prompts

    if (selectedCategory !== "all") {
      filtered = filtered.filter(p => p.category === selectedCategory)
    }

    if (searchQuery) {
      filtered = filtered.filter(p => 
        p.text.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }

    setFilteredPrompts(filtered)
  }, [prompts, selectedCategory, searchQuery])

  const loadPrompts = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/prompts?brandProfileId=${profile.id}`)
      const data = await response.json()

      if (data.success) {
        setPrompts(data.prompts)
      } else {
        toast.error("Failed to load prompts")
      }
    } catch (error) {
      console.error("Error loading prompts:", error)
      toast.error("Failed to load prompts")
    } finally {
      setLoading(false)
    }
  }

  const handleAddPrompt = async () => {
    if (!newPromptText.trim()) {
      toast.error("Please enter a prompt")
      return
    }

    try {
      const response = await fetch('/api/prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandProfileId: profile.id,
          text: newPromptText,
          category: newPromptCategory
        })
      })

      const data = await response.json()

      if (data.success) {
        toast.success("Prompt added successfully")
        setNewPromptText("")
        loadPrompts()
      } else {
        toast.error("Failed to add prompt")
      }
    } catch (error) {
      console.error("Error adding prompt:", error)
      toast.error("Failed to add prompt")
    }
  }

  const handleUpdatePrompt = async (promptId: string) => {
    if (!editText.trim()) {
      toast.error("Please enter a prompt")
      return
    }

    try {
      const response = await fetch('/api/prompts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          promptId,
          text: editText
        })
      })

      const data = await response.json()

      if (data.success) {
        toast.success("Prompt updated successfully")
        setEditingPrompt(null)
        setEditText("")
        loadPrompts()
      } else {
        toast.error("Failed to update prompt")
      }
    } catch (error) {
      console.error("Error updating prompt:", error)
      toast.error("Failed to update prompt")
    }
  }

  const handleDeletePrompt = async (promptId: string) => {
    try {
      const response = await fetch(`/api/prompts?promptId=${promptId}`, {
        method: 'DELETE'
      })

      const data = await response.json()

      if (data.success) {
        toast.success("Prompt deleted successfully")
        loadPrompts()
      } else {
        toast.error("Failed to delete prompt")
      }
    } catch (error) {
      console.error("Error deleting prompt:", error)
      toast.error("Failed to delete prompt")
    }
  }

  const handleGeneratePrompts = async () => {
    if (!profile.id) return

    setIsGenerating(true)
    try {
      const response = await fetch('/api/prompts/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandProfileId: profile.id,
          userRequest: "Generate additional prompts",
          brandInfo: {
            name: profile.companyName || '',
            description: profile.companyDescription || '',
            industry: profile.companyIndustry || '',
            products: [],
            icp: profile.companyICP || '',
            competitors: profile.competitors || []
          }
        })
      })

      const data = await response.json()

      if (data.success) {
        toast.success(`Generated ${data.prompts.length} new prompts`)
        loadPrompts()
      } else {
        toast.error("Failed to generate prompts")
      }
    } catch (error) {
      console.error("Error generating prompts:", error)
      toast.error("Failed to generate prompts")
    } finally {
      setIsGenerating(false)
    }
  }

  const getCategoryIcon = (category: string) => {
    const cat = CATEGORIES.find(c => c.value === category)
    return cat ? cat.icon : Target
  }

  const getCategoryColor = (category: string) => {
    const cat = CATEGORIES.find(c => c.value === category)
    return cat ? cat.color : 'bg-gray-500'
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Prompts Management</h1>
          <p className="text-muted-foreground mt-1">
            Manage your AI visibility test prompts
          </p>
        </div>
        <Button onClick={handleGeneratePrompts} disabled={isGenerating}>
          <Sparkles className="w-4 h-4 mr-2" />
          {isGenerating ? 'Generating...' : 'Generate More Prompts'}
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {CATEGORIES.map((cat) => {
          const count = prompts.filter(p => p.category === cat.value && p.isActive).length
          const Icon = cat.icon
          return (
            <Card key={cat.value}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{cat.label}</p>
                    <p className="text-2xl font-bold">{count}</p>
                  </div>
                  <div className={`p-3 rounded-lg ${cat.color} bg-opacity-10`}>
                    <Icon className={`w-6 h-6 text-${cat.color.replace('bg-', '')}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Add New Prompt */}
      <Card>
        <CardHeader>
          <CardTitle>Add Custom Prompt</CardTitle>
          <CardDescription>Create a new prompt to test your brand's AI visibility</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <Label>Prompt Text</Label>
              <Input
                value={newPromptText}
                onChange={(e) => setNewPromptText(e.target.value)}
                placeholder="e.g., What are the best CRM solutions for startups?"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Category</Label>
              <select
                value={newPromptCategory}
                onChange={(e) => setNewPromptCategory(e.target.value)}
                className="w-full mt-1 px-3 py-2 border rounded-md"
              >
                {CATEGORIES.map(cat => (
                  <option key={cat.value} value={cat.value}>{cat.label}</option>
                ))}
              </select>
            </div>
          </div>
          <Button onClick={handleAddPrompt}>
            <Plus className="w-4 h-4 mr-2" />
            Add Prompt
          </Button>
        </CardContent>
      </Card>

      {/* Prompts List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Your Prompts ({filteredPrompts.length})</CardTitle>
              <CardDescription>View and manage your prompt library</CardDescription>
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Search prompts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-64"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
            <TabsList className="mb-4">
              <TabsTrigger value="all">All</TabsTrigger>
              {CATEGORIES.map(cat => (
                <TabsTrigger key={cat.value} value={cat.value}>
                  {cat.label}
                </TabsTrigger>
              ))}
            </TabsList>

            {loading ? (
              <div className="text-center py-8">Loading prompts...</div>
            ) : filteredPrompts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No prompts found. Add some prompts to get started.
              </div>
            ) : (
              <div className="space-y-2">
                {filteredPrompts.map(prompt => {
                  const Icon = getCategoryIcon(prompt.category)
                  const isEditing = editingPrompt === prompt.id

                  return (
                    <div
                      key={prompt.id}
                      className="flex items-start justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex-1 flex items-start gap-3">
                        <div className={`p-2 rounded ${getCategoryColor(prompt.category)} bg-opacity-10 mt-1`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1">
                          {isEditing ? (
                            <div className="space-y-2">
                              <Input
                                value={editText}
                                onChange={(e) => setEditText(e.target.value)}
                                className="w-full"
                              />
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  onClick={() => handleUpdatePrompt(prompt.id)}
                                >
                                  <Check className="w-4 h-4 mr-1" />
                                  Save
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setEditingPrompt(null)
                                    setEditText("")
                                  }}
                                >
                                  <X className="w-4 h-4 mr-1" />
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <p className="font-medium">{prompt.text}</p>
                              <div className="flex gap-2 mt-2">
                                <Badge variant="secondary">{prompt.category}</Badge>
                                {prompt.isCustom && (
                                  <Badge variant="outline">Custom</Badge>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                      {!isEditing && (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setEditingPrompt(prompt.id)
                              setEditText(prompt.text)
                            }}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeletePrompt(prompt.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
