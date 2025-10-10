# User Account & Onboarding Flow

## Overview
Updated onboarding process now includes account creation as the first step, ensuring all brand profiles are tied to a specific user.

## Flow Sequence

### 1. Account Creation (`/welcome/account`)
- **Step 1 of 7** - "Account"
- User enters a username
- System auto-generates a secure 16-character password
- User must save the password (copy to clipboard feature included)
- Creates User record with hashed password
- Auto-logs in user with NextAuth credentials provider
- Stores `userId` and `username` in onboarding context

### 2. Company Basics (`/welcome`)
- **Step 2 of 7** - "Welcome"
- Company name, website, social media

### 3. Personal Profile (`/welcome/profile`)
- **Step 3 of 7** - "About You"
- User name and role

### 4. Company Details (`/welcome/company`)
- **Step 4 of 7** - "Company"
- Description, industry, services, ICP

### 5. Competitors (`/welcome/competitors`)
- **Step 5 of 7** - "Competitors"
- Competitor URLs

### 6. Visibility/Knowledge Base (`/welcome/visibility`)
- **Step 6 of 7** - "Visibility"
- Upload knowledge base files

### 7. AI Analysis (`/welcome/prompts`)
- **Step 7 of 7** - "Analysis"
- Automatic analysis trigger
- Progress indicator
- Completion and redirect to dashboard

## Database Schema Changes

### User Model (Updated)
```prisma
model User {
  id            String   @id @default(cuid())
  email         String   @unique
  name          String?
  password      String?  // NEW: For beta users with credentials
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  
  websites      Website[]
  brandProfiles BrandProfile[]
  
  @@map("users")
}
```

### BrandProfile Model
```prisma
model BrandProfile {
  id        Int      @id @default(autoincrement())
  userId    String   // Links to User.id
  // ... other fields
  
  user      User     @relation(fields: [userId], references: [id])
}
```

## Authentication

### NextAuth Configuration
Added **CredentialsProvider** to support username/password login:

```typescript
// lib/auth.ts
CredentialsProvider({
  name: "Credentials",
  credentials: {
    username: { label: "Username", type: "text" },
    password: { label: "Password", type: "password" }
  },
  async authorize(credentials) {
    // Finds user by username or email
    // Verifies bcrypt hashed password
    // Returns user object on success
  }
})
```

### Login Methods
1. **Credentials** (username + password) - NEW
2. **Twitter OAuth** - Existing

## API Endpoints

### POST `/api/auth/register`
Creates new user account during onboarding.

**Request:**
```json
{
  "username": "johndoe",
  "password": "auto-generated-secure-password"
}
```

**Response:**
```json
{
  "success": true,
  "userId": "cuid123",
  "username": "johndoe",
  "email": "johndoe@mudra.app"
}
```

**Error Responses:**
- `400` - Missing username or password
- `409` - Username already taken
- `500` - Server error

## Components

### AccountForm Component
**Location:** `components/onboarding/account-form.tsx`

**Features:**
- Username input validation
- Auto-generates 16-char password with special chars
- Password visibility toggle
- Copy to clipboard with confirmation
- Warning alert to save credentials
- Auto-login after account creation
- Smooth navigation to brand setup

**UI States:**
1. **Input State** - Enter username
2. **Created State** - Show credentials with copy button

### OnboardingContext Updates
**Location:** `components/onboarding/onboarding-context.tsx`

**New Fields:**
```typescript
interface OnboardingData {
  userId: number | null   // NEW
  username: string        // NEW
  // ... existing fields
}
```

## Migration Steps

### 1. Update Prisma Schema
```bash
cd mudra-app
# Schema already updated with password field
npx prisma db push
# or
npx prisma migrate dev --name add_user_password
```

### 2. Install bcryptjs
```bash
npm install bcryptjs
npm install --save-dev @types/bcryptjs
```

### 3. Restart Docker (if using)
```bash
docker compose restart
```

## User Flow Example

1. User visits app → Redirected to `/welcome/account`
2. Enters username: "startupfounder"
3. System generates password: "x7K#mP9$qL2@nR8!"
4. User copies password and saves it
5. Click "Continue to Brand Setup"
6. Auto-logged in with NextAuth
7. Proceeds through onboarding with `userId` stored in context
8. On completion, BrandProfile created with `userId: "cuid123"`
9. User can now login with: username="startupfounder", password="x7K#mP9$qL2@nR8!"

## Security Notes

- Passwords hashed with bcrypt (10 salt rounds)
- Auto-generated passwords are 16 characters with uppercase, lowercase, numbers, and special chars
- Email format: `{username}@mudra.app` for internal tracking
- Session uses JWT strategy
- Auto-login after registration for smooth UX

## Testing

### Test Account Creation
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"TestPass123!"}'
```

### Test Login
1. Visit `/welcome/account`
2. Create account with username
3. Verify auto-login by checking session
4. Complete onboarding
5. Log out
6. Log back in with saved credentials

## Troubleshooting

### Issue: "password does not exist in type User"
**Solution:** Run `npx prisma generate` after updating schema

### Issue: Auto-login fails
**Check:**
- CredentialsProvider is registered in `lib/auth.ts`
- Password is being hashed correctly in `/api/auth/register`
- NextAuth session is working (`/api/auth/session`)

### Issue: BrandProfile creation fails
**Check:**
- `userId` is present in onboarding context
- `saveBrandProfile` is using the provided `userId`
- User exists in database before profile creation
