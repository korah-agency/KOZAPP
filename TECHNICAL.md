# Kozapp - Documentation Technique

Guide technique pour les developpeurs et administrateurs systeme.

---

## Architecture

### Stack technique

| Composant | Technologie | Version |
|-----------|-------------|---------|
| Frontend | Next.js (App Router) | 15.x |
| Backend | FastAPI (Python) | 0.115+ |
| Base de donnees | PostgreSQL | 13+ |
| ORM | SQLAlchemy (async + asyncpg) | 2.0+ |
| Auth | JWT (PyJWT) + bcrypt (passlib) | - |
| WhatsApp | WhatsApp Cloud API (Meta) | v21.0 |
| Hebergement | o2switch (Phusion Passenger) | - |

### Architecture multi-tenant

Le systeme est **multi-tenant** : chaque commercant a son propre espace isole. L'isolation est garantie par :

1. **`profile_id`** sur toutes les tables scopees (customers, categories, products, orders, conversations...)
2. **RLS** (Row Level Security) avec variable de session `app.current_profile_id`
3. **JWT** qui identifie le profil authentifie
4. **Role applicatif** `kozapp_app` (sans BYPASSRLS)

```
[Client WhatsApp] --> [WhatsApp Cloud API] --> [Webhook FastAPI] --> [fn_get_profile_id_by_phone_number_id] --> [State Machine] --> [PostgreSQL + RLS]
[Frontend Next.js] --> [REST API FastAPI] --> [JWT + SET LOCAL app.current_profile_id] --> [PostgreSQL + RLS]
```

---

## Base de donnees

### Tables (11)

| Table | Description | Scope |
|-------|-------------|-------|
| `profiles` | Compte commercant (tenant) | - |
| `customers` | Clients WhatsApp | profile_id |
| `categories` | Categories de produits | profile_id |
| `products` | Catalogue | profile_id |
| `negotiation_rules` | Prix plancher / remise max | profile_id |
| `team_members` | Membres invites | profile_id |
| `orders` | Commandes | profile_id |
| `order_items` | Lignes de commande | order_id -> profile_id |
| `order_status_history` | Audit statuts | order_id -> profile_id |
| `whatsapp_conversations` | Sessions bot | profile_id |
| `whatsapp_messages` | Historique messages | conversation_id -> profile_id |

### Vues (6)

| Vue | Usage |
|-----|-------|
| `v_dashboard_stats` | Metrics du tableau de bord |
| `v_daily_sales` | Graphique ventes journalieres |
| `v_top_products` | Produits les plus vendus |
| `v_orders_list` | Liste des commandes |
| `v_customers_list` | Liste des clients + conversations |
| `v_public_catalog` | Catalogue frontend |

### Fonctions (10)

| Fonction | Usage |
|----------|-------|
| `fn_update_updated_at()` | Trigger updated_at |
| `fn_generate_order_number()` | Numerotation auto KOZ-YYYYMMDD-XXXX |
| `fn_update_customer_stats()` | Recalcul compteurs client |
| `fn_update_product_sold_count()` | Recalcul sold_count |
| `fn_log_order_status_change()` | Historique automatique |
| `fn_upsert_customer()` | Creer/maj client par telephone |
| `fn_create_order()` | Creer commande avec items |
| `fn_update_order_status()` | Changer statut |
| `fn_search_products()` | Recherche floue (trigram) |
| `fn_get_profile_id_by_phone_number_id()` | Routage webhook (SECURITY DEFINER) |

### Triggers (10)

- `trg_*_updated_at` : Mise a jour auto de `updated_at` (6 tables)
- `trg_generate_order_number` : Numerotation auto avant INSERT
- `trg_update_customer_stats` : Recalcul apres INSERT/UPDATE/DELETE orders
- `trg_update_product_sold` : Recalcul apres INSERT/UPDATE/DELETE order_items
- `trg_log_status_change` : Log apres UPDATE status

### Connexion

**SQLAlchemy async (utilise)** :
```
DATABASE_URL=postgresql+asyncpg://kozapp_app:password@localhost:5432/kozapp_dev
```

