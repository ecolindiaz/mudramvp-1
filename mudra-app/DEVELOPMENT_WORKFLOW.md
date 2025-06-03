# Mudra Development Workflow

## 🎯 Core Development Principles

### 1. **Small Batch Development**
- **One feature at a time** - Complete one component/feature before moving to the next
- **Immediate testing** - Test every change in the browser
- **Visual verification** - Confirm UI changes match expectations
- **Commit-ready code** - Each batch should be ready to commit

### 2. **Code Documentation Rule**
Every code addition MUST include:
- **What**: Clear description of what's being added
- **Why**: Business/technical reason for the change
- **How**: Brief explanation of how the code works
- **Impact**: What the user will see/experience

Example:
```typescript
// WHAT: AI Visibility Score Card Component
// WHY: Users need to see their overall AI mention rate at a glance
// HOW: Fetches score from mock data, displays as percentage with color coding
// IMPACT: Users see a prominent card showing 0-100% visibility score
```

### 3. **Three-Phase Development**

#### Phase 1: Frontend (Current) ✅
- Build complete UI with mock data
- All interactions and animations
- Responsive design
- Dark/light theme support

#### Phase 2: Backend
- API endpoints
- Database schema and migrations
- Business logic implementation
- Background job processing

#### Phase 3: Integration
- Connect frontend to backend
- Replace mock data with real API calls
- Add authentication flow
- Implement real-time updates

### 4. **Testing Protocol**
After EVERY change:
- [ ] Visual check in browser (localhost:3000)
- [ ] Console error check (F12 → Console)
- [ ] Responsive design check (mobile/tablet/desktop)
- [ ] Dark theme compatibility
- [ ] TypeScript errors (terminal)

### 5. **File Organization**
Follow the structure in `structure.md`:
```
components/
├── analysis/
│   ├── query-llms/
│   ├── crawler-detection/
│   └── [feature-name]/
├── dashboard/
├── ui/
└── shared/
```

### 6. **Component Development Pattern**
```typescript
// 1. Interface first
interface ComponentProps {
  data: DataType;
  onAction?: () => void;
}

// 2. Mock data (during Phase 1)
const mockData = {
  // Realistic data structure
};

// 3. Component with loading/error states
export function Component({ data }: ComponentProps) {
  if (!data) return <LoadingState />;
  if (error) return <ErrorState />;
  
  return <ActualComponent />;
}
```

### 7. **Git Commit Messages**
```
feat: Add AI visibility score card
fix: Correct responsive layout on mobile
style: Update dashboard dark theme colors
refactor: Simplify sidebar navigation logic
```

### 8. **Code Review Checklist**
Before considering a feature complete:
- [ ] Component renders without errors
- [ ] Responsive on all screen sizes
- [ ] Works in dark mode
- [ ] Loading states implemented
- [ ] Error states handled
- [ ] TypeScript types defined
- [ ] Mock data realistic
- [ ] Follows naming conventions

### 9. **Performance Considerations**
- Use `React.memo` for expensive components
- Implement virtual scrolling for long lists
- Lazy load heavy components
- Optimize images with Next.js Image
- Use proper caching strategies

### 10. **Accessibility Requirements**
- Proper ARIA labels
- Keyboard navigation support
- Focus management
- Color contrast compliance
- Screen reader compatibility

## 🚫 What NOT to Do

1. **Don't build multiple features simultaneously**
2. **Don't skip testing after changes**
3. **Don't use inline styles** - Use Tailwind classes
4. **Don't hardcode values** - Use constants/config
5. **Don't ignore TypeScript errors**
6. **Don't commit without testing**

## 📋 Daily Workflow

1. **Start**: Review current task and documentation
2. **Plan**: Break task into small batches
3. **Code**: Implement one batch
4. **Test**: Verify in browser
5. **Document**: Add code comments
6. **Repeat**: Next batch or next feature

## 🎯 Current Focus

**Phase 1 Priorities**:
1. Dashboard layout ✅
2. Metric cards (AI Visibility, Crawlers, etc.)
3. Analysis pages with mock data
4. Interactive charts and visualizations
5. Settings pages
6. Responsive design polish

---

**Remember**: Quality over quantity. A well-tested, documented component is better than three broken ones. 