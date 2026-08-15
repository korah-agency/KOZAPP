# 🚀 Quick Start: Deploy to Supabase + Vercel

## Right Now - The Immediate Plan

Your app has 3 parts that need deploying:
1. **Database** → Supabase (PostgreSQL cloud)
2. **Backend** → Railway/Render (Python FastAPI)
3. **Frontend** → Vercel (Next.js)

---

## ⏱️ TODAY: 15 Minutes

### Step 1: Create Supabase Project & Deploy Database

**Time: 10 minutes**

1. Go to https://supabase.com
2. Create new project
3. Go to **SQL Editor**
4. Copy/paste entire file: `schema_supabase_whatsapp_orders.sql`
5. Run it
6. Go to **Settings > Database > Connection pooling**
7. Copy the connection string
8. Go to **Settings > API**
9. Copy Project URL and Service Role Key

**Result**: You have your database + credentials ✅

### Step 2: Deploy Backend

**Time: 5 minutes** (choose ONE)

#### Option A: Railway (Recommended)
1. Go to https://railway.app
2. Connect GitHub
3. Deploy your repo
4. Add environment variables (see below)
5. Get your backend URL: `https://your-backend.railway.app`

#### Option B: Render
1. Go to https://render.com
2. New Web Service > GitHub
3. Set start command: `uvicorn app.main:app --host 0.0.0.0 --port 8000`
4. Add environment variables (see below)

**What backend needs** (environment variables):
```
DATABASE_URL=postgresql+asyncpg://postgres.[REF]:[PASSWORD]@aws-0-eu-west-1.pooler.supabase.com:5432/postgres
ENVIRONMENT=production
SECRET_KEY=generate_random_string_here
ALLOWED_ORIGINS=https://your-domain.vercel.app
FRONTEND_URL=https://your-domain.vercel.app
WHATSAPP_VERIFY_TOKEN=your_token
WHATSAPP_API_VERSION=v21.0
```

**Result**: Backend deployed ✅

---

## 🎯 STEP 2: Deploy Frontend to Vercel

**Time: 5 minutes**

1. Go to https://vercel.com
2. Import GitHub repository
3. Click Deploy
4. After deploy, go to **Settings > Environment Variables**
5. Add:
   ```
   NEXT_PUBLIC_API_URL=https://your-backend-url.railway.app
   NEXT_PUBLIC_SUPABASE_URL=https://[REF].supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
   ```
6. Redeploy from dashboard

**Result**: Frontend live at https://your-project.vercel.app ✅

---

## 🧪 Test Everything Works

```bash
# 1. Test backend
curl https://your-backend.railway.app/health
# Should return: {"status":"healthy"}

# 2. Visit frontend
# Should load without errors in console
https://your-project.vercel.app

# 3. Check Network tab in DevTools
# API calls should go to your-backend.railway.app
```

---

## 📋 Critical Environment Variables

### Backend (.env or Railway/Render)
```env
DATABASE_URL=postgresql+asyncpg://postgres.[REF]:[PASSWORD]@aws-0-eu-west-1.pooler.supabase.com:5432/postgres
ENVIRONMENT=production
SECRET_KEY=MyRandomSecretKey123456789012345
ALLOWED_ORIGINS=https://my-app.vercel.app
FRONTEND_URL=https://my-app.vercel.app
WHATSAPP_VERIFY_TOKEN=my_verify_token
WHATSAPP_API_VERSION=v21.0
```

### Frontend (Vercel Environment Variables)
```env
NEXT_PUBLIC_API_URL=https://your-backend.railway.app
NEXT_PUBLIC_SUPABASE_URL=https://your_ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

---

## 🔑 Getting Your Credentials

### From Supabase:
1. **Settings > Database > Connection pooling**
   - Copy: `postgresql://postgres.YOURREF:PASSWORD@aws-0-REGION.pooler.supabase.com:5432/postgres`
   - Replace `postgresql://` with `postgresql+asyncpg://`

2. **Settings > API**
   - Copy: Project URL (ex: `https://iwosikiamgolkgsrkdnj.supabase.co`)
   - Copy: Anon Key
   - Copy: Service Role Key

### From Railway/Render:
- Your backend URL will be shown after deployment
- Example: `https://your-backend-123456.railway.app`

---

## ⚠️ Important Notes

1. **Database Connection**: 
   - MUST use `postgresql+asyncpg://` NOT `postgresql://`
   - MUST use `.pooler.supabase.com` (connection pooler)
   
2. **Environment Variables**:
   - Backend: Set in Railway/Render/your hosting
   - Frontend: Set in Vercel Project Settings
   - Prefix frontend vars with `NEXT_PUBLIC_` (already done in code)

3. **CORS**:
   - Must add Vercel domain to `ALLOWED_ORIGINS` on backend
   - Otherwise frontend will get CORS errors

4. **Keep Secrets Safe**:
   - Never commit `.env` to GitHub
   - Never expose Service Role Key in frontend
   - Use environment variables instead

---

## 🐛 If Something Goes Wrong

### "Cannot connect to database"
- Check DATABASE_URL is correct
- Check using pooler (`.pooler.supabase.com`)
- Wake up Supabase project if sleeping

### "CORS error in console"
- Add Vercel domain to backend `ALLOWED_ORIGINS`
- Restart backend

### "Frontend can't reach API"
- Check `NEXT_PUBLIC_API_URL` in Vercel
- Check backend URL is correct
- Test with: `curl https://backend-url/health`

---

## 📚 Full Documentation

For more details, see:
- [SUPABASE-SETUP.md](SUPABASE-SETUP.md) - Detailed Supabase setup
- [DEPLOYMENT.md](DEPLOYMENT.md) - Complete deployment guide
- [DEPLOYMENT-CHECKLIST.md](DEPLOYMENT-CHECKLIST.md) - Full checklist

---

## 📊 Final Architecture

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│  Your GitHub Repo                                  │
│  ├─ /app → Vercel                                 │
│  │   └─ https://your-project.vercel.app           │
│  │                                                  │
│  ├─ /backend → Railway                            │
│  │   └─ https://your-backend.railway.app          │
│  │                                                  │
│  └─ schema_supabase_whatsapp_orders.sql           │
│      ↓                                              │
│      Supabase PostgreSQL                           │
│      └─ https://your_ref.supabase.co              │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## ✅ Deployment Checklist

- [ ] Created Supabase project
- [ ] Deployed database schema
- [ ] Copied connection string from Supabase
- [ ] Deployed backend to Railway/Render
- [ ] Deployed frontend to Vercel
- [ ] Set environment variables in backend
- [ ] Set environment variables in Vercel
- [ ] Tested backend: `/health` endpoint works
- [ ] Tested frontend: loads without errors
- [ ] Tested API calls: reach backend successfully

---

**You got this! 🎉**

Once done:
1. Your frontend is at: `https://your-project.vercel.app`
2. Your backend is at: `https://your-backend.railway.app`
3. Your database is at: Supabase (managed for you)

Ready to help with any issues!
