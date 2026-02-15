# GuardiaPass - Encrypted AI Security Dashboard

GuardiaPass is a zero-knowledge, encryption-first password manager and cybersecurity dashboard. Every credential stored in the vault is encrypted with AES-GCM-256 before it ever touches storage. AI-powered threat detection, dark web breach scanning, and a Chrome extension work together to keep your accounts safe — all built on top of the Web Crypto API with a full-stack architecture and PostgreSQL persistence.

---

## Encryption Architecture

### Zero-Knowledge Vault

All sensitive data in GuardiaPass is protected by client-side encryption. Vault credentials are always encrypted before being sent to the server, and decryption only happens in the browser. The backend stores ciphertext only — it never has access to plaintext passwords.

| Layer | Algorithm | Purpose |
|---|---|---|
| Key Derivation | PBKDF2-SHA256 (100,000 iterations) | Converts master password into a cryptographic key |
| Encryption | AES-GCM-256 | Authenticated encryption for all vault entries |
| IV Generation | `crypto.getRandomValues` (96-bit) | Unique initialization vector per encryption operation |
| Breach Checking | SHA-1 k-Anonymity | Password breach lookups without exposing the password |
| Authentication | WebAuthn / FIDO2 | Optional biometric unlock via secure hardware enclave |

### How It Works

1. **Master Password** — On login, the user provides a master password. This password is used as the input to key derivation. The default is `admin123` — it should be changed immediately after setup.
2. **Key Derivation** — PBKDF2-SHA256 with 100,000 iterations and a fixed salt derives a 256-bit AES key from the master password.
3. **Encrypt on Save** — When a credential is added to the vault, the password field is encrypted with AES-GCM-256 using a random 96-bit IV. The IV is prepended to the ciphertext and the result is Base64-encoded. The encrypted data is then sent to the Express backend and stored in PostgreSQL.
4. **Decrypt on Use** — When autofill or viewing is requested, the ciphertext is retrieved from the database, decoded, the IV is split from the payload, and AES-GCM decryption produces the original password — all in the browser.
5. **Re-Encryption on Password Change** — Changing the master password first decrypts all entries with the old key, then updates the master password, then re-encrypts every entry with the new key. If re-encryption fails mid-process, some entries may need manual recovery.

### Key Cache

Derived keys are memoized in memory (capped at 10 entries) to avoid repeated PBKDF2 derivation on every encrypt/decrypt call. The cache is cleared on master password change.

### Breach Detection (k-Anonymity)

Password breach checks use the Have I Been Pwned (HIBP) range API. The password is SHA-1 hashed locally, only the first 5 characters of the hash are sent to the API, and the suffix is matched client-side. The full password hash never leaves the browser.

---

## Features

### Encrypted Password Vault
- AES-GCM-256 encrypted credential storage with PostgreSQL persistence
- AI-powered password strength analysis
- AI-generated secure passphrases
- Identity storage (name, email, address, phone)
- One-click autofill via Chrome extension

### AI Neural Verifier (Live Shield)
- Real-time URL security scanning powered by Google Gemini 2.5 Flash
- Client-side typosquatting detection engine (25+ brand database)
- Homoglyph attack detection (Cyrillic, numeric, and lookalike character substitution)
- Levenshtein distance matching for impersonation attempts
- High-confidence threats (80%+) flagged instantly before AI processing

### Dark Web Breach Scanner
- HIBP password API with k-anonymity (password never leaves browser)
- Gemini AI breach intelligence for email and username exposure
- Risk assessment and remediation recommendations

### AI Security Advisor
- Persistent AI assistant powered by Backboard.io with session memory
- Web page scanning — paste any URL for security analysis
- Chrome extension integration for live page context

### In-Extension AI Chat
- Ask questions about any website directly from the Chrome extension popup
- Automatic page content extraction via `chrome.scripting` API
- Quick prompts: Summarize, Is it safe?, What is this?, Privacy risks?

### Network Hub
- Real-time visit telemetry from the Chrome extension
- Threat flagging for suspicious navigation events

### Activity Intelligence
- Security activity charts and statistics
- Threat timeline and category breakdown

### Cyber Academy
- 27+ curated security education resources across 6 categories
- Interactive Scam Site Simulator for hands-on phishing awareness
- External links to courses, guides, and tools

