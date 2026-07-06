# 🦉 ProjectOwl

Split receipts with friends — without the math.

A Splitwise-like PWA built with Next.js, focusing on receipt scanning and bill splitting.

## Current status

**Prototype — receipt scanning only.** Upload a receipt photo, and the app extracts
items, prices, and totals using Google Gemini.

## Quick start

### Prerequisites

- **Node.js** v18+ (download from [nodejs.org](https://nodejs.org))
- **Google Gemini API key** (get one free at [aistudio.google.com](https://aistudio.google.com/apikey))

### Setup

**macOS / Linux:**
```bash
chmod +x setup.sh
./setup.sh
```

**Windows (PowerShell):**
```powershell
.\setup.ps1
```

Or manually:

```bash
# 1. Install dependencies
npm install

# 2. Create .env.local (or copy from .env.example)
#    Add your GEMINI_API_KEY to .env.local
cp .env.example .env.local

# 3. Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and tap **Scan a receipt**.

### API

```
POST /api/receipts/extract
  Content-Type: multipart/form-data
  Body: { file: <receipt image> }

  → 200: { success: true, data: { menu: [...], total_price: ..., ... } }
  → 4xx/5xx: { success: false, error: "...", code: "..." }
```

## Project structure

```
src/
├── app/
│   ├── api/receipts/extract/route.ts   # POST endpoint (server-side)
│   ├── scan/page.tsx                    # Upload + results page
│   ├── page.tsx                         # Home page
│   └── layout.tsx                       # Root layout
├── components/
│   ├── ReceiptUploader.tsx              # Drag-and-drop file upload
│   ├── ReceiptResult.tsx                # Extracted item table + totals
│   ├── LoadingOverlay.tsx               # Spinner during processing
│   └── ErrorAlert.tsx                   # Error display with retry
└── lib/
    ├── schemas/receipt.ts               # Zod schemas + TypeScript types
    ├── llm/                             # LLM client abstraction
    │   ├── types.ts                     # LLMClient interface
    │   ├── gemini-client.ts             # Gemini implementation
    │   └── index.ts                     # Factory (createLLMClient)
    ├── errors.ts                        # Error classes
    └── retry.ts                         # Backoff retry utility
```

## Architecture decisions

- **LLM client interface** — Swap providers by adding one file + one factory case
- **Zod as single source of truth** — Runtime validation + TypeScript types from one schema
- **Raw REST API over SDK** — Full control over `responseSchema` for structured JSON output
- **Extensible** — Image preprocessing, prompt templates, and post-processing pipeline
  can be added without touching existing code
