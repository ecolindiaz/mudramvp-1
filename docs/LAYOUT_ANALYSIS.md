# Layout Analysis - Dashboard Pages

## Overview
This document analyzes the layout structure of the Mudra dashboard, focusing on how the sidebar, navbar (SiteHeader), and content areas interact across the Overview, Tracked Prompts, and Campaigns pages.

---

## Overall Layout Architecture

### Root Structure
```
SidebarProvider (bg-dark-grey)
├── AppSidebar (Fixed left sidebar, 16rem width)
└── SidebarInset (Main content area)
    ├── SiteHeader (Top navbar, fixed height)
    ├── Separator (Full width divider)
    └── Page Content (Flexible content area)
```

### CSS Variables
- `--sidebar-width`: `16rem` (256px)
- `--header-height`: Defined in CSS (typically ~56px)
- `--sidebar-width-icon`: `3rem` (48px when collapsed)

---

## Component Breakdown

### 1. SidebarProvider
**Location**: All dashboard pages wrap content in `SidebarProvider`

**Properties**:
- `className="bg-dark-grey"`
- CSS variable: `--sidebar-width: 16rem`
- Handles sidebar state (expanded/collapsed)
- Manages mobile/desktop behavior

**Key Features**:
- Desktop: Fixed sidebar on left, can collapse to offcanvas
- Mobile: Sidebar becomes a Sheet (drawer) overlay
- Keyboard shortcut: `Cmd/Ctrl + B` to toggle

### 2. AppSidebar
**Location**: `components/app-sidebar.tsx`

**Structure**:
```
Sidebar (fixed left, 16rem width)
├── SidebarHeader (h-[var(--header-height)])
│   └── Company Header (Y Combinator button)
├── Separator (border-white/[0.08])
├── SidebarContent
│   ├── NavMain (Core, Presence Lab, Knowledge Base)
│   └── NavSecondary (empty)
└── SidebarFooter
    ├── Support & Feedback buttons
    ├── Separator
    ├── Search bar (⌘K)
    └── NavUser (User profile)
```

**Positioning**:
- **Desktop**: Fixed position, `left-0`, `inset-y-0`
- **Width**: `16rem` (256px)
- **Border**: Right border `border-r border-white/[0.06]`
- **Z-index**: `z-10`
- **Collapsed state**: Slides off-screen to `left-[calc(var(--sidebar-width)*-1)]`

**Spacing**:
- Header: `px-3`, `pb-0`
- Content: `px-0`, `pt-4`
- Footer: `pb-4`, `px-3` (for buttons)

### 3. SiteHeader (Navbar)
**Location**: `components/site-header.tsx`

**Structure**:
```
header (h-[var(--header-height)])
└── div (flex, justify-between, px-4 lg:px-6)
    └── SidebarTrigger (hamburger menu button)
```

**Positioning**:
- **Height**: `var(--header-height)` (typically 56px)
- **Position**: Inside `SidebarInset`, at the top
- **Background**: `bg-dark-grey`
- **Border**: Bottom border `border-b border-white/10`
- **Padding**: `px-4 lg:px-6` (16px on mobile, 24px on desktop)

**Key Features**:
- Contains only the sidebar toggle button (`SidebarTrigger`)
- No page title or breadcrumbs (handled in page content)
- Minimal design - just the hamburger menu

### 4. SidebarInset (Main Content Area)
**Location**: `components/ui/sidebar.tsx` (line 306)

**Properties**:
- `className="bg-background relative flex w-full flex-1 flex-col min-w-0"`
- Takes remaining space after sidebar
- Contains `SiteHeader` and page content

**Layout Behavior**:
- Flex container with `flex-1` (grows to fill space)
- `min-w-0` prevents overflow issues
- Responsive: Adjusts margin when sidebar is inset variant

---

## Page Layout Patterns

All three pages (Overview, Tracked Prompts, Campaigns) follow the same structure:

### Common Structure
```tsx
<SidebarProvider className="bg-dark-grey" style={{ "--sidebar-width": "16rem" }}>
  <AppSidebar />
  <SidebarInset>
    <SiteHeader />
    <Separator className="w-full border-border" />
    <div className="flex flex-1 flex-col bg-dark-grey">
      <div className="container-type-inline-size container-name-main flex flex-1 flex-col gap-3 md:gap-4 bg-dark-grey">
        {/* Page Header */}
        <div className="px-4 lg:px-6 pt-4 md:pt-6 pb-4 md:pb-6">
          {/* Title, description, actions */}
        </div>
        
        {/* Divider Line */}
        <div className="h-[1px] bg-white/10"></div>
        
        {/* Content Area */}
        <div className="flex flex-col flex-1">
          {/* Page-specific content */}
        </div>
      </div>
    </div>
  </SidebarInset>
  <FloatingMudraButton />
</SidebarProvider>
```

---

## Page-Specific Layouts

### 1. Overview Page (`/dashboard/page.tsx`)

