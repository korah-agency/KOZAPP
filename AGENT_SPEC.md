# Kozapp — Socle agent IA : audit et plan d'implémentation

> Audit du 15 août 2026. Sources : Cahier des charges v1.0, Backend/BD/Hébergement v2.0,
> Guide WhatsApp v2.0, `schema_supabase_whatsapp_orders.sql` v3.0, code `backend/app/`.
> Version présentée : https://claude.ai/code/artifact/5249fa36-1e6f-4399-9baf-4ac8f7c5f5b2

## Constat principal

Les 20 fonctions proposées sont les **outils** d'un moteur d'agent qui n'a **aucune ligne de code**.
`backend/app/api/webhooks.py` est un automate à mots-clés codé en dur (`menu` → numéro → quantité →
adresse → `oui`). Aucun appel à OpenRouter, Gemini ou un quelconque LLM dans tout le backend.
`agent_tone`, `agent_language`, `agent_welcome`, `agent_info` sont stockés en base et jamais lus.

Couverture par le schéma actuel : **5 couvertes, 8 partielles, 7 sans support.**

## 1. Les 20 fonctions face au schéma

| Fonction | État | Manque |
|---|---|---|
| `chercher_produit` | OK | — `fn_search_products` + pg_trgm |
| `lister_categories_produits` | OK | — |
| `verifier_disponibilite` | Partiel | `is_available` booléen ; besoin `stock_quantity`, `track_stock` |
| `verifier_regle_negociation` | Partiel | `UNIQUE (product_id)` interdit une règle par défaut boutique |
| `calculer_offre_remise` | Partiel | aucune trace de la remise consentie (`order_items.list_price`) |
| `creer_commande` | **Conflit** | `fn_create_order` force le prix catalogue → commande négociée impossible ; pas de `delivery_fee` |
| `modifier_commande` | OK | même réserve de prix |
| `consulter_statut_commande` | OK | — |
| `obtenir_infos_boutique` | Partiel | `profiles.hours` en texte libre, non calculable |
| `estimer_frais_livraison` | **Absent** | table `delivery_zones` à créer |
| `obtenir_historique_client` | OK | `preferences JSONB` en option |
| `mettre_a_jour_bilan_conversation` | Partiel | enum FSM inadapté ; manque `outcome`, `estimated_amount` |
| `resumer_conversation` | **Absent** | colonne `summary` |
| `verifier_regles_relance` | **Absent** | table `followup_rules` |
| `envoyer_relance` | **Absent** | table `message_templates` ; pas de `template_name`/catégorie sur les messages |
| `enregistrer_resultat_relance` | **Absent** | table `followup_sends` |
| `verifier_reponse_avant_envoi` | Mal classé | doit être un middleware, pas un outil (voir §3) |
| `escalader_vers_commercant` | **Absent** | `needs_human`, notifications |
| `verifier_limite_quota` | **Absent** | `subscriptions`, `usage_counters`, `invoices` |
| `transcrire_et_comprendre_audio` | Mal classé | étape de pipeline ; manque `media_id`, `transcript` |

## 2. Migrations requises

**Nouvelles tables** : `delivery_zones`, `followup_rules`, `followup_sends`, `message_templates`,
`subscriptions`, `usage_counters`, `invoices`, `activity_logs`, `product_options`.

**Colonnes à ajouter**

- `whatsapp_conversations` : `summary`, `summary_upto_message_id`, `outcome`, `estimated_amount`,
  `needs_human`, **`last_inbound_at`** (indispensable pour savoir si la fenêtre 24 h est ouverte).
- `whatsapp_messages` : `media_id`, `media_mime_type`, `transcript`, `template_name`,
  `billing_category`, `cost_estimate`.
- `order_items` : `list_price` (pour tracer la remise).
- `orders` : `delivery_fee`, `discount_total`, `source`.
- `products` : `stock_quantity`, `track_stock`.
- `customers` : `preferences`, **`opt_out`** (qualité du compte WhatsApp).
- `profiles` : `opening_hours` (JSONB), `whatsapp_waba_id`, `whatsapp_token_expires_at`,
  `agent_enabled`, `agent_model`.
