#!/bin/bash

# Setup Firecrawl API Key
echo "🔥 Setting up Firecrawl API Key"
echo "================================"

# Create .env file with the API key
cat > .env << EOF
# Firecrawl API Configuration
FIRECRAWL_API_KEY=fc-302b86701ea44e928ddcfc42495a19a1

# Optional: Custom API endpoint (if using self-hosted)
# FIRECRAWL_API_URL=https://api.firecrawl.dev

# Example URLs for testing
EXAMPLE_URL_1=https://firecrawl.dev
EXAMPLE_URL_2=https://docs.firecrawl.dev
EXAMPLE_URL_3=https://example.com
EOF

echo "✅ Created .env file with your API key"
echo ""
echo "🚀 You can now run:"
echo "   npm start                 # Interactive CLI"
echo "   npm run example:basic     # Basic examples"
echo "   npm run example:advanced  # Advanced examples"
echo "   npm run example:prompt    # Prompt examples"
echo ""
echo "💡 Your API key is now saved in .env file" 