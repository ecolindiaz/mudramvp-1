# Google Analytics & Search Console Integration Setup

This guide will help you set up real traffic data integration with Google Analytics 4 and Google Search Console.

## Prerequisites

1. Access to Google Cloud Console
2. Access to Google Analytics 4 property
3. Access to Google Search Console property

## Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Note your Project ID

## Step 2: Enable Required APIs

1. In Google Cloud Console, go to **APIs & Services** > **Library**
2. Search for and enable:
   - **Google Analytics Data API** (v1)
   - **Google Search Console API**

## Step 3: Create Service Account

1. Go to **APIs & Services** > **Credentials**
2. Click **Create Credentials** > **Service Account**
3. Fill in details:
   - **Service account name**: `mudra-analytics-service`
   - **Service account ID**: Will be auto-generated
   - **Description**: Service account for MudraMVP analytics integration
4. Click **Create and Continue**
5. Grant role: **Viewer** (or more restrictive custom role)
6. Click **Done**

## Step 4: Generate Service Account Key

1. Click on the newly created service account
2. Go to **Keys** tab
3. Click **Add Key** > **Create new key**
4. Select **JSON** format
5. Click **Create** - a JSON file will download

## Step 5: Extract Credentials from JSON

Open the downloaded JSON file. You'll need these two values:

```json
{
  "client_email": "mudra-analytics-service@your-project.iam.gserviceaccount.com",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
}
```

## Step 6: Grant Access to Google Analytics

1. Go to [Google Analytics](https://analytics.google.com/)
2. Select your property
3. Go to **Admin** (bottom left)
4. Under **Property**, click **Property Access Management**
5. Click **+** (Add users)
6. Enter the service account email: `mudra-analytics-service@your-project.iam.gserviceaccount.com`
7. Select role: **Viewer**
8. Click **Add**

## Step 7: Get Google Analytics Property ID

1. In Google Analytics Admin, click **Property Settings**
2. Note your **Property ID** (format: `123456789`)
3. The full property ID for the API is: `properties/123456789`

## Step 8: Grant Access to Search Console

1. Go to [Google Search Console](https://search.google.com/search-console)
2. Select your property (website)
3. Click **Settings** (left sidebar)
4. Click **Users and permissions**
5. Click **Add User**
6. Enter the service account email: `mudra-analytics-service@your-project.iam.gserviceaccount.com`
7. Select permission: **Full** or **Restricted**
8. Click **Add**

## Step 9: Add Environment Variables

Add these variables to your `.env.local` file in the `mudra-app` directory:

```env
# Google Analytics & Search Console Integration
GOOGLE_CLIENT_EMAIL="mudra-analytics-service@your-project.iam.gserviceaccount.com"
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour\nPrivate\nKey\nHere\n-----END PRIVATE KEY-----\n"
GOOGLE_ANALYTICS_PROPERTY_ID="properties/123456789"
```

**Important Notes:**
- Keep the `\n` characters in the private key exactly as they appear in the JSON
- The private key should be enclosed in double quotes
- Never commit these credentials to version control

## Step 10: Install Required NPM Packages

Run these commands in the `mudra-app` directory:

```bash
npm install googleapis @google-analytics/data
```

## Step 11: Restart Docker Container

After adding environment variables and installing packages:

```bash
docker-compose down
docker-compose up --build
```

## Testing the Integration

1. Navigate to your MudraMVP app at http://localhost:3000
2. Click **"The Magic Button"**
3. Enter a website URL that's configured in your Google Analytics and Search Console
4. Click **"Analyze Website"**
5. Check the logs for:
   ```
   [GA4] Fetched analytics data: { monthlyVisitors: X, pageViews: Y, ... }
   [Search Console] Fetched search data: { topKeywords: [...], ... }
   ```

## Troubleshooting

### Error: "Missing Google service account credentials"
- Check that `GOOGLE_CLIENT_EMAIL` and `GOOGLE_PRIVATE_KEY` are set in `.env.local`
- Verify the private key has `\n` characters properly escaped

### Error: "User does not have sufficient permissions"
- Ensure the service account email is added to both Google Analytics and Search Console
- Check that the service account has at least "Viewer" permission in Analytics
- Verify the Search Console property URL matches exactly (with trailing slash)

### Error: "Property not found"
- Verify the GA Property ID format: `properties/123456789` (not just the number)
- Ensure the service account has access to that specific property

### No Data Returned
- Check that your website has recent traffic (last 30 days)
- Verify data is showing in the Google Analytics/Search Console web interfaces
- Look for errors in Docker logs: `docker-compose logs -f app`

## Optional: Brand-Specific GA Properties

You can store different GA Property IDs for different brands in your database:

1. Add a `gaPropertyId` field to the `BrandProfile` model in Prisma schema
2. Update the onboarding flow to collect the GA Property ID
3. Pass it through the pipeline config when analyzing

## Security Best Practices

1. **Never commit credentials**: Add `.env.local` to `.gitignore`
2. **Use environment-specific keys**: Different keys for dev/staging/production
3. **Rotate keys periodically**: Create new service accounts every 90 days
4. **Minimal permissions**: Only grant "Viewer" access, never "Editor"
5. **Monitor usage**: Check Google Cloud Console for API usage and errors

## API Quotas

- **Google Analytics Data API**: 50,000 requests per day (free tier)
- **Google Search Console API**: 1,200 requests per minute

For higher limits, you may need to request quota increases in Google Cloud Console.

## Next Steps

Once configured, the traffic metrics will automatically update on each analysis with:
- Real monthly visitor counts
- Actual page views
- Session duration from GA4
- Bounce rates
- Organic traffic percentage
- Top performing keywords from Search Console
- Week-over-week and month-over-month growth calculations
