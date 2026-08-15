# Kozapp

**Pilotez votre boutique WhatsApp en toute simplicite.**

Kozapp est une solution multi-tenant qui transforme votre compte WhatsApp Business en boutique en ligne. Vos clients commandent directement par WhatsApp, vous administrez tout depuis un tableau de bord web.

---

## Fonctionnalites

- **Commandes WhatsApp** : Le bot guide vos clients du menu a la confirmation
- **Tableau de bord** : Ventes, commandes et clients en temps reel
- **Catalogue** : Produits, categories, gestion des prix et disponibilites
- **Agent IA** : Configuration du ton, de la langue et des messages d'accueil
- **Negociation** : Prix plancher et remises max par produit
- **Equipe** : Invitation de membres sur votre boutique
- **Relances** : Regles automatiques pour recuperer les ventes
- **Parametres** : Boutique, equipe, langue, compte

---

## Comment ca marche ?

1. **Votre client vous ecrit sur WhatsApp** (ex: "Bonjour")
2. **Le bot repond automatiquement** avec le menu et les produits
3. **Le client choisit son produit**, la quantite, et son adresse
4. **La commande est confirmee** et apparait sur votre tableau de bord
5. **Vous validez et livrez** depuis l'interface web

---

## Installation

### Prérequis

- Python 3.11 ou 3.12
- Node.js 18+ (frontend)
- PostgreSQL 13+ (local ou Supabase)
- Compte [Meta for Developers](https://developers.facebook.com) (WhatsApp Cloud API)

### 1. Base de donnees

**Option A : Supabase (recommande)**

1. Creer un projet sur [supabase.com](https://supabase.com)
2. Ouvrir l'**SQL Editor**
3. Coller le contenu de `schema_supabase_whatsapp_orders.sql`
4. Cliquer sur **Run**
5. Copier la **Project URL** et la **service_role key**

**Option B : Postgres local**

```bash
createdb kozapp_dev
psql kozapp_dev < schema_supabase_whatsapp_orders.sql
```

### 2. Backend API

```bash
cd backend
python3.12 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Editer .env avec vos valeurs
uvicorn app.main:app --reload --port 8000
```

API disponible sur `http://localhost:8000`
Documentation Swagger : `http://localhost:8000/docs`

### 3. Frontend

```bash
pnpm install
pnpm dev
```

Frontend disponible sur `http://localhost:3000`

---

## Deployment

### Backend sur o2switch

1. Uploadez le dossier `backend/` via FTP/SFTP
2. cPanel > **Setup Python App** > **Create Application**
   - Python : 3.12
   - Application root : `/home/user/backend`
   - Startup file : `passenger_wsgi.py`
   - Entry point : `application`
3. Installer les dependances (terminal SSH)
4. Configurer les variables d'environnement
5. Redmarrer l'application

### Webhook WhatsApp

1. Meta for Developers > WhatsApp > Configuration
2. **Callback URL** : `https://api.votredomaine.com/webhooks/whatsapp`
3. **Verify Token** : meme valeur que `WHATSAPP_VERIFY_TOKEN` dans `.env`
4. S'abonner au champ **messages**

---

## Structure du projet

```
KOZAPP/
├── app/                              # Frontend Next.js 15 (App Router)
│   ├── auth/page.tsx                 # Inscription / connexion
│   ├── onboarding/page.tsx           # Parcours de configuration (4 etapes)
│   └── page.tsx                      # Dashboard (8 vues internes)
├── backend/                          # Backend FastAPI (Python)
│   ├── passenger_wsgi.py             # Point d'entree o2switch
│   ├── requirements.txt
│   ├── .env.example
│   └── app/
│       ├── main.py                   # FastAPI + CORS + rate limiting
│       ├── config.py                 # Settings (pydantic-settings + JWT)
│       ├── database.py               # SQLAlchemy async + sessions
│       ├── models/                   # 10 modeles ORM
│       ├── schemas/                  # 9 schemas Pydantic
│       ├── api/                      # 10 routeurs
│       │   ├── auth.py               # Register / login / me
│       │   ├── webhooks.py           # WhatsApp webhook
│       │   ├── orders.py             # CRUD commandes
│       │   ├── products.py           # CRUD produits
│       │   ├── categories.py         # CRUD categories
│       │   ├── customers.py          # Liste clients
│       │   ├── analytics.py          # Statistiques
│       │   ├── negotiation.py        # Regles de negociation
│       │   ├── team.py               # Gestion equipe
│       │   └── deps.py               # Auth JWT + RLS session
│       ├── services/                 # Logique metier
│       └── utils/slug.py             # Generation de slugs
├── schema_supabase_whatsapp_orders.sql  # Schema BDD (796 lignes)
├── README.md
├── TECHNICAL.md
└── COMMANDES.md
```

---

## Variables d'environnement

Voir `backend/.env.example`. Variables principales :

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | URL PostgreSQL (asyncpg) |
| `SECRET_KEY` | Cle secrete pour JWT |
| `WHATSAPP_VERIFY_TOKEN` | Token de verification du webhook Meta |
| `WHATSAPP_API_VERSION` | Version de l'API WhatsApp (defaut: v21.0) |

> Les tokens WhatsApp (`whatsapp_token`) et `phone_number_id` sont propres a chaque commercant, stockes dans la table `profiles`.

---

## API Endpoints

| Methode | Endpoint | Description |
|---------|----------|-------------|
| POST | `/api/auth/register` | Inscription |
| POST | `/api/auth/login` | Connexion (JWT) |
| GET | `/api/auth/me` | Profil connecte |
| GET | `/webhooks/whatsapp` | Verification webhook Meta |
| POST | `/webhooks/whatsapp` | Reception messages WhatsApp |
| GET | `/api/orders` | Liste commandes |
| GET | `/api/orders/{id}` | Detail commande |
| PATCH | `/api/orders/{id}/status` | Changer statut |
| GET | `/api/products` | Catalogue |
| POST | `/api/products` | Ajouter produit |
| PATCH | `/api/products/{id}` | Modifier produit |
| DELETE | `/api/products/{id}` | Desactiver produit |
| GET | `/api/categories` | Liste categories |
| POST | `/api/categories` | Ajouter categorie |
| GET | `/api/customers` | Liste clients |
| GET | `/api/analytics/daily-sales` | Ventes journalieres |
| GET | `/api/analytics/top-products` | Top produits |
| GET | `/api/analytics/summary` | Resume global |
| GET | `/api/negotiation-rules` | Regles de negociation |
| PUT | `/api/negotiation-rules/{product_id}` | Upsert regle |
| GET | `/api/team` | Liste equipe |
| POST | `/api/team` | Inviter membre |
| DELETE | `/api/team/{id}` | Retirer membre |
| GET | `/health` | Sante API |

---

## Licence

Propritaire - Kozapp
# KOZAPP
