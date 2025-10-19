# Mudra MVP

**Tagline:** "Get your startup mentioned by AI"

Mudra is a **Generative Engine Optimization (GEO) platform** that helps startups increase visibility in AI-generated responses from ChatGPT, Claude, Perplexity, and other AI systems. The platform analyzes AI visibility, technical structure, and generates actionable recommendations.

## 🚀 Quick Start

### mudra-app (Main Production App)
```powershell
cd mudra-app
npm install --force
npx prisma generate && npx prisma db push
npm run dev  # Starts on localhost:3000
```

### firegeo (Open-Source SaaS Starter)
```powershell
cd firegeo
npm install
npm run setup  # Auto-configures database + auth
npm run dev    # Starts with Turbopack
```

### llm (Python FAISS API)
```bash
cd llm
pip install -r requirements.txt
python faiss_api.py
```

## 📁 Project Structure

```
MudraMVP/
├── mudra-app/          # Main Next.js app (Prisma + PostgreSQL)
├── firegeo/            # SaaS starter (Drizzle + Better Auth)
├── llm/                # Python FAISS semantic search API
├── docs/               # Centralized documentation
│   ├── architecture/   # System design & diagrams
│   ├── implementation/ # Feature implementation guides
│   ├── fixes/          # Bug fixes & debugging
│   ├── deployment/     # Deployment guides
│   ├── guides/         # User & developer guides
│   ├── mudra-app/      # App-specific docs
│   ├── firegeo/        # Firegeo-specific docs
│   └── llm/            # LLM service docs
├── scripts/
│   └── archive/        # Archived test & setup scripts
└── .github/
    └── copilot-instructions.md  # AI development guidelines
```

## 📚 Documentation

- **📖 Full Documentation**: [/docs](/docs)
- **⚙️ Setup Guide**: [/docs/mudra-app/SETUP.md](/docs/mudra-app/SETUP.md)
- **🏗️ Architecture**: [/docs/architecture](/docs/architecture)
- **🚀 Quick Reference**: [/docs/guides/QUICK_REFERENCE.md](/docs/guides/QUICK_REFERENCE.md)
- **🐛 Troubleshooting**: [/docs/mudra-app/DEV_TROUBLESHOOTING.md](/docs/mudra-app/DEV_TROUBLESHOOTING.md)

## 🛠️ Technology Stack

### mudra-app
- **Framework**: Next.js 15 (App Router)
- **Database**: PostgreSQL + Prisma ORM
- **Auth**: Custom auth system
- **APIs**: DirectGEO (AI testing), Firecrawl (web scraping)

### firegeo
- **Framework**: Next.js 15 (App Router with Turbopack)
- **Database**: PostgreSQL + Drizzle ORM
- **Auth**: Better Auth
- **Features**: SaaS boilerplate with subscription management

### llm
- **Framework**: Python + FastAPI
- **Search**: FAISS vector database
- **Purpose**: Semantic search for content analysis

## 🏗️ Key Features

- **AI Visibility Testing**: Test brand mentions across OpenAI, Anthropic, Google
- **Technical Analysis**: 12-component health scoring (SEO, performance, accessibility)
- **Prompt Generation**: Brand-specific test prompts (up to 100 per brand)
- **Unified Analysis**: Parallel GEO + technical analysis pipeline
- **Dashboard**: Real-time metrics and historical comparisons

## License

This project is private and confidential.

## Contributing

Guidelines for contributing to this project will be added as needed. 