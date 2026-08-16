# Medfolio — Personal Health & Prescription Records

Medfolio is a privacy-first personal health management web application and PWA designed to digitize handwritten prescriptions, automatically schedule timed medicine doses, track diagnostic lab biomarker trends, and produce clinical doctor briefs.

---

## 🌟 Core Features

- 📸 **Prescription Digitization**: Capture paper prescriptions or lab reports with your camera. Uses Google Gemini Multimodal AI on the backend to extract doctor consultations, diagnoses, medicines, dosages, durations, and follow-up advice into structured records.
- 🔍 **Interactive Magnifier**: Smooth cursor-tracking hover zoom (`2x`, `2.5x`, `3.5x`) and fullscreen modal on prescription and lab test images.
- 💊 **Deterministic Scheduling**: Generates exact, non-overlapping dose time buckets in Pakistan Standard Time (`Asia/Karachi`), respecting meal relations (`before meals` vs `after meals`), ongoing courses, and PRN cabinet.
- 🧪 **Diagnostic Lab Trends**: Tracks biomarkers (e.g. Hemoglobin, Fasting Blood Sugar, HbA1c, Serum Creatinine, SGPT) with interactive Recharts line visualizations and reference range evaluation (`Within typical range`, `Outside typical range`).
- ⏱️ **Medical Timeline**: Unified chronological view interleaving doctor visits, prescriptions, lab results, and patient-logged symptoms.
- 📋 **Printable Doctor Brief**: A4 print-optimized one-page clinical summary sheet with active medicines, allergy/condition callouts, and recent history for consulting physicians.
- 🔗 **Doctor Share Links & QR Codes**: Time-limited (24h, 7d, 30d) view-only shareable links and SVG QR codes with instant revocation.
- 🚨 **Offline Red-Flag Triage**: Instant client-side check for medical emergencies (e.g. chest pain, shortness of breath) with one-tap Pakistan emergency helplines (`1122`, `115`, `1020`) before any network call.
- 💾 **Cryptographic JSON Backup**: Full export and schema-validated restore of health records.
- 📱 **Progressive Web App (PWA)**: Installable on mobile and desktop with offline caching and background service worker support.

---

## 🛠️ Tech Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS, Lucide Icons, Recharts
- **Backend / API**: Vercel Serverless Functions (`/api/extract-prescription`, `/api/extract-lab-report`, `/api/explain-medicine`)
- **AI Model**: Google Gemini API (`gemini-3.5-flash`)
- **Database & Auth**: Supabase PostgreSQL with local offline fallback persistence
- **Testing & Quality**: Vitest, TypeScript strict mode, ESLint (`0 warnings` rule)

---

## 🚀 Getting Started

### 1. Prerequisites
- Node.js 18+
- npm or yarn

### 2. Installation
```bash
git clone <repository-url>
cd medfolio
npm install
```

### 3. Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

Fill in your configuration:
```env
# Public Supabase Client Keys
VITE_SUPABASE_URL=https://<your-project>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-key>

# Server-Side API Keys (Never prefixed with VITE_)
SUPABASE_URL=https://<your-project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
GEMINI_API_KEY=<your-gemini-api-key>
GEMINI_MODEL=gemini-3.5-flash
```

### 4. Run Locally
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

### 5. Run Verification & Tests
```bash
npm run verify
```
Runs full TypeScript typecheck, ESLint zero-warnings audit, Vitest domain tests, and production build bundle.

---

## 🔒 Security & Privacy Architecture

- **No Secrets in Client Bundle**: All AI calls and Gemini API keys operate strictly within backend serverless functions (`/api/*`). The frontend bundle contains zero LLM secrets.
- **Client Offline Resilience**: If the database is unreachable or offline, the client seamlessly stores and serves data via local encrypted storage.
- **Clinical Neutrality**: Out-of-range lab results and AI extraction suggestions use neutral medical language without speculative diagnosing or exaggerated alerts.
