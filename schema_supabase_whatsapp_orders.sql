-- ============================================================
-- KOZAPP - Schema PostgreSQL
-- Systeme de commande WhatsApp pour restaurants/boutiques
-- Version: 3.0 (multi-tenant : profile_id + RLS par session)
-- ============================================================

-- Compatible Supabase (schema "extensions") et Postgres local classique.
-- Sur Postgres local, extensions.uuid_generate_v4() n'existe pas :
-- ce script utilise gen_random_uuid() (module pgcrypto, disponible
-- nativement depuis Postgres 13) qui fonctionne dans les deux cas.

-- Sommaire :
--   1. Extensions
--   2. Types enum
--   3. Tables (avec profile_id sur toutes les tables scopees a une boutique)
--   4. Index
--   5. Vues
--   6. Fonctions
--   7. Triggers
--   8. RLS (isolation par variable de session app.current_profile_id)
--   9. Role applicatif dedie (sans BYPASSRLS)
--   10. Seed
-- ============================================================


-- ============================================================
-- 1. EXTENSIONS
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;


-- ============================================================
-- 2. TYPES ENUM
-- ============================================================

DO $$ BEGIN
    CREATE TYPE order_status AS ENUM (
        'pending',      -- Nouvelle
        'confirmed',    -- Validee
        'delivering',   -- En livraison
        'delivered',    -- Livree
        'cancelled'     -- Annulee
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE message_direction AS ENUM ('incoming', 'outgoing');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE conversation_state AS ENUM (
        'idle',
        'awaiting_product_choice',
        'awaiting_quantity',
        'awaiting_delivery_address',
        'awaiting_confirmation',
        'order_active',
        'closed'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ============================================================
-- 3. TABLES
-- ============================================================

-- -----------------------------------------------------------
-- 3.1 PROFILES (Compte commercant = une boutique = un tenant)
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS profiles (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email                   VARCHAR(255) UNIQUE NOT NULL,
    password_hash           TEXT NOT NULL,
    shop_name               VARCHAR(255) NOT NULL DEFAULT '',
    shop_description        TEXT,
    phone                   VARCHAR(50),
    activity_type           VARCHAR(50) DEFAULT 'restauration',
    city                    VARCHAR(100),
    delivery_zones          TEXT,
    address                 TEXT,
    hours                   TEXT,
    whatsapp_number         VARCHAR(50),
    whatsapp_phone_number_id VARCHAR(50),   -- ID Meta du numero WABA de CE commercant (Embedded Signup)
    whatsapp_token          TEXT,           -- Token d'acces WhatsApp Cloud API propre a CE commercant
    agent_tone              VARCHAR(50) DEFAULT 'Chaleureux',
    agent_language          VARCHAR(10) DEFAULT 'fr',
    agent_welcome           TEXT,
    agent_info               TEXT,
    plan                    VARCHAR(20) NOT NULL DEFAULT 'decouverte'
                             CHECK (plan IN ('decouverte', 'starter', 'business', 'scale')),
    reset_token_hash        VARCHAR(64),   -- SHA-256 du token de reinitialisation, jamais le token en clair
    reset_token_expires_at  TIMESTAMPTZ,
    is_active               BOOLEAN NOT NULL DEFAULT TRUE,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE profiles IS 'Compte commercant (un tenant = une boutique)';
COMMENT ON COLUMN profiles.whatsapp_phone_number_id IS 'Cle de routage du webhook Meta vers ce profil';

-- -----------------------------------------------------------
-- 3.2 CUSTOMERS (Clients via WhatsApp, scopes par boutique)
-- -----------------------------------------------------------
-- Un meme numero WhatsApp peut ecrire a plusieurs boutiques Kozapp :
-- l'unicite se fait donc sur (profile_id, whatsapp_phone), pas sur le
-- numero seul.
CREATE TABLE IF NOT EXISTS customers (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id        UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    whatsapp_phone    VARCHAR(50) NOT NULL,
    name              VARCHAR(255),
    city              VARCHAR(100),
    neighborhood      VARCHAR(100),
    address           TEXT,
    total_orders      INTEGER NOT NULL DEFAULT 0,
    total_spent       NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    last_order_at     TIMESTAMPTZ,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (profile_id, whatsapp_phone)
);

COMMENT ON TABLE customers IS 'Clients identifies par leur numero WhatsApp, isoles par boutique';

-- -----------------------------------------------------------
-- 3.3 CATEGORIES
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS categories (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id        UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    name              VARCHAR(100) NOT NULL,
    slug              VARCHAR(100) NOT NULL,
    display_order     INTEGER NOT NULL DEFAULT 0,
    is_active         BOOLEAN NOT NULL DEFAULT TRUE,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (profile_id, slug)
);

COMMENT ON TABLE categories IS 'Categories de produits, propres a chaque boutique';

-- -----------------------------------------------------------
-- 3.4 PRODUCTS (Catalogue)
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS products (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id              UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    category_id             UUID REFERENCES categories(id) ON DELETE SET NULL,
    name                    VARCHAR(255) NOT NULL,
    slug                    VARCHAR(255) NOT NULL,
    description             TEXT,
    price                   NUMERIC(10,2) NOT NULL CHECK (price >= 0),
    image_url               VARCHAR(500),
    is_available            BOOLEAN NOT NULL DEFAULT TRUE,
    is_featured             BOOLEAN NOT NULL DEFAULT FALSE,
    sold_count              INTEGER NOT NULL DEFAULT 0,
    sort_order              INTEGER NOT NULL DEFAULT 0,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (profile_id, slug)
);

COMMENT ON TABLE products IS 'Catalogue de produits, propre a chaque boutique';
COMMENT ON COLUMN products.sold_count IS 'Nombre total vendu (affiche dans le frontend)';

-- -----------------------------------------------------------
-- 3.5 NEGOTIATION RULES (regles de negociation par produit)
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS negotiation_rules (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id        UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    product_id        UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    is_negotiable     BOOLEAN NOT NULL DEFAULT FALSE,
    floor_price       NUMERIC(10,2) NOT NULL CHECK (floor_price >= 0),
    max_discount_pct  NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (max_discount_pct BETWEEN 0 AND 100),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (product_id)
);

COMMENT ON TABLE negotiation_rules IS 'Prix plancher / remise max par produit, appliques par l agent';

-- -----------------------------------------------------------
-- 3.6 TEAM MEMBERS (equipe invitee sur une boutique)
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS team_members (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id        UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    email             VARCHAR(255) NOT NULL,
    name              VARCHAR(255),
    role              VARCHAR(50) NOT NULL DEFAULT 'member',  -- 'owner', 'member'
    invited_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    accepted_at       TIMESTAMPTZ,
    UNIQUE (profile_id, email)
);

COMMENT ON TABLE team_members IS 'Membres invites par le commercant proprietaire';

-- -----------------------------------------------------------
-- 3.7 ORDERS (Commandes)
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS orders (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id            UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    customer_id           UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    order_number          VARCHAR(20) UNIQUE NOT NULL,
    status                order_status NOT NULL DEFAULT 'pending',
    subtotal              NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
    total_amount          NUMERIC(10,2) NOT NULL CHECK (total_amount >= 0),
    currency              VARCHAR(3) NOT NULL DEFAULT 'XAF',
    delivery_address      TEXT,
    delivery_city         VARCHAR(100),
    delivery_neighborhood VARCHAR(100),
    notes                 TEXT,
    paid                  BOOLEAN NOT NULL DEFAULT FALSE,
    paid_at               TIMESTAMPTZ,
    delivered_at          TIMESTAMPTZ,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE orders IS 'Commandes passees par les clients';

-- -----------------------------------------------------------
-- 3.8 ORDER_ITEMS (Lignes de commande)
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS order_items (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id          UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id        UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    product_name      VARCHAR(255) NOT NULL,
    quantity          INTEGER NOT NULL CHECK (quantity > 0),
    unit_price        NUMERIC(10,2) NOT NULL CHECK (unit_price >= 0),
    subtotal          NUMERIC(10,2) NOT NULL CHECK (subtotal >= 0),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE order_items IS 'Lignes de detail d une commande';

-- -----------------------------------------------------------
-- 3.9 ORDER_STATUS_HISTORY (Audit)
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS order_status_history (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id          UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    old_status        order_status,
    new_status        order_status NOT NULL,
    changed_by        VARCHAR(100),
    note              TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------
-- 3.10 WHATSAPP_CONVERSATIONS (Machine a etats)
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS whatsapp_conversations (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id        UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    customer_id       UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    state             conversation_state NOT NULL DEFAULT 'idle',
    context           JSONB DEFAULT '{}',
    last_message_at   TIMESTAMPTZ,
    message_count     INTEGER NOT NULL DEFAULT 0,
    is_active         BOOLEAN NOT NULL DEFAULT TRUE,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE whatsapp_conversations IS 'Sessions de conversation WhatsApp';

-- -----------------------------------------------------------
-- 3.11 WHATSAPP_MESSAGES (Historique)
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS whatsapp_messages (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id         UUID NOT NULL REFERENCES whatsapp_conversations(id) ON DELETE CASCADE,
    direction               message_direction NOT NULL,
    message_type            VARCHAR(30) DEFAULT 'text',
    content                 TEXT NOT NULL,
    whatsapp_message_id     VARCHAR(100) UNIQUE,
    status                  VARCHAR(30),
    error_message           TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE whatsapp_messages IS 'Historique des messages WhatsApp';


-- ============================================================
-- 4. INDEX
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_wa_phone_number_id ON profiles(whatsapp_phone_number_id);

CREATE INDEX IF NOT EXISTS idx_customers_profile ON customers(profile_id);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(whatsapp_phone);
CREATE INDEX IF NOT EXISTS idx_customers_name_trgm ON customers USING gin(name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_customers_neighborhood ON customers(neighborhood);

CREATE INDEX IF NOT EXISTS idx_categories_profile ON categories(profile_id);
CREATE INDEX IF NOT EXISTS idx_categories_active ON categories(profile_id, is_active, display_order);

CREATE INDEX IF NOT EXISTS idx_products_profile ON products(profile_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id) WHERE is_available = TRUE;
CREATE INDEX IF NOT EXISTS idx_products_available ON products(profile_id, is_available, sort_order);
CREATE INDEX IF NOT EXISTS idx_products_sold ON products(profile_id, sold_count DESC);

CREATE INDEX IF NOT EXISTS idx_negotiation_rules_profile ON negotiation_rules(profile_id);

CREATE INDEX IF NOT EXISTS idx_team_members_profile ON team_members(profile_id);

CREATE INDEX IF NOT EXISTS idx_orders_profile ON orders(profile_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_number ON orders(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(profile_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(profile_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product ON order_items(product_id);

CREATE INDEX IF NOT EXISTS idx_status_history_order ON order_status_history(order_id);

CREATE INDEX IF NOT EXISTS idx_conversations_profile ON whatsapp_conversations(profile_id);
CREATE INDEX IF NOT EXISTS idx_conversations_customer ON whatsapp_conversations(customer_id);
CREATE INDEX IF NOT EXISTS idx_conversations_active ON whatsapp_conversations(profile_id, is_active, last_message_at DESC);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON whatsapp_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_whatsapp_id ON whatsapp_messages(whatsapp_message_id);


-- ============================================================
-- 5. VUES
-- Toutes filtrables par l'appelant via "WHERE profile_id = ..."
-- ============================================================

CREATE OR REPLACE VIEW v_dashboard_stats AS
SELECT
    profile_id,
    COUNT(*) AS total_orders,
    COUNT(*) FILTER (WHERE status = 'pending') AS pending_orders,
    COUNT(*) FILTER (WHERE status = 'confirmed') AS confirmed_orders,
    COUNT(*) FILTER (WHERE status = 'delivering') AS delivering_orders,
    COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE) AS today_orders,
    COALESCE(SUM(total_amount), 0) AS total_revenue,
    COALESCE(SUM(total_amount) FILTER (WHERE created_at >= CURRENT_DATE), 0) AS today_revenue
FROM orders
GROUP BY profile_id;

CREATE OR REPLACE VIEW v_daily_sales AS
SELECT
    profile_id,
    DATE(created_at) AS date,
    COUNT(*) AS order_count,
    SUM(total_amount) AS total_revenue
FROM orders
GROUP BY profile_id, DATE(created_at)
ORDER BY DATE(created_at) DESC;

CREATE OR REPLACE VIEW v_top_products AS
SELECT
    p.id, p.profile_id, p.name, p.slug, p.price, p.image_url, p.sold_count,
    c.name AS category_name, c.slug AS category_slug
FROM products p
LEFT JOIN categories c ON p.category_id = c.id
WHERE p.is_available = TRUE
ORDER BY p.sold_count DESC;

CREATE OR REPLACE VIEW v_orders_list AS
SELECT
    o.id, o.profile_id, o.order_number, o.status, o.total_amount, o.currency,
    o.delivery_neighborhood, o.created_at,
    c.name AS customer_name, c.whatsapp_phone,
    COUNT(oi.id) AS item_count,
    STRING_AGG(oi.product_name || CASE WHEN oi.quantity > 1 THEN ' x' || oi.quantity ELSE '' END, ' + ') AS items_summary
FROM orders o
JOIN customers c ON o.customer_id = c.id
LEFT JOIN order_items oi ON oi.order_id = o.id
GROUP BY o.id, c.name, c.whatsapp_phone;

CREATE OR REPLACE VIEW v_customers_list AS
SELECT
    c.id, c.profile_id, c.name, c.whatsapp_phone, c.city, c.neighborhood,
    c.total_orders, c.total_spent, c.last_order_at,
    wc.id AS conversation_id, wc.state AS conversation_state,
    wc.last_message_at, wc.message_count
FROM customers c
LEFT JOIN whatsapp_conversations wc ON wc.customer_id = c.id AND wc.is_active = TRUE;

CREATE OR REPLACE VIEW v_public_catalog AS
SELECT
    p.id, p.profile_id, p.name, p.slug, p.description, p.price, p.image_url,
    p.sold_count, p.is_featured,
    c.name AS category_name, c.slug AS category_slug
FROM products p
LEFT JOIN categories c ON p.category_id = c.id
WHERE p.is_available = TRUE
ORDER BY c.display_order, p.sort_order, p.name;


-- ============================================================
-- 6. FONCTIONS
-- ============================================================

CREATE OR REPLACE FUNCTION fn_update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION fn_generate_order_number()
RETURNS TRIGGER AS $$
DECLARE
    v_date TEXT;
    v_seq  INTEGER;
BEGIN
    v_date := TO_CHAR(NOW(), 'YYYYMMDD');
    SELECT COUNT(*) + 1 INTO v_seq
    FROM orders
    WHERE order_number LIKE 'KOZ-' || v_date || '-%';
    NEW.order_number := 'KOZ-' || v_date || '-' || LPAD(v_seq::TEXT, 4, '0');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION fn_update_customer_stats()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE customers
    SET
        total_orders = (SELECT COUNT(*) FROM orders WHERE customer_id = NEW.customer_id),
        total_spent = (SELECT COALESCE(SUM(total_amount), 0) FROM orders WHERE customer_id = NEW.customer_id),
        last_order_at = (SELECT MAX(created_at) FROM orders WHERE customer_id = NEW.customer_id),
        updated_at = NOW()
    WHERE id = NEW.customer_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION fn_update_product_sold_count()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE products
    SET sold_count = (
        SELECT COALESCE(SUM(oi.quantity), 0)
        FROM order_items oi
        JOIN orders o ON oi.order_id = o.id
        WHERE oi.product_id = NEW.product_id
        AND o.status != 'cancelled'
    )
    WHERE id = NEW.product_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION fn_log_order_status_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO order_status_history (order_id, old_status, new_status, changed_by)
        VALUES (NEW.id, OLD.status, NEW.status, 'system');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Upsert client par (profile_id, telephone)
CREATE OR REPLACE FUNCTION fn_upsert_customer(
    p_profile_id UUID,
    p_phone VARCHAR,
    p_name VARCHAR DEFAULT NULL,
    p_city VARCHAR DEFAULT NULL,
    p_neighborhood VARCHAR DEFAULT NULL,
    p_address TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_id UUID;
BEGIN
    INSERT INTO customers (profile_id, whatsapp_phone, name, city, neighborhood, address)
    VALUES (p_profile_id, p_phone, p_name, p_city, p_neighborhood, p_address)
    ON CONFLICT (profile_id, whatsapp_phone) DO UPDATE
    SET
        name = COALESCE(EXCLUDED.name, customers.name),
        city = COALESCE(EXCLUDED.city, customers.city),
        neighborhood = COALESCE(EXCLUDED.neighborhood, customers.neighborhood),
        address = COALESCE(EXCLUDED.address, customers.address),
        updated_at = NOW()
    RETURNING id INTO v_id;
    RETURN v_id;
END;
$$ LANGUAGE plpgsql;

-- Creer une commande complete, produits pris dans le catalogue DU MEME profil
CREATE OR REPLACE FUNCTION fn_create_order(
    p_profile_id UUID,
    p_customer_id UUID,
    p_items JSONB,
    p_delivery_address TEXT DEFAULT NULL,
    p_delivery_city VARCHAR DEFAULT NULL,
    p_delivery_neighborhood VARCHAR DEFAULT NULL,
    p_notes TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_order_id UUID;
    v_item JSONB;
    v_product RECORD;
    v_subtotal NUMERIC := 0;
BEGIN
    INSERT INTO orders (
        profile_id, customer_id, subtotal, total_amount,
        delivery_address, delivery_city, delivery_neighborhood, notes
    )
    VALUES (
        p_profile_id, p_customer_id, 0, 0,
        p_delivery_address, p_delivery_city, p_delivery_neighborhood, p_notes
    )
    RETURNING id INTO v_order_id;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        SELECT id, name, price, image_url
        INTO v_product
        FROM products
        WHERE id = (v_item->>'product_id')::UUID
          AND profile_id = p_profile_id
          AND is_available = TRUE;

        IF v_product IS NULL THEN
            RAISE EXCEPTION 'Produit non trouve pour ce profil: %', v_item->>'product_id';
        END IF;

        INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price, subtotal)
        VALUES (
            v_order_id, v_product.id, v_product.name,
            (v_item->>'quantity')::INTEGER, v_product.price,
            v_product.price * (v_item->>'quantity')::INTEGER
        );

        v_subtotal := v_subtotal + (v_product.price * (v_item->>'quantity')::INTEGER);
    END LOOP;

    UPDATE orders SET subtotal = v_subtotal, total_amount = v_subtotal WHERE id = v_order_id;
    RETURN v_order_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION fn_update_order_status(
    p_order_id UUID,
    p_new_status order_status
)
RETURNS BOOLEAN AS $$
DECLARE
    v_old_status order_status;
BEGIN
    SELECT status INTO v_old_status FROM orders WHERE id = p_order_id;
    IF v_old_status IS NULL THEN
        RAISE EXCEPTION 'Commande non trouvee: %', p_order_id;
    END IF;
    UPDATE orders SET status = p_new_status WHERE id = p_order_id;
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION fn_search_products(
    p_profile_id UUID,
    p_query TEXT,
    p_limit INTEGER DEFAULT 20
)
RETURNS TABLE (
    id UUID, name VARCHAR, description TEXT, price NUMERIC,
    image_url VARCHAR, sold_count INTEGER, category_name VARCHAR
) AS $$
BEGIN
    RETURN QUERY
    SELECT p.id, p.name, p.description, p.price, p.image_url, p.sold_count,
           c.name AS category_name
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE p.profile_id = p_profile_id
      AND p.is_available = TRUE
      AND (p.name % p_query OR p.name ILIKE '%' || p_query || '%')
    ORDER BY similarity(p.name, p_query) DESC, p.name
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;


-- Resolution du profil proprietaire d'un numero WhatsApp, appelee par le
-- webhook AVANT toute authentification (donc avant que app.current_profile_id
-- ne soit positionnee). SECURITY DEFINER : s'execute avec les privileges du
-- proprietaire de la fonction et contourne donc RLS, mais seulement pour ce
-- lookup precis (routage), rien d'autre. Le GRANT est fait section 9, une
-- fois le role applicatif cree.
CREATE OR REPLACE FUNCTION fn_get_profile_id_by_phone_number_id(p_phone_number_id VARCHAR)
RETURNS TABLE(id UUID)
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT profiles.id FROM profiles
    WHERE whatsapp_phone_number_id = p_phone_number_id AND is_active = TRUE;
END;
$$ LANGUAGE plpgsql;


-- ============================================================
-- 7. TRIGGERS
-- ============================================================

CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION fn_update_updated_at();
CREATE TRIGGER trg_customers_updated_at BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION fn_update_updated_at();
CREATE TRIGGER trg_products_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION fn_update_updated_at();
CREATE TRIGGER trg_negotiation_rules_updated_at BEFORE UPDATE ON negotiation_rules FOR EACH ROW EXECUTE FUNCTION fn_update_updated_at();
CREATE TRIGGER trg_orders_updated_at BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION fn_update_updated_at();
CREATE TRIGGER trg_conversations_updated_at BEFORE UPDATE ON whatsapp_conversations FOR EACH ROW EXECUTE FUNCTION fn_update_updated_at();

CREATE TRIGGER trg_generate_order_number
    BEFORE INSERT ON orders
    FOR EACH ROW
    WHEN (NEW.order_number IS NULL OR NEW.order_number = '')
    EXECUTE FUNCTION fn_generate_order_number();

CREATE TRIGGER trg_update_customer_stats
    AFTER INSERT OR UPDATE OR DELETE ON orders
    FOR EACH ROW EXECUTE FUNCTION fn_update_customer_stats();

CREATE TRIGGER trg_update_product_sold
    AFTER INSERT OR UPDATE OR DELETE ON order_items
    FOR EACH ROW EXECUTE FUNCTION fn_update_product_sold_count();

CREATE TRIGGER trg_log_status_change
    BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION fn_log_order_status_change();


-- ============================================================
-- 8. RLS — isolation par variable de session
-- ============================================================
-- L'authentification est geree par notre propre backend (JWT), pas par
-- Supabase Auth : les policies ne s'appuient donc pas sur les roles
-- "anon"/"authenticated" ni sur auth.uid(), mais sur une variable de
-- session que le backend positionne pour chaque requete APRES avoir
-- verifie le JWT :
--
--   SELECT set_config('app.current_profile_id', '<uuid-du-profil>', true);
--
-- (set_config(), pas "SET LOCAL ... = $1" : SET ne supporte pas les
-- parametres lies du protocole etendu utilise par asyncpg.)
--
-- Cette variable n'a d'effet protecteur que si la connexion applicative
-- utilise un role SANS l'attribut BYPASSRLS (voir section 9) : un
-- role superuser ou proprietaire des tables ignore toujours RLS.

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE negotiation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_messages ENABLE ROW LEVEL SECURITY;

-- Cas particulier pour "profiles" : contrairement aux autres tables, la
-- lecture d'un profil sert aussi a ETABLIR l'identite elle-meme (email au
-- login/inscription, id juste apres verification de la signature du JWT
-- et AVANT que la variable de session ne soit positionnee -- probleme de
-- l'oeuf et la poule). La vraie barriere de securite dans ces cas est le
-- mot de passe (login) ou la signature du JWT (sessions authentifiees),
-- pas RLS -- donc la lecture reste ouverte. En revanche l'ECRITURE reste
-- strictement isolee : creer un profil (inscription) est ouvert, mais le
-- modifier ne l'est qu'a son propre profil, une fois authentifie.
CREATE POLICY "profiles_select_open" ON profiles
    FOR SELECT USING (TRUE);

CREATE POLICY "profiles_insert_open" ON profiles
    FOR INSERT WITH CHECK (TRUE);

CREATE POLICY "profiles_update_own" ON profiles
    FOR UPDATE
    USING (id = NULLIF(current_setting('app.current_profile_id', TRUE), '')::uuid)
    WITH CHECK (id = NULLIF(current_setting('app.current_profile_id', TRUE), '')::uuid);

CREATE POLICY "customers_tenant_isolation" ON customers
    USING (profile_id = NULLIF(current_setting('app.current_profile_id', TRUE), '')::uuid)
    WITH CHECK (profile_id = NULLIF(current_setting('app.current_profile_id', TRUE), '')::uuid);

CREATE POLICY "categories_tenant_isolation" ON categories
    USING (profile_id = NULLIF(current_setting('app.current_profile_id', TRUE), '')::uuid)
    WITH CHECK (profile_id = NULLIF(current_setting('app.current_profile_id', TRUE), '')::uuid);

CREATE POLICY "products_tenant_isolation" ON products
    USING (profile_id = NULLIF(current_setting('app.current_profile_id', TRUE), '')::uuid)
    WITH CHECK (profile_id = NULLIF(current_setting('app.current_profile_id', TRUE), '')::uuid);

CREATE POLICY "negotiation_rules_tenant_isolation" ON negotiation_rules
    USING (profile_id = NULLIF(current_setting('app.current_profile_id', TRUE), '')::uuid)
    WITH CHECK (profile_id = NULLIF(current_setting('app.current_profile_id', TRUE), '')::uuid);

CREATE POLICY "team_members_tenant_isolation" ON team_members
    USING (profile_id = NULLIF(current_setting('app.current_profile_id', TRUE), '')::uuid)
    WITH CHECK (profile_id = NULLIF(current_setting('app.current_profile_id', TRUE), '')::uuid);

CREATE POLICY "orders_tenant_isolation" ON orders
    USING (profile_id = NULLIF(current_setting('app.current_profile_id', TRUE), '')::uuid)
    WITH CHECK (profile_id = NULLIF(current_setting('app.current_profile_id', TRUE), '')::uuid);

-- order_items / order_status_history / conversations / messages n'ont pas
-- profile_id directement : isolation via une sous-requete sur la table parente.
CREATE POLICY "order_items_tenant_isolation" ON order_items
    USING (order_id IN (SELECT id FROM orders WHERE profile_id = NULLIF(current_setting('app.current_profile_id', TRUE), '')::uuid))
    WITH CHECK (order_id IN (SELECT id FROM orders WHERE profile_id = NULLIF(current_setting('app.current_profile_id', TRUE), '')::uuid));

CREATE POLICY "status_history_tenant_isolation" ON order_status_history
    USING (order_id IN (SELECT id FROM orders WHERE profile_id = NULLIF(current_setting('app.current_profile_id', TRUE), '')::uuid))
    WITH CHECK (order_id IN (SELECT id FROM orders WHERE profile_id = NULLIF(current_setting('app.current_profile_id', TRUE), '')::uuid));

CREATE POLICY "conversations_tenant_isolation" ON whatsapp_conversations
    USING (profile_id = NULLIF(current_setting('app.current_profile_id', TRUE), '')::uuid)
    WITH CHECK (profile_id = NULLIF(current_setting('app.current_profile_id', TRUE), '')::uuid);

CREATE POLICY "messages_tenant_isolation" ON whatsapp_messages
    USING (conversation_id IN (SELECT id FROM whatsapp_conversations WHERE profile_id = NULLIF(current_setting('app.current_profile_id', TRUE), '')::uuid))
    WITH CHECK (conversation_id IN (SELECT id FROM whatsapp_conversations WHERE profile_id = NULLIF(current_setting('app.current_profile_id', TRUE), '')::uuid));

-- Exception : le webhook WhatsApp entrant doit pouvoir CREER un profil
-- inconnu (nouveau client) avant meme de connaitre le profile_id de la
-- session -- il s'authentifie via son propre role de service (voir 9).


-- ============================================================
-- 9. ROLE APPLICATIF DEDIE (sans BYPASSRLS)
-- ============================================================
-- Sur Supabase, le role "service_role" utilise par le backend a
-- BYPASSRLS -- RLS ne le protege pas. Sur Postgres local (ou sur
-- Supabase si on choisit de durcir), on cree un role applicatif dedie,
-- proprietaire d'aucune table, qui respecte RLS :

DO $$ BEGIN
    CREATE ROLE kozapp_app LOGIN PASSWORD 'change_me_kozapp_app_dev';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

GRANT USAGE ON SCHEMA public TO kozapp_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO kozapp_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO kozapp_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO kozapp_app;
GRANT EXECUTE ON FUNCTION fn_get_profile_id_by_phone_number_id(VARCHAR) TO kozapp_app;

-- Le webhook (creation de profils/clients inconnus, avant authentification
-- JWT) s'execute avec RLS FORCE mais via une fonction SECURITY DEFINER
-- (fn_upsert_customer, fn_create_order) executee par le proprietaire de la
-- base -- c'est le seul chemin qui contourne delibrement RLS, et il est
-- borne au strict necessaire (creation de client / commande).


-- ============================================================
-- 10. SEED — boutique pilote "La Damé"
-- ============================================================

INSERT INTO profiles (
    id, email, password_hash, shop_name, activity_type, city, delivery_zones, hours,
    agent_tone, agent_welcome, agent_info, whatsapp_phone_number_id, whatsapp_token
)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'admin@lada.me',
    '$2b$12$placeholder_hash_a_remplacer',
    'La Damé',
    'restauration',
    'Douala',
    'Bonapriso, Bastos, Akwa, Deido',
    'Tous les jours, 11h - 22h',
    'Chaleureux',
    'Bonjour ! Bienvenue chez La Damé. Comment puis-je vous aider aujourd''hui ?',
    'Ouvert tous les jours de 11h à 22h. Livraison à Bonapriso, Bastos, Akwa et Deido. Paiement en espèces ou Mobile Money.',
    NULL,
    NULL
)
ON CONFLICT (email) DO NOTHING;

INSERT INTO categories (profile_id, name, slug, display_order)
SELECT '00000000-0000-0000-0000-000000000001', v.name, v.slug, v.display_order
FROM (VALUES
    ('Burgers', 'burgers', 1),
    ('Poulet', 'poulet', 2),
    ('Menus Enfants', 'menus-enfants', 3),
    ('Boissons', 'boissons', 4)
) AS v(name, slug, display_order)
ON CONFLICT (profile_id, slug) DO NOTHING;

INSERT INTO products (profile_id, category_id, name, slug, description, price, is_available, is_featured, sold_count, sort_order)
SELECT '00000000-0000-0000-0000-000000000001', c.id, p.name, p.slug, p.description, p.price, p.available, p.featured, p.sold, p.sort_order
FROM (VALUES
    ('burgers', 'Kozapp Burger', 'kozapp-burger', 'Double steak de boeuf, fromage gratine, salade fraiche, sauce maison.', 3500.00, TRUE, TRUE, 86, 1),
    ('poulet', 'Poulet braisé', 'poulet-braise', 'Poulet entier mariné 24h, braisé lentement. Accompagné de yassa.', 4500.00, TRUE, TRUE, 61, 2),
    ('menus-enfants', 'Menu enfant', 'menu-enfant', 'Mini burger ou tenders, frites maison et jus de fruit.', 2500.00, TRUE, FALSE, 43, 3),
    ('boissons', 'Jus de bissap', 'jus-de-bissap', 'Jus de bissap frais préparé maison.', 1000.00, FALSE, FALSE, 39, 4)
) AS p(cat_slug, name, slug, description, price, available, featured, sold, sort_order)
JOIN categories c ON c.slug = p.cat_slug AND c.profile_id = '00000000-0000-0000-0000-000000000001'
ON CONFLICT (profile_id, slug) DO NOTHING;

INSERT INTO negotiation_rules (profile_id, product_id, is_negotiable, floor_price, max_discount_pct)
SELECT '00000000-0000-0000-0000-000000000001', p.id, TRUE, p.price * 0.85, 15
FROM products p
WHERE p.profile_id = '00000000-0000-0000-0000-000000000001' AND p.slug IN ('kozapp-burger', 'poulet-braise')
ON CONFLICT (product_id) DO NOTHING;
