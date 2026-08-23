# Medfolio — Personal Health & Prescription Records

Medfolio is a privacy-first personal health management web application and PWA designed to digitize handwritten prescriptions, automatically schedule timed medicine doses, track diagnostic lab biomarker trends, and produce clinical doctor briefs.

---

## 🌟 Key Features

- **📸 Prescription Digitization**: Photograph paper prescriptions or lab reports. Google Gemini Multimodal AI extracts medications, dosages, frequencies, and durations into structured records.
- **💊 Deterministic Dose Scheduling**: Generates exact, non-overlapping dose time buckets in Pakistan Standard Time (`Asia/Karachi`), respecting meal relations (`before meals` vs `after meals`), ongoing courses, and PRN cabinet.
- **🧪 Diagnostic Lab Trends**: Tracks biomarkers (e.g., Fasting Blood Sugar, HbA1c, ALT/SGPT, Serum Creatinine, Hemoglobin) with interactive Recharts visualizations and clinical reference ranges.
- **⏱️ Longitudinal Timeline**: Unified chronological view interleaving doctor visits, prescriptions, lab results, and patient-logged symptoms.
- **📋 Printable Doctor Brief**: A4 print-optimized one-page clinical summary sheet with active medicines, allergy callouts, and recent history for consulting physicians.
- **🔗 Secure Doctor Sharing**: Time-limited (24h, 7d, 30d) view-only shareable links and QR codes with instant revocation and PIN protection.
- **🚨 Emergency Red-Flag Triage**: Instant client-side check for medical emergency symptoms with one-tap Pakistan emergency helplines (`1122`, `115`, `1020`) before any network request.
- **📶 Offline Vault**: Full offline capability with local encrypted storage and PWA background caching when connectivity drops.

---

## 🛠️ Tech Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS v4, Custom SVG Icons, Recharts
- **Backend / API**: Vercel Serverless Functions (`/api/extract-prescription`, `/api/extract-lab-report`, `/api/explain-medicine`)
- **AI Model**: Google Gemini API (`gemini-3.5-flash`)
- **Database & Auth**: Supabase PostgreSQL with tenant-isolated Row-Level Security (RLS)
- **Testing & Quality**: Vitest, strict TypeScript mode, zero-warnings ESLint rule

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

### 5. Verification & Tests
```bash
npm run verify
```
Runs full TypeScript typecheck, ESLint zero-warnings audit, Vitest domain tests, and production build bundle.

---

## 🔒 Clinical Safety & Security Guardrails

- **Assisting Care, Never Replacing Doctors**: Medfolio is a health organization and patient assistance tool. It does not diagnose illnesses or modify prescriptions without licensed physician supervision.
- **Zero Silent Commits**: All AI-extracted prescription fields and lab values require explicit human review and confirmation before being committed to patient health records.
- **No Secrets in Client Bundle**: All AI calls and Gemini API keys operate strictly within backend serverless functions (`/api/*`). The frontend bundle contains zero LLM secrets.
- **Client Offline Resilience**: If the database is unreachable or offline, the client securely stores and serves data via local encrypted storage.
- **Clinical Neutrality**: Out-of-range lab results and AI extraction suggestions use neutral medical language without speculative diagnosing or exaggerated alerts.