**Supabase (pooler)** :
```
DATABASE_URL=postgresql+asyncpg://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres
```

---

## Authentification et RLS

### Flux JWT

1. **Register/Login** : le backend verifie les credentials, genere un JWT contenant `sub: profile_id`
2. **Requetes API** : le frontend envoie `Authorization: Bearer <token>`
3. **`get_current_profile()`** : decode le JWT, charge le profile, execute `SET LOCAL app.current_profile_id = '<uuid>'`
4. **RLS** : chaque policy filtre sur `current_setting('app.current_profile_id')`

### Mots de passe

Bcrypt via `passlib` : `hash_password()` / `verify_password()` dans `deps.py`.

### Routes protegees

Toutes les routes `/api/*` (sauf `/api/auth/register` et `/api/auth/login`) necessitent un header `Authorization: Bearer <jwt>`.

---

## Machine a etats WhatsApp

```
idle --> awaiting_product_choice --> awaiting_quantity --> awaiting_delivery_address --> awaiting_confirmation --> order_active
```

| Etat | Actions | Transitions |
|------|---------|-------------|
| `idle` | Salutations, menu, aide, suivi | --> `awaiting_product_choice` |
| `awaiting_product_choice` | Affiche catalogue, attend numero | --> `awaiting_quantity` |
| `awaiting_quantity` | Demande quantite | --> `awaiting_delivery_address` |
| `awaiting_delivery_address` | Demande adresse | --> `awaiting_confirmation` |
| `awaiting_confirmation` | Resume, attend oui/non | --> `order_active` ou `idle` |
| `order_active` | Questions post-commande | --> `idle` |

### Routage webhook multi-tenant

Le webhook WhatsApp utilise `fn_get_profile_id_by_phone_number_id()` (SECURITY DEFINER) pour identifier le profil proprietaire du numero WhatsApp qui recoit le message, AVANT toute authentification.

---

## Endpoints API

### Auth

| Methode | Endpoint | Body | Reponse |
|---------|----------|------|---------|
| POST | `/api/auth/register` | `{email, password, shop_name, activity_type}` | `{access_token}` |
| POST | `/api/auth/login` | `{email, password}` | `{access_token}` |
| GET | `/api/auth/me` | - | `ProfileRead` |

### Commandes

| Methode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/orders` | Liste (page, page_size, order_status) |
| GET | `/api/orders/{id}` | Detail avec items et client |
| PATCH | `/api/orders/{id}/status` | `{status}` - Statuts: pending, confirmed, delivering, delivered, cancelled |

### Produits

| Methode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/products` | Liste (category_id, is_available) |
| GET | `/api/products/{id}` | Detail |
| POST | `/api/products` | `{name, price, category_id, ...}` |
| PATCH | `/api/products/{id}` | Modification |
| DELETE | `/api/products/{id}` | Soft delete (is_available=false) |

### Categories

| Methode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/categories` | Liste |
| POST | `/api/categories` | `{name, slug?, display_order}` |

### Clients

| Methode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/customers` | Liste (page, page_size, search) |
| GET | `/api/customers/{id}` | Detail |
| PATCH | `/api/customers/{id}` | Modification |

### Analytics

| Methode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/analytics/daily-sales` | Ventes journalieres (days) |
| GET | `/api/analytics/top-products` | Top produits (limit) |
| GET | `/api/analytics/summary` | Resume global |

### Negotiation

| Methode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/negotiation-rules` | Liste des regles |
| PUT | `/api/negotiation-rules/{product_id}` | Upsert: `{is_negotiable, floor_price, max_discount_pct}` |

### Team

| Methode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/team` | Liste membres |
| POST | `/api/team` | `{email, name?, role}` |
| DELETE | `/api/team/{id}` | Retirer |

### Webhook

| Methode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/webhooks/whatsapp` | Verification Meta (hub_challenge) |
| POST | `/webhooks/whatsapp` | Reception messages/statuts |

### Sante

