# Kozapp — Page Analytics : spécification complète

> Pour l'agent qui construit ou revoit la page Analytics du tableau de bord.
> Backend déjà implémenté et vérifié (imports OK, migration 002 appliquée
> en local) : `backend/app/services/analytics_service.py`,
> `backend/app/schemas/analytics.py`, `backend/app/api/analytics.py`.
> Ce document décrit le contrat pour construire/consommer le frontend.

## Où ça s'insère

Le tableau de bord (`app/app/page.tsx`) a aujourd'hui 7 vues dans la sidebar :
`dashboard, orders, catalog, followups, agent, billing, settings`. Il faut
ajouter une 8ᵉ vue **`analytics`**, entre `dashboard` et `orders` dans le
menu (`useMenu` dans page.tsx), avec l'icône `BarChart3` (lucide-react,
pas encore importée). Pas d'ajout à la bottom-nav mobile (déjà 3 items +
"Plus").

Le `Dashboard` existant garde son rôle de vue d'ensemble rapide (CA,
commandes, top produits) ; `Analytics` est la page d'approfondissement.

## Style visuel à respecter

Aucune librairie de graphiques n'est utilisée dans le projet (pas de
recharts/chart.js). Tout est fait en CSS/SVG pur. **Réutiliser les classes
existantes** (`app/globals.css`) plutôt qu'en créer de nouvelles :

- `.metrics-grid` / `.metric-card` / `.metric-icon.{purple,pink,green,orange}` — cartes de chiffres en haut de page (déjà utilisées par `Dashboard`)
- `.panel` / `.panel-heading` (h2 + p + `.text-button` optionnel à droite) — conteneur de chaque section
- `.rank-row` — ligne de classement avec numéro, libellé, valeur à droite (déjà utilisée pour le top produits)
- `.zone-row` + `.mini-progress` — **définies dans le CSS mais non utilisées nulle part actuellement** ; conçues exactement pour une répartition géographique en barres. À utiliser pour `geo_breakdown`.
- `.badge.badge-{purple,pink,green,orange,grey,red}` — pastilles de statut (voir composant `Badge` déjà dans page.tsx)
- `.attention-item` — ligne cliquable avec icône + titre + sous-titre + chevron (déjà utilisée dans le panneau "à traiter" du Dashboard) — bon candidat pour la liste `leaking_sales.items`
- `.usage-grid` / `.usage-card` — trio de métriques côte à côte (déjà utilisé dans Billing) — bon candidat pour `followups` (envoyées/répondu/converti) et `segments` (nouveaux/récurrents/taux)
- `.impact-card` — **définie dans le CSS, non utilisée actuellement** — bon candidat pour `negotiation`
- `.quota-card` / `.progress` — **déjà présente dans `Dashboard` mais avec des valeurs statiques (`—`, `0%`)** — c'est le widget de quota, à brancher sur les vraies données (voir section Quota ci-dessous)

Pour `peak_hours` (24 valeurs, pas de classe existante adaptée) : construire
une rangée de 24 barres verticales avec `<div>` + hauteur en `%` inline,
dans le même esprit que `.chart` (voir la classe existante pour les
couleurs : `var(--purple)` comme teinte de barre, fond `#ece8f0` comme
`.progress`). Une nouvelle classe `.hour-bars` est acceptable ici, à
ajouter dans `globals.css` en suivant les tokens de couleur déjà en place
(ne pas introduire de nouvelle palette).

Devises : toujours passer par `fmtFcfa(valeur, lang)` (déjà importé/défini
dans page.tsx), jamais `Intl.NumberFormat` direct.

## Contrat API

### `GET /api/analytics/summary?days={n|omis}`

Déjà existant, **étendu** d'un champ `quota` (le widget quota du Dashboard
peut donc être branché sans appel supplémentaire) :

```json
{
  "total_orders": 42,
  "total_revenue": 185000.0,
  "total_customers": 31,
  "average_order_value": 4404.76,
  "daily_sales": [{ "date": "2026-08-10", "order_count": 5, "total_revenue": 22000.0 }],
  "top_products": [{ "product_id": "...", "product_name": "Kozapp Burger", "total_quantity": 12, "total_revenue": 42000.0 }],
  "quota": {
    "plan": "starter",
    "conversations_used": 214,
    "conversations_limit": 800,
    "followups_used": 12,
    "followups_limit": 150,
    "period_start": "2026-08-01",
    "period_end": "2026-08-31"
  }
}
```

