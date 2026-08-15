-- ============================================================
-- KOZAPP - Migration 002 : socle agent IA
-- A appliquer APRES schema_supabase_whatsapp_orders.sql (v3.0)
-- ============================================================
-- Contexte : cette migration debloque les 16 outils de l'agent, le
-- garde-fou de reponse, le controle de quota et les relances. Elle est
-- ecrite pour etre rejouable sans erreur (IF NOT EXISTS partout).

-- ------------------------------------------------------------
-- 1. PROFILES — config agent, horaires structures, jetons WhatsApp
-- ------------------------------------------------------------
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS agent_enabled BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS agent_model VARCHAR(100);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS opening_hours JSONB;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS whatsapp_waba_id VARCHAR(50);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS whatsapp_token_expires_at TIMESTAMPTZ;

COMMENT ON COLUMN profiles.opening_hours IS
  'Horaires structures par jour, ex. {"mon":[["11:00","22:00"]], "tue":[...], "closed":["sun"]}. '
  'Alimente verifier_ouverture ; profiles.hours (texte libre) reste affiche tel quel si opening_hours est vide.';

-- ------------------------------------------------------------
-- 2. PRODUCTS — stock
-- ------------------------------------------------------------
ALTER TABLE products ADD COLUMN IF NOT EXISTS track_stock BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS stock_quantity INTEGER;

-- ------------------------------------------------------------
-- 3. CUSTOMERS — preferences, opt-out relance
-- ------------------------------------------------------------
ALTER TABLE customers ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{}';
ALTER TABLE customers ADD COLUMN IF NOT EXISTS opt_out BOOLEAN NOT NULL DEFAULT FALSE;

-- ------------------------------------------------------------
-- 4. NEGOTIATION_RULES — regle par defaut au niveau boutique
-- ------------------------------------------------------------
-- product_id devient nullable (NULL = regle par defaut de la boutique) et
-- l'ancienne contrainte UNIQUE(product_id) est remplacee par deux index
-- uniques partiels : au plus une regle par produit, au plus une regle
-- par-defaut par boutique.
ALTER TABLE negotiation_rules ALTER COLUMN product_id DROP NOT NULL;

ALTER TABLE negotiation_rules DROP CONSTRAINT IF EXISTS negotiation_rules_product_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS uq_negotiation_rules_product
  ON negotiation_rules(product_id) WHERE product_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_negotiation_rules_profile_default
  ON negotiation_rules(profile_id) WHERE product_id IS NULL;

-- ------------------------------------------------------------
-- 5. ORDERS / ORDER_ITEMS — livraison, remise, tracabilite du prix negocie
-- ------------------------------------------------------------
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_fee NUMERIC(10,2) NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_total NUMERIC(10,2) NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS source VARCHAR(20) NOT NULL DEFAULT 'agent';

ALTER TABLE order_items ADD COLUMN IF NOT EXISTS list_price NUMERIC(10,2);
COMMENT ON COLUMN order_items.list_price IS 'Prix catalogue au moment de la commande, avant remise negociee (unit_price = prix reellement facture).';

-- ------------------------------------------------------------
-- 6. WHATSAPP_CONVERSATIONS — bilan commercial, fenetre 24h, escalade
-- ------------------------------------------------------------
-- L'ancien enum conversation_state decrivait l'automate a mots-cles ; il ne
-- correspond plus a un agent en conversation libre. On elargit la colonne
-- en texte libre, remplie desormais par l'agent lui-meme.
ALTER TABLE whatsapp_conversations ALTER COLUMN state DROP DEFAULT;
ALTER TABLE whatsapp_conversations ALTER COLUMN state TYPE VARCHAR(30) USING state::text;
ALTER TABLE whatsapp_conversations ALTER COLUMN state SET DEFAULT 'active';
DROP TYPE IF EXISTS conversation_state;