| Methode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/health` | `{status: "healthy"}` |

---

## Securite

1. **JWT** : authentification stateless, expiree apres 7 jours
2. **RLS** : isolation multi-tenant par variable de session
3. **Role `kozapp_app`** : role applicatif sans BYPASSRLS
4. **Bcrypt** : hashage des mots de passe
5. **CORS** : origines configurees via `ALLOWED_ORIGINS`
6. **Rate limiting** : slowapi avec cle par adresse IP
7. **HTTPS** : obligatoire pour les webhooks Meta (gere par o2switch)
8. **Pas de token global** : les tokens WhatsApp sont propres a chaque tenant (dans `profiles`)

---

## Hebergement o2switch

| Parametre | Valeur |
|-----------|--------|
| Python version | 3.12 |
| Application root | `/home/user/backend` |
| Startup file | `passenger_wsgi.py` |
| Entry point | `application` |

Le pont `a2wsgi` convertit l'ASGI FastAPI en WSGI pour Passenger.

---

## Developpement local

### Backend

```bash
cd backend
python3.12 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
createdb kozapp_dev
psql kozapp_dev < ../schema_supabase_whatsapp_orders.sql
uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
pnpm install
pnpm dev
```

### Tests

```bash
pnpm lint    # Frontend
pnpm build   # Frontend
```

---

## Structure backend

```
backend/
├── passenger_wsgi.py
├── requirements.txt
├── .env.example
└── app/
    ├── main.py                    # FastAPI + middleware
    ├── config.py                  # Settings (JWT, DB, WhatsApp)
    ├── database.py                # Engine async + sessions
    ├── models/
    │   ├── profile.py             # Compte commercant
    │   ├── customer.py            # Client WhatsApp
    │   ├── category.py            # Categorie produit
    │   ├── product.py             # Produit
    │   ├── negotiation_rule.py    # Regle negociation
    │   ├── team_member.py         # Membre equipe
    │   ├── order.py               # Commande + items
    │   ├── order_status_history.py
    │   ├── whatsapp_conversation.py
    │   └── whatsapp_message.py
    ├── schemas/
    │   ├── auth.py                # Register, Login, Token
    │   ├── profile.py             # ProfileRead
    │   ├── customer.py
    │   ├── category.py
    │   ├── product.py
    │   ├── negotiation.py
    │   ├── team.py
    │   ├── order.py
    │   ├── whatsapp.py
    │   └── analytics.py
    ├── api/
    │   ├── deps.py                # JWT, RLS session, hash
    │   ├── auth.py                # /api/auth/*
    │   ├── webhooks.py            # /webhooks/*
    │   ├── orders.py              # /api/orders/*
    │   ├── products.py            # /api/products/*
    │   ├── categories.py          # /api/categories/*
    │   ├── customers.py           # /api/customers/*
    │   ├── analytics.py           # /api/analytics/*
    │   ├── negotiation.py         # /api/negotiation-rules/*
    │   └── team.py                # /api/team/*
    ├── services/
    │   ├── whatsapp.py            # Envoi messages Cloud API
    │   ├── order_service.py
    │   └── analytics_service.py
    └── utils/
        └── slug.py                # slugify()
```

---

## Format des reponses API

### TokenResponse
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs..."
}
```

### OrderRead
```json
{
  "id": "uuid",
  "order_number": "KOZ-20260812-0001",
  "status": "pending",
  "total_amount": 7000.0,
  "currency": "XAF",
  "delivery_neighborhood": "Bonapriso",
  "created_at": "2026-08-12T14:20:00Z",
  "customer": {"id": "uuid", "name": "Nadine M.", "whatsapp_phone": "237690000000"},
  "items": [{"product_name": "Kozapp Burger", "quantity": 2, "unit_price": 3500.0, "subtotal": 7000.0}]
}
```

### AnalyticsSummary
```json
{
  "total_orders": 128,
  "total_revenue": 486500.0,
  "total_customers": 86,
  "average_order_value": 3800.78,
  "daily_sales": [...],
  "top_products": [...]
}
```
