# DOMParser API - Complete Documentation

> **Web API for parsing XML or HTML source code from strings into DOM Document objects**

---

## Table of Contents

1. [Overview](#overview)
2. [Constructor](#constructor)
3. [Methods](#methods)
   - [parseFromString()](#parsefromstring)
4. [MIME Types](#mime-types)
5. [Code Examples](#code-examples)
6. [Error Handling](#error-handling)
7. [Security Considerations](#security-considerations)
8. [Browser Compatibility](#browser-compatibility)
9. [Related APIs](#related-apis)

---

## Overview

The **`DOMParser`** interface provides the ability to parse XML or HTML source code from a string into a DOM `Document` object.

### Key Characteristics

| Feature | Description |
|---------|-------------|
| **Purpose** | Convert string markup to DOM Document |
| **Input** | HTML, XML, XHTML, or SVG strings |
| **Output** | `Document` object (HTMLDocument or XMLDocument) |
| **Opposite** | `XMLSerializer` (converts DOM to strings) |

### How It Differs from XMLHttpRequest

- `DOMParser` parses from **strings**
- `XMLHttpRequest` parses from **URLs**

---

## Constructor

### `DOMParser()`

Creates a new `DOMParser` object.

#### Syntax

```javascript
new DOMParser()
```

#### Parameters

**None** - The constructor takes no parameters.

#### Return Value

A new `DOMParser` object that can be used to parse document text via `parseFromString()`.

#### Example

```javascript
const parser = new DOMParser();
```

---

## Methods

### `parseFromString()`

Parses HTML or XML input and returns a `Document` object with the specified content type.

#### Syntax

```javascript
parseFromString(input, mimeType)
```

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `input` | `TrustedHTML` or `string` | The HTML, XML, XHTML, or SVG markup to be parsed |
| `mimeType` | `string` | The MIME type specifying the parsing mode |

#### Return Value

A `Document` object with `contentType` matching the given `mimeType`.

The browser may return:
- `HTMLDocument` - for HTML content
- `XMLDocument` - for XML/SVG content

Both derive from `Document`.

#### Exceptions

##### `TypeError`

Thrown when:
- `mimeType` is not one of the allowed values
- `input` is a string when Trusted Types are enforced by CSP and no default policy exists

---

## MIME Types

### Allowed Values

| MIME Type | Parsing Mode | Use Case |
|-----------|--------------|----------|
| `text/html` | HTML | Parse HTML documents |
| `text/xml` | XML | Parse XML documents |
| `application/xml` | XML | Parse XML documents (alternative) |
| `application/xhtml+xml` | XHTML | Parse XHTML documents |
| `image/svg+xml` | SVG | Parse SVG documents |

### Behavior Differences

#### HTML Parsing (`text/html`)

- `<script>` elements are marked **non-executable**
- Events are **not fired**
- Event handlers **don't run**
- Can download resources from `<iframe>` and `<img>` elements
- Creates an **inert in-memory DOM** separate from the visible page
- Useful for parsing HTML with declarative shadow roots
- Useful for sanitizing input

#### XML Parsing (`text/xml`, `application/xml`, `application/xhtml+xml`, `image/svg+xml`)

- Input parsed strictly as XML
- Useful for importing, validating, and extracting data from XML files
- Returns document with `<parsererror>` node if input is malformed
- Errors reported to browser's JavaScript console

---

## Code Examples

### Basic HTML Parsing

```javascript
const parser = new DOMParser();

const htmlString = "<strong>Beware of the leopard</strong>";
const doc = parser.parseFromString(htmlString, "text/html");

console.log(doc.contentType);              // "text/html"
console.log(doc.body.firstChild.textContent); // "Beware of the leopard"
```

### Parsing a Complete HTML Document

```javascript
const parser = new DOMParser();

const htmlString = `
<!DOCTYPE html>
<html>
<head>
    <title>Test Page</title>
</head>
<body>
    <h1>Hello World</h1>
    <p>This is a paragraph.</p>
</body>
</html>
`;

const doc = parser.parseFromString(htmlString, "text/html");

console.log(doc.title);                    // "Test Page"
console.log(doc.querySelector("h1").textContent); // "Hello World"
console.log(doc.querySelectorAll("p").length);    // 1
```

### XML Parsing

```javascript
const parser = new DOMParser();

const xmlString = "<warning>Beware of the tiger</warning>";
const doc = parser.parseFromString(xmlString, "application/xml");

console.log(doc.contentType);              // "application/xml"
console.log(doc.documentElement.textContent); // "Beware of the tiger"
console.log(doc.documentElement.tagName);     // "warning"
```

### Complex XML Parsing

```javascript
const parser = new DOMParser();

const xmlString = `
<?xml version="1.0" encoding="UTF-8"?>
<catalog>
    <book id="1">
        <title>JavaScript: The Good Parts</title>
        <author>Douglas Crockford</author>
        <price>29.99</price>
    </book>
    <book id="2">
        <title>Eloquent JavaScript</title>
        <author>Marijn Haverbeke</author>
        <price>39.99</price>
    </book>
</catalog>
`;

const doc = parser.parseFromString(xmlString, "application/xml");

// Get all books
const books = doc.querySelectorAll("book");
console.log(books.length); // 2

// Get specific data
const firstBook = books[0];
console.log(firstBook.querySelector("title").textContent); // "JavaScript: The Good Parts"
console.log(firstBook.getAttribute("id"));                  // "1"

// Iterate through all books
books.forEach(book => {
    const title = book.querySelector("title").textContent;
    const author = book.querySelector("author").textContent;
    const price = book.querySelector("price").textContent;
    console.log(`${title} by ${author} - $${price}`);
});
```

### SVG Parsing

```javascript
const parser = new DOMParser();

const svgString = '<circle cx="50" cy="50" r="50"/>';
const doc = parser.parseFromString(svgString, "image/svg+xml");

console.log(doc.contentType);       // "image/svg+xml"
console.log(doc.firstChild.tagName); // "circle"
```

### Complete SVG Document

```javascript
const parser = new DOMParser();

const svgString = `
<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
    <rect x="10" y="10" width="80" height="80" fill="red"/>
    <circle cx="150" cy="50" r="40" fill="blue"/>
    <text x="100" y="150" text-anchor="middle">Hello SVG</text>
</svg>
`;

const doc = parser.parseFromString(svgString, "image/svg+xml");
const svg = doc.documentElement;

// Access SVG elements
const rect = svg.querySelector("rect");
console.log(rect.getAttribute("fill")); // "red"

// Append to DOM
document.body.appendChild(svg);
```

### Extracting Data from HTML

```javascript
const parser = new DOMParser();

const htmlString = `
<div class="product">
    <h2 class="title">Awesome Product</h2>
    <span class="price">$99.99</span>
    <p class="description">This is a great product.</p>
    <ul class="features">
        <li>Feature 1</li>
        <li>Feature 2</li>
        <li>Feature 3</li>
    </ul>
</div>
`;

const doc = parser.parseFromString(htmlString, "text/html");

const product = {
    title: doc.querySelector(".title").textContent,
    price: doc.querySelector(".price").textContent,
    description: doc.querySelector(".description").textContent,
    features: Array.from(doc.querySelectorAll(".features li")).map(li => li.textContent)
};

console.log(product);
// {
//     title: "Awesome Product",
//     price: "$99.99",
//     description: "This is a great product.",
//     features: ["Feature 1", "Feature 2", "Feature 3"]
// }
```

### Parsing HTML Tables

```javascript
const parser = new DOMParser();

const htmlString = `
<table>
    <thead>
        <tr><th>Name</th><th>Age</th><th>City</th></tr>
    </thead>
    <tbody>
        <tr><td>Alice</td><td>30</td><td>New York</td></tr>
        <tr><td>Bob</td><td>25</td><td>Los Angeles</td></tr>
        <tr><td>Charlie</td><td>35</td><td>Chicago</td></tr>
    </tbody>
</table>
`;

const doc = parser.parseFromString(htmlString, "text/html");

// Get headers
const headers = Array.from(doc.querySelectorAll("thead th")).map(th => th.textContent);
console.log(headers); // ["Name", "Age", "City"]

// Get data rows
const rows = doc.querySelectorAll("tbody tr");
const data = Array.from(rows).map(row => {
    const cells = row.querySelectorAll("td");
    return {
        name: cells[0].textContent,
        age: parseInt(cells[1].textContent),
        city: cells[2].textContent
    };
});

console.log(data);
// [
//     { name: "Alice", age: 30, city: "New York" },
//     { name: "Bob", age: 25, city: "Los Angeles" },
//     { name: "Charlie", age: 35, city: "Chicago" }
// ]
```

---

## Error Handling

### XML Error Detection

When parsing XML, malformed input results in a document containing a `<parsererror>` element.

```javascript
const parser = new DOMParser();

const malformedXml = "<warning>Beware of the missing closing tag";
const doc = parser.parseFromString(malformedXml, "application/xml");

// Check for parsing errors
const errorNode = doc.querySelector("parsererror");

if (errorNode) {
    console.error("XML Parsing failed!");
    console.error(errorNode.textContent);
} else {
    console.log("XML Parsing succeeded!");
    // Process the document
}
```

### Robust XML Parser Function

```javascript
function parseXML(xmlString) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlString, "application/xml");

    const errorNode = doc.querySelector("parsererror");
    if (errorNode) {
        throw new Error(`XML Parsing Error: ${errorNode.textContent}`);
    }

    return doc;
}

// Usage
try {
    const doc = parseXML("<valid><xml>content</xml></valid>");
    console.log("Parsed successfully:", doc.documentElement.tagName);
} catch (error) {
    console.error(error.message);
}
```

### HTML Error Handling

HTML parsing is more forgiving - browsers will attempt to fix malformed HTML:

```javascript
const parser = new DOMParser();

// Malformed HTML (missing closing tags)
const malformedHtml = "<div><p>Paragraph 1<p>Paragraph 2</div>";
const doc = parser.parseFromString(malformedHtml, "text/html");

// Browser auto-corrects the structure
console.log(doc.body.firstChild); // Structure is corrected
```

### Block-Level Element Auto-Closing

> **Warning:** Block-level elements like `<p>` will be automatically closed if another block-level element is nested inside and parsed before the closing tag.

```javascript
const parser = new DOMParser();

const htmlString = "<p>Paragraph<div>Block inside</div>More text</p>";
const doc = parser.parseFromString(htmlString, "text/html");

// The <p> is auto-closed before the <div>
console.log(doc.body.childNodes.length); // Multiple nodes created
```

---

## Security Considerations

> **Warning:** `DOMParser.parseFromString()` is a potential XSS vector if unsafe input is parsed and then injected into the visible DOM.

### The XSS Risk

Scripts in parsed HTML are initially inactive but **will execute if injected into visible DOM**.

### Safe Behavior of Parsed Documents

```javascript
const parser = new DOMParser();
const htmlWithScript = '<script>alert("test")</script>';
const doc = parser.parseFromString(htmlWithScript, "text/html");

// Script is NOT executed here - it's marked non-executable
// The parsed document is inert
```

### Mitigation Strategies

#### 1. Use Trusted Types with Sanitization (Recommended)

```javascript
// Polyfill for browsers without Trusted Types support
if (typeof trustedTypes === "undefined") {
    globalThis.trustedTypes = {
        createPolicy: (name, rules) => rules
    };
}

// Create a policy that sanitizes input using DOMPurify
const policy = trustedTypes.createPolicy("my-policy", {
    createHTML: (input) => DOMPurify.sanitize(input)
});

// Safe parsing with sanitization
const parser = new DOMParser();
const untrustedString = '<p>Content</p><img src="x" onerror="alert(1)">';
const trustedHTML = policy.createHTML(untrustedString);
const safeDocument = parser.parseFromString(trustedHTML, "text/html");
```

#### 2. Use DOMPurify Directly

```javascript
// Install: npm install dompurify
import DOMPurify from 'dompurify';

function safeParseHTML(htmlString) {
    const parser = new DOMParser();
    const sanitized = DOMPurify.sanitize(htmlString);
    return parser.parseFromString(sanitized, "text/html");
}

const userInput = '<script>evil()</script><p>Safe content</p>';
const doc = safeParseHTML(userInput);
// Only safe content remains
```

#### 3. Enforce Trusted Types via CSP

```html
<!-- In your HTML header or via server headers -->
<meta http-equiv="Content-Security-Policy"
      content="require-trusted-types-for 'script'">
```

#### 4. Extract Data Only (Don't Inject) - Safest

```javascript
// Safe: Only extract data, never inject back to DOM
const parser = new DOMParser();
const htmlString = '<div class="data" data-value="42">Content</div>';
const doc = parser.parseFromString(htmlString, "text/html");

// Extract data only using textContent (safe)
const value = doc.querySelector(".data").dataset.value;
const text = doc.querySelector(".data").textContent;

// Use the extracted data safely
console.log(value, text); // "42", "Content"
```

### Security Checklist

| Practice | Status |
|----------|--------|
| Never inject parsed content from untrusted sources directly | Required |
| Always sanitize with DOMPurify before parsing untrusted input | Recommended |
| Use Trusted Types when available | Recommended |
| Enforce Trusted Types via CSP in production | Recommended |
| Only extract data from parsed documents using textContent | Safest |

---

## Browser Compatibility

### Support Status

**Baseline: Widely Available**

- Available across browsers since **July 2015**
- Works across many devices and browser versions

### Browser Support

| Browser | Support |
|---------|---------|
| Chrome | Full |
| Firefox | Full |
| Safari | Full |
| Edge | Full |
| Opera | Full |
| IE 9+ | Full |

### Feature Detection

```javascript
if (typeof DOMParser !== "undefined") {
    // DOMParser is supported
    const parser = new DOMParser();
} else {
    // Fallback for very old browsers (unlikely needed today)
    console.warn("DOMParser not supported");
}
```

---

## Related APIs

### XMLSerializer

The opposite of DOMParser - converts DOM trees to XML/HTML strings.

```javascript
const parser = new DOMParser();
const serializer = new XMLSerializer();

// Parse
const doc = parser.parseFromString("<root><child>text</child></root>", "application/xml");

// Modify
doc.querySelector("child").textContent = "modified";

// Serialize back to string
const xmlString = serializer.serializeToString(doc);
console.log(xmlString); // <root><child>modified</child></root>
```

### Document.parseHTMLUnsafe()

A more ergonomic alternative for HTML parsing (static method).

```javascript
// Using DOMParser
const parser = new DOMParser();
const doc1 = parser.parseFromString("<p>Hello</p>", "text/html");

// Using parseHTMLUnsafe (newer, more convenient)
const doc2 = Document.parseHTMLUnsafe("<p>Hello</p>");
```

### XMLHttpRequest / Fetch

For loading documents from URLs rather than strings.

```javascript
// DOMParser: from string
const parser = new DOMParser();
const doc = parser.parseFromString(someString, "text/html");

// Fetch + DOMParser: from URL
const response = await fetch("https://example.com/page.html");
const html = await response.text();
const doc2 = parser.parseFromString(html, "text/html");
```

### JSON.parse()

Counterpart for JSON documents.

```javascript
// DOMParser for XML/HTML
const parser = new DOMParser();
const xmlDoc = parser.parseFromString("<data>value</data>", "application/xml");

// JSON.parse for JSON
const jsonData = JSON.parse('{"data": "value"}');
```

---

## Quick Reference

### Cheat Sheet

```javascript
const parser = new DOMParser();

// HTML
const htmlDoc = parser.parseFromString("<p>Hello</p>", "text/html");
const text = htmlDoc.body.textContent;

// XML
const xmlDoc = parser.parseFromString("<root>data</root>", "application/xml");
const data = xmlDoc.documentElement.textContent;

// SVG
const svgDoc = parser.parseFromString('<svg><circle r="10"/></svg>', "image/svg+xml");
const svg = svgDoc.documentElement;

// Error check (XML only)
const errorNode = xmlDoc.querySelector("parsererror");
if (errorNode) console.error("Parse error!");

// Query parsed content
const items = htmlDoc.querySelectorAll(".item");
const attr = htmlDoc.querySelector("[data-id]").dataset.id;
```

### Common Patterns

```javascript
// Parse and extract all links
function extractLinks(html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    return Array.from(doc.querySelectorAll("a")).map(a => ({
        href: a.getAttribute("href"),
        text: a.textContent
    }));
}

// Parse and extract meta tags
function extractMeta(html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    const meta = {};
    doc.querySelectorAll("meta").forEach(m => {
        const name = m.getAttribute("name") || m.getAttribute("property");
        const content = m.getAttribute("content");
        if (name && content) meta[name] = content;
    });
    return meta;
}

// Safe HTML to text (using textContent - XSS safe)
function htmlToText(html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    return doc.body.textContent || "";
}
```

---

*Documentation compiled from MDN Web Docs at https://developer.mozilla.org/en-US/docs/Web/API/DOMParser*
