# Quick Deployment Checklist

## Phase 1: Supabase Setup (15-20 minutes)

### Create & Configure Project
- [ ] Create Supabase project at supabase.com
- [ ] Wait for project to initialize (2-3 min)
- [ ] Save project password securely
- [ ] Go to SQL Editor
- [ ] Paste entire schema from `schema_supabase_whatsapp_orders.sql`
- [ ] Run schema
- [ ] Verify 11 tables created in Table Editor

### Get Connection Credentials
- [ ] Settings > Database > Connection pooling
- [ ] Copy **Pooler Connection String** for backend (asyncpg)
- [ ] Settings > API
- [ ] Copy **Project URL**
- [ ] Copy **Service Role Key**
- [ ] Copy **Anon Key**

### Example Connection String
```
postgresql+asyncpg://postgres.YOUR_REF:YOUR_PASSWORD@aws-0-eu-west-1.pooler.supabase.com:5432/postgres
```

---

## Phase 2: Backend Deployment (30-45 minutes)

### Option A: Railway (Recommended)
1. [ ] Go to railway.app
2. [ ] Create account & connect GitHub
3. [ ] New project > GitHub Repo
4. [ ] Select your KOZAPP repository
5. [ ] Set environment variables:
   ```
   DATABASE_URL=postgresql+asyncpg://...
   ENVIRONMENT=production
   SECRET_KEY=<generate-random>
   ALLOWED_ORIGINS=https://your-vercel-domain.vercel.app
   FRONTEND_URL=https://your-vercel-domain.vercel.app
   WHATSAPP_VERIFY_TOKEN=<your-token>
   WHATSAPP_API_VERSION=v21.0
   ```
6. [ ] Deploy
7. [ ] Get backend URL: `https://your-backend.railway.app`

### Option B: Render
1. [ ] Go to render.com
2. [ ] Create account & connect GitHub
3. [ ] New Web Service > GitHub
4. [ ] Select KOZAPP repo
5. [ ] Set start command: `uvicorn app.main:app --host 0.0.0.0 --port 8000`
6. [ ] Add environment variables (same as above)
7. [ ] Deploy

### Option C: o2switch (Current)
1. [ ] Update `.env` on server with Supabase DATABASE_URL
2. [ ] Update `ALLOWED_ORIGINS` with Vercel domain
3. [ ] Restart application

### Test Backend Deployment
```bash
curl https://YOUR-BACKEND-URL/health
# Should return: {"status":"healthy"}

curl https://YOUR-BACKEND-URL/docs
# Should open Swagger UI
```

---

## Phase 3: Frontend Deployment on Vercel (10-15 minutes)

### Deploy to Vercel
1. [ ] Go to vercel.com
2. [ ] Click "New Project"
3. [ ] Import GitHub repository
4. [ ] Select your KOZAPP repo
5. [ ] Framework Preset: Next.js (auto-detected)
6. [ ] Root Directory: `./`
7. [ ] Build Command: `pnpm build` (or `npm run build`)
8. [ ] Output Directory: `.next`
9. [ ] Click Deploy

### Configure Environment Variables in Vercel
1. [ ] After deployment, go to Project Settings > Environment Variables
2. [ ] Add these variables:
   ```env
   NEXT_PUBLIC_API_URL=https://YOUR-BACKEND-URL
   NEXT_PUBLIC_SUPABASE_URL=https://YOUR_REF.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
   ```
3. [ ] Deploy again (or redeploy from dashboard)

### Verify Frontend Works
1. [ ] Go to your Vercel project URL
2. [ ] Check browser console for errors
3. [ ] Try to access app
4. [ ] Verify API calls go to correct backend (DevTools Network tab)

---

## Phase 4: Verification & Testing

### Database
- [ ] Connect to Supabase > Table Editor
- [ ] Verify tables exist and have correct structure
- [ ] Check RLS policies exist on all tables

### API/Backend
- [ ] `https://YOUR-BACKEND/health` returns `{"status":"healthy"}`
- [ ] `https://YOUR-BACKEND/docs` opens Swagger UI
- [ ] CORS headers are correct
- [ ] All endpoints work from frontend

### Frontend
- [ ] App loads without errors
- [ ] API calls succeed
- [ ] No CORS errors in console
- [ ] Auth flow works (if implemented)
- [ ] Data displays correctly

### WhatsApp (if enabled)
- [ ] Webhook URL set in Meta Developers: `https://YOUR-BACKEND/api/webhooks/whatsapp`
- [ ] Verify token matches `WHATSAPP_VERIFY_TOKEN`
- [ ] Test webhook with sample webhook from Meta

---

## Environment Variables Reference

### Backend (Railway/Render/.env)
```env
# Database - MUST USE POOLER
DATABASE_URL=postgresql+asyncpg://postgres.YOUR_REF:YOUR_PASSWORD@aws-0-eu-west-1.pooler.supabase.com:5432/postgres

# Supabase (optional if using Supabase client)
SUPABASE_URL=https://YOUR_REF.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Application
ENVIRONMENT=production
SECRET_KEY=change_me_to_random_32_char_string
JWT_ALGORITHM=HS256
JWT_EXPIRE_MINUTES=10080

# CORS
ALLOWED_ORIGINS=https://your-domain.vercel.app,https://your-custom-domain.com
FRONTEND_URL=https://your-domain.vercel.app

# WhatsApp
WHATSAPP_VERIFY_TOKEN=unique_verification_token
WHATSAPP_API_VERSION=v21.0
```

### Frontend (Vercel Environment Variables)
```env
NEXT_PUBLIC_API_URL=https://your-backend.railway.app
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

---

## Troubleshooting

### CORS Errors in Frontend
**Problem**: Frontend can't reach backend
**Solution**:
1. Check `ALLOWED_ORIGINS` in backend includes Vercel domain
2. Restart/redeploy backend
3. Check backend is running: `https://backend-url/health`

### Database Connection Fails
**Problem**: Backend can't connect to Supabase
**Solution**:
1. Verify `DATABASE_URL` is correct
2. Make sure using **pooler** connection, not regular
3. Check Supabase project is active (not sleeping)
4. Test connection locally first

### Vercel Build Fails
**Problem**: Deployment fails on Vercel
**Solution**:
1. Check build logs in Vercel dashboard
2. Ensure `next build` works locally: `npm run build`
3. Check Node version compatibility
4. Verify all dependencies are in package.json

### WhatsApp Webhook Not Receiving
**Problem**: WhatsApp messages not coming in
**Solution**:
1. Verify webhook URL in Meta Developers: `https://backend-url/api/webhooks/whatsapp`
2. Verify verify token matches
3. Check backend logs for webhook events
4. Send test message from Meta dashboard

---

## Final URLs After Deployment

```
Frontend: https://your-domain.vercel.app
Backend API: https://your-backend.railway.app
Database: Supabase (cloud-hosted)
Webhook: https://your-backend.railway.app/api/webhooks/whatsapp
```

Save these URLs for reference!
