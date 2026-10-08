# PROOFly Deployment Guide

This guide details how to deploy PROOFly's Next.js Frontend and FastAPI Python Backend to production environments. 

## 1. Environment Configuration

### Supabase Setup
1. Create a new Supabase project in your Supabase Dashboard.
2. Navigate to the SQL Editor and run the schema script located at `backend/db/migrations/001_initial_schema.sql` (if available/required) or apply your migrations.
3. Obtain your `Project URL`, `anon_key`, and `service_role_key` from the API Settings page.
4. Set up your SMTP/Email configuration inside Supabase Authentication settings if email verification is mandated for Sign Ups.

### Backend Environment Variables (Production)
Create a secure production environment (e.g., Render, Railway, or Google Cloud Run) and inject the following keys:
```env
SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_KEY="your-service-role-key" # IMPORTANT: Use service_role_key for backend DB insertion
SUPABASE_JWT_SECRET="your-jwt-secret-from-api-settings"
GEMINI_API_KEY="AIza..."
CORS_ORIGINS="https://your-frontend-domain.vercel.app"

# Optional LLM Config
LLM_PROVIDER=gemini # Or "groq"
GROQ_API_KEY=
GROQ_MODEL=
```

### Frontend Environment Variables (Production)
Inject these into your frontend hosting platform (e.g., Vercel, Netlify):
```env
NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="your-publishable-key"
NEXT_PUBLIC_API_URL="https://your-deployed-backend-url.onrender.com"
```

## 2. Deploying the Backend

### Using Render (or similar PaaS)
1. Connect your GitHub repository to Render.
2. Create a new **Web Service**.
3. Set the Build Command:
   ```bash
   pip install -r backend/requirements.txt
   ```
4. Set the Start Command:
   ```bash
   uvicorn backend.main:app --host 0.0.0.0 --port $PORT
   ```
5. Add the backend environment variables listed above.

### Using Google Cloud Run (Docker)
A `Dockerfile` is provided in the project root.
```bash
gcloud run deploy proofly-backend --source . --port 8000
```

## 3. Deploying the Frontend

### Using Vercel
1. Connect your repository to Vercel.
2. Set the Root Directory to `frontend`.
3. The framework preset should automatically detect **Next.js**.
4. Add the frontend environment variables (`NEXT_PUBLIC_*`).
5. Click **Deploy**.

## 4. Post-Deployment Verification
1. Access the live frontend URL.
2. Create an instructor account via the `/signup` route (confirm your email via Supabase if required).
3. Ensure the deployed backend `/api/health` returns `200 OK`.
4. Navigate to `/submissions/new`, upload a TXT/PDF/DOCX document, and verify that the ML orchestrator successfully parses and returns the analysis report.