ALTER TABLE whatsapp_conversations ADD COLUMN IF NOT EXISTS summary TEXT;
ALTER TABLE whatsapp_conversations ADD COLUMN IF NOT EXISTS summary_upto_message_id UUID;
ALTER TABLE whatsapp_conversations ADD COLUMN IF NOT EXISTS outcome VARCHAR(20) NOT NULL DEFAULT 'en_cours';
ALTER TABLE whatsapp_conversations ADD COLUMN IF NOT EXISTS estimated_amount NUMERIC(10,2);
ALTER TABLE whatsapp_conversations ADD COLUMN IF NOT EXISTS needs_human BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE whatsapp_conversations ADD COLUMN IF NOT EXISTS last_inbound_at TIMESTAMPTZ;

COMMENT ON COLUMN whatsapp_conversations.outcome IS
  'Bilan commercial : en_cours, negociation, commande_conclue, perdue, escaladee.';
COMMENT ON COLUMN whatsapp_conversations.last_inbound_at IS
  'Horodatage du dernier message CLIENT (pas agent). Sert a savoir si la fenetre gratuite de 24h Meta est ouverte avant tout envoi hors reponse directe.';

CREATE INDEX IF NOT EXISTS idx_conversations_needs_human
  ON whatsapp_conversations(profile_id, needs_human) WHERE needs_human = TRUE;

-- ------------------------------------------------------------
-- 7. WHATSAPP_MESSAGES — media, transcription, facturation
-- ------------------------------------------------------------
ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS media_id VARCHAR(100);
ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS media_mime_type VARCHAR(100);
ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS transcript TEXT;
ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS template_name VARCHAR(100);
ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS billing_category VARCHAR(20);
ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS cost_estimate NUMERIC(8,2);

-- ------------------------------------------------------------
-- 8. DELIVERY_ZONES — estimer_frais_livraison
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS delivery_zones (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id        UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    name              VARCHAR(100) NOT NULL,
    fee               NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (fee >= 0),
    free_above_amount  NUMERIC(10,2),
    is_active         BOOLEAN NOT NULL DEFAULT TRUE,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (profile_id, name)
);
ALTER TABLE delivery_zones ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
    CREATE POLICY "delivery_zones_tenant_isolation" ON delivery_zones
        USING (profile_id = NULLIF(current_setting('app.current_profile_id', TRUE), '')::uuid)
        WITH CHECK (profile_id = NULLIF(current_setting('app.current_profile_id', TRUE), '')::uuid);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
CREATE INDEX IF NOT EXISTS idx_delivery_zones_profile ON delivery_zones(profile_id);

-- ------------------------------------------------------------
-- 9. MESSAGE_TEMPLATES — modeles Meta approuves, utilises par les relances
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS message_templates (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id        UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    name              VARCHAR(100) NOT NULL,
    category          VARCHAR(20) NOT NULL DEFAULT 'utility'
                       CHECK (category IN ('utility', 'marketing', 'authentication')),
    language_code     VARCHAR(10) NOT NULL DEFAULT 'fr',
    body              TEXT NOT NULL,
    variables         JSONB NOT NULL DEFAULT '[]',
    approval_status   VARCHAR(20) NOT NULL DEFAULT 'pending'
                       CHECK (approval_status IN ('pending', 'approved', 'rejected')),
    is_active         BOOLEAN NOT NULL DEFAULT TRUE,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (profile_id, name, language_code)
);
ALTER TABLE message_templates ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
    CREATE POLICY "message_templates_tenant_isolation" ON message_templates
        USING (profile_id = NULLIF(current_setting('app.current_profile_id', TRUE), '')::uuid)
        WITH CHECK (profile_id = NULLIF(current_setting('app.current_profile_id', TRUE), '')::uuid);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
CREATE INDEX IF NOT EXISTS idx_message_templates_profile ON message_templates(profile_id, is_active);