### `GET /api/analytics/insights?days=30` (nouveau)

Un seul appel qui agrège les 8 analytics de cette page. `days` par défaut
à 30 ; `days` omis = toute la durée de vie de la boutique (sauf
`leaking_sales`, jamais filtré par période — voir plus bas).

```json
{
  "geo_breakdown": [
    { "neighborhood": "Bonapriso", "order_count": 18, "total_revenue": 79000.0 }
  ],
  "conversion": {
    "total_conversations": 96,
    "converted": 42,
    "lost": 12,
    "in_progress": 30,
    "escalated": 12,
    "conversion_rate": 43.8
  },
  "peak_hours": [
    { "hour": 0, "order_count": 0 }, "...", { "hour": 12, "order_count": 14 }, "...", { "hour": 23, "order_count": 1 }
  ],
  "followups": {
    "sent": 40,
    "responded": 18,
    "converted": 9,
    "recovered_amount": 63000.0,
    "response_rate": 45.0,
    "conversion_rate": 22.5
  },
  "negotiation": {
    "negotiated_orders": 15,
    "total_orders": 42,
    "negotiated_share": 35.7,
    "average_discount_pct": 8.2,
    "total_discount_amount": 21500.0
  },
  "leaking_sales": {
    "count": 7,
    "estimated_amount": 48000.0,
    "items": [
      {
        "customer_name": "Awa N.",
        "whatsapp_phone": "237690000000",
        "outcome": "negociation",
        "last_message_at": "2026-08-14T09:12:00Z",
        "estimated_amount": 12000.0
      }
    ]
  },
  "segments": { "new_customers": 22, "returning_customers": 9, "repeat_rate": 29.0 },
  "quota": { "...": "identique au champ quota de /summary" }
}
```

## Description détaillée des 8 analytics