### Chrome Extension
- Manifest V3 service worker architecture
- Automatic password detection and save prompts
- One-click autofill for matching sites
- Hunter.io email verification for Gmail and Outlook
- Phishing block page for detected threats
- In-popup AI chat for live page analysis

---

## Architecture

### Full-Stack Design

GuardiaPass uses a full-stack architecture with server-side API proxying. API keys are never exposed to the client.

```
┌─────────────────────────────────────────────────┐
│  Browser (React + Vite)                         │
│  ┌───────────┐  ┌──────────┐  ┌──────────────┐ │
│  │ Vault UI  │  │ Verifier │  │ Breach Scan  │ │
│  └─────┬─────┘  └────┬─────┘  └──────┬───────┘ │
│        │              │               │         │
│  ┌─────┴──────────────┴───────────────┴───────┐ │
│  │         services/api.ts (API Client)       │ │
│  └────────────────────┬───────────────────────┘ │
│                       │ /api/*                  │
└───────────────────────┼─────────────────────────┘
                        │
┌───────────────────────┼─────────────────────────┐
│  Express Backend      │ (server/index.js)       │
│  ┌────────────────────┴───────────────────────┐ │
│  │              API Routes                    │ │
│  │  /api/vault/*  /api/ai/*  /api/breach/*    │ │
│  │  /api/hunter/* /api/backboard/* /api/visits │ │
│  └──┬─────────┬──────────┬──────────┬─────────┘ │
│     │         │          │          │           │
│  ┌──┴──┐  ┌──┴───┐  ┌───┴──┐  ┌───┴────────┐  │
│  │ DB  │  │Gemini│  │Hunter│  │Backboard.io│  │
│  │(PG) │  │ API  │  │ API  │  │    API     │  │
│  └─────┘  └──────┘  └──────┘  └────────────┘  │
└─────────────────────────────────────────────────┘
```

- **Development**: Vite dev server (port 5000) proxies `/api` requests to Express (port 3001)
- **Production**: Express (port 5000) serves the Vite build from `dist/` and handles `/api` routes directly

---

## Setup Instructions

### Prerequisites

- Node.js 18+ and npm
- PostgreSQL database (provided automatically on Replit)

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

**On Replit**: AI features work automatically via Replit AI Integrations (Gemini). The following are auto-configured:
- `DATABASE_URL` — PostgreSQL connection string
- `AI_INTEGRATIONS_GEMINI_API_KEY` — Replit-managed Gemini API key
- `AI_INTEGRATIONS_GEMINI_BASE_URL` — Replit-managed Gemini base URL

**Optional API keys** (add as Secrets on Replit):
- `HUNTER_API_KEY` — Hunter.io API key for email verification
- `BACKBOARD_API_KEY` — Backboard.io API key for AI Advisor memory

**Outside Replit**: Set these environment variables manually:
```
GOOGLE_API_KEY=your_gemini_api_key
HUNTER_API_KEY=your_hunter_io_api_key
BACKBOARD_API_KEY=your_backboard_io_api_key
DATABASE_URL=your_postgresql_connection_string
```

You can copy the template and fill it in:
```bash
cp .env.example .env
```

### 3. Start the Development Server

```bash
npm run dev
```

The app runs on `http://localhost:5000`. The default master password is `admin123` — change it immediately in Settings after first login.

### 4. Build for Production

```bash
npm run build
npm run server
```

Express serves the Vite build from `dist/` on port 5000.

### 5. Run Database Migration (Optional but Recommended)

If you upgraded from an older version, run:

```bash
npm run migrate
```

This backfills `vault_identities.password_cipher` so identity passwords are persisted safely.

---

## New Vault Features

- **Identity Password AI Generation**: In the `Identities` add form, click `AI` next to password to generate a strong password.
- **Address Auto-Suggestions**: While typing an address in `Identities`, likely addresses are suggested; selecting one auto-fills city/state/ZIP when possible.
- **Hidden Photos (Encrypted)**: In the `Hidden Photos` vault tab, upload images to encrypt and store locally. You can view, download, or delete entries later.

### 5. Install the Chrome Extension

1. Open `chrome://extensions` in Chrome
2. Enable **Developer Mode** (toggle in the top-right corner)
3. Click **Load unpacked** and select the `extension/` directory
4. The extension icon appears in the toolbar — the shield is now active

