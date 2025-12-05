# GitHub App Setup Required

## Critical: Setup URL Configuration

For the GitHub App integration to work automatically, you **must** configure the **Setup URL** in your GitHub App settings.

### Steps to Configure:

1. Go to your GitHub App settings:
   - For personal apps: https://github.com/settings/apps/mudra-development
   - For org apps: https://github.com/organizations/{org}/settings/apps/mudra-development

2. Scroll to **"Setup URL (optional)"** section

3. Enter your callback URL:
   - **Development:** `http://localhost:3000/api/auth/github/installation/callback`
   - **Production:** `https://yourdomain.com/api/auth/github/installation/callback`

4. Check **"Redirect on update"** checkbox

5. Click **"Save changes"**

### What This Does:

When users install your GitHub App, they will be automatically redirected to your callback URL with the `installation_id` parameter. This allows Mudra to:
- Exchange the installation ID for an access token
- Store the integration in the database
- Enable the deployment dialog to detect the connection

### Without This Configuration:

If the Setup URL is not configured:
- Installation completes on GitHub's side ✓
- User sees success message on GitHub ✓
- **But** user is NOT redirected back to Mudra ✗
- **Result:** No database record created ✗
- **Impact:** Deployment dialog shows "GitHub not connected" ✗

## Alternative: Manual Sync Endpoint

If you can't configure the Setup URL (e.g., testing on localhost without ngrok), you can manually sync installations:

### Create a Manual Sync Endpoint:

```typescript
// app/api/integrations/github/sync/route.ts
// This endpoint fetches installations from GitHub and syncs them to the database
```

### Usage:

Users can click a "Sync GitHub" button in the integrations page to manually fetch their installations.

## Verifying Setup:

After configuring the Setup URL:

1. **Remove** any existing installations:
   - Go to https://github.com/settings/installations
   - Click "Configure" on mudra-development
   - Scroll down and click "Uninstall"

2. **Reinstall** the GitHub App through Mudra:
   - Go to Dashboard → Integrations
   - Click "Connect GitHub"
   - Select repositories
   - Click "Install"

3. **Verify** redirect:
   - You should be redirected back to Mudra
   - You should see the installation status update
   - Check database for GitHubIntegration record

4. **Test** deployment:
   - Go to Dashboard → Agents Lab
   - Try to deploy Content Optimizer
   - Repository dropdown should appear

## Troubleshooting:

### Issue: "GitHub not connected" after installation

**Cause:** Setup URL not configured in GitHub App settings

**Solution:**
1. Configure Setup URL (see steps above)
2. Uninstall and reinstall the GitHub App
3. Or use manual sync endpoint

### Issue: Callback returns 401 Unauthorized

**Cause:** User not logged into Mudra when redirected

**Solution:**
- Ensure users are logged in before clicking "Connect GitHub"
- Add session persistence check in callback

### Issue: "Failed to refresh installation token"

**Cause:** Missing or invalid GITHUB_APP_ID or GITHUB_PRIVATE_KEY

**Solution:**
- Verify environment variables are set correctly
- Ensure private key includes `-----BEGIN RSA PRIVATE KEY-----` headers
- Check for proper `\n` escaping in .env file

## Production Deployment:

When deploying to production:

1. Update GitHub App Setup URL to production domain
2. Set environment variables on hosting platform:
   ```
   GITHUB_APP_ID=your_app_id
   GITHUB_APP_NAME=mudra-content-optimizer
   GITHUB_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----"
   NEXT_PUBLIC_GITHUB_APP_NAME=mudra-content-optimizer
   ```
3. Test installation flow end-to-end
4. Verify database records are created

## Questions?

- Check logs: `docker logs mudra-app-dev 2>&1 | Select-String "GitHub"`
- Test callback manually: Visit `/api/auth/github/installation/callback?installation_id=YOUR_ID&setup_action=install`
- Verify database: Run `check-github-integration.js` script
