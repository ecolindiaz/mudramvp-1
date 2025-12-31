# Environment Setup for Campaigns

## Create .env.local File

Create a file named `.env.local` in the `mudra-app` directory with this content:

```env
# Database (using existing SQLite)
DATABASE_URL="file:./prisma/dev.db"

# OpenAI for campaign generation
OPENAI_API_KEY=sk-your-key-here-from-openai-platform

# NextAuth (optional for now)
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-here
```

## Get OpenAI API Key

1. Go to https://platform.openai.com/api-keys
2. Sign up or log in
3. Click "Create new secret key"
4. Copy the key (starts with `sk-`)
5. Replace `sk-your-key-here-from-openai-platform` with your key

## Run Migration

After creating `.env.local`, run:

```bash
node scripts/setup-campaigns-db.js
```

Or manually run this SQL on your database:

```bash
sqlite3 prisma/dev.db < prisma/migrations/add_campaigns.sql
```

## Verify Setup

Start the dev server:

```bash
npm run dev
```

Then:
1. Go to http://localhost:3000/dashboard/campaigns
2. Create a new campaign
3. It should save to drafts!

## Troubleshooting

### "Environment variable not found: DATABASE_URL"
Create the `.env.local` file as shown above.

### "Table already exists"
Already set up! Skip the migration step.

### "OpenAI API key not configured"
Add your OpenAI API key to `.env.local`.

---

**Quick Copy-Paste for .env.local:**

```env
DATABASE_URL="file:./prisma/dev.db"
OPENAI_API_KEY=
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=random-secret-string-here
```

Then fill in your OpenAI API key and save the file.

