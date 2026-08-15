# Commandes manuelles a effectuer

Guide etape par etape pour mettre en place Kozapp.

---

## ETAPE 1 : Base de donnees PostgreSQL

### Option A : Supabase (recommande)

1. Aller sur [supabase.com](https://supabase.com) et creer un compte
2. Cliquer sur **New Project**
3. Choisir un nom de projet et un mot de passe de base de donnees
4. Noter le **mot de passe** (a conserver) : `@aURELIEN200`
5. Attendre que le projet soit cree (~2 min)
6. Aller dans **SQL Editor**
7. Copier le contenu complet du fichier `schema_supabase_whatsapp_orders.sql`
8. Coller dans l'editeur et cliquer sur **Run**
9. Verifier que les 11 tables sont creees (onglet **Table Editor**)
10. Aller dans **Settings > API** et copier :
    - **Project URL** (ex: `https://xxxxx.supabase.co`) : `https://iwosikiamgolkgsrkdnj.supabase.co``
    - **service_role** key (a garder secrete) : `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml3b3Npa2lhbWdvbGtnc3JrZG5qIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NjQzNzAyOCwiZXhwIjoyMTAyMDEzMDI4fQ.jB9eqCOOqY-pb_DItlfvTCOeeAsad9zW6hdi9Rx98dA`
11. Aller dans **Settings > Database > Connection string** et copier l'**URI** : `URI Site`
    - Pour le pooler asyncpg : utiliser `aws-0-[region].pooler.supabase.com:5432`

### Option B : Postgres local

```bash
createdb kozapp_dev
psql kozapp_dev < schema_supabase_whatsapp_orders.sql
```

Le role `kozapp_app` est cree automatiquement par le script SQL.

---

## ETAPE 2 : Meta for Developers (WhatsApp Cloud API)

1. Aller sur [developers.facebook.com](https://developers.facebook.com)
2. Creer un compte developpeur si besoin
3. Cliquer sur **My Apps > Create App**
4. Choisir **Business** comme type
5. Remplir le nom de l'app et le contact email
6. Dans le tableau de bord, activer **WhatsApp**
7. Aller dans **WhatsApp > Configuration**
8. Noter le **Phone Number ID** (ex: `1234567890`)
9. Aller dans **WhatsApp > API Setup**
10. Copier le **Temporary access token** (pour les tests)
11. Pour le token permanent : **System Users > Generate Token**

> Note : le token et le phone_number_id seront stockes dans `profiles` (un par commercant), pas dans les variables d'environnement.

---

## ETAPE 3 : Configuration locale

```bash
# 1. Cloner le repo
git clone <url-du-repo>
cd KOZAPP

# 2. Backend
cd backend
python3.12 -m venv venv
source venv/bin/activate  # Linux/Mac
pip install -r requirements.txt
cp .env.example .env
```

Editer `backend/.env` :

```env
# Postgres local
DATABASE_URL=postgresql+asyncpg://kozapp_app:change_me_kozapp_app_dev@localhost:5432/kozapp_dev

# Supabase (alternative)
# DATABASE_URL=postgresql+asyncpg://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres

# WhatsApp (verify token global)
WHATSAPP_VERIFY_TOKEN=mon_token_secret_de_verification
WHATSAPP_API_VERSION=v21.0

# App
ENVIRONMENT=development
SECRET_KEY=generer_une_cle_longue_et_secrete_ici
ALLOWED_ORIGINS=http://localhost:3000
```

---

## ETAPE 4 : Tester le backend

```bash
uvicorn app.main:app --reload --port 8000
```

Verifier :
- `http://localhost:8000/health` --> `{"status":"healthy"}`
- `http://localhost:8000/docs` --> Swagger UI

Tester l'inscription :
```bash
curl -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@kozapp.com","password":"secret123","shop_name":"Ma Boutique","activity_type":"restauration"}'
```

---

## ETAPE 5 : Tester le frontend

```bash
cd ..
pnpm install
pnpm dev
```

Verifier :
- `http://localhost:3000` --> Page d'accueil
- `http://localhost:3000/auth` --> Page de connexion

---

## ETAPE 6 : Deploiement sur o2switch

### 6.1 Upload

```bash
tar -czf kozapp-backend.tar.gz backend/
```

Ou via FTP/SFTP : uploader `backend/` dans `/home/votre-user/`.

### 6.2 Configuration cPanel

1. cPanel > **Setup Python App**
2. **Create Application** :
   - Python version : 3.12
   - Application root : `/home/votre-user/backend`
   - Startup file : `passenger_wsgi.py`
   - Entry point : `application`
3. **Create**
4. **Environment variables** : ajouter chaque variable du `.env`
5. Terminal SSH :
   ```bash
   source /home/votre-user/virtualenv/backend/3.12/bin/activate
   cd /home/votre-user/backend
   pip install -r requirements.txt
   ```

### 6.3 SSL

Verifier le SSL actif (Let's Encrypt via cPanel > SSL/TLS) -- obligatoire pour les webhooks Meta.

---

## ETAPE 7 : Configuration du webhook WhatsApp

1. Meta for Developers > WhatsApp > Configuration
2. **Callback URL** : `https://api.votredomaine.com/webhooks/whatsapp`
3. **Verify Token** : meme valeur que `WHATSAPP_VERIFY_TOKEN`
4. **Verify and Save**
5. S'abonner au champ **messages**

---

## ETAPE 8 : Frontend en production

```bash
pnpm build
```

Uploider le dossier `.next/` ou deployer sur Vercel/Netlify.

---

## ETAPE 9 : Verification finale

1. Creer un compte via `/auth`
2. Passer par l'onboarding (activite, boutique, zone, WhatsApp)
3. Envoyer "Bonjour" a votre numero WhatsApp
4. Verifier que le bot repond avec le menu
5. Passer une commande complete via WhatsApp
6. Verifier que la commande apparait dans le dashboard
7. Tester les analytics, le catalogue, les settings

---

## Commandes utiles

```bash
# Backend dev
cd backend && uvicorn app.main:app --reload --port 8000

# Frontend dev
pnpm dev

# Build
pnpm build

# Lint
pnpm lint

# Logs o2switch
# cPanel > Setup Python App > Logs
```

---

## Depannage

| Probleme | Solution |
|----------|----------|
| `ModuleNotFoundError` | Activer le venv : `source venv/bin/activate` |
| `Connection refused` DB | Verifier `DATABASE_URL` dans `.env` |
| Webhook WhatsApp non recu | Verifier SSL + URL callback |
| 403 sur le webhook | Verifier `WHATSAPP_VERIFY_TOKEN` |
| `Passenger error` | Verifier `passenger_wsgi.py` + dependances |
| Frontend ne charge pas | Verifier `pnpm dev` actif |
| `JWT error` | Verifier `SECRET_KEY` identique partout |
| RLS bloque les requetes | Verifier que `SET LOCAL app.current_profile_id` est appele |
