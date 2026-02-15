# GuardiaPass - AI Security Dashboard

## Overview
GuardiaPass is a production-grade cybersecurity password manager and URL verification dashboard built with React, TypeScript, Vite, and Express backend with PostgreSQL persistence. Features AI-powered URL verification, encrypted password vault, dark web breach scanning, network monitoring, activity analytics, Chrome extension integration, and AI Security Advisor.

## Recent Changes (Feb 15, 2026)
- **Gemini via Replit AI Integrations**: Switched to Replit-managed Gemini access (no user API key needed), using gemini-2.5-flash model
- **API status endpoint**: `/api/status` reports which APIs are configured
- **Full-stack refactor**: Express backend (port 3001 dev / 5000 prod) + Vite frontend (port 5000 dev with proxy to backend)
- **PostgreSQL persistence**: vault_passwords, vault_identities, visits tables with proper indexing
- **Server-side API proxying**: All external API calls (Gemini, Hunter.io, Backboard.io, HIBP) go through backend — API keys never exposed to client
- **Removed all demo/mock data**: No more generateDemoVisits, populateMockData, or fake fallbacks
- **Database-backed vault**: Passwords/identities/visits loaded from PostgreSQL on unlock, saved on create/delete
- **Frontend API client**: services/api.ts centralizes all backend API calls
- Client-side AES-GCM-256 encryption preserved — backend stores ciphertext only
- Typosquatting detection engine with 25+ brand database (client-side, instant)
- AI Security Advisor powered by Backboard.io with persistent memory
- Cyber Academy with 27+ curated security learning resources and Scam Site Simulator
- Chrome extension: autofill, credential save, Hunter.io email scanning, in-popup AI chat
- Breach Scanner: HIBP password API (k-anonymity) + Gemini AI for email/username intelligence

## Project Architecture
- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS (CDN)
- **Backend**: Express 5 (Node.js) serving API routes and static files in production
- **Database**: PostgreSQL (Neon-backed via Replit)
- **AI**: Google Gemini API via @google/genai + Replit AI Integrations (gemini-2.5-flash), Backboard.io (AI Advisor)
- **Email Verification**: Hunter.io API (email verifier v2)
- **Crypto**: Web Crypto API (AES-GCM-256, PBKDF2) — client-side encryption
- **State**: React useState, database persistence via API calls
- **Breach Detection**: HIBP Password API (k-anonymity) + Gemini AI

### Architecture Pattern
- Dev: Vite dev server (port 5000) proxies /api to Express (port 3001)
- Prod: Express (port 5000) serves Vite build from dist/ and handles /api routes
- API keys: Server-side only (AI_INTEGRATIONS_GEMINI_API_KEY, HUNTER_API_KEY, BACKBOARD_API_KEY)

### Key Files
- `server/index.js` - Express backend: DB init, CRUD APIs, AI proxy routes, static file serving
- `services/api.ts` - Frontend API client (vaultApi, visitsApi, aiApi, breachApi, hunterApi, backboardApi)
- `App.tsx` - Main app component, routing, bridge message handling, DB load on unlock
- `components/Vault.tsx` - Password/identity vault with DB persistence
- `components/Verifier.tsx` - AI Neural Verifier (URL security scanner)
- `components/BreachScanner.tsx` - Dark web breach detection (email/username/password)
- `components/NetworkMonitor.tsx` - Network Hub (visit telemetry display)
- `components/Analytics.tsx` - Activity Intelligence (charts/stats)
- `components/Settings.tsx` - Theme config + vault password change with re-encryption
- `components/AIAdvisor.tsx` - AI Security Advisor (Backboard.io powered chat)
- `components/Education.tsx` - Cyber Academy (security education, Scam Site Simulator)
- `components/ExtensionSimulator.tsx` - Browser extension simulator
- `components/AuthGateway.tsx` - Login screen with biometric detection
- `services/geminiService.ts` - Client-side typosquatting detection + API calls via backend
- `services/breachService.ts` - SHA-1 hashing + breach check via backend
- `services/hunterService.ts` - Email verification via backend
- `services/backboardService.ts` - Backboard.io assistant/thread management via backend
- `services/cryptoService.ts` - Client-side AES-GCM encryption/decryption
- `types.ts` - TypeScript interfaces and enums
- `vite.config.ts` - Vite config with proxy to backend
- `package.json` - Scripts: dev (server + vite), build (vite build)

### Chrome Extension (`extension/`)
- `manifest.json` - Extension manifest v3
- `background.js` - Service worker (visit tracking, autofill relay, credential save)
- `content.js` - Content script (dashboard bridge, password detection, save prompt, Hunter.io email scanner)
- `popup.html/js` - Extension popup (vault access, autofill, site audit)
- `blocked.html` - Phishing block page
- `content.css` - Content script styles

### Environment Variables (Server-side secrets)
- `DATABASE_URL` - PostgreSQL connection string (auto-set by Replit)
- `AI_INTEGRATIONS_GEMINI_API_KEY` - Replit-managed Gemini API key (auto-set)
- `AI_INTEGRATIONS_GEMINI_BASE_URL` - Replit-managed Gemini base URL (auto-set)
- `HUNTER_API_KEY` - Hunter.io API key
- `BACKBOARD_API_KEY` - Backboard.io API key

### Default Master Password
- `admin123` (can be changed in Settings > Change Vault Password)

## User Preferences
- Dark cybersecurity/hacker aesthetic
- Multiple theme options (forest, obsidian, neon, arctic)
