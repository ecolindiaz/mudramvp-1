# Clear Session Instructions

Your authentication is stuck. Follow these steps to clear everything:

## Option 1: Clear Browser Data (Recommended)

1. Open Chrome DevTools: `F12`
2. Go to **Application** tab
3. Under **Storage** → Click **Clear site data**
4. Check all boxes:
   - Cookies and other site data
   - Cached images and files
   - Local storage
   - Session storage
5. Click **Clear site data**
6. Close DevTools
7. Navigate to: `http://localhost:3000/login`

## Option 2: Manual Cookie Deletion

1. Open Chrome DevTools: `F12`
2. Go to **Application** tab
3. Expand **Cookies** → `http://localhost:3000`
4. Delete these cookies if they exist:
   - `next-auth.session-token`
   - `next-auth.csrf-token`
   - `next-auth.callback-url`
   - Any other `next-auth.*` cookies
5. Refresh the page
6. Navigate to: `http://localhost:3000/login`

## Option 3: Use Incognito Window

1. Open new Incognito/Private window: `Ctrl+Shift+N`
2. Go to: `http://localhost:3000/login`
3. Try logging in fresh

## After Clearing

You should be able to:
1. Access `/login` without being redirected
2. Create a new account at `/signup`
3. Log in with email/password
4. Log in with Google OAuth
5. See your real email in the sidebar after login
6. Successfully log out

## Test the System

After clearing and logging in:

### Test Login:
- Navigate to `/login`
- Enter credentials
- Should redirect to `/dashboard`
- Sidebar should show your real name/email

### Test Logout:
- Click user avatar (bottom left)
- Click "Log out"
- Should see console logs: "Signing out..." → "Sign out response: 200"
- Should redirect to `/login`

### Test Google OAuth:
- Go to `/login`
- Click "Continue with Google"
- Should open Google sign-in popup
- After signing in, should redirect to `/dashboard`
- Sidebar should show your Google email

## Still Not Working?

If issues persist, restart the Docker container:
```bash
cd mudra-app
docker compose -f docker-compose.dev.yml restart
```

Then clear browser data again and try.
