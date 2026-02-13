# Bright Data Residential Proxies - Complete Integration Documentation

> **Purpose**: Enable geo-targeted DirectGEO AI queries for Mudra MVP. The proxy routes **Gemini API calls** through country-specific residential IPs so Google's Search grounding returns localized results. Claude, Perplexity, and OpenAI have built-in geo filters and do NOT need the proxy. Supported countries: USA, Spain, UK, Mexico, Colombia, Argentina, Peru.

---

## Table of Contents

1. [What Are Residential Proxies](#1-what-are-residential-proxies)
2. [Network Specifications](#2-network-specifications)
3. [Authentication and Credentials](#3-authentication-and-credentials)
4. [Super Proxy Endpoint](#4-super-proxy-endpoint)
5. [Geolocation Targeting (CRITICAL FOR MUDRA)](#5-geolocation-targeting-critical-for-mudra)
6. [IP Rotation and Session Management](#6-ip-rotation-and-session-management)
7. [Configuration Parameters Reference](#7-configuration-parameters-reference)
8. [Code Examples - All Languages](#8-code-examples---all-languages)
9. [JavaScript/Node.js SDK Integration](#9-javascriptnodejs-sdk-integration)
10. [SOCKS5 Protocol Support](#10-socks5-protocol-support)
11. [Network Access and Security (IP Whitelisting)](#11-network-access-and-security-ip-whitelisting)
12. [Account Management API](#12-account-management-api)
13. [Rules, Limits and Best Practices](#13-rules-limits-and-best-practices)
14. [Mudra MVP Use Case - Complete Business and Technical Specification](#14-mudra-mvp-use-case---complete-business-and-technical-specification)
    - 14.1 Business Rules Summary
    - 14.2 What "Monitor" Means
    - 14.3 Country Selection Flow
    - 14.4 When Proxy Requests Happen (Onboarding, Dashboard, Add Location)
    - 14.5 Proxy Usage Per Analysis Run (Bandwidth Calculation)
    - 14.6 Language and Prompt Logic
    - 14.7 Technical Crawl vs GEO Crawl
    - 14.8 Dashboard UI - Country Flag Display
    - 14.9 Complete Flow Diagram
    - 14.10 Proxy Request Mapping
    - 14.11 Concrete Example Walkthrough
    - 14.12 Maximum Usage Ceiling
    - 14.13 Data Model Changes Needed
    - 14.14 Summary
15. [Environment Variables and Config](#15-environment-variables-and-config)
16. [Complete Mudra Implementation Code](#16-complete-mudra-implementation-code)
17. [Error Handling and Retry Strategy](#17-error-handling-and-retry-strategy)
18. [Cost Optimization](#18-cost-optimization)
19. [FAQ](#19-faq)
20. [Official Documentation Links](#20-official-documentation-links)

---

## 1. What Are Residential Proxies

**Source**: https://docs.brightdata.com/proxy-networks/residential/introduction

The Bright Data Residential proxy network is a network of **150M+ IPs** from **195+ countries** all around the world. The vast pool of Residential IPs is made up of **real people who opt-in** and are rewarded in exchange for lending their IP to the network.

### Why Residential Proxies for Mudra

- **Geo-localized AI API calls**: Route Gemini API calls through country-specific IPs so Google's Search grounding returns locally relevant results (Gemini is the ONLY provider that needs this - Claude, Perplexity, and OpenAI all have built-in geo filters)
- **Real user IPs**: Gemini sees the request as coming from an actual resident of that country, not a US server
- **Accurate grounding data**: When Gemini grounds its response with Google Search, the search results are localized to the proxy's country
- **Anti-detection**: Unlike datacenter proxies, residential IPs are not flagged, ensuring reliable API access

### How It Works

1. You send a request through Bright Data's **Super Proxy** endpoint
2. You specify the target country (e.g., `-country-es` for Spain)
3. Bright Data routes your request through a **real residential IP** in that country
4. The target website sees a real IP from Spain and returns Spanish-localized content
5. The response comes back to your server

---

## 2. Network Specifications

| Specification | Value |
|---|---|
| **IP Pool Size** | 150,000,000+ IPs |
| **Countries Covered** | 195+ |
| **Proxy Type** | Rotating Residential |
| **Protocols** | HTTP, HTTPS, SOCKS5 |
| **Super Proxy Host** | `brd.superproxy.io` |
| **HTTP/HTTPS Port** | `33335` |
| **SOCKS5 Port** | `22228` |
| **Authentication** | Username/Password (embedded in proxy URL) |
| **IP Rotation** | Automatic per-request (default) or sticky sessions |
| **Session Duration** | Configurable (sticky sessions keep same IP) |
| **Bandwidth** | Pay-per-GB |
| **Concurrent Connections** | Unlimited |

---

## 3. Authentication and Credentials

**Source**: https://docs.brightdata.com/api-reference/authentication

### Credential Components

| Component | Format | Description |
|---|---|---|
| **Customer ID** | `hl_XXXXXXXX` | Your Bright Data account ID |
| **Zone Name** | e.g., `residential_zone1` | The proxy zone you create in the dashboard |
| **Zone Password** | alphanumeric string | Password for the specific zone |
| **API Key** | `b5648e10...` (long hex string) | For REST API calls (account management) |

### Username Format

The proxy username follows this pattern:

```
brd-customer-<customer_id>-zone-<zone_name>
```

**Example:**
```
brd-customer-hl_12345678-zone-mudra_residential
```

### Full Proxy URL Format

```
http://brd-customer-<customer_id>-zone-<zone_name>:<zone_password>@brd.superproxy.io:33335
```

### With Geo-Targeting Parameters

Parameters are appended to the username with `-` separators:

```
http://brd-customer-<customer_id>-zone-<zone_name>-country-<code>:<zone_password>@brd.superproxy.io:33335
```

### API Key Authentication (for REST API)

For account management API calls, use a Bearer token:

```
Authorization: Bearer YOUR_API_KEY
```

**How to get your API Key:**
1. Go to https://brightdata.com/cp/setting/users
2. Generate an API key from account settings
3. Use it in the `Authorization` header

---

## 4. Super Proxy Endpoint

**Source**: https://docs.brightdata.com/proxy-networks/residential/quickstart

All residential proxy requests go through the **Super Proxy**:

| Protocol | Host | Port |
|---|---|---|
| HTTP/HTTPS | `brd.superproxy.io` | `33335` |
| SOCKS5 | `brd.superproxy.io` | `22228` |

### How the Super Proxy Works

```
Your Server -> Super Proxy (brd.superproxy.io:33335) -> Residential IP in Target Country -> Target Website
```

The Super Proxy:
1. Authenticates your credentials
2. Reads the geo-targeting parameters from your username
3. Selects an appropriate residential IP from that location
4. Forwards your request through that IP
5. Returns the response to you

---

## 5. Geolocation Targeting (CRITICAL FOR MUDRA)

**Source**: https://docs.brightdata.com/api-reference/proxy/geolocation-targeting

This is the **most important section** for Mudra. Geolocation parameters are embedded in the proxy username.

### 5.1 Country Targeting

**Format:** `-country-<two_letter_code>`

| Country (Mudra) | ISO Code | Username Suffix |
|---|---|---|
| **USA** | `us` | `-country-us` |
| **Spain** | `es` | `-country-es` |
| **UK** | `gb` | `-country-gb` |
| **Mexico** | `mx` | `-country-mx` |
| **Colombia** | `co` | `-country-co` |
| **Argentina** | `ar` | `-country-ar` |
| **Peru** | `pe` | `-country-pe` |

**Full username example for USA:**
```
brd-customer-hl_12345678-zone-mudra_residential-country-us
```

**Full username example for Spain:**
```
brd-customer-hl_12345678-zone-mudra_residential-country-es
```

**cURL example targeting Mexico:**
```sh
curl "https://target-website.com" \
  --proxy brd.superproxy.io:33335 \
  --proxy-user "brd-customer-hl_12345678-zone-mudra_residential-country-mx:zone_password_here"
```

### 5.2 State Targeting

**Format:** `-country-<code>-state-<state_code>`

Available for countries like USA and Australia.

```
brd-customer-hl_12345678-zone-mudra_residential-country-us-state-ny
brd-customer-hl_12345678-zone-mudra_residential-country-us-state-ca
```

### 5.3 City Targeting

**Format:** `-country-<code>-city-<cityname>`

City names must be **lowercase, no spaces**.

```
brd-customer-hl_12345678-zone-mudra_residential-country-us-city-newyork
brd-customer-hl_12345678-zone-mudra_residential-country-es-city-madrid
brd-customer-hl_12345678-zone-mudra_residential-country-mx-city-mexicocity
brd-customer-hl_12345678-zone-mudra_residential-country-co-city-bogota
brd-customer-hl_12345678-zone-mudra_residential-country-ar-city-buenosaires
brd-customer-hl_12345678-zone-mudra_residential-country-pe-city-lima
brd-customer-hl_12345678-zone-mudra_residential-country-gb-city-london
```

### 5.4 ZIP Code Targeting

**Format:** `-country-us-city-<city>-zip-<zipcode>`

Available for Residential proxies (primarily US):

```
brd-customer-hl_12345678-zone-mudra_residential-country-us-city-memphis-zip-37501
```

### 5.5 ASN Targeting

**Format:** `-asn-<asn_number>`

Target specific ISP/Autonomous System Numbers:

```
brd-customer-hl_12345678-zone-mudra_residential-country-us-asn-56386
```

### 5.6 OS Targeting (Residential Only)

**Format:** `-os-<os_name>`

Target specific operating systems: `windows`, `macos`, `android`

```
brd-customer-hl_12345678-zone-mudra_residential-os-windows
```

### 5.7 Chaining Multiple Parameters

You can chain parameters together:

```
brd-customer-hl_12345678-zone-mudra_residential-country-us-state-ca-city-sanfrancisco
```

---

## 6. IP Rotation and Session Management

**Source**: https://docs.brightdata.com/api-reference/proxy/rotate_ips

### 6.1 Default Rotation (Recommended for Mudra)

By default, Bright Data assigns a **random proxy** from the available pool based on your configuration (e.g., targeting `-country-mx`). **Each subsequent request gets a different, randomly selected proxy IP.**

- This is the default behavior - no extra configuration needed
- Each request to crawl a page gets a fresh IP
- High request rates may occasionally reuse the same IP

**This is ideal for Mudra** because each page crawl should look like a different user.

### 6.2 Sticky Sessions (Same IP Across Requests)

If you need the **same IP for multiple requests** (e.g., crawling multiple pages of the same site in sequence), use session IDs:

**Format:** `-session-<unique_string>`

```
brd-customer-hl_12345678-zone-mudra_residential-country-us-session-mysession123
```

**Rules:**
- Each unique session ID gets a unique IP address
- Sending the same session ID = same IP
- Sending a different session ID = different IP
- Session IPs eventually expire (typically after approximately 10 minutes of inactivity)

### 6.3 Forced Rotation

To **force a new IP** between requests, use a different random session ID each time:

```javascript
// Force new IP per request
const sessionId = `session-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const username = `brd-customer-${CUSTOMER_ID}-zone-${ZONE_NAME}-country-${countryCode}-session-${sessionId}`;
```

---

## 7. Configuration Parameters Reference

**Source**: https://docs.brightdata.com/proxy-networks/residential/configure-your-proxy and https://docs.brightdata.com/proxy-networks/config-options

### All Username Parameters

| Parameter | Format | Description | Proxy Types |
|---|---|---|---|
| `-country-xx` | 2-letter ISO code | Target country | All |
| `-state-xxxxx` | 2-letter state code | Target state (requires country) | Residential, Mobile |
| `-city-xxxxx` | lowercase, no spaces | Target city (requires country) | Residential, Mobile |
| `-zip-xxxxx` | 5-digit code | Target ZIP code (requires city) | Residential |
| `-asn-xxxxx` | ASN number | Target specific ISP/ASN | Residential |
| `-os-xxxxx` | `windows`/`macos`/`android` | Target OS | Residential only |
| `-session-xxxxx` | any unique string | Sticky session (same IP) | All |
| `-carrier-xxxxx` | carrier code | Target mobile carrier | Mobile only |

### Complete Username Construction

```
brd-customer-<CUSTOMER_ID>-zone-<ZONE_NAME>[-country-<CC>][-state-<ST>][-city-<CITY>][-zip-<ZIP>][-asn-<ASN>][-os-<OS>][-session-<SESSION>]
```

---

## 8. Code Examples - All Languages

**Source**: https://docs.brightdata.com/proxy-networks/residential/send-your-first-request

### 8.1 cURL

```sh
curl "http://lumtest.com/myip.json" \
  --proxy brd.superproxy.io:33335 \
  --proxy-user "brd-customer-<customer_id>-zone-<zone_name>:<zone_password>"
```

**With country targeting:**
```sh
curl "http://lumtest.com/myip.json" \
  --proxy brd.superproxy.io:33335 \
  --proxy-user "brd-customer-<customer_id>-zone-<zone_name>-country-es:<zone_password>"
```

### 8.2 Node.js (request-promise)

```javascript
require('request-promise')({
    url: 'http://lumtest.com/myip.json',
    proxy: 'http://brd-customer-<customer_id>-zone-<zone_name>:<zone_password>@brd.superproxy.io:33335',
})
.then(function (data) {
    console.log(data);
},
function (err) {
    console.error(err);
});
```

### 8.3 Node.js (Modern - fetch with https-proxy-agent)

```javascript
import { HttpsProxyAgent } from 'https-proxy-agent';

const CUSTOMER_ID = 'hl_12345678';
const ZONE_NAME = 'mudra_residential';
const ZONE_PASSWORD = 'your_zone_password';
const COUNTRY = 'es'; // Spain

const proxyUrl = `http://brd-customer-${CUSTOMER_ID}-zone-${ZONE_NAME}-country-${COUNTRY}:${ZONE_PASSWORD}@brd.superproxy.io:33335`;
const agent = new HttpsProxyAgent(proxyUrl);

const response = await fetch('https://target-website.com', { agent });
const html = await response.text();
console.log(html);
```

### 8.4 Python (requests)

```python
import requests

host = 'brd.superproxy.io'
port = 33335
username = 'brd-customer-<customer_id>-zone-<zone_name>-country-mx'
password = '<zone_password>'

proxy_url = f'http://{username}:{password}@{host}:{port}'
proxies = {
    'http': proxy_url,
    'https': proxy_url
}

url = "http://lumtest.com/myip.json"
response = requests.get(url, proxies=proxies)
print(response.json())
```

### 8.5 PHP

```php
<?php
$curl = curl_init('http://lumtest.com/myip.json');
curl_setopt($curl, CURLOPT_PROXY, 'http://brd.superproxy.io:33335');
curl_setopt($curl, CURLOPT_PROXYUSERPWD,
  'brd-customer-<customer_id>-zone-<zone_name>-country-gb:<zone_password>');
curl_exec($curl);
?>
```

### 8.6 Ruby

```ruby
require 'uri'
require 'net/http'

uri = URI.parse('http://lumtest.com/myip.json')
proxy = Net::HTTP::Proxy('brd.superproxy.io', 33335,
  'brd-customer-<customer_id>-zone-<zone_name>', '<zone_password>')

req = Net::HTTP::Get.new(uri)
result = proxy.start(uri.host, uri.port, use_ssl: uri.scheme == 'https') do |http|
  http.request(req)
end

puts result.body
```

### 8.7 C# (.NET)

```csharp
using System;
using System.Net;

class Example {
    static void Main() {
        var client = new WebClient();
        client.Proxy = new WebProxy("brd.superproxy.io:33335");
        client.Proxy.Credentials = new NetworkCredential(
            "brd-customer-<customer_id>-zone-<zone_name>",
            "<zone_password>"
        );
        Console.WriteLine(client.DownloadString("http://lumtest.com/myip.json"));
    }
}
```

### 8.8 Java

```java
package example;

import org.apache.http.HttpHost;
import org.apache.http.client.fluent.*;

public class Example {
    public static void main(String[] args) throws Exception {
        HttpHost proxy = new HttpHost("brd.superproxy.io", 33335);
        String res = Executor.newInstance()
            .auth(proxy, "brd-customer-<customer_id>-zone-<zone_name>", "<zone_password>")
            .execute(Request.Get("http://lumtest.com/myip.json").viaProxy(proxy))
            .returnContent().asString();
        System.out.println(res);
    }
}
```

### 8.9 Perl

```perl
use LWP::UserAgent;
my $agent = LWP::UserAgent->new();
$agent->proxy(['http', 'https'],
  "http://brd-customer-<customer_id>-zone-<zone_name>:<zone_password>\@brd.superproxy.io:33335");
print $agent->get('http://lumtest.com/myip.json')->content();
```

### 8.10 VBA

```vb
Imports System.Net

Module Module1
    Sub Main()
        Dim Client As New WebClient
        Client.Proxy = New WebProxy("http://brd.superproxy.io:33335")
        Client.Proxy.Credentials = New NetworkCredential(
            "brd-customer-<customer_id>-zone-<zone_name>", "<zone_password>")
        Console.WriteLine(Client.DownloadString("http://lumtest.com/myip.json"))
    End Sub
End Module
```

---

## 9. JavaScript/Node.js SDK Integration

**Source**: https://docs.brightdata.com/api-reference/SDK-JS

### Installation

```bash
npm install @brightdata/sdk
```

### SDK Initialization

```javascript
import { bdclient } from '@brightdata/sdk';

// Basic initialization
const client = new bdclient({
    apiKey: 'your-api-key-here', // or set BRIGHTDATA_API_KEY env variable
});

// Advanced configuration
const advancedClient = new bdclient({
    apiKey: 'brd-customer-hl_12345-zone-web:abc123',
    autoCreateZones: true,           // Auto-create zones if they don't exist
    webUnlockerZone: 'my_web_zone',  // Custom web unlocker zone name
    serpZone: 'my_serp_zone',        // Custom SERP zone name
    logLevel: 'DEBUG',               // 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL'
    structuredLogging: true,         // JSON format logging
    verbose: true                    // Enable verbose output
});

// Using environment variables (recommended for production)
// Set BRIGHTDATA_API_KEY, BRIGHTDATA_WEB_UNLOCKER_ZONE, BRIGHTDATA_SERP_ZONE
const envClient = new bdclient(); // Automatically uses env vars
```

### SDK Constructor Options

| Option | Type | Default | Description |
|---|---|---|---|
| `apiKey` | string | env `BRIGHTDATA_API_KEY` | Your Bright Data API key |
| `autoCreateZones` | boolean | `true` | Auto-create zones if they don't exist |
| `webUnlockerZone` | string | -- | Custom zone name for Web Unlocker |
| `serpZone` | string | -- | Custom zone name for SERP API |
| `logLevel` | string | `'INFO'` | `'DEBUG'` / `'INFO'` / `'WARNING'` / `'ERROR'` / `'CRITICAL'` |
| `structuredLogging` | boolean | `false` | Enable structured JSON logging |
| `verbose` | boolean | `false` | Enable verbose logging |

---

## 10. SOCKS5 Protocol Support

**Source**: https://docs.brightdata.com/proxy-networks/socks5

If you need SOCKS5 (useful for certain crawling tools):

### Port

SOCKS5 uses port **`22228`** (not 33335).

### Node.js Example

```javascript
const https = require('https');
const { SocksProxyAgent } = require('socks-proxy-agent');

const user_pass = 'brd-customer-[ACCOUNT_ID]-zone-[ZONE_NAME]:[ZONE_PASSWORD]';
const socks_proxy_url = `socks5h://${user_pass}@brd.superproxy.io:22228`;
const agent = new SocksProxyAgent(socks_proxy_url);

https.get('https://geo.brdtest.com/welcome.txt', { agent },
    res => res.pipe(process.stdout));
```

### Installation

```bash
npm install socks-proxy-agent
```

---

## 11. Network Access and Security (IP Whitelisting)

**Source**: https://docs.brightdata.com/proxy-networks/residential/network-access

### Important Security Rules

1. **Whitelist your server IPs** - Add the IPs of your servers (Vercel serverless functions, your deployment IPs) to the zone's allowlist
2. **Whitelisted IPs are YOUR machine's IPs** - Not the proxy IPs, but the IPs from which you send requests
3. **IP ranges supported** - You can whitelist entire ranges
4. **No limit** on number of IPs/domains you can add
5. **Recommended** to allowlist IPs to prevent temporary blocks due to irregular activity

### API Endpoints for IP Management

#### Get Zone Whitelist
```
GET https://api.brightdata.com/zone/whitelist?zones=mudra_residential
Authorization: Bearer YOUR_API_KEY
```

**Response:**
```json
{
    "mudra_residential": ["127.0.0.1", "203.0.113.50"]
}
```

#### Add IP to Zone Whitelist
```
PUT https://api.brightdata.com/zone/whitelist
Authorization: Bearer YOUR_API_KEY
Content-Type: application/json

{
    "zone": "mudra_residential",
    "ip": "203.0.113.50"
}
```

#### Remove IP from Zone Whitelist
```
DELETE https://api.brightdata.com/zone/whitelist
Authorization: Bearer YOUR_API_KEY
Content-Type: application/json

{
    "zone": "mudra_residential",
    "ip": "203.0.113.50"
}
```

#### IP Format Options for Whitelist
- Single IP: `"ip": "1.2.1.2"`
- IP range: `"ip": "1.2.1.2-1.2.1.10"`
- IP subnet: `"ip": "10.20.30.40/24"`
- IP mask: `"ip": "10.20.30.40/255.255.255.0"`

### Domain Allowlist/Denylist

#### Add Domain to Allowlist/Denylist
```
POST https://api.brightdata.com/zone/domains
Authorization: Bearer YOUR_API_KEY
Content-Type: application/json

{
    "zone": "mudra_residential",
    "domain": "example.com",
    "type": "allowlist"
}
```

#### Remove Domain
```
DELETE https://api.brightdata.com/zone/domains
Authorization: Bearer YOUR_API_KEY
Content-Type: application/json

{
    "zone": "mudra_residential",
    "domain": "example.com"
}
```

---

## 12. Account Management API

**Source**: https://docs.brightdata.com/api-reference/terminology

### Key Terminology

| Term | Definition |
|---|---|
| **Zone** | A proxy configuration unit with its own settings, credentials, and IP pool type |
| **Super Proxy** | The gateway server (`brd.superproxy.io`) that routes your requests |
| **Peer/Exit Node** | The actual residential IP that makes the request to the target |
| **Customer ID** | Your account identifier (format: `hl_XXXXXXXX`) |
| **Session** | A mechanism to maintain the same exit IP across multiple requests |
| **Bandwidth** | Data transfer measured in GB - this is what you pay for |

### API Base URL

```
https://api.brightdata.com
```

### Authentication for ALL API Calls

```
Authorization: Bearer YOUR_API_KEY
```

---

## 13. Rules, Limits and Best Practices

**Source**: https://docs.brightdata.com/proxy-networks/residential/faqs

### Rules and Compliance

1. **Ethical use only** - Bright Data IPs come from real users who opted in
2. **No scraping of personal data** without proper legal basis
3. **Respect robots.txt** where applicable
4. **Rate limiting** - Do not hammer target sites; add delays between requests
5. **Bandwidth is billed** - Every byte through the proxy costs money

### Network Limits

| Limit | Value |
|---|---|
| Concurrent connections | Unlimited |
| Bandwidth | Pay-per-GB (no hard limit) |
| Session duration (sticky) | Approximately 10 min inactivity timeout |
| IP pool per country | Varies (US has the most) |
| Request timeout | Configurable |

### Best Practices for Mudra

1. **One request per page** - Each page crawl = one proxy request with a fresh IP
2. **Country per request** - Embed the country code in every request's username
3. **Rotate by default** - Do not use sticky sessions for crawling different pages
4. **Error handling** - Retry with a new IP if a request fails (change session ID)
5. **Test endpoint** - Use `http://lumtest.com/myip.json` to verify your IP is from the correct country
6. **Minimize bandwidth** - Only fetch what you need (HTML, not images/CSS/JS for analysis)
7. **Whitelist your server IPs** - Especially for Vercel deployments

---

## 14. Mudra MVP Use Case - Complete Business and Technical Specification

This section describes **exactly** how Bright Data residential proxies integrate into the Mudra product, covering every business rule, user flow, data model impact, and proxy usage pattern.

---

### 14.0 PRIMARY USE CASE: Geo-Localized DirectGEO AI Queries (Claude & Gemini)

> **THIS IS THE MOST IMPORTANT SECTION OF THIS ENTIRE DOCUMENT.**

The residential proxy exists **primarily** to make the DirectGEO AI API calls to **Claude (Anthropic)** and **Gemini (Google)** appear as if they originate from a specific country. This is critical because these two AI providers **do not offer a built-in geolocation filter** in their APIs.

#### The Problem

When Mudra sends a DirectGEO query like _"How does brand X appear in search results in Spain?"_ to an AI model, the model's response quality depends on whether it can actually simulate/access localized data. The approach differs by provider:

| AI Provider | Has Built-in Geo Filter? | Needs Proxy? | How Geo-Targeting Works |
|---|---|---|---|
| **Perplexity** | YES - API supports location parameter | NO | Pass location params directly in the API request |
| **OpenAI** | YES - API supports location/region filtering | NO | Pass location context directly in the API request |
| **Claude (Anthropic)** | YES - Web search tool has `user_location` param | NO | Pass `user_location: { country, city, region, timezone }` in the web search tool definition |
| **Gemini (Google)** | NO - No geo filter in API | **YES - NEEDS PROXY** | Route the API call through a residential proxy IP from the target country |

#### Claude's Built-in Location Filter (NO proxy needed)

**Source**: https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-search-tool

Claude's web search tool (`web_search_20250305`) supports a `user_location` parameter directly in the tool definition:

```json
{
  "type": "web_search_20250305",
  "name": "web_search",
  "max_uses": 5,
  "user_location": {
    "type": "approximate",
    "city": "Madrid",
    "region": "Madrid",
    "country": "ES",
    "timezone": "Europe/Madrid"
  }
}
```

This means Claude will localize its web search results to Spain without needing any proxy. **No Bright Data proxy is needed for Claude.**

Claude web search pricing: **$10 per 1,000 searches** + standard token costs.

#### Why Gemini NEEDS the Proxy

Gemini (Google's AI) does **not** offer a `user_location` or equivalent geo-targeting parameter in its API. When Gemini uses Google Search grounding, the search results are localized based on the **origin IP of the API request**. Therefore:

- A Gemini API call from a US server IP = US-localized grounding results
- A Gemini API call through a **Spanish residential proxy IP** = Spain-localized grounding results

This is the **only provider** that requires the Bright Data residential proxy.

#### Why This Matters for Gemini

When you call the Gemini API from a server in the US and ask _"What are the top results for [brand] in Mexico?"_, Gemini may return US-biased results because Google's search grounding uses the request's origin IP for localization. By routing the API call through a **Bright Data residential proxy in Mexico**, Google sees a request from a real Mexican residential IP, and the grounding search returns Mexican-localized results.

#### How It Works in Practice

```
GEMINI WITHOUT PROXY (wrong results):
  Mudra Server (US) ---> Gemini API ---> Google Search Grounding uses US IP
  Grounding results are US-localized, even if prompt asks about Spain

GEMINI WITH PROXY (correct results):
  Mudra Server ---> Bright Data Proxy (Spain IP) ---> Gemini API
  Google Search Grounding sees Spanish residential IP
  Grounding results are Spain-localized = accurate geo response

CLAUDE (no proxy needed):
  Mudra Server ---> Claude API { tools: [{ web_search, user_location: { country: "ES" } }] }
  Claude's web search is localized to Spain via built-in parameter

PERPLEXITY (no proxy needed):
  Mudra Server ---> Perplexity API { location: "Spain" } ---> geo-accurate results

OPENAI (no proxy needed):
  Mudra Server ---> OpenAI API { location: "Spain" }     ---> geo-accurate results
```

#### Per-Provider Proxy Decision Matrix

For EACH DirectGEO prompt execution during analysis:

```
For each country assigned to this domain:
    For each prompt to execute:
        |
        |-- If provider = Perplexity:
        |   |-- Call Perplexity API directly (NO proxy)
        |   |-- Pass country/location as API parameter
        |   |-- Cost: $0 proxy bandwidth
        |
        |-- If provider = OpenAI:
        |   |-- Call OpenAI API directly (NO proxy)
        |   |-- Pass country/location as API parameter
        |   |-- Cost: $0 proxy bandwidth
        |
        |-- If provider = Claude (Anthropic):
        |   |-- Call Claude API directly (NO proxy)
        |   |-- Pass user_location in web_search tool definition:
        |   |     { country: "ES", city: "Madrid", region: "Madrid", timezone: "Europe/Madrid" }
        |   |-- Claude's web search returns Spain-localized results natively
        |   |-- Cost: $0 proxy bandwidth (only Claude's web search fee: $10/1000 searches)
        |
        |-- If provider = Gemini (Google):  *** ONLY ONE THAT NEEDS PROXY ***
        |   |-- Route API call THROUGH residential proxy for target country
        |   |-- Proxy username: -country-{countryCode}
        |   |-- Gemini's Google Search grounding sees residential IP from target country
        |   |-- Cost: proxy bandwidth for API request + response
```

#### Code Pattern: Per-Provider Geo-Localized API Calls

```typescript
import { HttpsProxyAgent } from 'https-proxy-agent';
import { buildProxyUrl, generateSessionId, type MudraCountryCode } from './brightdata-proxy';

// ============================================================
// Country-to-location mapping for Claude's user_location param
// ============================================================
const CLAUDE_LOCATION_MAP: Record<MudraCountryCode, {
  city: string; region: string; country: string; timezone: string;
}> = {
  us: { city: 'New York', region: 'New York', country: 'US', timezone: 'America/New_York' },
  gb: { city: 'London', region: 'England', country: 'GB', timezone: 'Europe/London' },
  es: { city: 'Madrid', region: 'Madrid', country: 'ES', timezone: 'Europe/Madrid' },
  mx: { city: 'Mexico City', region: 'CDMX', country: 'MX', timezone: 'America/Mexico_City' },
  co: { city: 'Bogota', region: 'Bogota', country: 'CO', timezone: 'America/Bogota' },
  ar: { city: 'Buenos Aires', region: 'Buenos Aires', country: 'AR', timezone: 'America/Argentina/Buenos_Aires' },
  pe: { city: 'Lima', region: 'Lima', country: 'PE', timezone: 'America/Lima' },
};

// ============================================================
// CLAUDE - NO PROXY NEEDED (built-in user_location)
// Source: https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-search-tool
// ============================================================
async function callClaudeDirect(prompt: string, countryCode: MudraCountryCode) {
  const location = CLAUDE_LOCATION_MAP[countryCode];

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
      tools: [{
        type: 'web_search_20250305',
        name: 'web_search',
        max_uses: 5,
        // THIS IS THE KEY: Claude localizes search results natively
        user_location: {
          type: 'approximate',
          city: location.city,
          region: location.region,
          country: location.country,
          timezone: location.timezone,
        },
      }],
    }),
    // NO proxy agent needed
  });

  return response.json();
}

// ============================================================
// GEMINI - NEEDS PROXY (no built-in geo filter)
// Only provider that requires Bright Data residential proxy
// ============================================================
async function callGeminiWithGeoProxy(prompt: string, countryCode: MudraCountryCode) {
  const proxyUrl = buildProxyUrl({ country: countryCode }, generateSessionId());
  const agent = new HttpsProxyAgent(proxyUrl);

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GOOGLE_AI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
      // @ts-expect-error - agent is compatible with Node.js fetch
      agent, // <-- THIS IS THE KEY: routes through country-specific residential proxy
             //     so Gemini's Google Search grounding returns localized results
    }
  );

  return response.json();
}

// ============================================================
// PERPLEXITY - NO PROXY NEEDED (built-in location parameter)
// ============================================================
async function callPerplexityDirect(prompt: string, countryCode: MudraCountryCode) {
  const response = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'sonar',
      messages: [{ role: 'user', content: prompt }],
      // Perplexity supports location natively via API params
    }),
    // NO proxy needed
  });

  return response.json();
}

// ============================================================
// OPENAI - NO PROXY NEEDED (built-in location filtering)
// ============================================================
async function callOpenAIDirect(prompt: string, countryCode: MudraCountryCode) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      // OpenAI supports location/region context natively
    }),
    // NO proxy needed
  });

  return response.json();
}
```

#### Unified Dispatcher Pattern

```typescript
/**
 * Execute a DirectGEO prompt against the appropriate AI provider.
 * ONLY Gemini needs the residential proxy. All others have built-in geo filters.
 */
async function executeGeoPrompt(
  prompt: string,
  provider: 'claude' | 'gemini' | 'perplexity' | 'openai',
  countryCode: MudraCountryCode,
) {
  switch (provider) {
    case 'claude':
      // NO PROXY - uses web_search tool's user_location parameter
      return callClaudeDirect(prompt, countryCode);

    case 'gemini':
      // *** ONLY PROVIDER THAT NEEDS PROXY ***
      return callGeminiWithGeoProxy(prompt, countryCode);

    case 'perplexity':
      // NO PROXY - has built-in location filter
      return callPerplexityDirect(prompt, countryCode);

    case 'openai':
      // NO PROXY - has built-in location filter
      return callOpenAIDirect(prompt, countryCode);
  }
}
```

#### Bandwidth Impact for AI API Calls

Unlike HTML crawling (~100KB per page), AI API calls have different bandwidth characteristics:

| Direction | Typical Size | Description |
|---|---|---|
| Request (prompt) | ~2-10KB | The prompt text sent to Gemini |
| Response (completion) | ~5-30KB | Gemini's response text |
| **Total per call** | **~7-40KB** | Much smaller than HTML crawling |

Since **ONLY Gemini** calls go through the proxy (Claude, Perplexity, and OpenAI all have built-in geo filters), the actual proxy bandwidth is extremely minimal.

```
Example: 1 domain, 3 countries, 10 prompts each, ONLY Gemini needs proxy
= 3 countries x 10 prompts x 1 provider = 30 proxied API calls
= 30 x 40KB = ~1.2MB per run

Max scenario: 3 domains x 5 countries x 10 prompts x 1 provider (Gemini only) = 150 proxied calls
= 150 x 40KB = ~6MB per run
= Monthly (daily): 30 x 6MB = 180MB = ~0.18GB/month
= Extremely low for residential proxy pricing
```

---

### 14.1 Business Rules Summary

| Rule | Value |
|---|---|
| **Max domains (monitors) per account** | 3 |
| **Max countries per domain** | 5 |
| **Allowed countries** | USA, Spain, UK, Mexico, Colombia, Argentina, Peru (7 total) |
| **Languages** | English, Spanish (only 2) |
| **Technical crawl per domain** | Exactly 1 (does NOT vary by country) |
| **GEO crawl per domain** | 1 per country (varies by country, uses proxy) |
| **Onboarding per domain** | Full onboarding required for each domain (each is a separate monitor) |
| **Country selection location** | Inside each monitor's Dashboard |
| **Country flag display** | Top-left of dashboard, showing which countries that domain is tracked in |

---

### 14.2 What "Monitor" Means

A **Monitor** = 1 domain. Each domain added by the user is a separate monitor that:

- Goes through the **full onboarding flow** independently (because different domains may have different products, content, structure, etc.)
- Has its **own set of prompts** generated during its onboarding
- Has its **own country selections** (which countries to track)
- Has **one technical structure crawl** (schema, metadata, FAQ, content scoring)
- Has **one GEO analysis per country** it is assigned to

**Example:**
- Monitor 1: `vercel.com` -> Countries: USA, Spain, Mexico
- Monitor 2: `shopify.com` -> Countries: USA, UK, Colombia
- Monitor 3: `example.ar` -> Countries: Argentina, Peru

Each monitor is independent. `vercel.com`'s onboarding data, prompts, and results are completely separate from `shopify.com`.

---

### 14.3 Country Selection Flow

#### When Does Country Selection Happen?

Country selection happens in **two places**:

1. **During Onboarding** - When a user adds a new domain (monitor), they select which countries they want to track. The very first API request during onboarding already goes through the proxy for the selected location.

2. **Inside the Dashboard** - After onboarding, within each monitor's dashboard, the user can see/manage their country selections. A **flag icon** appears at the top-left of the dashboard showing which countries are active for that domain.

#### Country Selection per Domain (NOT Global)

Country selection is **per domain**, not per account. Each domain independently chooses up to 5 countries:

```
Account (max 3 domains)
|
|-- Domain: vercel.com
|   |-- Countries: [US, ES, MX]    <-- 3 countries, 3 flag icons in dashboard
|   |-- Language mapping: US->EN, ES->ES, MX->ES
|
|-- Domain: shopify.com
|   |-- Countries: [US, GB]         <-- 2 countries, 2 flag icons in dashboard
|   |-- Language mapping: US->EN, GB->EN
|
|-- Domain: tienda.co
|   |-- Countries: [CO, AR, PE, ES, MX]  <-- 5 countries (max), 5 flag icons
|   |-- Language mapping: CO->ES, AR->ES, PE->ES, ES->ES, MX->ES
```

---

### 14.4 When Proxy Requests Happen

**Remember:** The proxy is used **ONLY for routing Gemini API calls** through country-specific IPs. Claude, Perplexity, and OpenAI all have built-in geo filters and go direct.

#### A. During Onboarding (New Domain Added)

When a user adds a new domain and selects locations during onboarding:

```
User adds "vercel.com" and selects countries: USA, Spain, Mexico
    |
    v
Onboarding triggers FIRST analysis from each selected country:
    |
    |-- For each country (US, ES, MX):
    |   |-- DirectGEO prompts executed per AI provider:
    |   |   |-- Gemini:     API call THROUGH PROXY (-country-XX) -> geo-localized response
    |   |   |-- Claude:     API call DIRECT (user_location param) -> geo-localized response
    |   |   |-- Perplexity: API call DIRECT (location param)      -> geo-localized response
    |   |   |-- OpenAI:     API call DIRECT (location param)      -> geo-localized response
    |   |-- Store GeoAnalysisResult { country: XX, ... }
    |
    |-- Technical crawl (1 only, no proxy)
    |   |-- Schema markup analysis
    |   |-- Metadata analysis
    |   |-- FAQ detection
    |   |-- Content scoring
```

**Key point:** The proxy request happens **immediately at onboarding** for each location the user selects. This means the user gets their first geo-analysis results right away.

#### B. During Dashboard "Run Analysis" (Subsequent Runs)

When the user clicks "Run Analysis" on a monitor's dashboard:

```
User clicks "Run Analysis" on vercel.com dashboard
    |
    v
/api/analysis/unified
    |
    v
For each country assigned to this domain:
    |-- Gemini prompts  -> THROUGH PROXY (-country-XX) for each country
    |-- Claude prompts  -> DIRECT (user_location: { country: XX })
    |-- Perplexity      -> DIRECT (built-in geo filter)
    |-- OpenAI          -> DIRECT (built-in geo filter)
    |
    |-- 1x Technical crawl (re-crawl structure, no proxy)
```

#### C. When User Adds a New Location to an Existing Domain

If a user later adds Colombia to `vercel.com` from within the dashboard:

```
User adds Colombia to vercel.com's tracked countries
    |
    v
Immediate analysis for Colombia:
    |-- Gemini prompts  -> THROUGH PROXY (-country-co)
    |-- Claude prompts  -> DIRECT { user_location: { country: 'CO', city: 'Bogota', ... } }
    |-- Perplexity      -> DIRECT { location: 'Colombia' }
    |-- OpenAI          -> DIRECT { location: 'Colombia' }
    |-- Store GeoAnalysisResult { country: 'co', ... }
    |-- Dashboard now shows [US] [ES] [MX] [CO] flags
    |
    (No need to re-run other countries or technical crawl)
```

---

### 14.5 Proxy Usage Per Analysis Run (Bandwidth Calculation)

**ONLY Gemini calls go through the proxy.** Claude, Perplexity, and OpenAI all have built-in geo filters and go direct.

For **each analysis run** on a single domain, the number of proxied API calls is:

```
Proxied calls = (Countries) x (Gemini prompts per country)
```

**Example scenarios (assuming 10 prompts per country, only Gemini proxied):**

| Scenario | Domains | Countries | Gemini Prompts | Proxied Calls per Run |
|---|---|---|---|---|
| Minimal | 1 domain | 1 country | 10 | 1 x 10 = 10 |
| Typical | 1 domain | 3 countries | 10 | 3 x 10 = 30 |
| Heavy | 3 domains | 5 countries each | 10 | 15 x 10 = 150 |
| Max possible | 3 domains | 5 countries each | 10 | 150 |

**Bandwidth estimate per proxied Gemini call:** ~7-40KB (prompt request + AI response)
**Max bandwidth per full run (all domains, worst case):** 150 x 40KB = ~6MB
**Monthly (daily runs):** 30 x 6MB = 180MB = ~0.18GB/month

This is **extremely** cost-efficient for residential proxy pricing.

---

### 14.6 Language and Prompt Logic

Only **2 languages** exist in the system: English and Spanish.

| Country | Proxy Code | Prompt Language | Rationale |
|---|---|---|---|
| **USA** | `-country-us` | **English** | English-speaking country |
| **UK** | `-country-gb` | **English** | English-speaking country |
| **Spain** | `-country-es` | **Spanish** | Spanish-speaking country |
| **Mexico** | `-country-mx` | **Spanish** | Spanish-speaking country |
| **Colombia** | `-country-co` | **Spanish** | Spanish-speaking country |
| **Argentina** | `-country-ar` | **Spanish** | Spanish-speaking country |
| **Peru** | `-country-pe` | **Spanish** | Spanish-speaking country |

#### How Prompts Work Per Country

The onboarding generates prompts for the domain. Those prompts exist in **both languages**. When running analysis for a specific country:

1. Determine the language: `COUNTRY_LANGUAGE_MAP[countryCode]`
2. Select the prompts in that language
3. Crawl the website through the proxy from that country
4. Run AI analysis with those language-specific prompts against the country-specific HTML

**The same prompt logic/structure applies across all domains** - only the language varies (EN vs ES). The onboarding information definition stays the same, just translated per language.

---

### 14.7 Technical Crawl vs DirectGEO AI Analysis

These are **two different types** of analysis that happen per domain:

#### Technical Crawl (1 per domain, NO proxy needed)

| Aspect | Detail |
|---|---|
| **What it analyzes** | Schema markup, metadata, FAQ presence, content structure |
| **How many per domain** | Exactly 1 |
| **Uses proxy?** | No (or optionally from primary country) |
| **Varies by country?** | No - HTML structure/schema is the same regardless of viewer location |
| **Scoring dimensions** | Schema (40pts), Metadata (30pts), FAQ (20pts), Content (10pts) |
| **When it runs** | Once during onboarding, once per "Run Analysis" click |

#### DirectGEO AI Analysis (1 per country per domain, proxy for Claude & Gemini ONLY)

| Aspect | Detail |
|---|---|
| **What it analyzes** | How the brand/domain appears in AI-powered search from a specific country |
| **How many per domain** | 1 set per assigned country (max 5 countries) |
| **Uses proxy?** | **ONLY for Claude & Gemini** (they lack geo filters). Perplexity & OpenAI go direct. |
| **Varies by country?** | Yes - AI responses reflect the geographic perspective of the requesting IP |
| **Prompt language** | Matches country (EN for US/GB, ES for the rest) |
| **When it runs** | Once per country during onboarding, once per country per "Run Analysis" click |
| **Why proxy matters** | Claude & Gemini API calls from a Spanish IP return Spain-localized AI responses |

---

### 14.8 Dashboard UI - Country Flag Display

In each monitor's dashboard, the **top-left** shows the countries being tracked:

```
+--------------------------------------------------------------+
| [US] [ES] [MX]   vercel.com Dashboard          [Run Analysis]|
+--------------------------------------------------------------+
| Overview Metrics    |    Issues    |    Prompts    |          |
|                     |              |               |          |
| Score: 72/100       |              |               |          |
| ...                 |              |               |          |
```

- Each flag is a clickable icon representing a tracked country
- Clicking a flag switches the dashboard view to show results **from that country's perspective**
- The scores, issues, and prompt results change based on which country is selected
- The technical score stays the same regardless of country (it is structural)

---

### 14.9 Complete Flow Diagram

```
=================================================================
USER ONBOARDING (per domain - each domain gets full onboarding)
=================================================================

Step 1: User enters domain (e.g., vercel.com)
Step 2: User selects countries (e.g., USA, Spain, Mexico)  [max 5]
Step 3: User completes onboarding questionnaire
Step 4: System generates prompts (in EN + ES)
Step 5: System triggers FIRST analysis:
        |
        |-- Technical Crawl (1x, no proxy)
        |   |-- Crawl vercel.com directly
        |   |-- Score: Schema + Metadata + FAQ + Content
        |   |-- Store as TechnicalAnalysisResult
        |
        |-- DirectGEO Analysis (1x per country)
        |   |
        |   |-- [US] For each prompt:
        |   |   |-- Gemini:     THROUGH PROXY -country-us (grounding localized)
        |   |   |-- Claude:     DIRECT { user_location: { country: "US" } }
        |   |   |-- Perplexity: DIRECT { location: "US" }
        |   |   |-- OpenAI:     DIRECT { location: "US" }
        |   |   |-- Store as GeoAnalysisResult { country: 'us', ... }
        |   |
        |   |-- [ES] For each prompt:
        |   |   |-- Gemini:     THROUGH PROXY -country-es
        |   |   |-- Claude:     DIRECT { user_location: { country: "ES" } }
        |   |   |-- Perplexity: DIRECT   |  OpenAI: DIRECT
        |   |   |-- Store as GeoAnalysisResult { country: 'es', ... }
        |   |
        |   |-- [MX] For each prompt:
        |   |       |-- Gemini:     THROUGH PROXY -country-mx
        |   |       |-- Claude:     DIRECT { user_location: { country: "MX" } }
        |   |       |-- Perplexity: DIRECT   |  OpenAI: DIRECT
        |   |       |-- Store as GeoAnalysisResult { country: 'mx', ... }
        |
Step 6: Dashboard loads with [US] [ES] [MX] flags at top-left
        Default view shows first country's results


=================================================================
DASHBOARD "RUN ANALYSIS" (subsequent runs)
=================================================================

User clicks [Run Analysis] on vercel.com dashboard
    |
    v
Same flow as Step 5 above:
    |-- 1x Technical Crawl (re-score structure)
    |-- DirectGEO per country (Gemini through proxy, rest direct)
    |-- Store new results (new run, preserves history for deltas)


=================================================================
USER ADDS NEW LOCATION (from dashboard)
=================================================================

User adds "Colombia" to vercel.com from dashboard settings
    |
    v
Immediate DirectGEO for Colombia:
    |-- Gemini:     THROUGH PROXY -country-co
    |-- Claude:     DIRECT { user_location: { country: "CO", city: "Bogota" } }
    |-- Perplexity: DIRECT   |  OpenAI: DIRECT
    |-- Store as GeoAnalysisResult { country: 'co', ... }
    |-- Dashboard now shows [US] [ES] [MX] [CO] flags


=================================================================
SECOND DOMAIN ONBOARDING
=================================================================

User adds second domain: shopify.com
    |
    v
Full onboarding again (different domain = different monitor):
    |-- New onboarding questionnaire (shopify has different products/content)
    |-- New prompts generated (in EN + ES)
    |-- User selects countries: USA, UK
    |-- Technical Crawl (1x) for shopify.com
    |-- DirectGEO: [US] Gemini proxy + [GB] Gemini proxy (rest direct)
    |-- Separate dashboard with [US] [GB] flags
```

---

### 14.10 Proxy Request Mapping (What Exactly Gets Proxied)

| Action | Uses Proxy? | Country Param | Why |
|---|---|---|---|
| Technical crawl (schema, meta, FAQ, content) | No | None | Structure is location-independent |
| **Gemini API call** for DirectGEO (any country) | **YES** | `-country-XX` | Gemini has NO built-in geo filter; grounding uses origin IP |
| **Claude API call** for DirectGEO | No | N/A | Has `user_location` param in web search tool |
| **Perplexity API call** for DirectGEO | No | N/A | Has built-in location parameter in API |
| **OpenAI API call** for DirectGEO | No | N/A | Has built-in location/region filter in API |
| Adding a new location (Gemini prompts) | YES | `-country-XX` | First geo-localized Gemini queries for new country |
| Adding a new location (other providers) | No | N/A | Built-in geo filters handle it |
| Storing results to DB | No | N/A | Internal operation |
| Dashboard rendering | No | N/A | Client-side |

**Key takeaway:** The proxy is needed for **Gemini ONLY**. It is an AI API routing layer that ensures Gemini's Google Search grounding "sees" the world from the target country's perspective. All other providers (Claude, Perplexity, OpenAI) have native geo-targeting parameters.

---

### 14.11 Concrete Example Walkthrough

**Scenario:** User signs up and adds `vercel.com` with countries USA, Spain, Mexico. Domain has 10 DirectGEO prompts.

#### For Country: USA (English prompts)

**Gemini API calls (PROXIED - only provider that needs it):**
```
Proxy Username: brd-customer-hl_ABC123-zone-mudra_residential-country-us
Proxy URL: http://brd-customer-hl_ABC123-zone-mudra_residential-country-us:zone_pass_xyz@brd.superproxy.io:33335
Target API: https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent
Method: POST through proxy

Each of the 10 Gemini prompts is sent through a US residential IP.
Gemini's Google Search grounding returns US-localized results.
```

**Claude API calls (DIRECT - no proxy, uses user_location):**
```
Target API: https://api.anthropic.com/v1/messages
Method: POST direct (no proxy)
Geo-targeting: tools[0].user_location = { country: "US", city: "New York", timezone: "America/New_York" }

Claude's web search tool localizes results to USA natively. No proxy needed.
```

**Perplexity API calls (DIRECT - no proxy):**
```
Target API: https://api.perplexity.ai/chat/completions
Location: Passed as API parameter. No proxy needed.
```

**OpenAI API calls (DIRECT - no proxy):**
```
Target API: https://api.openai.com/v1/chat/completions
Location: Passed as API parameter. No proxy needed.
```

**Result stored:** `GeoAnalysisResult { domainId: 'vercel.com', country: 'us', overallScore: 78, ... }`

#### For Country: Spain (Spanish prompts)

**Gemini: PROXIED through Spanish IP:**
```
Proxy Username: brd-customer-hl_ABC123-zone-mudra_residential-country-es
Gemini API calls routed through residential IP in Spain.
Google Search grounding returns Spain-localized results.
```

**Claude: DIRECT** with `user_location: { country: "ES", city: "Madrid", timezone: "Europe/Madrid" }`
**Perplexity + OpenAI: DIRECT** with location param "Spain"

**Result stored:** `GeoAnalysisResult { domainId: 'vercel.com', country: 'es', overallScore: 65, ... }`

#### For Country: Mexico (Spanish prompts)

**Gemini: PROXIED through Mexican IP:**
```
Proxy Username: brd-customer-hl_ABC123-zone-mudra_residential-country-mx
Gemini grounding returns Mexican-localized results (LATAM search results, local brands).
```

**Claude: DIRECT** with `user_location: { country: "MX", city: "Mexico City", timezone: "America/Mexico_City" }`
**Perplexity + OpenAI: DIRECT** with location param "Mexico"

**Result stored:** `GeoAnalysisResult { domainId: 'vercel.com', country: 'mx', overallScore: 61, ... }`

#### Technical Crawl (No Proxy, done once)
```
Direct fetch: https://vercel.com
Analyze: Schema types, metadata tags, FAQ sections, content depth
Stored: TechnicalAnalysisResult { domainId: 'vercel.com', schemaScore: 35/40, metadataScore: 28/30, ... }
```

#### Total Proxy Usage for This Example
```
Countries: 3 (US, ES, MX)
Prompts per country: 10
Providers needing proxy: 1 (Gemini ONLY)
Total proxied API calls: 3 x 10 x 1 = 30 calls
Estimated bandwidth: 30 x ~20KB = ~0.6MB
```

---

### 14.12 Maximum Usage Ceiling

The absolute maximum proxy usage per analysis run across the entire account.
**Only Gemini API calls go through the proxy.**

```
Max domains: 3
Max countries per domain: 5
Gemini prompts per country: ~10
Max proxied Gemini calls per run: 3 x 5 x 10 = 150
Average bandwidth per Gemini call: ~20-40KB (prompt + response)
Max bandwidth per full run: 150 x 40KB = ~6MB

If user runs analysis daily for a month:
30 days x 6MB = 180MB/month = ~0.18GB/month

This is extremely low bandwidth for residential proxy pricing.
```

---

### 14.13 Data Model Changes Needed

To support multi-country per domain, the data model needs:

```
Domain / Monitor
  |-- id
  |-- url (e.g., "vercel.com")
  |-- userId
  |-- countries: string[]           <-- NEW: ['us', 'es', 'mx'] (max 5)
  |-- primaryCountry: string        <-- NEW: first/default country for dashboard view
  |-- onboardingData: {...}         <-- same as current
  |-- prompts: Prompt[]             <-- same as current, but tagged with language

Prompt
  |-- id
  |-- domainId
  |-- language: 'en' | 'es'         <-- NEW: which language this prompt is in
  |-- content: string
  |-- ...existing fields

GeoAnalysisResult
  |-- id
  |-- domainId
  |-- country: string                <-- NEW: 'us', 'es', 'mx', etc.
  |-- runId
  |-- overallScore
  |-- html (cached crawl)            <-- the HTML from this country's proxy crawl
  |-- promptResults: [...]
  |-- createdAt

TechnicalAnalysisResult
  |-- id
  |-- domainId
  |-- runId
  |-- schemaScore, metadataScore, faqScore, contentScore
  |-- createdAt
  (No country field - technical results are country-independent)
```

---

### 14.14 Summary: What the Proxy Does for Mudra

```
+-----------------------------------------------------------------------+
| BRIGHT DATA RESIDENTIAL PROXY ROLE IN MUDRA                           |
+-----------------------------------------------------------------------+
|                                                                       |
| PRIMARY PURPOSE:                                                      |
|   Route Gemini API calls through country-specific residential IPs     |
|   so Google's Search grounding returns geo-localized results.         |
|                                                                       |
| WHY ONLY GEMINI:                                                      |
|   - Claude:     has user_location param in web_search tool (NO proxy) |
|   - Perplexity: has built-in location filter in API       (NO proxy)  |
|   - OpenAI:     has built-in location/region filter       (NO proxy)  |
|   - Gemini:     NO geo filter in API                      (NEEDS PROXY)|
|                                                                       |
| WHEN IT IS USED:                                                      |
|   1. Onboarding: Gemini DirectGEO queries per selected country        |
|   2. Run Analysis: Gemini DirectGEO queries per country               |
|   3. Add Location: Gemini queries for the new country                 |
|                                                                       |
| WHEN IT IS NOT USED:                                                  |
|   - Claude API calls (use user_location param instead)                |
|   - Perplexity API calls (use built-in location param)                |
|   - OpenAI API calls (use built-in location param)                    |
|   - Technical crawl (schema, metadata, FAQ, content)                  |
|   - Database operations, Dashboard rendering                          |
|                                                                       |
| BILLING:                                                              |
|   - Max 3 domains x 5 countries x 10 Gemini prompts = 150 calls/run  |
|   - ~40KB per call = ~6MB per full run                                |
|   - ~0.18GB/month if daily = extremely low cost                       |
|                                                                       |
| COUNTRIES (7 allowed, max 5 per domain):                              |
|   US (en), GB (en), ES (es), MX (es), CO (es), AR (es), PE (es)     |
|                                                                       |
+-----------------------------------------------------------------------+
```

---

## 15. Environment Variables and Config

```env
# .env.local

# Bright Data Residential Proxy Credentials
BRIGHTDATA_CUSTOMER_ID=hl_XXXXXXXX
BRIGHTDATA_ZONE_NAME=mudra_residential
BRIGHTDATA_ZONE_PASSWORD=your_zone_password_here

# Bright Data API Key (for account management API)
BRIGHTDATA_API_KEY=your_api_key_here

# Proxy endpoint (rarely changes)
BRIGHTDATA_PROXY_HOST=brd.superproxy.io
BRIGHTDATA_PROXY_PORT=33335
```

---

## 16. Complete Mudra Implementation Code

### 16.1 Proxy Configuration Module

```typescript
// lib/services/brightdata-proxy.ts

export interface ProxyConfig {
  host: string;
  port: number;
  username: string;
  password: string;
}

export interface GeoTargeting {
  country: string;       // ISO 2-letter code: 'us', 'es', 'mx', 'gb', 'co', 'ar', 'pe'
  state?: string;        // Optional: 2-letter state code
  city?: string;         // Optional: lowercase, no spaces
  zip?: string;          // Optional: 5-digit ZIP
  asn?: string;          // Optional: ASN number
}

// Allowed countries for Mudra
export const MUDRA_ALLOWED_COUNTRIES = ['us', 'es', 'gb', 'mx', 'co', 'ar', 'pe'] as const;
export type MudraCountryCode = typeof MUDRA_ALLOWED_COUNTRIES[number];

// Country to language mapping
export const COUNTRY_LANGUAGE_MAP: Record<MudraCountryCode, 'en' | 'es'> = {
  us: 'en',
  gb: 'en',
  es: 'es',
  mx: 'es',
  co: 'es',
  ar: 'es',
  pe: 'es',
};

// Country display names and flag codes
export const COUNTRY_INFO: Record<MudraCountryCode, { name: string; flagCode: string }> = {
  us: { name: 'United States', flagCode: 'US' },
  gb: { name: 'United Kingdom', flagCode: 'GB' },
  es: { name: 'Spain', flagCode: 'ES' },
  mx: { name: 'Mexico', flagCode: 'MX' },
  co: { name: 'Colombia', flagCode: 'CO' },
  ar: { name: 'Argentina', flagCode: 'AR' },
  pe: { name: 'Peru', flagCode: 'PE' },
};

/**
 * Build a Bright Data proxy username with geo-targeting parameters.
 *
 * Format: brd-customer-<id>-zone-<zone>[-country-<cc>][-state-<st>][-city-<city>][-session-<sid>]
 */
export function buildProxyUsername(geo: GeoTargeting, sessionId?: string): string {
  const customerId = process.env.BRIGHTDATA_CUSTOMER_ID;
  const zoneName = process.env.BRIGHTDATA_ZONE_NAME;

  if (!customerId || !zoneName) {
    throw new Error('Missing BRIGHTDATA_CUSTOMER_ID or BRIGHTDATA_ZONE_NAME env vars');
  }

  let username = `brd-customer-${customerId}-zone-${zoneName}`;

  // Append geo-targeting
  if (geo.country) username += `-country-${geo.country.toLowerCase()}`;
  if (geo.state) username += `-state-${geo.state.toLowerCase()}`;
  if (geo.city) username += `-city-${geo.city.toLowerCase().replace(/\s/g, '')}`;
  if (geo.zip) username += `-zip-${geo.zip}`;
  if (geo.asn) username += `-asn-${geo.asn}`;

  // Append session for sticky IP or force rotation
  if (sessionId) {
    username += `-session-${sessionId}`;
  }

  return username;
}

/**
 * Build the full proxy URL for use with fetch/axios/etc.
 */
export function buildProxyUrl(geo: GeoTargeting, sessionId?: string): string {
  const username = buildProxyUsername(geo, sessionId);
  const password = process.env.BRIGHTDATA_ZONE_PASSWORD;
  const host = process.env.BRIGHTDATA_PROXY_HOST || 'brd.superproxy.io';
  const port = process.env.BRIGHTDATA_PROXY_PORT || '33335';

  if (!password) {
    throw new Error('Missing BRIGHTDATA_ZONE_PASSWORD env var');
  }

  return `http://${username}:${password}@${host}:${port}`;
}

/**
 * Build a ProxyConfig object (useful for libraries that need host/port/user/pass separately).
 */
export function buildProxyConfig(geo: GeoTargeting, sessionId?: string): ProxyConfig {
  return {
    host: process.env.BRIGHTDATA_PROXY_HOST || 'brd.superproxy.io',
    port: parseInt(process.env.BRIGHTDATA_PROXY_PORT || '33335', 10),
    username: buildProxyUsername(geo, sessionId),
    password: process.env.BRIGHTDATA_ZONE_PASSWORD || '',
  };
}

/**
 * Generate a unique session ID to force IP rotation.
 */
export function generateSessionId(): string {
  return `mudra-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Validate that a country code is in Mudra's allowed list.
 */
export function isAllowedCountry(code: string): code is MudraCountryCode {
  return MUDRA_ALLOWED_COUNTRIES.includes(code.toLowerCase() as MudraCountryCode);
}

/**
 * Get the prompt language for a given country.
 */
export function getLanguageForCountry(country: MudraCountryCode): 'en' | 'es' {
  return COUNTRY_LANGUAGE_MAP[country];
}
```

### 16.2 Proxied Fetch Utility

```typescript
// lib/services/proxied-fetch.ts

import { HttpsProxyAgent } from 'https-proxy-agent';
import { buildProxyUrl, generateSessionId, type GeoTargeting } from './brightdata-proxy';

interface ProxiedFetchOptions {
  geo: GeoTargeting;
  url: string;
  /** Use sticky session (same IP for multiple requests). Default: false (rotating). */
  sticky?: boolean;
  /** Custom session ID for sticky sessions. Auto-generated if sticky=true and not provided. */
  sessionId?: string;
  /** Request timeout in ms. Default: 30000. */
  timeout?: number;
  /** Number of retry attempts. Default: 3. */
  retries?: number;
  /** Additional fetch options (headers, method, body, etc.) */
  fetchOptions?: RequestInit;
}

interface ProxiedFetchResult {
  html: string;
  statusCode: number;
  headers: Record<string, string>;
  proxyCountry: string;
  /** The IP address used (if available from response headers) */
  exitIp?: string;
}

/**
 * Fetch a URL through Bright Data residential proxy with geo-targeting.
 *
 * Usage:
 *   const result = await proxiedFetch({
 *     geo: { country: 'es' },
 *     url: 'https://example.com',
 *   });
 */
export async function proxiedFetch(options: ProxiedFetchOptions): Promise<ProxiedFetchResult> {
  const {
    geo,
    url,
    sticky = false,
    timeout = 30000,
    retries = 3,
    fetchOptions = {},
  } = options;

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      // Generate a new session ID per attempt to get a fresh IP on retry
      const sessionId = sticky
        ? (options.sessionId || generateSessionId())
        : generateSessionId();

      const proxyUrl = buildProxyUrl(geo, sessionId);
      const agent = new HttpsProxyAgent(proxyUrl);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        ...fetchOptions,
        // @ts-expect-error - agent is compatible with Node.js fetch
        agent,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const html = await response.text();

      // Extract response headers as plain object
      const headers: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        headers[key] = value;
      });

      return {
        html,
        statusCode: response.status,
        headers,
        proxyCountry: geo.country,
        exitIp: headers['x-luminati-ip'] || headers['x-brightdata-ip'] || undefined,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.warn(
        `[proxiedFetch] Attempt ${attempt}/${retries} failed for ${url} (country: ${geo.country}):`,
        lastError.message
      );

      if (attempt < retries) {
        // Wait before retrying (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
  }

  throw new Error(
    `[proxiedFetch] All ${retries} attempts failed for ${url} (country: ${geo.country}): ${lastError?.message}`
  );
}

/**
 * Verify proxy is working and returning the correct country.
 * Uses Bright Data's test endpoint.
 */
export async function verifyProxy(country: string): Promise<{
  ip: string;
  country: string;
  city?: string;
  asn?: { number: number; name: string };
}> {
  const proxyUrl = buildProxyUrl({ country }, generateSessionId());
  const agent = new HttpsProxyAgent(proxyUrl);

  const response = await fetch('http://lumtest.com/myip.json', {
    // @ts-expect-error
    agent,
  });

  return response.json();
}
```

### 16.3 Multi-Country Crawler

```typescript
// lib/services/multi-country-crawler.ts

import {
  type MudraCountryCode,
  getLanguageForCountry,
  isAllowedCountry,
  COUNTRY_INFO,
} from './brightdata-proxy';
import { proxiedFetch } from './proxied-fetch';

interface CountryCrawlResult {
  country: MudraCountryCode;
  language: 'en' | 'es';
  html: string;
  statusCode: number;
  exitIp?: string;
  crawledAt: Date;
  error?: string;
}

interface MultiCountryCrawlOptions {
  url: string;
  countries: MudraCountryCode[];
  /** Whether to crawl countries in parallel. Default: true. */
  parallel?: boolean;
  /** Timeout per request in ms. Default: 30000. */
  timeout?: number;
}

/**
 * Crawl a URL from multiple countries using residential proxies.
 * Returns one result per country with the HTML as seen from that location.
 *
 * Usage:
 *   const results = await crawlFromCountries({
 *     url: 'https://vercel.com',
 *     countries: ['us', 'es', 'mx'],
 *   });
 */
export async function crawlFromCountries(
  options: MultiCountryCrawlOptions
): Promise<CountryCrawlResult[]> {
  const { url, countries, parallel = true, timeout = 30000 } = options;

  // Validate countries
  for (const country of countries) {
    if (!isAllowedCountry(country)) {
      throw new Error(
        `Country "${country}" is not in the allowed list. Allowed: us, es, gb, mx, co, ar, pe`
      );
    }
  }

  const crawlOne = async (country: MudraCountryCode): Promise<CountryCrawlResult> => {
    const language = getLanguageForCountry(country);

    try {
      console.log(`[crawl] Fetching ${url} from ${COUNTRY_INFO[country].name} (${country})...`);

      const result = await proxiedFetch({
        geo: { country },
        url,
        timeout,
      });

      console.log(
        `[crawl] Got ${result.statusCode} from ${country} (IP: ${result.exitIp || 'unknown'})`
      );

      return {
        country,
        language,
        html: result.html,
        statusCode: result.statusCode,
        exitIp: result.exitIp,
        crawledAt: new Date(),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[crawl] Failed for ${country}: ${message}`);

      return {
        country,
        language,
        html: '',
        statusCode: 0,
        crawledAt: new Date(),
        error: message,
      };
    }
  };

  if (parallel) {
    return Promise.all(countries.map(crawlOne));
  }

  // Sequential crawling
  const results: CountryCrawlResult[] = [];
  for (const country of countries) {
    results.push(await crawlOne(country));
  }
  return results;
}
```

### 16.4 Integration with Unified Analysis Service

```typescript
// Example integration point in unified-analysis.service.ts

import { crawlFromCountries } from './multi-country-crawler';
import { type MudraCountryCode, getLanguageForCountry } from './brightdata-proxy';

/**
 * Perform geo-targeted analysis for a domain across multiple countries.
 *
 * For each country:
 * 1. Crawl the website through a residential proxy from that country
 * 2. Run AI analysis using prompts in the appropriate language
 * 3. Store results per country
 */
async function runGeoAnalysisForCountries(
  domain: string,
  countries: MudraCountryCode[],
  prompts: any[] // your existing prompt type
) {
  // Step 1: Crawl from all countries in parallel
  const crawlResults = await crawlFromCountries({
    url: `https://${domain}`,
    countries,
    parallel: true,
    timeout: 30000,
  });

  // Step 2: For each successful crawl, run AI analysis
  for (const crawl of crawlResults) {
    if (crawl.error) {
      console.error(`Skipping ${crawl.country} for ${domain}: ${crawl.error}`);
      continue;
    }

    const language = crawl.language; // 'en' or 'es'

    // Filter prompts by language
    const countryPrompts = prompts.filter(p => p.language === language);

    // Run your existing AI analysis with the country-specific HTML
    // ... your existing DirectGEO analysis logic here,
    //     but using crawl.html instead of direct-fetched HTML
    //     and storing the country code with the result
  }
}
```

---

## 17. Error Handling and Retry Strategy

### Common Errors and Solutions

| Error | Cause | Solution |
|---|---|---|
| `407 Proxy Authentication Required` | Wrong credentials | Check CUSTOMER_ID, ZONE_NAME, ZONE_PASSWORD |
| `502 Bad Gateway` | Proxy peer unavailable | Retry with new session ID (new IP) |
| `503 Service Unavailable` | Target site blocking | Retry with new IP, add delay |
| `ECONNREFUSED` | Proxy host unreachable | Check network, verify `brd.superproxy.io:33335` is accessible |
| `ETIMEDOUT` | Request timeout | Increase timeout, retry with new IP |
| `403 Forbidden` | Target site geo-blocking | Verify country targeting is correct |

### Retry Strategy for Mudra

```typescript
// Recommended retry configuration:
const RETRY_CONFIG = {
  maxRetries: 3,             // Try up to 3 times per country
  retryDelay: 1000,          // 1 second between retries (with exponential backoff)
  timeout: 30000,            // 30 second timeout per request
  forceNewIpOnRetry: true,   // Always get a new IP on retry (new session ID)
};
```

---

## 18. Cost Optimization

### Pricing Model

Bright Data residential proxies are billed **per GB of bandwidth**.

### Tips to Minimize Costs for Mudra

1. **Fetch only HTML** - Do not load images, CSS, JS through the proxy. Set appropriate headers:
   ```typescript
   const fetchOptions = {
     headers: {
       'Accept': 'text/html',
     },
   };
   ```

2. **One crawl per page per country** - Do not re-crawl unnecessarily

3. **Cache results** - Store crawled HTML; do not re-crawl until next analysis run

4. **Limit countries per domain** - Max 5 countries per the business rules

5. **Technical crawl without proxy** - The technical structure analysis (schema, metadata) only needs one crawl, not one per country

6. **Compress responses** - Accept gzip:
   ```typescript
   headers: { 'Accept-Encoding': 'gzip, deflate' }
   ```

---

## 19. FAQ

### Q: Can I use the same zone for all countries?
**A:** Yes. One zone can be used for all countries. You specify the country per-request via the username parameter.

### Q: How accurate is the geo-targeting?
**A:** Country-level targeting is extremely accurate (real residential IPs from that country). City-level is less precise but still good for residential proxies.

### Q: What happens if no IP is available for a country?
**A:** Bright Data covers 195+ countries. For the 7 Mudra countries (US, ES, GB, MX, CO, AR, PE), there will always be IPs available. The US has the largest pool.

### Q: Do I need to whitelist my server IPs?
**A:** Recommended but not strictly required if using username/password auth. For production (Vercel), you should whitelist your deployment IPs.

### Q: Can I verify which country the IP is from?
**A:** Yes. Use the test endpoint: `http://lumtest.com/myip.json` - it returns the IP's country, city, and ASN.

### Q: How do I set up a zone?
**A:** In the Bright Data dashboard -> Proxy Zones -> Create Zone -> Select "Residential" -> Configure settings. The zone name and password are what you use in the proxy username.

### Q: What is the difference between rotating and sticky sessions?
**A:** Rotating (default) = new IP every request. Sticky = same IP for multiple requests using the same session ID. For Mudra crawling, **rotating is recommended**.

### Q: Can I target the EU as a region?
**A:** Yes, using `-country-eu` gives a random IP from an EU country. But for Mudra, we target specific countries.

---

## 20. Official Documentation Links

### Core Documentation
- **Residential Proxies Overview**: https://brightdata.com/proxy-types/residential-proxies
- **Introduction**: https://docs.brightdata.com/proxy-networks/residential/introduction
- **Quickstart Guide**: https://docs.brightdata.com/proxy-networks/residential/quickstart
- **Configure Your Proxy**: https://docs.brightdata.com/proxy-networks/residential/configure-your-proxy
- **Network Access**: https://docs.brightdata.com/proxy-networks/residential/network-access
- **Send Your First Request**: https://docs.brightdata.com/proxy-networks/residential/send-your-first-request
- **FAQ**: https://docs.brightdata.com/proxy-networks/residential/faqs

### API Reference
- **Authentication**: https://docs.brightdata.com/api-reference/authentication
- **Terminology**: https://docs.brightdata.com/api-reference/terminology
- **JavaScript SDK**: https://docs.brightdata.com/api-reference/SDK-JS
- **Geolocation Targeting**: https://docs.brightdata.com/api-reference/proxy/geolocation-targeting
- **IP Rotation**: https://docs.brightdata.com/api-reference/proxy/rotate_ips

### Configuration Options
- **All Config Options**: https://docs.brightdata.com/proxy-networks/config-options
- **SOCKS5 Protocol**: https://docs.brightdata.com/proxy-networks/socks5

### Account Management
- **Zone Whitelist API**: https://docs.brightdata.com/api-reference/account-management-api/zone-ip-allowlist
- **Add IP to Whitelist**: https://docs.brightdata.com/api-reference/account-management-api/allowlist-ip
- **Domain Allowlist/Denylist**: https://docs.brightdata.com/api-reference/account-management-api/allowlist-or-denylist-domains

### NPM Packages Needed
- **`https-proxy-agent`**: https://www.npmjs.com/package/https-proxy-agent - HTTP/HTTPS proxy support for Node.js fetch
- **`socks-proxy-agent`**: https://www.npmjs.com/package/socks-proxy-agent - SOCKS5 proxy support (optional)
- **`@brightdata/sdk`**: https://www.npmjs.com/package/@brightdata/sdk - Official Bright Data JS SDK (optional, for advanced features)

---

## Quick Reference Card

```
+----------------------------------------------------------+
|  BRIGHT DATA RESIDENTIAL PROXY - QUICK REFERENCE         |
+----------------------------------------------------------+
|                                                          |
|  Host:     brd.superproxy.io                             |
|  Port:     33335 (HTTP/S) | 22228 (SOCKS5)              |
|                                                          |
|  Username: brd-customer-{ID}-zone-{ZONE}-country-{CC}   |
|  Password: {ZONE_PASSWORD}                               |
|                                                          |
|  Country Codes for Mudra:                                |
|    US=us  ES=es  GB=gb  MX=mx  CO=co  AR=ar  PE=pe      |
|                                                          |
|  Test URL: http://lumtest.com/myip.json                  |
|                                                          |
|  npm install https-proxy-agent                           |
|                                                          |
|  const agent = new HttpsProxyAgent(proxyUrl);            |
|  const res = await fetch(url, { agent });                |
|                                                          |
+----------------------------------------------------------+
```