-- ------------------------------------------------------------
-- 10. FOLLOWUP_RULES — verifier_regles_relance
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS followup_rules (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id        UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    name              VARCHAR(150) NOT NULL,
    trigger_type      VARCHAR(30) NOT NULL
                       CHECK (trigger_type IN ('panier_abandonne', 'client_inactif', 'renouvellement')),
    delay_hours       INTEGER NOT NULL CHECK (delay_hours > 0),
    template_id       UUID REFERENCES message_templates(id) ON DELETE SET NULL,
    is_active         BOOLEAN NOT NULL DEFAULT TRUE,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE followup_rules ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
    CREATE POLICY "followup_rules_tenant_isolation" ON followup_rules
        USING (profile_id = NULLIF(current_setting('app.current_profile_id', TRUE), '')::uuid)
        WITH CHECK (profile_id = NULLIF(current_setting('app.current_profile_id', TRUE), '')::uuid);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
CREATE INDEX IF NOT EXISTS idx_followup_rules_profile ON followup_rules(profile_id, is_active);

-- ------------------------------------------------------------
-- 11. FOLLOWUP_SENDS — envoyer_relance / enregistrer_resultat_relance
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS followup_sends (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id        UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    rule_id           UUID NOT NULL REFERENCES followup_rules(id) ON DELETE CASCADE,
    customer_id       UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    conversation_id   UUID REFERENCES whatsapp_conversations(id) ON DELETE SET NULL,
    sent_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    whatsapp_status   VARCHAR(30),
    result            VARCHAR(20) NOT NULL DEFAULT 'en_attente'
                       CHECK (result IN ('en_attente', 'repondu', 'commande', 'sans_effet')),
    result_recorded_at TIMESTAMPTZ
);
ALTER TABLE followup_sends ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
    CREATE POLICY "followup_sends_tenant_isolation" ON followup_sends
        USING (profile_id = NULLIF(current_setting('app.current_profile_id', TRUE), '')::uuid)
        WITH CHECK (profile_id = NULLIF(current_setting('app.current_profile_id', TRUE), '')::uuid);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
CREATE INDEX IF NOT EXISTS idx_followup_sends_profile ON followup_sends(profile_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_followup_sends_customer ON followup_sends(customer_id);
-- Empeche de relancer deux fois le meme client pour la meme regle dans les 24h
CREATE INDEX IF NOT EXISTS idx_followup_sends_rule_customer ON followup_sends(rule_id, customer_id, sent_at DESC);

-- ------------------------------------------------------------
-- 12. USAGE_COUNTERS — verifier_limite_quota (compteur par periode)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS usage_counters (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id            UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    period_start          DATE NOT NULL,
    period_end            DATE NOT NULL,
    conversations_count   INTEGER NOT NULL DEFAULT 0,
    followups_count       INTEGER NOT NULL DEFAULT 0,
    UNIQUE (profile_id, period_start)
);
ALTER TABLE usage_counters ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
    CREATE POLICY "usage_counters_tenant_isolation" ON usage_counters
        USING (profile_id = NULLIF(current_setting('app.current_profile_id', TRUE), '')::uuid)
        WITH CHECK (profile_id = NULLIF(current_setting('app.current_profile_id', TRUE), '')::uuid);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
CREATE INDEX IF NOT EXISTS idx_usage_counters_profile_period ON usage_counters(profile_id, period_start);

-- ------------------------------------------------------------
-- 13. ACTIVITY_LOGS — journal (garde-fou, acces support, actions sensibles)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS activity_logs (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id        UUID REFERENCES profiles(id) ON DELETE CASCADE,
    actor             VARCHAR(100) NOT NULL,
    action            VARCHAR(100) NOT NULL,
    detail            JSONB DEFAULT '{}',
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_activity_logs_profile ON activity_logs(profile_id, created_at DESC);

-- ------------------------------------------------------------
-- 14. Droits du role applicatif sur les nouvelles tables
-- ------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON
    delivery_zones, message_templates, followup_rules, followup_sends,
    usage_counters, activity_logs
TO kozapp_app;

-- ------------------------------------------------------------
-- 15. Donnees de depart pour le pilote La Damé (zones de livraison)
-- ------------------------------------------------------------
INSERT INTO delivery_zones (profile_id, name, fee, free_above_amount)
SELECT '00000000-0000-0000-0000-000000000001', v.name, v.fee, v.free_above
FROM (VALUES
    ('Bonapriso', 1000.00, 10000.00),
    ('Bastos', 1500.00, 10000.00),
    ('Akwa', 1000.00, 10000.00),
    ('Deido', 1200.00, 10000.00)
) AS v(name, fee, free_above)
ON CONFLICT (profile_id, name) DO NOTHING;