- `negotiation_rules` : `product_id` nullable + index unique partiel (règle boutique).
- `fn_create_order` : accepter un prix unitaire optionnel, validé serveur contre `floor_price`.
- Remplacer l'enum `conversation_state` (il décrit l'automate scripté, pas une conversation libre).

## 3. Corrections à apporter à la liste de fonctions

Outils vs contrôles — ne pas confondre :

- `verifier_reponse_avant_envoi` → **middleware obligatoire** entre génération et envoi. Un garde-fou
  que le modèle peut choisir de ne pas appeler n'est pas un garde-fou.
- `verifier_limite_quota` → **vérification serveur** avant tout appel payant.
- `transcrire_et_comprendre_audio` → **étape d'entrée du pipeline** (circulaire sinon).
- `resumer_conversation` → **déclenché sur seuil** par le pipeline, pas à la discrétion du modèle.

Outils manquants : `enregistrer_infos_client` (sans lui `obtenir_historique_client` ne lit jamais
rien), `lister_commandes_client`, `verifier_ouverture`.

## 4. Sécurité — à traiter dans le lot 0

1. **Signature webhook non vérifiée** — `receive_whatsapp_message` ne contrôle pas
   `X-Hub-Signature-256`. N'importe qui peut injecter de faux messages et créer de vraies commandes.
2. **`profile_id` ne doit jamais être un paramètre d'outil** — injecté par le serveur depuis la
   session. Sinon prompt injection → fuite cross-tenant, ce que le RLS est censé empêcher.
3. **Ne jamais faire confiance à un prix produit par le modèle** — recalcul serveur systématique,
   comparé au `floor_price` avant écriture.
4. **Idempotence** — Meta rejoue les webhooks ; le conflit sur `whatsapp_message_id` (UNIQUE) n'est
   pas intercepté.
5. **`whatsapp_token` en clair en base** — à chiffrer au repos.

## 5. Absent du code ET de la liste, mais exigé au MVP

Embedded Signup (libre-service, dépend du jalon 0 Meta) · facturation et Mobile Money · application
réelle des rôles propriétaire/membre · administration Korah · planificateur de tâches de fond ·
file d'attente + reprise (« ne jamais perdre un message ») · agent bilingue FR/EN ·
politique de conservation des données.

## 6. Plan par lots (ordre de dépendance)

- **Lot 0 — Migrations + sécurité webhook** *(bloquant)*
- **Lot 1 — Moteur de l'agent** *(bloquant)* : OpenRouter, boucle de tool-calling, prompt système
  depuis la config boutique, entrée audio, middleware garde-fou, contrôle de quota, résumé auto.
- **Lot 2 — Les 17 outils** (catalogue, négociation, commandes, boutique, client, escalade).
- **Lot 3 — Relances** : tables + planificateur + modèles Meta + remplacement du mock
  (`app/app/page.tsx:584`).
- **Lot 4 — Abonnement, quotas, facturation**.
- **Lot 5 — Plateforme WhatsApp** *(dépend du jalon 0)* : Embedded Signup, fenêtre 24 h,
  coexistence, qualité du compte.
- **Lot 6 — Rôles, journal, admin Korah**.
- **Lot 7 — Fiabilité et supervision**.

## 7. Arbitrages

- **Ne pas paralléliser les lots 0 et 1.** Tout outil écrit avant la correction de `fn_create_order`
  et le remplacement de `conversation_state` est du code à jeter.
- **Le lot 5 dépend d'un jalon administratif**, pas technique. Développer les lots 1 à 4 contre le
  numéro de test Meta en attendant.
- **Le pilote est un fast-food** : les options de commande (accompagnements, tailles) ne sont pas
  du V2, elles sont nécessaires au lot 2.
