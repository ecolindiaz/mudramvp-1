# GitHub Repository Selection - Quick Setup Checklist

## ⚡ Quick Start (5 minutes)

### 1. Install Required Package
```bash
cd mudra-app
npm install jsonwebtoken
npm install --save-dev @types/jsonwebtoken
```

### 2. Run Database Migration
```bash
npx prisma migrate dev --name add_github_app_support
npx prisma generate
```

### 3. Create GitHub App

**Go to:** https://github.com/settings/apps/new

**Fill in form:**
```
Name: mudra-content-optimizer
Homepage: http://localhost:3000
Callback URL: http://localhost:3000/api/auth/github/installation/callback
Webhook: ❌ Uncheck "Active"

Permissions:
  Repository → Contents: Read and write
  Repository → Pull requests: Read and write  
  Account → Email: Read-only

Install: Any account
```

**After creation:**
- Save App ID
- Save Client ID
- Generate & save Client Secret
- Generate & download Private Key (.pem file)

### 4. Update .env.local

**Convert private key:**
```bash
# Mac/Linux
awk 'NF {sub(/\r/, ""); printf "%s\\n",$0;}' ~/Downloads/your-app.*.private-key.pem
```

**Paste values:**
```bash
GITHUB_APP_ID=123456
GITHUB_CLIENT_ID=Iv1.abc123def456
GITHUB_CLIENT_SECRET=your_secret_here
GITHUB_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\nYour\nKey\nHere\n-----END RSA PRIVATE KEY-----"
```

### 5. Test
```bash
npm run dev
```

Visit: http://localhost:3000/dashboard/integrations
Click "Install" → Select repositories → Done! ✅

---

## 📋 Pre-Setup Checklist

Before running the above steps, ensure:

- [ ] You have a GitHub account
- [ ] You have **write access** to at least one repository (can be repos you own, org repos, or repos where you're a collaborator)
- [ ] Node.js and npm are installed
- [ ] Docker is running (if using Docker dev environment)
- [ ] PostgreSQL database is accessible
- [ ] `.env.local` file exists in `mudra-app/`

---

## 🔧 Troubleshooting

### Error: "Cannot find module 'jsonwebtoken'"
```bash
npm install jsonwebtoken @types/jsonwebtoken
```

### Error: "Missing GITHUB_APP_ID"
- Make sure you filled in all 4 new env vars in `.env.local`
- Restart dev server after updating `.env.local`

### Error: "Invalid private key"
- Ensure newlines are converted to `\n` literal string
- Key should be one line in .env file
- Keep quotes around the key value

### GitHub redirects to error page
- Check callback URL matches exactly (no trailing slash)
- Verify GitHub App is active (not suspended)
- Check browser console for errors

### No repositories show in dropdown
- Make sure you selected repositories during installation
- Try uninstalling and reinstalling the app
- Check `/api/integrations/github/repositories` endpoint directly

---

## 🎯 What Changed?

### Before
❌ User grants access to ALL repositories (security risk)

### After  
✅ User selects specific repositories (secure & compliant)

### Files Modified
- ✅ `prisma/schema.prisma` - Added `installationId` and `integrationType`
- ✅ `app/api/auth/github/installation/callback/route.ts` - NEW (handles installations)
- ✅ `app/dashboard/integrations/page.tsx` - Uses GitHub App URL
- ✅ `hooks/use-agent-operations.ts` - Uses GitHub App URL
- ✅ `.env.local` - Added GitHub App configuration

### Database Changes
New columns in `GitHubIntegration` table:
- `installationId` (Int?) - Links to GitHub App installation
- `integrationType` (String) - "oauth" or "installation"

---

## 🚀 Production Deploy

After testing locally:

1. **Update GitHub App callback:**
   - Go to: https://github.com/settings/apps/mudra-content-optimizer
   - Change callback URL to: `https://mudramvp.vercel.app/api/auth/github/installation/callback`

2. **Add Vercel env vars:**
   - GITHUB_APP_ID
   - GITHUB_APP_NAME
   - GITHUB_CLIENT_ID (update existing)
   - GITHUB_CLIENT_SECRET (update existing)
   - GITHUB_PRIVATE_KEY (paste entire .pem content)
   - NEXT_PUBLIC_GITHUB_APP_NAME

3. **Redeploy**

---

## ✅ Success Indicators

You know it's working when:

1. ✅ Clicking "Install" on Integrations page redirects to GitHub
2. ✅ GitHub shows "Select repositories" UI (not all-or-nothing OAuth)
3. ✅ After selecting repos, redirects back to Mudra
4. ✅ Integrations page shows "Connected as @username"
5. ✅ Content Optimizer deployment shows only selected repos in dropdown
6. ✅ Can create PR to selected repository successfully

---

## ❓ FAQ

### Can I connect repositories I don't own?
**Yes!** You can connect:
- ✅ **Organization repositories** (if you're a member with write access)
- ✅ **Repositories where you're a collaborator** (with push/write permissions)
- ✅ **Forked repositories** you have write access to
- ✅ **Your own repositories**

During GitHub App installation, you'll see:
- All repos you own
- All org repos you have access to
- All repos where you're a collaborator

You can select any combination of these!

### What permissions do I need?
- **Minimum:** Write access (push permission) to create PRs
- **Ideal:** Admin access for full control
- **Organization repos:** Must be org member with appropriate role

### How do organization admins control this?
Org admins can:
1. Allow/restrict which GitHub Apps can be installed
2. Approve installations for organization repositories
3. Review which repos each member connected

Go to: `https://github.com/organizations/YOUR_ORG/settings/oauth_application_policy`

---

## 📞 Need Help?

Check full documentation:
- Setup guide: `docs/implementation/GITHUB_APP_REPOSITORY_SELECTION.md`
- Implementation summary: `docs/implementation/GITHUB_REPO_SELECTION_SETUP.md`

Or check TypeScript errors:
```bash
npm run build
```
