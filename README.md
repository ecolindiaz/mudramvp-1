# Technical Structure - GEO Analysis System

A comprehensive web scraping and GEO (Generative Engine Optimization) analysis system built with Firecrawl and TypeScript. This system provides enterprise-grade technical analysis for websites, focusing on AI search engine optimization.

## 🎯 **What This System Does**

Our enhanced GEO scraper analyzes websites across **6 critical dimensions**:

1. **📋 Structured Data Analysis** - JSON-LD, microdata, Schema.org detection
2. **🧠 Entity Recognition** - Organizations, people, technologies, products
3. **❓ FAQ Optimization** - Q&A structure and help content analysis  
4. **🕐 Content Freshness** - Publication dates, update frequency, temporal signals
5. **📝 Content Authority** - Statistics, expert quotes, citations, testimonials
6. **🔧 Technical Accessibility** - Meta tags, HTTPS, mobile-friendliness, Core Web Vitals

**Output**: Comprehensive GEO scores (0-100) with actionable optimization recommendations.

## 🚀 **Quick Start**

### **Prerequisites**
- Node.js 18+ 
- Firecrawl API key from [firecrawl.dev](https://firecrawl.dev)

### **Installation**
```bash
# Install dependencies
npm install

# Set up your Firecrawl API key
export FIRECRAWL_API_KEY=fc-your-api-key

# Or use the setup script
./setup-api-key.sh
```

### **Basic Usage**
```bash
# Enhanced GEO analysis (recommended)
npm run enhanced-geo https://website.com

# Basic GEO technical analysis
npm run geo https://website.com

# Simple schema extraction
npm run extract https://website.com

# Build TypeScript
npm run build
```

## 📊 **Analysis Examples**

### **TickUp App Analysis**
```bash
npm run enhanced-geo https://tickupapp.com/
```
**Results**: 71/100 GEO Score
- ✅ **Structured Data**: 50/100 (16 JSON-LD schemas found!)
- ✅ **Entity Recognition**: 100/100 (16 financial organizations)
- ✅ **FAQ Optimization**: 70/100 (11 educational sections)
- ✅ **Technical Accessibility**: 85/100

### **TradingView Analysis** 
```bash
npm run enhanced-geo https://tradingview.com/
```
**Results**: 67/100 GEO Score
- ✅ **Entity Recognition**: 100/100 (56 organizations, 12 technologies)
- ✅ **Content Authority**: 100/100 (Rich financial data)
- ✅ **Content Freshness**: 95/100 (Daily updates)

## 🔧 **System Architecture**

### **Core Files**
```
src/
├── enhanced-geo-scraper.ts     # 🌟 Main comprehensive scraper
├── geo-technical-scraper.ts    # Basic GEO analysis  
├── schema-extractor.ts         # Simple schema extraction
└── config/
    └── firecrawl-config.ts     # Shared Firecrawl configuration
```

### **Key Features**

#### **1. Enhanced Structured Data Detection**
- **Real HTML parsing** + **AI extraction** for maximum coverage
- **JSON-LD script detection** with regex + AI processing
- **Microdata parsing** from HTML attributes
- **Schema type identification** (Organization, Product, FAQ, etc.)

#### **2. Intelligent Entity Recognition**
- **Organizations**: Companies, institutions, brands
- **People**: Experts, authors, industry leaders  
- **Technologies**: Frameworks, tools, programming languages
- **Products**: Software, services, offerings
- **Locations**: Geographic references and markets

#### **3. Comprehensive FAQ Analysis**
- **Educational content detection**
- **Q&A structure identification**
- **Support documentation analysis**
- **Help content optimization scoring**

#### **4. Content Freshness Assessment**
- **Publication date extraction**
- **Last modified timestamps**
- **Update frequency analysis**
- **Freshness signal detection** (news, releases, versions)

#### **5. Authority Signal Detection**
- **Statistics and data points**
- **Expert quotes and testimonials**
- **Citation and reference analysis**
- **Content quality metrics**

## 📈 **GEO Scoring Algorithm**

Our weighted scoring system:
```typescript
Overall Score = 
  (Content Authority × 25%) +
  (Technical Accessibility × 20%) +  
  (Structured Data × 20%) +
  (Entity Recognition × 15%) +
  (FAQ Optimization × 10%) +
  (Content Freshness × 10%)
```

**Score Ranges**:
- **80-100**: Excellent GEO optimization
- **60-79**: Good, minor improvements needed
- **40-59**: Fair, significant opportunities  
- **0-39**: Poor, major optimization required

## 💾 **Output & Reports**

All analysis results are saved to `output/` with detailed JSON reports:

```json
{
  "url": "https://website.com",
  "geoScore": {
    "overall": 71,
    "structuredData": 50,
    "entityRecognition": 100,
    "contentFreshness": 95
  },
  "structuredData": {
    "jsonLd": [...],
    "schemaTypes": ["Recipe", "Organization"]
  },
  "entityRecognition": {
    "organizations": ["Google", "Microsoft"],
    "technologies": ["React", "TypeScript"]
  }
}
```

**Report Types**:
- `enhanced-geo-*.json` - Comprehensive analysis
- `geo-technical-*.json` - Basic technical analysis
- `schema-markup-*.json` - Schema extraction only

## 🎯 **Use Cases**

### **For SEO Teams**
- **Competitive analysis** of rival websites
- **Technical SEO auditing** with AI focus
- **Structured data optimization** recommendations
- **Content authority assessment**

### **For Development Teams**  
- **Schema markup validation**
- **Technical accessibility testing**
- **Performance optimization insights**
- **Entity relationship mapping**

### **For Content Teams**
- **FAQ optimization** opportunities
- **Content freshness** monitoring
- **Authority signal** enhancement
- **Educational content** structure analysis

### **For Marketing Teams**
- **Brand entity recognition** tracking
- **Competitive positioning** analysis
- **Content strategy** optimization
- **Technical differentiation** insights

## 🔍 **Technical Implementation**

### **Parallel Processing Architecture**
```typescript
// 5 simultaneous Firecrawl API calls for comprehensive analysis
const [htmlResult, contentResult, entityResult, faqResult, freshnessResult] = 
  await Promise.all([...]);
```

### **Hybrid Data Extraction**
- **HTML Regex Parsing** for traditional structured data
- **AI-Powered Extraction** for complex content analysis
- **Metadata Processing** for technical signals
- **Content Analysis** for authority and freshness

### **Error Handling & Reliability**
- Graceful fallbacks for failed extractions
- Comprehensive error logging
- Timeout handling for large sites
- Rate limiting respect for Firecrawl API

## 🛠️ **Development**

### **Build System**
```bash
npm run build        # Compile TypeScript
npm test            # Run tests (coming soon)
npm run lint        # Code linting (coming soon)
```

### **Project Structure**
```
Technical Structure/
├── src/                        # TypeScript source code
├── dist/                       # Compiled JavaScript (generated)
├── output/                     # Analysis results
├── GEO_IMPROVEMENT_RESULTS.md  # System enhancement documentation
├── TECHNICAL_ANALYSIS.md       # Technical capability assessment
└── README.md                   # This file
```

## 🤝 **Integration with MudraMVP**

This technical analysis system is designed to complement MudraMVP by providing:

- **Competitive Intelligence**: Analyze competitor technical implementations
- **GEO Optimization**: Optimize MudraMVP for AI search engines
- **Technical Benchmarking**: Compare against industry standards  
- **Content Strategy**: Inform content and FAQ development
- **SEO Enhancement**: Technical SEO recommendations

## 📋 **Dependencies**

### **Runtime Dependencies**
- `@mendable/firecrawl-js` - Web scraping API
- `dotenv` - Environment variable management
- `@types/node` - Node.js TypeScript definitions

### **Development Dependencies**  
- `typescript` - TypeScript compiler
- `tsx` - TypeScript execution for development

## 🔮 **Future Enhancements**

- **Performance Metrics**: Core Web Vitals integration
- **Advanced Accessibility**: ARIA landmark analysis
- **RDFa Parsing**: Complete structured data trinity
- **API Integration**: REST API for programmatic access
- **Dashboard UI**: Web interface for analysis results
- **Batch Processing**: Multiple URL analysis
- **Competitive Tracking**: Regular monitoring and alerts

## 📞 **Support**

For issues, questions, or feature requests related to the Technical Structure system, please refer to the main MudraMVP repository or contact the development team.

---

**Built with ❤️ for MudraMVP - Empowering intelligent web analysis and GEO optimization.** 