**Page Header** (lines 70-121):
```tsx
<div className="px-4 lg:px-6 pt-4 md:pt-6 pb-4 md:pb-6">
  <div className="flex items-center justify-between gap-4 flex-wrap">
    <div className="min-w-0">
      <h1>Overview</h1>
      <p>Your brands performance across AI Search Engines</p>
    </div>
    <div className="flex items-center gap-2.5 flex-shrink-0">
      {/* Platform Filter Dropdown */}
      {/* Timer */}
    </div>
  </div>
</div>
```

**Divider** (line 124):
```tsx
<div className="h-[1px] bg-white/10"></div>
```

**Content Area** (lines 126-142):
```tsx
<div className="flex flex-1 flex-col pt-6 pb-8">
  <div>
    <OverviewMetrics />
  </div>
  <div className="px-4 lg:px-6 pt-6">
    <NaturalLanguageReport />
  </div>
</div>
```

**Spacing**:
- Header padding: `pt-4 md:pt-6 pb-4 md:pb-6` (16px/24px top, 16px/24px bottom)
- Content padding: `pt-6 pb-8` (24px top, 32px bottom)
- Horizontal padding: `px-4 lg:px-6` (16px mobile, 24px desktop)

### 2. Tracked Prompts Page (`/dashboard/tracked-prompts/page.tsx`)

**Page Header** (lines 511-556):
```tsx
<div className="px-4 lg:px-6 pt-4 md:pt-6 pb-4 md:pb-6">
  <div className="flex items-center justify-between">
    <div>
      <h1>Tracked Prompts</h1>
      <p>Monitor prompts and mentions across AI models</p>
    </div>
    <div className="flex items-center gap-2">
      {/* Prompt count */}
      {/* All Prompts button */}
      {/* Add Prompt button */}
    </div>
  </div>
</div>
```

**Divider** (line 559):
```tsx
<div className="h-[1px] bg-white/10"></div>
```

**Content Area** (lines 562-835):
```tsx
<div className="flex flex-col flex-1">
  <div className="px-4 lg:px-6 pt-6 pb-6 md:pb-8 space-y-4">
    {/* Filters */}
    {/* Table */}
    {/* Selection footer (fixed bottom) */}
    {/* Add Prompt Dialog */}
  </div>
</div>
```

**Spacing**:
- Same header padding as Overview
- Content padding: `pt-6 pb-6 md:pb-8` (24px top, 24px/32px bottom)
- Internal spacing: `space-y-4` (16px between filter and table)

**Special Elements**:
- Selection footer: Fixed position `fixed left-1/2 -translate-x-1/2 bottom-6 z-30`
- Table: Full width with `overflow-hidden rounded-md border`

### 3. Campaigns Page (`/dashboard/campaigns/page.tsx`)

**Page Header** (lines 338-725):
```tsx
<div className="px-4 lg:px-6 pt-4 md:pt-6 pb-4 md:pb-6">
  <div className="flex items-center justify-between">
    <div>
      <h1>Campaigns</h1>
      <p>Tailored brand content for visibility improvement across channels.</p>
    </div>
    <div className="flex items-center">
      {/* New Campaign button (opens dialog) */}
    </div>
  </div>
</div>
```

**Divider** (line 728):
```tsx
<div className="h-[1px] bg-white/10 -mx-4 lg:-mx-6 w-[calc(100%+2rem)] lg:w-[calc(100%+3rem)]"></div>
```
**Note**: This divider has negative margins to extend full width, compensating for container padding.

**Content Area** (lines 730-847):
```tsx
{/* Progress Animation (conditional) */}
{isGenerating && (
  <div className="px-4 lg:px-6 pt-6">
    {/* Generation progress card */}
  </div>
)}

{/* Campaign List (conditional) */}
{!isGenerating && (
  <div className="flex flex-col flex-1">
    <div className="px-4 lg:px-6 pt-6 pb-6 md:pb-8">
      {/* Filter pills */}
      {/* Campaign cards */}
    </div>
  </div>
)}
```

**Spacing**:
- Same header padding pattern
- Content padding: `pt-6 pb-6 md:pb-8`
- Divider uses negative margins for full-width effect

---

## Div Positioning & Spacing Analysis

### Horizontal Spacing

**Container Padding**:
- Mobile: `px-4` (16px left/right)
- Desktop: `lg:px-6` (24px left/right)

**Gap Between Elements**:
- Page header buttons: `gap-2` or `gap-2.5` (8px or 10px)
- Filter elements: `gap-3` (12px)
- Card grids: `gap-3 md:gap-4` (12px mobile, 16px desktop)

### Vertical Spacing

**Page Header**:
- Top padding: `pt-4 md:pt-6` (16px mobile, 24px desktop)
- Bottom padding: `pb-4 md:pb-6` (16px mobile, 24px desktop)