Numérotées comme dans le rapport de recommandation ([artifact publié](https://claude.ai/code/artifact/a23552e7-3093-4171-859b-528533b950e0)).

### 1. Répartition géographique — `geo_breakdown`

**Affiche** : jusqu'à 8 quartiers/villes classés par nombre de commandes,
avec leur CA. **Pourquoi** : cahier des charges §4.7 et §8 — c'est
l'indicateur le plus explicitement demandé et jusqu'ici totalement absent
du produit. Dit au commerçant où livrer plus, où cibler une pub locale.
**Calcul** : `GROUP BY COALESCE(delivery_neighborhood, delivery_city)` sur
`orders`, commandes annulées exclues, borné par `days` sur `created_at`.
**UI** : `.zone-row` + `.mini-progress` par ligne — largeur de la barre
proportionnelle à `order_count` du plus gros quartier de la liste (donc
recalculer le ratio côté client : `order_count / max(...)`, pas fourni par
l'API). Le montant s'affiche à droite comme dans `.zone-row>div:first-child`.

### 2. Taux de conversion conversation → commande — `conversion`

**Affiche** : `conversion_rate` en gros chiffre + répartition
converti/en cours/perdu/escaladé. **Pourquoi** : la promesse centrale du
produit (§1.3 : « transformer chaque conversation en donnée exploitable »).
**Calcul** : `GROUP BY whatsapp_conversations.outcome`, borné par `days`
sur `created_at` de la conversation. **UI** : une carte `.metric-card`
pour le taux (accent vert), puis 4 pastilles `.badge` (purple=converti,
orange=en cours, red=perdu, pink=escaladé) avec leur compte.

### 3. Heures de forte activité — `peak_hours`

**Affiche** : 24 valeurs (une par heure UTC 0-23), nombre de commandes par
heure. **Pourquoi** : cité nommément au §8 pour le pilote restauration
(« ajuster l'offre et la logistique »). **Calcul** : `EXTRACT(hour FROM
created_at)` sur `orders`, commandes annulées exclues. **UI** : voir
section style ci-dessus — 24 barres, hauteur proportionnelle au max de la
série, avec l'heure en légende sous chaque 4ᵉ barre (0h, 4h, 8h...) pour
ne pas surcharger.
⚠️ Les heures sont en **UTC**, pas en heure locale Cameroun (WAT = UTC+1) —
convertir côté frontend avant affichage (`hour + 1) % 24`), sinon le pic du
déjeuner apparaît décalé d'une heure.

### 4. Efficacité des relances — `followups`

**Affiche** : envoyées / taux de réponse / taux de conversion / montant
récupéré. **Pourquoi** : l'argument face à l'agent natif de Meta, qui ne
relance pas (guide WhatsApp §11). **Calcul** : agrégation sur
`followup_sends.result`, borné par `days` sur `sent_at` ; le montant
récupéré est une heuristique (commandes du même client dans les 48h après
une relance marquée `commande` — pas un lien direct en base). **UI** :
`.usage-grid` à 3 `.usage-card` (envoyées, taux réponse, taux conversion)
+ le montant récupéré mis en avant séparément (grand chiffre, accent vert,
au-dessus ou à côté de la grille).

### 5. Impact de la négociation — `negotiation`

**Affiche** : part des commandes négociées, remise moyenne accordée,
montant total de remise. **Pourquoi** : deuxième différenciateur du
produit — montre que l'agent tient la politique de prix plutôt que de la
subir. **Calcul** : une commande est « négociée » si au moins une ligne a
`list_price > unit_price` ; `average_discount_pct` est la moyenne des
`(list_price - unit_price) / list_price` par ligne. **UI** : `.impact-card`
— un gros chiffre (part négociée en %) + deux lignes de détail (remise
moyenne, montant total).

### 6. Ventes en train de fuir — `leaking_sales`

**Affiche** : liste des conversations `en_cours`/`negociation` sans
message depuis 24h, avec le montant estimé cumulé. **Pourquoi** : le
pendant négatif de #2, directement actionnable — c'est la cible naturelle
d'une relance. **Calcul** : **non borné par `days`** (c'est un état présent,
pas un historique) — toute conversation stagnante depuis plus de 24h,
peu importe son âge. Limité aux 10 plus grosses par montant estimé pour la
liste détaillée ; le total (`count`/`estimated_amount`) porte sur
l'ensemble, pas seulement les 10 affichées. **UI** : bandeau `.metric-card`
(accent orange/rouge) pour le total, puis liste `.attention-item` par
conversation (icône client, nom, "depuis Xh", montant à droite) — cliquable
vers la conversation si l'écran Relances/Conversations le permet.

### 7. Clients nouveaux vs récurrents — `segments`

**Affiche** : nombre de nouveaux clients (créés dans la période), nombre
de clients récurrents (`total_orders > 1`, toute période confondue), taux
de réachat. **Pourquoi** : un client qui revient n'a pas la même valeur
qu'un client de passage — signal de fidélité que le CA brut masque.
⚠️ `returning_customers` et `repeat_rate` portent sur **l'ensemble de la
clientèle**, pas seulement les clients créés dans la fenêtre `days` (sinon
un client fidèle de longue date n'apparaîtrait jamais comme "récurrent" si
sa dernière commande est hors fenêtre). Seul `new_customers` est borné par
`days`. **UI** : `.usage-grid` à 3 `.usage-card`.

### 8. Consommation du quota du palier — `quota`

**Affiche** : conversations et relances consommées ce mois vs incluses
dans le palier. **Pourquoi** : §9.3 du cahier des charges — « la
prévisibilité rassure et vend mieux », éviter la facture surprise.
**Déjà scaffoldé dans l'UI** : le widget `.quota-card` existe dans
`Dashboard` (4ᵉ carte de `.metrics-grid`) mais affiche des valeurs
statiques (`—`, barre à `0%`). **À faire** : le brancher sur
`summary.quota.conversations_used / conversations_limit` (barre =
`used/limit * 100`, avec une classe d'alerte si > 90%). Le répéter en
version détaillée (conversations **et** relances) sur la page Analytics
via `insights.quota` (même endpoint, pas d'appel supplémentaire si
`/summary` est déjà chargé ailleurs).

## Filtre de période

Réutiliser le même sélecteur que `Dashboard` (`periodOptions` :
Aujourd'hui / 7 jours / Ce mois / Tout), câblé sur le paramètre `days` de
`/insights`. Exception : `leaking_sales` ignore ce filtre par construction
(voir #6) — ne pas le lier au sélecteur de période côté UI, ou l'indiquer
clairement (ex. « à l'instant présent », pas de filtre appliqué).

## Ce qui n'est PAS dans ce lot

Les 6 analytics identifiées comme "sans données" dans le rapport (marge
produit, coût messagerie réel, qualité du compte WhatsApp, source
d'acquisition, historique de rupture de stock, performance par membre
d'équipe) ne sont pas dans ce contrat — elles nécessitent des colonnes ou
des intégrations qui n'existent pas encore (voir le rapport publié pour le
détail de chacune).
