# Kozapp - Deployment Guide (Supabase + Vercel)

## PHASE 1: Supabase Configuration

### Step 1: Create Supabase Project
1. Go to [supabase.com](https://supabase.com)
2. Click **"New Project"**
3. Fill in:
   - **Project Name**: `kozapp-production` (or similar)
   - **Password**: Save this securely (you'll need it)
   - **Region**: Choose closest to your users
4. Wait 2-3 minutes for project to initialize

### Step 2: Deploy Database Schema
1. In Supabase dashboard, go to **SQL Editor**
2. Create a new query
3. Copy the entire content from `schema_supabase_whatsapp_orders.sql`
4. Paste and run the query
5. Wait for completion
6. Verify in **Table Editor** that all 11 tables are created:
   - `profiles`, `customers`, `categories`, `products`
   - `orders`, `order_items`, `negotiation_rules`
   - `team_members`, `whatsapp_conversation`, `whatsapp_message`, `order_status_history`

### Step 3: Configure RLS (Row Level Security)
1. Go to **Authentication > Policies**
2. Verify that RLS is enabled on all tables
3. The schema creates policies automatically - check that:
   - Each policy references `app.current_profile_id`
   - Policies are restrictive (only allow owner access)

### Step 4: Create Database Roles & Connection String
1. Go to **Settings > Database > Connection pooling**
2. Verify **Pooler Mode** is set to **"Transaction"**
3. Copy the **Pooling Connection String** (for backend):
   ```
   postgresql+asyncpg://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres
   ```
   Replace `[ref]` and `[password]` with your actual values.

4. Go to **Settings > API** and copy:
   - **Project URL**: `https://[ref].supabase.co`
   - **Service Role Key** (secret - never expose): `eyJ...`
   - **Anon Key** (public): for frontend if needed

### Step 5: Configure Environment Variables
Save these values securely (in Vercel and your backend hosting):

```env
# Supabase Database
DATABASE_URL=postgresql+asyncpg://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres

# Supabase API (optional, if using Supabase client)
SUPABASE_URL=https://[ref].supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Application
ENVIRONMENT=production
SECRET_KEY=<generate-a-long-random-string>
JWT_ALGORITHM=HS256
JWT_EXPIRE_MINUTES=10080

# CORS & Frontend
ALLOWED_ORIGINS=https://your-domain.com,https://www.your-domain.com
FRONTEND_URL=https://your-domain.com

# WhatsApp (optional - only if webhook is enabled)
WHATSAPP_VERIFY_TOKEN=<unique-secret-token>
WHATSAPP_API_VERSION=v21.0
```

---

## PHASE 2: Backend Deployment (Choose One)

### ⚠️ Important: Vercel vs Backend Hosting

**Vercel cannot host Python FastAPI backends.** You need a separate Python host:

#### Option A: Railway (Recommended for beginners)
1. Go to [railway.app](https://railway.app)
2. Create account and connect GitHub
3. Create new project
4. Select "GitHub Repo" and choose your KOZAPP repo
5. Configure environment variables
6. Railway auto-detects Python and deploys
7. Get your backend URL: `https://your-backend.railway.app`

#### Option B: Render
1. Go to [render.com](https://render.com)
2. Create new "Web Service"
3. Connect GitHub repo
4. Select branch with backend code
5. Set start command: `uvicorn app.main:app --host 0.0.0.0 --port 8000`
6. Add environment variables
7. Deploy

#### Option C: Keep on Current Hosting
If using o2switch (Phusion Passenger), update:
- Database connection to Supabase
- Environment variables
- Redeploy

---

## PHASE 3: Vercel Frontend Deployment

### Step 1: Connect GitHub to Vercel
1. Go to [vercel.com](https://vercel.com)
2. Click **"New Project"**
3. Import GitHub repository
4. Select the repo with KOZAPP
5. Configure build settings:
   - **Framework Preset**: Next.js (auto-detected)
   - **Root Directory**: `./` (root)
   - **Build Command**: `npm run build` or `pnpm build`
   - **Output Directory**: `.next`

### Step 2: Set Environment Variables in Vercel
1. Go to **Project Settings > Environment Variables**
2. Add these variables (they become `NEXT_PUBLIC_*` for frontend):
   ```env
   NEXT_PUBLIC_API_URL=https://your-backend.railway.app
   NEXT_PUBLIC_SUPABASE_URL=https://[ref].supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
   ```

3. Make sure these match what's in your `lib/api.ts`

### Step 3: Update Frontend API Calls
Check [lib/api.ts](lib/api.ts):
```typescript
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
```
This should work automatically if you set `NEXT_PUBLIC_API_URL` in Vercel.

### Step 4: Configure Custom Domain (Optional)
1. In Vercel: **Settings > Domains**
2. Add your domain
3. Update DNS records as instructed

### Step 5: Deploy
1. Click **Deploy**
2. Vercel builds and deploys automatically
3. Monitor build logs at dashboard
4. Your app is live at: `https://your-project.vercel.app`

---

## PHASE 4: Post-Deployment Testing

### Test Backend API
```bash
curl https://your-backend.railway.app/health
# Should return: {"status":"healthy"}

curl https://your-backend.railway.app/docs
# Should open Swagger API docs
```

### Test Frontend
1. Go to `https://your-domain.com`
2. Test login/auth flow
3. Check browser console for any CORS errors
4. Open DevTools Network tab and verify API calls go to backend

### Test Database Connection
In Supabase:
1. Go to **Table Editor**
2. You should see data appearing (profiles, orders, etc.) as users interact

### Fix Common Issues

#### CORS Errors
If frontend gets CORS errors when calling backend:
1. Backend: Check `ALLOWED_ORIGINS` includes your Vercel domain
2. Example: `ALLOWED_ORIGINS=https://my-app.vercel.app,https://my-domain.com`
3. Redeploy backend

#### Database Connection Fails
- Check `DATABASE_URL` is correct in backend
- Verify Supabase project isn't in sleep mode
- Check IP whitelist if enabled

#### Webhook Not Working (WhatsApp)
- Set `WHATSAPP_VERIFY_TOKEN` in backend
- Update Meta Developers webhook URL to: `https://your-backend.railway.app/api/webhooks/whatsapp`
- Set correct verify token in Meta dashboard

---

## Environment Variables Checklist

### Backend (.env or Vercel/Railway/Render)
- [ ] `DATABASE_URL` - Supabase pooler connection
- [ ] `SUPABASE_URL` - Supabase project URL
- [ ] `SUPABASE_SERVICE_ROLE_KEY` - Service role key
- [ ] `SECRET_KEY` - Generate random 32+ char string
- [ ] `ENVIRONMENT=production`
- [ ] `ALLOWED_ORIGINS` - Include Vercel frontend domain
- [ ] `FRONTEND_URL` - Your Vercel domain
- [ ] `WHATSAPP_VERIFY_TOKEN` - For webhook

### Frontend (Vercel)
- [ ] `NEXT_PUBLIC_API_URL` - Backend URL (Railway/Render/etc)
- [ ] `NEXT_PUBLIC_SUPABASE_URL` - If using Supabase client
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` - If using Supabase client

---

## Deployment Summary

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│  GitHub (Source Code)                             │
│  ├── /app (Next.js) ──────────────→ Vercel         │
│  └── /backend (FastAPI) ──────────→ Railway/Render │
│                                     │               │
│                          ┌──────────┘               │
│                          ↓                          │
│                   Supabase PostgreSQL              │
│                   ├── 11 Tables                    │
│                   ├── RLS Policies                 │
│                   └── Multi-tenant Isolation       │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## Next Steps

1. ✅ Create Supabase project
2. ✅ Run schema in SQL Editor
3. ✅ Copy connection string & API keys
4. ✅ Deploy backend (Railway/Render)
5. ✅ Deploy frontend (Vercel)
6. ✅ Update environment variables
7. ✅ Test all flows
8. ✅ Set up custom domain
9. ✅ Monitor logs and errors
10. ✅ Set up WhatsApp webhook (if needed)

---

## Support

- Supabase Docs: https://supabase.com/docs
- Vercel Docs: https://vercel.com/docs
- Railway Docs: https://docs.railway.app
- FastAPI Docs: https://fastapi.tiangolo.com