**Divider**:
- Height: `h-[1px]` (1px)
- Background: `bg-white/10`
- Full width (no horizontal padding)

**Content Area**:
- Top padding: `pt-6` (24px)
- Bottom padding: `pb-6 md:pb-8` (24px mobile, 32px desktop)
- Internal spacing: `space-y-4` or `gap-3 md:gap-4` (16px or 12px/16px)

### Container Structure

**Outer Container**:
```tsx
<div className="flex flex-1 flex-col bg-dark-grey">
```
- Flex column, grows to fill space
- Background: `bg-dark-grey`

**Inner Container**:
```tsx
<div className="container-type-inline-size container-name-main flex flex-1 flex-col gap-3 md:gap-4 bg-dark-grey">
```
- Container query support (`@container/main`)
- Gap between children: `gap-3 md:gap-4`

---

## Navbar (SiteHeader) Interaction

### How SiteHeader Interacts with Pages

1. **Position**: Always at the top of `SidebarInset`, below the sidebar
2. **Height**: Fixed at `var(--header-height)` (typically 56px)
3. **Content**: Only contains `SidebarTrigger` button
4. **Separator**: Full-width separator below header (`border-white/10`)

### Responsive Behavior

**Desktop**:
- Sidebar visible: Header starts after sidebar (16rem from left)
- Sidebar collapsed: Header expands to full width
- Sidebar trigger: Always visible in header

**Mobile**:
- Sidebar hidden: Header spans full width
- Sidebar trigger: Opens Sheet drawer overlay
- Header remains fixed at top

### Visual Hierarchy

```
┌─────────────────────────────────────┐
│ Sidebar (16rem) │ Header (56px)     │
│                 ├───────────────────┤
│                 │ Separator (1px)   │
│                 ├───────────────────┤
│                 │ Page Header       │
│                 │ (Title + Actions) │
│                 ├───────────────────┤
│                 │ Divider (1px)     │
│                 ├───────────────────┤
│                 │                   │
│                 │ Content Area      │
│                 │ (Flexible)        │
│                 │                   │
└─────────────────┴───────────────────┘
```

---

## Key Layout Patterns

### 1. Consistent Header Pattern
All pages use:
- Same padding: `px-4 lg:px-6 pt-4 md:pt-6 pb-4 md:pb-6`
- Same structure: Title + description on left, actions on right
- Same typography: `text-2xl font-bold` for h1, `text-muted-foreground` for description

### 2. Consistent Divider Pattern
All pages use:
- Same height: `h-[1px]`
- Same color: `bg-white/10`
- Full width (some use negative margins to extend beyond container)

### 3. Consistent Content Area Pattern
All pages use:
- Same outer wrapper: `flex flex-col flex-1`
- Same padding: `px-4 lg:px-6 pt-6 pb-6 md:pb-8`
- Flexible height: `flex-1` allows content to fill available space

### 4. Container Query Support
All pages use:
- `@container/main` for responsive layouts
- Container-based breakpoints for nested components

---

## Z-Index Layers

1. **Sidebar**: `z-10` (fixed positioning)
2. **SiteHeader**: Default (inside SidebarInset flow)
3. **Selection Footer** (Tracked Prompts): `z-30` (fixed bottom)
4. **FloatingMudraButton**: Likely high z-index (floating action button)
5. **Dialogs/Modals**: Typically `z-50` (shadcn/ui default)

---

## Responsive Breakpoints

- **Mobile**: Default (< 768px)
- **Tablet/Desktop**: `md:` (≥ 768px)
- **Large Desktop**: `lg:` (≥ 1024px)

**Key Responsive Behaviors**:
- Sidebar: Sheet on mobile, fixed on desktop
- Padding: `px-4` → `lg:px-6` (16px → 24px)
- Gaps: `gap-3` → `md:gap-4` (12px → 16px)
- Typography: Base → `md:text-base` or `lg:text-lg`

---

## Floating Elements

### FloatingMudraButton
- Position: Fixed (likely bottom-right)
- Appears on all dashboard pages
- Independent of scroll position

### Selection Footer (Tracked Prompts)
- Position: `fixed left-1/2 -translate-x-1/2 bottom-6`
- Centered horizontally, 24px from bottom
- Only visible when rows are selected

---

## Summary

The layout follows a consistent pattern across all dashboard pages:

1. **SidebarProvider** wraps everything
2. **AppSidebar** fixed on left (16rem width)
3. **SidebarInset** contains main content
4. **SiteHeader** minimal navbar with sidebar toggle
5. **Separator** full-width divider
6. **Page Header** consistent padding and structure
7. **Divider** 1px line separating header from content
8. **Content Area** flexible, fills remaining space

All pages maintain:
- Consistent horizontal padding (`px-4 lg:px-6`)
- Consistent vertical spacing (`pt-4 md:pt-6`, `pb-4 md:pb-6`)
- Same divider styling (`h-[1px] bg-white/10`)
- Flexible content areas that adapt to available space

