# Supabase Setup - Step by Step

## 1️⃣ Create Supabase Project

### Go to https://supabase.com
1. Click **"New Project"**
2. Fill in:
   - **Name**: `kozapp` (or `kozapp-prod`)
   - **Database Password**: Save this! (you won't see it again)
   - **Region**: Pick the closest to your users (EU, US, etc.)
3. Click **"Create new project"**
4. ⏳ Wait 2-3 minutes for initialization

---

## 2️⃣ Deploy Your Database Schema

### In Supabase Dashboard:
1. Click **"SQL Editor"** (left sidebar)
2. Click **"New Query"**
3. Paste the entire content from your file:
   ```
   /KOZAPP/schema_supabase_whatsapp_orders.sql
   ```
4. Click **"Run"** (top right)
5. ✅ Wait for completion (should see "11 tables created" or similar)

### Verify Tables Created:
1. Go to **"Table Editor"** (left sidebar)
2. You should see all 11 tables:
   - profiles
   - customers
   - categories
   - products
   - negotiation_rules
   - team_members
   - orders
   - order_items
   - whatsapp_conversation
   - whatsapp_message
   - order_status_history

---

## 3️⃣ Get Your Database Connection String

### Method 1: Using Connection Pooler (RECOMMENDED for asyncpg)

1. Click **"Settings"** (bottom left)
2. Click **"Database"**
3. Scroll to **"Connection pooling"**
4. Make sure **Mode** is set to **"Transaction"**
5. Copy the connection string starting with `postgresql://`
6. It will look like:
   ```
   postgresql://postgres.[YOUR_REF]:[YOUR_PASSWORD]@aws-0-eu-west-1.pooler.supabase.com:5432/postgres
   ```

### Convert to asyncpg format for backend:
Replace `postgresql://` with `postgresql+asyncpg://`:
```
postgresql+asyncpg://postgres.[YOUR_REF]:[YOUR_PASSWORD]@aws-0-eu-west-1.pooler.supabase.com:5432/postgres
```

**This is your `DATABASE_URL` for backend!**

---

## 4️⃣ Get Your API Keys

### In Supabase Dashboard:
1. Click **"Settings"** (bottom left)
2. Click **"API"**
3. Under **"URLs"**, copy:
   - **Project URL**: `https://[YOUR_REF].supabase.co`
   - Example: `https://iwosikiamgolkgsrkdnj.supabase.co`

4. Under **"Project API Keys"**, copy:
   - **Anon Key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (public)
   - **Service Role Key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (SECRET - keep safe!)

---

## 5️⃣ Check Row Level Security (RLS)

### In Supabase Dashboard:
1. Click **"Authentication"** (left sidebar)
2. Click **"Policies"**
3. Select each table and verify RLS policies exist
4. You should see policies that reference `app.current_profile_id`

**This is automatic from the schema** - just verify it's there.

---

## 6️⃣ Your Supabase Credentials Summary

Save these credentials securely (password manager, etc):

```
PROJECT_NAME: kozapp
PROJECT_URL: https://[YOUR_REF].supabase.co
PROJECT_REF: [YOUR_REF]
DATABASE_PASSWORD: [saved-when-creating-project]

CONNECTION_STRING (for backend):
postgresql+asyncpg://postgres.[YOUR_REF]:[YOUR_PASSWORD]@aws-0-eu-west-1.pooler.supabase.com:5432/postgres

API KEYS:
SUPABASE_ANON_KEY: eyJ...
SUPABASE_SERVICE_ROLE_KEY: eyJ...
```

---

## 7️⃣ Next: Environment Variables for Backend

Once Supabase is ready, use these for your backend deployment:

```env
# This is the most important one
DATABASE_URL=postgresql+asyncpg://postgres.[YOUR_REF]:[YOUR_PASSWORD]@aws-0-eu-west-1.pooler.supabase.com:5432/postgres

# These are optional (only if using Supabase client features)
SUPABASE_URL=https://[YOUR_REF].supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Application settings
ENVIRONMENT=production
SECRET_KEY=generate_a_random_string_here_32_chars_minimum
ALLOWED_ORIGINS=https://your-vercel-domain.vercel.app
FRONTEND_URL=https://your-vercel-domain.vercel.app
WHATSAPP_VERIFY_TOKEN=your_unique_token_here
WHATSAPP_API_VERSION=v21.0
```

---

## ✅ Supabase Checklist

- [ ] Created project on supabase.com
- [ ] Project initialized (wait 2-3 min)
- [ ] Ran schema from `schema_supabase_whatsapp_orders.sql`
- [ ] Verified 11 tables created
- [ ] Copied connection string (pooler)
- [ ] Copied Project URL
- [ ] Copied Anon Key
- [ ] Copied Service Role Key
- [ ] Verified RLS policies exist
- [ ] Saved credentials securely

---

## Common Mistakes to Avoid

❌ **Don't use**: `postgresql://` connection string
✅ **Do use**: `postgresql+asyncpg://` for backend

❌ **Don't expose**: Service Role Key in frontend
✅ **Do keep it** only in backend environment variables

❌ **Don't forget**: to set `ALLOWED_ORIGINS` when deploying
✅ **Do include** your Vercel domain

❌ **Don't skip** RLS verification
✅ **Do verify** policies are in place (automatic from schema)

---

## Troubleshooting

### "Connection refused" error
- Check DATABASE_URL is correct
- Verify using pooler connection (ends with `.pooler.supabase.com`)
- Check Supabase project status (might be hibernating - wake it up)

### "Role '...' does not exist" error
- Schema creates role `kozapp_app` automatically
- Make sure full schema ran successfully
- Check in Supabase Table Editor that tables exist

### Can't see tables in Table Editor
- Re-run schema in SQL Editor
- Check for error messages in SQL output
- Make sure full schema.sql file was copied

---

## Next Steps

1. ✅ Complete Supabase setup (this file)
2. → Deploy backend (Railway/Render/o2switch)
3. → Deploy frontend (Vercel)
4. → Test everything works

See `DEPLOYMENT.md` or `DEPLOYMENT-CHECKLIST.md` for backend & frontend steps.