The extension requires the dashboard to be open in a tab for AI features. If it is not open, the extension will automatically open it in the background when needed.

---

## API Status

The `/api/status` endpoint reports which APIs are configured and available:

```json
{
  "gemini": true,
  "hunter": true,
  "backboard": true,
  "database": true
}
```

---

## Project Structure

```
guardiapass/
├── server/
│   └── index.js                        # Express backend: DB, API routes, static serving
│
├── services/
│   ├── api.ts                          # Frontend API client (all backend calls)
│   ├── cryptoService.ts                # AES-GCM-256, PBKDF2, biometric auth
│   ├── geminiService.ts                # Gemini API calls + typosquatting detection
│   ├── breachService.ts                # HIBP k-anonymity + AI breach intelligence
│   ├── hunterService.ts                # Hunter.io email verification
│   └── backboardService.ts            # Backboard.io AI memory assistant
│
├── components/
│   ├── AuthGateway.tsx                 # Login (master password + biometric)
│   ├── Vault.tsx                       # Encrypted credential manager
│   ├── Verifier.tsx                    # AI URL security scanner
│   ├── BreachScanner.tsx               # Dark web breach detection
│   ├── AIAdvisor.tsx                   # AI Security Advisor chat
│   ├── NetworkMonitor.tsx              # Visit telemetry display
│   ├── Analytics.tsx                   # Activity charts and stats
│   ├── Education.tsx                   # Cyber Academy + Scam Site Simulator
│   ├── Settings.tsx                    # Theme + master password change
│   └── ExtensionSimulator.tsx          # Extension demo/simulator
│
├── extension/
│   ├── manifest.json                   # Manifest V3
│   ├── background.js                   # Service worker (routing, auto-dashboard)
│   ├── content.js                      # Content script (bridge, Hunter.io, autofill)
│   ├── popup.html                      # Extension popup UI
│   ├── popup.js                        # Popup logic + AI chat
│   ├── content.css                     # Content script styles
│   └── blocked.html                    # Phishing block page
│
├── App.tsx                             # Main app, routing, extension bridge
├── index.html                          # Entry point
├── types.ts                            # TypeScript interfaces
├── vite.config.ts                      # Vite config with proxy to backend
└── package.json                        # Dependencies and scripts
```

---

## Security Notes

- **All vault passwords are encrypted at rest.** Credential passwords are AES-GCM-256 encrypted before being sent to the server. The backend stores ciphertext only — plaintext passwords only exist in browser memory during active use.
- **Server-side API proxying.** All external API calls (Gemini, Hunter.io, Backboard.io, HIBP) go through the Express backend. API keys are never exposed to the client or embedded in the frontend bundle.
- **Breach checks use k-anonymity.** Only a 5-character SHA-1 hash prefix is sent to HIBP. The full password hash never leaves the client.
- **Re-encryption on password change.** All entries are decrypted with the old key, the master password is updated, then entries are re-encrypted. If the process is interrupted, recovery may require the old master password.
- **PostgreSQL persistence.** Vault data is stored in PostgreSQL with proper indexing. The database stores only encrypted ciphertext for password fields.
- **The Chrome extension uses no hardcoded secrets.** All AI processing is relayed through the dashboard tab where API routing is available.
- **Biometric authentication uses WebAuthn/FIDO2.** Hardware-backed verification through the platform authenticator. Falls back gracefully if unavailable.

---

## Technology Stack

| Category | Technology |
|---|---|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS |
| Backend | Express 5 (Node.js) |
| Database | PostgreSQL (Neon-backed via Replit) |
| AI Engine | Google Gemini 2.5 Flash via @google/genai + Replit AI Integrations |
| AI Memory | Backboard.io persistent assistant threads |
| Email Verification | Hunter.io API v2 |
| Encryption | Web Crypto API (AES-GCM-256, PBKDF2-SHA256) |
| Breach Detection | HIBP Password API (k-anonymity) + Gemini AI |
| Biometrics | WebAuthn / FIDO2 Platform Authenticator |
| Charts | Recharts |
| Icons | Lucide React |
| Extension | Chrome Manifest V3 |

---

## Default Credentials

| Field | Value |
|---|---|
| Master Password | `admin123` |

Change this immediately after first login via **Settings > Change Vault Password**. All existing vault entries will be re-encrypted with your new password.

---

## License

This project is provided as-is for educational and demonstration purposes.
