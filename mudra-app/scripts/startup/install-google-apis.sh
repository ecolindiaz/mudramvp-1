#!/bin/bash

# Script to install Google Analytics and Search Console API packages

echo "Installing Google APIs packages..."

# Install googleapis and google-analytics-data packages
npm install googleapis @google-analytics/data

echo "✓ Installed googleapis"
echo "✓ Installed @google-analytics/data"
echo ""
echo "Next steps:"
echo "1. Set up Google Cloud Project and Service Account (see GOOGLE_ANALYTICS_SETUP.md)"
echo "2. Add GOOGLE_CLIENT_EMAIL, GOOGLE_PRIVATE_KEY, and GOOGLE_ANALYTICS_PROPERTY_ID to .env.local"
echo "3. Rebuild Docker container: docker-compose down && docker-compose up --build"
