"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Lang = "fr" | "en";

type LanguageContextValue = { lang: Lang; setLang: (l: Lang) => void };

const LanguageContext = createContext<LanguageContextValue>({ lang: "fr", setLang: () => {} });

const STORAGE_KEY = "kozapp_lang";

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("fr");

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === "en" || saved === "fr") setLangState(saved);
  }, []);

  function setLang(l: Lang) {
    setLangState(l);
    window.localStorage.setItem(STORAGE_KEY, l);
  }

  return <LanguageContext.Provider value={{ lang, setLang }}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  return useContext(LanguageContext);
}

/** Interpole des variables `{cle}` dans un texte traduit (ex. "Vendu {count} fois"). */
export function tFormat(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ""));
}

/** Locale Intl/Date a utiliser pour la langue active. */
export function localeFor(lang: Lang): string {
  return lang === "fr" ? "fr-FR" : "en-US";
}

/* ================================================================
   DASHBOARD (app/app/page.tsx)
   ================================================================ */
export type DashboardT = {
  loadingApp: string;
  sidebar: { helpCenter: string; korahSolution: string; logout: string; connected: string; notConnected: string };
  menu: { dashboard: string; analytics: string; orders: string; catalog: string; followups: string; agent: string; billing: string; settings: string };
  bottomNav: { home: string; more: string };
  topbar: {
    whatsappConnected: string; whatsappNotConnected: string; notifications: string; noNotifications: string;
    parameters: string; languageFr: string; languageEn: string; logout: string;
  };
  settings: {
    boutique: string; team: string; language: string; account: string;
    heading: string; title: string; subtitle: string;
    languageTitle: string; languageDesc: string; languageLabel: string; save: string; saved: string;
  };
  common: {
    loading: string; error: string; retry: string; save: string; saving: string; saved: string; cancel: string;
    search: string; close: string; add: string; edit: string; delete: string; confirm: string; back: string;
    resetSearch: string; noResultsFor: string; view: string;
  };
  dashboard: {
    today: string; greeting: string; subtitle: string;
    periodToday: string; periodLast7: string; periodThisMonth: string; periodAllTime: string;
    loadingStats: string; errorStats: string;
    ordersLabel: string; ordersEmpty: string; total: string;
    customersLabel: string; customersEmpty: string;
    revenueLabel: string; avgBasket: string;
    conversations: string; perTier: string; quotaHint: string;
    emptyTitle: string; emptyText: string; emptyAction: string;
    attentionTitle: string; attentionSubtitle: string;
    pendingOrders: string; pendingOrdersDesc: string;
    subscription: string; subscriptionDesc: string;
    bestProducts: string; bestProductsSub: string; catalogLink: string; noSales: string; sold: string;
  };
  orders: {
    eyebrow: string; title: string; subtitle: string;
    summaryCount: string; summaryPending: string; summaryDelivered: string;
    searchPlaceholder: string; loading: string; error: string;
    emptyTitleNone: string; emptyTitleFiltered: string; emptyTextNone: string;
    colOrder: string; colCustomer: string; colProducts: string; colAmount: string; colDelivery: string; colStatus: string;
    viewOrder: string; noDelivery: string;
    statusNew: string; statusConfirmed: string; statusDelivering: string; statusDelivered: string; statusCancelled: string;
  };
  orderDetail: {
    products: string; total: string; delivery: string; notProvided: string;
    changeStatus: string; update: string; updating: string; notifyCustomer: string; updateFailed: string;
  };
  catalog: {
    eyebrow: string; title: string; subtitle: string; addProduct: string; searchPlaceholder: string;
    loading: string; error: string; emptyTitleNone: string; emptyTitleFiltered: string; emptyTextNone: string;
    outOfStock: string; noCategory: string; soldTimes: string; toggleAvailability: string;
    helpTitle: string; helpText: string;
  };
  addProductModal: {
    title: string; subtitle: string; photoLabel: string; photoPreviewAlt: string; addPhoto: string;
    nameLabel: string; namePlaceholder: string; priceLabel: string; pricePlaceholder: string;
    categoryLabel: string; noCategory: string; descLabel: string; descPlaceholder: string;
    adding: string; add: string; formatError: string; sizeError: string; createError: string;
  };
  followups: {
    eyebrow: string; title: string; subtitle: string; activeRules: string; activeRulesDesc: string;
    ruleTitle: string; ruleDesc: string; ruleDelay: string; activateRule: string; comingSoon: string;
  };
  negotiation: {
    loading: string; error: string; allow: string; allowDesc: string; emptyProducts: string;
    catalogPrice: string; floorPrice: string; maxDiscount: string; negotiable: string;
    previewBefore: string; previewMiddle: string; previewAfter: string;
  };
  agent: {
    eyebrow: string; title: string; subtitle: string; active: string;
    formTitle: string; formDesc: string; toneLabel: string; toneFriendly: string; toneProfessional: string; toneWarm: string;
    welcomeLabel: string; infoLabel: string; saving: string; saved: string; save: string;
    tryTitle: string; previewSub: string; simulation: string; sampleQuestion: string; defaultWelcome: string; previewFoot: string;
    negotiationTitle: string; negotiationDesc: string; reduce: string; configure: string;
  };
  billing: {
    eyebrow: string; title: string; subtitle: string; currentOffer: string; active: string; changePlan: string;
    paymentTitle: string; paymentDesc: string;
    plans: Record<"decouverte" | "starter" | "business" | "scale", { name: string; price: string; desc: string }>;
  };
  boutiqueTab: {
    title: string; desc: string; shopName: string; sector: string;
    sectorRestauration: string; sectorMode: string; sectorServices: string; sectorOther: string;
    deliveryZone: string; whatsappNumber: string; address: string; hours: string;
    saving: string; saved: string; save: string;
  };
  equipeTab: {
    title: string; desc: string; inviteLabel: string; invitePlaceholder: string; invite: string;
    loading: string; error: string; empty: string; owner: string; member: string; active: string; invitationSent: string;
  };
  compteTab: {
    title: string; desc: string; password: string; passwordDesc: string; change: string;
    emailNotif: string; emailNotifDesc: string; closeAccount: string; closeAccountDesc: string;
  };
  analytics: {
    eyebrow: string; title: string; subtitle: string;
    loading: string; error: string;
    geoTitle: string; geoSubtitle: string;
    conversionTitle: string; conversionSubtitle: string;
    peakHoursTitle: string; peakHoursSubtitle: string;
    followupsTitle: string; followupsSubtitle: string;
    negotiationTitle: string; negotiationSubtitle: string;
    leakingTitle: string; leakingSubtitle: string; leakingSince: string;
    segmentsTitle: string; segmentsSubtitle: string;
    quotaTitle: string; quotaSubtitle: string;
    converted: string; inProgress: string; lost: string; escalated: string;
    sent: string; responded: string; recoveredAmount: string;
    negotiatedShare: string; avgDiscount: string; totalDiscount: string;
    newCustomers: string; returningClients: string; repeatRate: string;
    conversationsUsed: string; followupsUsed: string;
    highUsageWarning: string;
    noData: string;
  };
  confirmClose: { title: string; text: string; cancel: string; confirm: string };
  changePasswordModal: {
    title: string; desc: string; current: string; newPassword: string; confirmNew: string;
    mismatch: string; genericError: string; saving: string; submit: string;
    successTitle: string; successText: string; show: string; hide: string; close: string; passwordHint: string;
  };
};

const dashboardFr: DashboardT = {
  loadingApp: "Chargement de votre espace Kozapp…",
  sidebar: {
    helpCenter: "Centre d'aide", korahSolution: "Une solution", logout: "Se déconnecter",
    connected: "connecté", notConnected: "non connecté",
  },
  menu: {
    dashboard: "Tableau de bord", analytics: "Analytics", orders: "Commandes", catalog: "Catalogue", followups: "Relances",
    agent: "Mon agent", billing: "Facturation", settings: "Paramètres",
  },
  bottomNav: { home: "Accueil", more: "Plus" },
  topbar: {
    whatsappConnected: "Votre WhatsApp est connecté", whatsappNotConnected: "Votre WhatsApp est non connecté",
    notifications: "Notifications", noNotifications: "Aucune notification pour l'instant.",
    parameters: "Paramètres", languageFr: "Français", languageEn: "Anglais", logout: "Se déconnecter",
  },
  settings: {
    boutique: "Boutique", team: "Équipe", language: "Langue", account: "Compte",
    heading: "Votre espace, à votre image", title: "Paramètres", subtitle: "Gérez votre boutique, votre équipe et votre compte.",
    languageTitle: "Langue de l'interface",
    languageDesc: "Ce que vous voyez dans votre espace Kozapp — distinct de la langue de votre agent, réglable dans « Mon agent ».",
    languageLabel: "Langue de l'interface", save: "Enregistrer", saved: "Enregistré ✓",
  },
  common: {
    loading: "Chargement…", error: "Erreur", retry: "Réessayer", save: "Enregistrer", saving: "Enregistrement…",
    saved: "Enregistré ✓", cancel: "Annuler", search: "Rechercher", close: "Fermer", add: "Ajouter",
    edit: "Modifier", delete: "Supprimer", confirm: "Confirmer", back: "Retour",
    resetSearch: "Réinitialiser la recherche", noResultsFor: "Aucun résultat pour « {query} ».", view: "Voir",
  },
  dashboard: {
    today: "Aujourd'hui", greeting: "Bonjour", subtitle: "Voici ce qui se passe dans votre boutique aujourd'hui.",
    periodToday: "Aujourd'hui", periodLast7: "7 derniers jours", periodThisMonth: "Ce mois-ci", periodAllTime: "Depuis le début",
    loadingStats: "Chargement de votre tableau de bord…", errorStats: "Impossible de charger vos statistiques.",
    ordersLabel: "Commandes", ordersEmpty: "Aucune pour l'instant", total: "Total",
    customersLabel: "Clients", customersEmpty: "Aucun pour l'instant",
    revenueLabel: "Revenus (FCFA)", avgBasket: "Panier moyen : {amount} FCFA",
    conversations: "Conversations", perTier: "/ selon palier", quotaHint: "Suivi des quotas disponible avec l'abonnement",
    emptyTitle: "Votre tableau de bord se remplira dès vos premières conversations",
    emptyText: "Ajoutez des produits à votre catalogue et connectez votre WhatsApp pour commencer à recevoir des commandes.",
    emptyAction: "Ajouter un produit",
    attentionTitle: "À votre attention", attentionSubtitle: "Quelques actions rapides",
    pendingOrders: "Commandes en attente", pendingOrdersDesc: "À valider dès que possible",
    subscription: "Votre abonnement", subscriptionDesc: "Voir la consommation du mois",
    bestProducts: "Produits les plus vendus", bestProductsSub: "Sur l'ensemble de l'activité",
    catalogLink: "Catalogue", noSales: "Pas encore de vente enregistrée.", sold: "vendus",
  },
  orders: {
    eyebrow: "Suivi opérationnel", title: "Commandes", subtitle: "Retrouvez et suivez chaque commande, du message à la livraison.",
    summaryCount: "commandes", summaryPending: "en attente d'action", summaryDelivered: "commandes livrées",
    searchPlaceholder: "Rechercher une commande",
    loading: "Chargement de vos commandes…", error: "Impossible de charger les commandes.",
    emptyTitleNone: "Aucune commande pour l'instant", emptyTitleFiltered: "Aucune commande trouvée",
    emptyTextNone: "Les commandes passées par vos clients WhatsApp apparaîtront ici.",
    colOrder: "Commande", colCustomer: "Client", colProducts: "Produits", colAmount: "Montant",
    colDelivery: "Livraison", colStatus: "Statut", viewOrder: "Voir la commande {num}", noDelivery: "—",
    statusNew: "Nouvelle", statusConfirmed: "Validée", statusDelivering: "En livraison",
    statusDelivered: "Livrée", statusCancelled: "Annulée",
  },
  orderDetail: {
    products: "Produits", total: "Total", delivery: "Livraison", notProvided: "Non renseignée",
    changeStatus: "Changer le statut", update: "Mettre à jour", updating: "Enregistrement…",
    notifyCustomer: "Prévenir le client par WhatsApp", updateFailed: "Échec de la mise à jour.",
  },
  catalog: {
    eyebrow: "Votre offre en temps réel", title: "Catalogue", subtitle: "Vos produits sont immédiatement disponibles pour votre agent.",
    addProduct: "Ajouter un produit", searchPlaceholder: "Rechercher un produit",
    loading: "Chargement de votre catalogue…", error: "Impossible de charger le catalogue.",
    emptyTitleNone: "Votre catalogue est vide", emptyTitleFiltered: "Aucun produit trouvé",
    emptyTextNone: "Ajoutez votre premier produit pour que votre agent puisse en parler à vos clients.",
    outOfStock: "En rupture", noCategory: "Sans catégorie", soldTimes: "Vendu {count} fois",
    toggleAvailability: "Basculer la disponibilité de {name}",
    helpTitle: "Bon à savoir :",
    helpText: "quand vous changez un prix ou une disponibilité, votre agent est informé immédiatement.",
  },
  addProductModal: {
    title: "Ajouter un produit", subtitle: "Ajoutez les informations que votre agent pourra utiliser immédiatement.",
    photoLabel: "Photo du produit", photoPreviewAlt: "Aperçu du produit", addPhoto: "Ajouter une photo",
    nameLabel: "Nom du produit", namePlaceholder: "Ex. Burger veggie",
    priceLabel: "Prix (FCFA)", pricePlaceholder: "Ex. 3 500",
    categoryLabel: "Catégorie", noCategory: "Sans catégorie",
    descLabel: "Description courte", descPlaceholder: "Décrivez votre produit en quelques mots.",
    adding: "Ajout en cours…", add: "Ajouter le produit",
    formatError: "Formats acceptés : JPEG, PNG, WEBP.", sizeError: "Image trop volumineuse (5 Mo maximum).",
    createError: "Échec de la création.",
  },
  followups: {
    eyebrow: "Ventes récupérées automatiquement", title: "Relances",
    subtitle: "Aidez vos clients à revenir, avec le bon message au bon moment.",
    activeRules: "Vos règles actives", activeRulesDesc: "Les relances s'envoient automatiquement selon vos choix.",
    ruleTitle: "Panier sans réponse", ruleDesc: "Relancer un client qui a demandé un prix mais n'a pas répondu.",
    ruleDelay: "Après 24 heures", activateRule: "Activer la règle",
    comingSoon: "Le moteur de relances automatiques arrive prochainement — ces règles ne sont pas encore actives côté serveur.",
  },
  negotiation: {
    loading: "Chargement des règles de négociation…", error: "Impossible de charger les règles.",
    allow: "Autoriser la négociation", allowDesc: "L'agent ne dépassera jamais les limites définies ci-dessous.",
    emptyProducts: "Ajoutez des produits à votre catalogue pour définir des règles de négociation.",
    catalogPrice: "Prix catalogue", floorPrice: "Prix plancher (FCFA)", maxDiscount: "Remise max (%)",
    negotiable: "{name} négociable",
    previewBefore: "Un client demandant une remise sur ",
    previewMiddle: " se verra proposer au maximum ",
    previewAfter: " (prix plancher : {floor} FCFA).",
  },
  agent: {
    eyebrow: "Votre assistant commercial", title: "Mon agent", subtitle: "Configurez son style et testez-le avant de le laisser répondre.",
    active: "Agent actif",
    formTitle: "Comment votre agent répond-il ?", formDesc: "Ces informations guident chaque conversation.",
    toneLabel: "Ton de l'agent", toneFriendly: "Amical", toneProfessional: "Professionnel", toneWarm: "Chaleureux",
    welcomeLabel: "Message d'accueil", infoLabel: "Informations que l'agent peut partager",
    saving: "Enregistrement…", saved: "Enregistré ✓", save: "Enregistrer les modifications",
    tryTitle: "Essayer votre agent", previewSub: "Aperçu de la conversation", simulation: "Simulation",
    sampleQuestion: "Bonsoir, vous avez des burgers ?", defaultWelcome: "Bonsoir ! Comment puis-je vous aider ?",
    previewFoot: "L'aperçu utilise les réglages actuels de votre agent.",
    negotiationTitle: "Règles de négociation", negotiationDesc: "Gardez le contrôle des prix que votre agent peut proposer.",
    reduce: "Réduire", configure: "Configurer",
  },
  billing: {
    eyebrow: "Votre abonnement Kozapp", title: "Facturation", subtitle: "Un seul abonnement, une seule facture en FCFA.",
    currentOffer: "Offre actuelle", active: "Actif", changePlan: "Changer de forfait",
    paymentTitle: "Paiement simplifié",
    paymentDesc: "Orange Money, MTN Mobile Money et carte bancaire seront acceptés à l'ouverture des paliers payants.",
    plans: {
      decouverte: { name: "Découverte", price: "0 FCFA / mois", desc: "Palier gratuit, sans engagement." },
      starter: { name: "Starter", price: "9 900 FCFA / mois", desc: "Pour les petits vendeurs qui grandissent." },
      business: { name: "Business", price: "24 900 FCFA / mois", desc: "Pour les commerçants établis et les restos." },
      scale: { name: "Scale", price: "dès 59 900 FCFA / mois", desc: "Pour les chaînes et gros volumes." },
    },
  },
  boutiqueTab: {
    title: "Informations de la boutique", desc: "Ces informations aident votre agent à répondre avec précision.",
    shopName: "Nom de la boutique", sector: "Secteur d'activité",
    sectorRestauration: "Restauration", sectorMode: "Mode", sectorServices: "Services", sectorOther: "Autre",
    deliveryZone: "Zone de livraison", whatsappNumber: "Numéro WhatsApp", address: "Adresse", hours: "Horaires",
    saving: "Enregistrement…", saved: "Enregistré ✓", save: "Enregistrer",
  },
  equipeTab: {
    title: "Membres de l'équipe", desc: "Invitez des collaborateurs et gérez leurs accès.",
    inviteLabel: "E-mail à inviter", invitePlaceholder: "collegue@boutique.cm", invite: "Inviter",
    loading: "Chargement de l'équipe…", error: "Impossible de charger l'équipe.",
    empty: "Aucun membre invité pour l'instant.",
    owner: "Propriétaire", member: "Membre", active: "Actif", invitationSent: "Invitation envoyée",
  },
  compteTab: {
    title: "Mot de passe et sécurité", desc: "Gérez vos identifiants et vos notifications.",
    password: "Mot de passe", passwordDesc: "Modifiable depuis cet écran", change: "Changer",
    emailNotif: "Notifications par e-mail", emailNotifDesc: "Nouvelles commandes, quotas, factures",
    closeAccount: "Fermer mon compte",
    closeAccountDesc: "Cette action supprime définitivement les données de votre boutique.",
  },
  analytics: {
    eyebrow: "Vue approfondie", title: "Analytics", subtitle: "Comprenez votre activité en profondeur pour vendre encore mieux.",
    loading: "Chargement de vos analytics…", error: "Impossible de charger les analytics.",
    geoTitle: "Répartition géographique", geoSubtitle: "D'où viennent vos commandes",
    conversionTitle: "Taux de conversion", conversionSubtitle: "Conversations transformées en commandes",
    peakHoursTitle: "Heures de forte activité", peakHoursSubtitle: "Quand vos clients vous contactent",
    followupsTitle: "Efficacité des relances", followupsSubtitle: "Messages envoyés vs commandes récupérées",
    negotiationTitle: "Impact de la négociation", negotiationSubtitle: "Votre agent maîtrise-t-il les prix ?",
    leakingTitle: "Ventes en train de fuir", leakingSubtitle: "Conversations stagnantes depuis 24h+", leakingSince: "depuis",
    segmentsTitle: "Clients nouveaux vs récurrents", segmentsSubtitle: "Fidélité de votre clientèle",
    quotaTitle: "Consommation du palier", quotaSubtitle: "Conversations et relances utilisées ce mois",
    converted: "Converti", inProgress: "En cours", lost: "Perdu", escalated: "Escaladé",
    sent: "Envoyées", responded: "Répondues", recoveredAmount: "Montant récupéré",
    negotiatedShare: "Part négociée", avgDiscount: "Remise moyenne", totalDiscount: "Total remises",
    newCustomers: "Nouveaux clients", returningClients: "Clients récurrents", repeatRate: "Taux de réachat",
    conversationsUsed: "Conversations", followupsUsed: "Relances",
    highUsageWarning: "Palier bientôt atteint",
    noData: "Pas encore de données pour cette période.",
  },
  confirmClose: {
    title: "Fermer définitivement votre compte ?",
    text: "Cette action supprime toutes les données de votre boutique — commandes, catalogue, conversations. Elle est irréversible.",
    cancel: "Annuler", confirm: "Oui, fermer mon compte",
  },
  changePasswordModal: {
    title: "Changer de mot de passe", desc: "Confirmez votre mot de passe actuel, puis choisissez-en un nouveau.",
    current: "Mot de passe actuel", newPassword: "Nouveau mot de passe", confirmNew: "Confirmer le nouveau mot de passe",
    mismatch: "Les deux mots de passe ne correspondent pas.",
    genericError: "Impossible de mettre à jour le mot de passe pour le moment.",
    saving: "Enregistrement…", submit: "Mettre à jour le mot de passe",
    successTitle: "Mot de passe mis à jour", successText: "Votre mot de passe a bien été modifié.",
    show: "Afficher", hide: "Masquer", close: "Fermer",
    passwordHint: "Au moins 6 caractères, avec au moins une lettre et un chiffre.",
  },
};

const dashboardEn: DashboardT = {
  loadingApp: "Loading your Kozapp space…",
  sidebar: {
    helpCenter: "Help center", korahSolution: "A solution by", logout: "Log out",
    connected: "connected", notConnected: "not connected",
  },
  menu: {
    dashboard: "Dashboard", analytics: "Analytics", orders: "Orders", catalog: "Catalog", followups: "Follow-ups",
    agent: "My agent", billing: "Billing", settings: "Settings",
  },
  bottomNav: { home: "Home", more: "More" },
  topbar: {
    whatsappConnected: "Your WhatsApp is connected", whatsappNotConnected: "Your WhatsApp is not connected",
    notifications: "Notifications", noNotifications: "No notifications yet.",
    parameters: "Settings", languageFr: "French", languageEn: "English", logout: "Log out",
  },
  settings: {
    boutique: "Shop", team: "Team", language: "Language", account: "Account",
    heading: "Your space, your way", title: "Settings", subtitle: "Manage your shop, your team, and your account.",
    languageTitle: "Interface language",
    languageDesc: "What you see in your Kozapp space — different from your agent's language, adjustable in \"My agent\".",
    languageLabel: "Interface language", save: "Save", saved: "Saved ✓",
  },
  common: {
    loading: "Loading…", error: "Error", retry: "Retry", save: "Save", saving: "Saving…",
    saved: "Saved ✓", cancel: "Cancel", search: "Search", close: "Close", add: "Add",
    edit: "Edit", delete: "Delete", confirm: "Confirm", back: "Back",
    resetSearch: "Reset search", noResultsFor: "No results for « {query} ».", view: "View",
  },
  dashboard: {
    today: "Today", greeting: "Hello", subtitle: "Here's what's happening in your shop today.",
    periodToday: "Today", periodLast7: "Last 7 days", periodThisMonth: "This month", periodAllTime: "All time",
    loadingStats: "Loading your dashboard…", errorStats: "Couldn't load your stats.",
    ordersLabel: "Orders", ordersEmpty: "None yet", total: "Total",
    customersLabel: "Customers", customersEmpty: "None yet",
    revenueLabel: "Revenue (FCFA)", avgBasket: "Average basket: {amount} FCFA",
    conversations: "Conversations", perTier: "/ per plan", quotaHint: "Quota tracking available with a subscription",
    emptyTitle: "Your dashboard will fill up as soon as you get your first conversations",
    emptyText: "Add products to your catalog and connect your WhatsApp to start receiving orders.",
    emptyAction: "Add a product",
    attentionTitle: "Needs your attention", attentionSubtitle: "A few quick actions",
    pendingOrders: "Pending orders", pendingOrdersDesc: "To confirm as soon as possible",
    subscription: "Your subscription", subscriptionDesc: "See this month's usage",
    bestProducts: "Best-selling products", bestProductsSub: "Across your whole activity",
    catalogLink: "Catalog", noSales: "No sales recorded yet.", sold: "sold",
  },
  orders: {
    eyebrow: "Operational tracking", title: "Orders", subtitle: "Find and track every order, from message to delivery.",
    summaryCount: "orders", summaryPending: "awaiting action", summaryDelivered: "orders delivered",
    searchPlaceholder: "Search an order",
    loading: "Loading your orders…", error: "Couldn't load orders.",
    emptyTitleNone: "No orders yet", emptyTitleFiltered: "No orders found",
    emptyTextNone: "Orders placed by your WhatsApp customers will appear here.",
    colOrder: "Order", colCustomer: "Customer", colProducts: "Products", colAmount: "Amount",
    colDelivery: "Delivery", colStatus: "Status", viewOrder: "View order {num}", noDelivery: "—",
    statusNew: "New", statusConfirmed: "Confirmed", statusDelivering: "Out for delivery",
    statusDelivered: "Delivered", statusCancelled: "Cancelled",
  },
  orderDetail: {
    products: "Products", total: "Total", delivery: "Delivery", notProvided: "Not provided",
    changeStatus: "Change status", update: "Update", updating: "Saving…",
    notifyCustomer: "Notify the customer by WhatsApp", updateFailed: "Update failed.",
  },
  catalog: {
    eyebrow: "Your live offer", title: "Catalog", subtitle: "Your products are instantly available to your agent.",
    addProduct: "Add a product", searchPlaceholder: "Search a product",
    loading: "Loading your catalog…", error: "Couldn't load the catalog.",
    emptyTitleNone: "Your catalog is empty", emptyTitleFiltered: "No products found",
    emptyTextNone: "Add your first product so your agent can talk about it to your customers.",
    outOfStock: "Out of stock", noCategory: "No category", soldTimes: "Sold {count} times",
    toggleAvailability: "Toggle availability for {name}",
    helpTitle: "Good to know:",
    helpText: "when you change a price or availability, your agent is informed instantly.",
  },
  addProductModal: {
    title: "Add a product", subtitle: "Add the details your agent can use right away.",
    photoLabel: "Product photo", photoPreviewAlt: "Product preview", addPhoto: "Add a photo",
    nameLabel: "Product name", namePlaceholder: "E.g. Veggie burger",
    priceLabel: "Price (FCFA)", pricePlaceholder: "E.g. 3,500",
    categoryLabel: "Category", noCategory: "No category",
    descLabel: "Short description", descPlaceholder: "Describe your product in a few words.",
    adding: "Adding…", add: "Add product",
    formatError: "Accepted formats: JPEG, PNG, WEBP.", sizeError: "Image too large (5 MB max).",
    createError: "Couldn't create the product.",
  },
  followups: {
    eyebrow: "Sales recovered automatically", title: "Follow-ups",
    subtitle: "Help customers come back, with the right message at the right time.",
    activeRules: "Your active rules", activeRulesDesc: "Follow-ups are sent automatically based on your settings.",
    ruleTitle: "Cart with no reply", ruleDesc: "Follow up with a customer who asked for a price but didn't reply.",
    ruleDelay: "After 24 hours", activateRule: "Enable rule",
    comingSoon: "The automatic follow-up engine is coming soon — these rules aren't active on the server yet.",
  },
  negotiation: {
    loading: "Loading negotiation rules…", error: "Couldn't load the rules.",
    allow: "Allow negotiation", allowDesc: "The agent will never go past the limits set below.",
    emptyProducts: "Add products to your catalog to set negotiation rules.",
    catalogPrice: "Catalog price", floorPrice: "Floor price (FCFA)", maxDiscount: "Max discount (%)",
    negotiable: "{name} negotiable",
    previewBefore: "A customer asking for a discount on ",
    previewMiddle: " will be offered at most ",
    previewAfter: " (floor price: {floor} FCFA).",
  },
  agent: {
    eyebrow: "Your sales assistant", title: "My agent", subtitle: "Configure its style and try it out before letting it reply.",
    active: "Agent active",
    formTitle: "How does your agent reply?", formDesc: "This information guides every conversation.",
    toneLabel: "Agent tone", toneFriendly: "Friendly", toneProfessional: "Professional", toneWarm: "Warm",
    welcomeLabel: "Welcome message", infoLabel: "Information the agent can share",
    saving: "Saving…", saved: "Saved ✓", save: "Save changes",
    tryTitle: "Try your agent", previewSub: "Conversation preview", simulation: "Simulation",
    sampleQuestion: "Hi, do you have burgers?", defaultWelcome: "Hello! How can I help you?",
    previewFoot: "This preview uses your agent's current settings.",
    negotiationTitle: "Negotiation rules", negotiationDesc: "Keep control over the prices your agent can offer.",
    reduce: "Collapse", configure: "Configure",
  },
  billing: {
    eyebrow: "Your Kozapp subscription", title: "Billing", subtitle: "One subscription, one bill, in FCFA.",
    currentOffer: "Current plan", active: "Active", changePlan: "Change plan",
    paymentTitle: "Simplified payment",
    paymentDesc: "Orange Money, MTN Mobile Money, and credit card will be accepted once paid tiers open.",
    plans: {
      decouverte: { name: "Découverte", price: "0 FCFA / month", desc: "Free tier, no commitment." },
      starter: { name: "Starter", price: "9,900 FCFA / month", desc: "For small sellers who are growing." },
      business: { name: "Business", price: "24,900 FCFA / month", desc: "For established merchants and restaurants." },
      scale: { name: "Scale", price: "from 59,900 FCFA / month", desc: "For chains and high volumes." },
    },
  },
  boutiqueTab: {
    title: "Shop information", desc: "This information helps your agent reply accurately.",
    shopName: "Shop name", sector: "Business sector",
    sectorRestauration: "Food & restaurants", sectorMode: "Fashion", sectorServices: "Services", sectorOther: "Other",
    deliveryZone: "Delivery area", whatsappNumber: "WhatsApp number", address: "Address", hours: "Hours",
    saving: "Saving…", saved: "Saved ✓", save: "Save",
  },
  equipeTab: {
    title: "Team members", desc: "Invite collaborators and manage their access.",
    inviteLabel: "Email to invite", invitePlaceholder: "colleague@shop.cm", invite: "Invite",
    loading: "Loading your team…", error: "Couldn't load the team.",
    empty: "No members invited yet.",
    owner: "Owner", member: "Member", active: "Active", invitationSent: "Invitation sent",
  },
  compteTab: {
    title: "Password and security", desc: "Manage your credentials and notifications.",
    password: "Password", passwordDesc: "Editable from this screen", change: "Change",
    emailNotif: "Email notifications", emailNotifDesc: "New orders, quotas, invoices",
    closeAccount: "Close my account",
    closeAccountDesc: "This action permanently deletes your shop's data.",
  },
  analytics: {
    eyebrow: "Deep dive", title: "Analytics", subtitle: "Understand your activity in depth to sell even better.",
    loading: "Loading your analytics…", error: "Couldn't load analytics.",
    geoTitle: "Geographic breakdown", geoSubtitle: "Where your orders come from",
    conversionTitle: "Conversion rate", conversionSubtitle: "Conversations turned into orders",
    peakHoursTitle: "Peak hours", peakHoursSubtitle: "When your customers reach out",
    followupsTitle: "Follow-up performance", followupsSubtitle: "Messages sent vs orders recovered",
    negotiationTitle: "Negotiation impact", negotiationSubtitle: "Does your agent hold the line on prices?",
    leakingTitle: "Leaking sales", leakingSubtitle: "Conversations stuck for 24h+", leakingSince: "since",
    segmentsTitle: "New vs returning customers", segmentsSubtitle: "Customer loyalty",
    quotaTitle: "Plan usage", quotaSubtitle: "Conversations and follow-ups used this month",
    converted: "Converted", inProgress: "In progress", lost: "Lost", escalated: "Escalated",
    sent: "Sent", responded: "Responded", recoveredAmount: "Recovered amount",
    negotiatedShare: "Negotiated share", avgDiscount: "Avg discount", totalDiscount: "Total discounts",
    newCustomers: "New customers", returningClients: "Returning customers", repeatRate: "Repeat rate",
    conversationsUsed: "Conversations", followupsUsed: "Follow-ups",
    highUsageWarning: "Plan limit approaching",
    noData: "No data for this period yet.",
  },
  confirmClose: {
    title: "Permanently close your account?",
    text: "This action deletes all your shop's data — orders, catalog, conversations. It cannot be undone.",
    cancel: "Cancel", confirm: "Yes, close my account",
  },
  changePasswordModal: {
    title: "Change password", desc: "Confirm your current password, then choose a new one.",
    current: "Current password", newPassword: "New password", confirmNew: "Confirm new password",
    mismatch: "The two passwords don't match.",
    genericError: "Couldn't update the password right now.",
    saving: "Saving…", submit: "Update password",
    successTitle: "Password updated", successText: "Your password has been changed.",
    show: "Show", hide: "Hide", close: "Close",
    passwordHint: "At least 6 characters, with at least one letter and one digit.",
  },
};

const DASHBOARD_TRANSLATIONS: Record<Lang, DashboardT> = { fr: dashboardFr, en: dashboardEn };

export function useDashboardT() {
  const { lang } = useLanguage();
  return DASHBOARD_TRANSLATIONS[lang];
}

/* ================================================================
   AUTH (login/register + forgot/reset password)
   ================================================================ */
export type AuthT = {
  login: string; register: string;
  welcomeBackTitle: string; registerTitle: string;
  welcomeBackSub: string; registerSub: string;
  googleContinue: string; comingSoon: string; or: string;
  shopNameLabel: string; shopNamePlaceholder: string;
  emailLabel: string; emailPlaceholder: string; passwordLabel: string;
  forgotPassword: string; submitLoading: string; submitLogin: string; submitRegister: string;
  legalPrefix: string; terms: string; legalAnd: string; privacy: string;
  genericError: string;
  forgotTitle: string; forgotSub: string; forgotSend: string; forgotSent: string; forgotSending: string;
  forgotBackToLogin: string; forgotDone: string; checkEmailTitle: string; checkEmailBefore: string; checkEmailAfter: string;
  resetTitle: string; resetSub: string; resetNewPassword: string; resetConfirm: string;
  resetSubmit: string; resetSaving: string; resetDone: string; resetDoneSub: string; resetLoginLink: string;
  resetInvalidTitle: string; resetInvalidSub: string; resetInvalidCta: string;
  passwordMismatch: string; passwordHint: string;
};

const authFr: AuthT = {
  login: "Se connecter", register: "Créer un compte",
  welcomeBackTitle: "Content de vous revoir", registerTitle: "Automatisons votre WhatsApp ensemble",
  welcomeBackSub: "Connectez-vous pour retrouver votre boutique Kozapp.", registerSub: "Créez votre compte, sans carte bancaire.",
  googleContinue: "Continuer avec Google", comingSoon: "Bientôt disponible", or: "ou",
  shopNameLabel: "Nom de la boutique", shopNamePlaceholder: "Ex. La Damé",
  emailLabel: "Adresse e-mail", emailPlaceholder: "vous@boutique.cm", passwordLabel: "Mot de passe",
  forgotPassword: "Mot de passe oublié ?", submitLoading: "Un instant…",
  submitLogin: "Se connecter", submitRegister: "Créer mon compte",
  legalPrefix: "En vous connectant, vous acceptez nos", terms: "Conditions d'utilisation",
  legalAnd: "et notre", privacy: "Politique de confidentialité",
  genericError: "Impossible de contacter le serveur. Réessayez.",
  forgotTitle: "Mot de passe oublié", forgotSub: "Indiquez votre e-mail, nous vous enverrons un lien de réinitialisation.",
  forgotSend: "Envoyer le lien", forgotSent: "Lien envoyé", forgotSending: "Envoi…", forgotBackToLogin: "Retour à la connexion",
  forgotDone: "Si un compte existe avec cet e-mail, un lien de réinitialisation a été envoyé.",
  checkEmailTitle: "Vérifiez votre boîte mail",
  checkEmailBefore: "Si un compte existe avec l'adresse ",
  checkEmailAfter: ", vous recevrez un lien pour choisir un nouveau mot de passe.",
  resetTitle: "Choisir un nouveau mot de passe", resetSub: "Ce lien est valable une heure.",
  resetNewPassword: "Nouveau mot de passe", resetConfirm: "Confirmer le mot de passe",
  resetSubmit: "Mettre à jour le mot de passe", resetSaving: "Enregistrement…",
  resetDone: "Mot de passe mis à jour", resetDoneSub: "Vous pouvez maintenant vous connecter avec votre nouveau mot de passe.",
  resetLoginLink: "Se connecter",
  resetInvalidTitle: "Lien invalide", resetInvalidSub: "Ce lien de réinitialisation est incomplet. Redemandez-en un nouveau.",
  resetInvalidCta: "Redemander un lien",
  passwordMismatch: "Les deux mots de passe ne correspondent pas.",
  passwordHint: "Au moins 6 caractères, avec au moins une lettre et un chiffre.",
};

const authEn: AuthT = {
  login: "Log in", register: "Create account",
  welcomeBackTitle: "Welcome back", registerTitle: "Let's automate your WhatsApp together",
  welcomeBackSub: "Log in to get back to your Kozapp shop.", registerSub: "Create your account, no credit card needed.",
  googleContinue: "Continue with Google", comingSoon: "Coming soon", or: "or",
  shopNameLabel: "Shop name", shopNamePlaceholder: "E.g. La Damé",
  emailLabel: "Email address", emailPlaceholder: "you@shop.cm", passwordLabel: "Password",
  forgotPassword: "Forgot your password?", submitLoading: "One moment…",
  submitLogin: "Log in", submitRegister: "Create my account",
  legalPrefix: "By logging in, you agree to our", terms: "Terms of use",
  legalAnd: "and our", privacy: "Privacy policy",
  genericError: "Couldn't reach the server. Please try again.",
  forgotTitle: "Forgot password", forgotSub: "Enter your email and we'll send you a reset link.",
  forgotSend: "Send link", forgotSent: "Link sent", forgotSending: "Sending…", forgotBackToLogin: "Back to login",
  forgotDone: "If an account exists with this email, a reset link has been sent.",
  checkEmailTitle: "Check your inbox",
  checkEmailBefore: "If an account exists with the address ",
  checkEmailAfter: ", you'll receive a link to choose a new password.",
  resetTitle: "Choose a new password", resetSub: "This link is valid for one hour.",
  resetNewPassword: "New password", resetConfirm: "Confirm password",
  resetSubmit: "Update password", resetSaving: "Saving…",
  resetDone: "Password updated", resetDoneSub: "You can now log in with your new password.",
  resetLoginLink: "Log in",
  resetInvalidTitle: "Invalid link", resetInvalidSub: "This reset link is incomplete. Request a new one.",
  resetInvalidCta: "Request a new link",
  passwordMismatch: "The two passwords don't match.",
  passwordHint: "At least 6 characters, with at least one letter and one digit.",
};

const AUTH_TRANSLATIONS: Record<Lang, AuthT> = { fr: authFr, en: authEn };

export function useAuthT() {
  const { lang } = useLanguage();
  return AUTH_TRANSLATIONS[lang];
}

/* ================================================================
   PRICING PAGE
   ================================================================ */
export type PricingT = {
  eyebrow: string; title: string; subtitle: string;
  recommended: string; compareAll: string; applying: string;
  priceCol: string; genericError: string;
  plans: { name: string; target: string; sub: string; cta: string; features: string[] }[];
  comparisonRows: { label: string; values: string[] }[];
};

const pricingFr: PricingT = {
  eyebrow: "Forfaits", title: "Choisissez votre forfait",
  subtitle: "Tous les forfaits incluent le chatbot IA, le catalogue et la connexion WhatsApp Business.",
  recommended: "Recommandé", compareAll: "Comparer tous les détails", applying: "Un instant…",
  priceCol: "Prix", genericError: "Impossible d'appliquer ce forfait pour le moment.",
  plans: [
    { name: "Découverte", target: "Test, découverte", sub: "Gratuit, sans carte", cta: "Essayer gratuitement",
      features: ["1 numéro WhatsApp", "~100 conversations / mois", "15 produits au catalogue", "Tableau de bord basique"] },
    { name: "Starter", target: "Petits vendeurs", sub: "", cta: "Commencer",
      features: ["~800 conversations / mois", "100 produits au catalogue", "150 relances incluses", "Marque Kozapp retirée"] },
    { name: "Business", target: "Commerçants établis, restos", sub: "", cta: "Commencer",
      features: ["2 numéros WhatsApp", "~3 000 conversations / mois", "Catalogue illimité + 600 relances", "Analytics avancées, support prioritaire"] },
    { name: "Scale", target: "Chaînes, gros volumes", sub: "ou sur devis", cta: "Nous contacter",
      features: ["Numéros WhatsApp multiples", "Volume élevé / à la carte", "Notes vocales complètes", "Analytics + équipe, support dédié"] },
  ],
  comparisonRows: [
    { label: "Numéros WhatsApp", values: ["1", "1", "2", "Multi"] },
    { label: "Modèle IA", values: ["Flash-Lite", "Flash-Lite", "3.6 Flash", "Premium en option"] },
    { label: "Conversations / mois", values: ["~100", "~800", "~3 000", "Élevé / à la carte"] },
    { label: "Catalogue produits", values: ["15", "100", "Illimité", "Illimité"] },
    { label: "Relances incluses", values: ["0", "150", "600", "Élevé"] },
    { label: "Notes vocales", values: ["Non", "Entrée", "Entrée (+images V2)", "Complet"] },
    { label: "Négociation", values: ["Non", "Basique", "Avancée", "Avancée"] },
    { label: "Tableau de bord", values: ["Basique", "Complet", "Analytics avancées", "Analytics + équipe"] },
    { label: "Marque Kozapp", values: ["Affichée", "Retirée", "Retirée", "Retirée"] },
    { label: "Support", values: ["Communautaire", "Standard", "Prioritaire", "Dédié"] },
  ],
};

const pricingEn: PricingT = {
  eyebrow: "Plans", title: "Choose your plan",
  subtitle: "Every plan includes the AI chatbot, the catalog, and the WhatsApp Business connection.",
  recommended: "Recommended", compareAll: "Compare all details", applying: "One moment…",
  priceCol: "Price", genericError: "Couldn't apply this plan right now.",
  plans: [
    { name: "Découverte", target: "Testing it out", sub: "Free, no card", cta: "Try it free",
      features: ["1 WhatsApp number", "~100 conversations / month", "15 products in the catalog", "Basic dashboard"] },
    { name: "Starter", target: "Small sellers", sub: "", cta: "Get started",
      features: ["~800 conversations / month", "100 products in the catalog", "150 follow-ups included", "Kozapp branding removed"] },
    { name: "Business", target: "Established merchants, restaurants", sub: "", cta: "Get started",
      features: ["2 WhatsApp numbers", "~3,000 conversations / month", "Unlimited catalog + 600 follow-ups", "Advanced analytics, priority support"] },
    { name: "Scale", target: "Chains, high volumes", sub: "or custom quote", cta: "Contact us",
      features: ["Multiple WhatsApp numbers", "High volume / a la carte", "Full voice note support", "Analytics + team, dedicated support"] },
  ],
  comparisonRows: [
    { label: "WhatsApp numbers", values: ["1", "1", "2", "Multi"] },
    { label: "AI model", values: ["Flash-Lite", "Flash-Lite", "3.6 Flash", "Premium optional"] },
    { label: "Conversations / month", values: ["~100", "~800", "~3,000", "High / a la carte"] },
    { label: "Product catalog", values: ["15", "100", "Unlimited", "Unlimited"] },
    { label: "Follow-ups included", values: ["0", "150", "600", "High"] },
    { label: "Voice notes", values: ["No", "Input", "Input (+images V2)", "Full"] },
    { label: "Negotiation", values: ["No", "Basic", "Advanced", "Advanced"] },
    { label: "Dashboard", values: ["Basic", "Full", "Advanced analytics", "Analytics + team"] },
    { label: "Kozapp branding", values: ["Shown", "Removed", "Removed", "Removed"] },
    { label: "Support", values: ["Community", "Standard", "Priority", "Dedicated"] },
  ],
};

const PRICING_TRANSLATIONS: Record<Lang, PricingT> = { fr: pricingFr, en: pricingEn };

export function usePricingT() {
  const { lang } = useLanguage();
  return PRICING_TRANSLATIONS[lang];
}

/* ================================================================
   ONBOARDING (5 steps)
   ================================================================ */
export type OnboardingT = {
  skip: string; continueLabel: string; finish: string; stepOf: string;
  step1Title: string; step1Desc: string; fullName: string; fullNamePlaceholder: string;
  role: string; rolePlaceholder: string;
  step2Title: string; step2Desc: string; companyName: string; companyNamePlaceholder: string;
  sector: string; chooseSector: string;
  sectorMode: string; sectorBeaute: string; sectorRestauration: string; sectorEcommerce: string;
  sectorElectronique: string; sectorServices: string; sectorAutre: string;
  step3Title: string; step3Desc: string;
  needs: string[];
  step4Title: string; step4Desc: string; whatsappNumber: string; infoBoxText: string;
  step5Title: string; step5Desc: string;
  sourceFacebook: string; sourceWhatsapp: string; sourceWordOfMouth: string; sourceOther: string;
};

const onboardingFr: OnboardingT = {
  skip: "Passer", continueLabel: "Continuer", finish: "Terminer", stepOf: "Étape {current} sur {total}",
  step1Title: "Toi", step1Desc: "Pour que l'assistant parle en votre nom.",
  fullName: "Nom complet", fullNamePlaceholder: "Ex. Marie Kouam",
  role: "Fonction / rôle dans l'entreprise", rolePlaceholder: "Ex. Gérante, Responsable ventes",
  step2Title: "Ton entreprise", step2Desc: "Ce que vos clients voient dans la conversation.",
  companyName: "Nom de l'entreprise ou de la boutique", companyNamePlaceholder: "Ex. La Damé",
  sector: "Secteur d'activité", chooseSector: "Choisir un secteur",
  sectorMode: "Mode", sectorBeaute: "Beauté", sectorRestauration: "Restauration", sectorEcommerce: "E-commerce",
  sectorElectronique: "Électronique", sectorServices: "Services", sectorAutre: "Autre",
  step3Title: "Ton besoin principal", step3Desc: "On configure l'IA en priorité pour ça.",
  needs: ["Service après-vente", "Prise de commande", "Relance clients", "Catalogue produits", "Autre"],
  step4Title: "Numéro WhatsApp", step4Desc: "Le numéro que l'assistant va gérer.",
  whatsappNumber: "Numéro WhatsApp Business",
  infoBoxText: "Ce numéro sert à connecter l'assistant : il répond à vos clients, envoie le catalogue et enregistre les commandes. Vous gardez le contrôle total et pouvez le déconnecter à tout moment.",
  step5Title: "D'où venez-vous ?", step5Desc: "Ça nous aide à mieux vous accompagner.",
  sourceFacebook: "Facebook", sourceWhatsapp: "WhatsApp", sourceWordOfMouth: "Bouche-à-oreille", sourceOther: "Autre",
};

const onboardingEn: OnboardingT = {
  skip: "Skip", continueLabel: "Continue", finish: "Finish", stepOf: "Step {current} of {total}",
  step1Title: "You", step1Desc: "So the assistant can speak on your behalf.",
  fullName: "Full name", fullNamePlaceholder: "E.g. Marie Kouam",
  role: "Role / position in the company", rolePlaceholder: "E.g. Manager, Sales lead",
  step2Title: "Your company", step2Desc: "What your customers see in the conversation.",
  companyName: "Company or shop name", companyNamePlaceholder: "E.g. La Damé",
  sector: "Business sector", chooseSector: "Choose a sector",
  sectorMode: "Fashion", sectorBeaute: "Beauty", sectorRestauration: "Food & restaurants", sectorEcommerce: "E-commerce",
  sectorElectronique: "Electronics", sectorServices: "Services", sectorAutre: "Other",
  step3Title: "Your main need", step3Desc: "We'll configure the AI for this first.",
  needs: ["After-sales support", "Taking orders", "Customer follow-ups", "Product catalog", "Other"],
  step4Title: "WhatsApp number", step4Desc: "The number the assistant will manage.",
  whatsappNumber: "WhatsApp Business number",
  infoBoxText: "This number is used to connect the assistant: it replies to your customers, sends the catalog, and records orders. You keep full control and can disconnect it at any time.",
  step5Title: "Where did you hear about us?", step5Desc: "This helps us support you better.",
  sourceFacebook: "Facebook", sourceWhatsapp: "WhatsApp", sourceWordOfMouth: "Word of mouth", sourceOther: "Other",
};

const ONBOARDING_TRANSLATIONS: Record<Lang, OnboardingT> = { fr: onboardingFr, en: onboardingEn };

export function useOnboardingT() {
  const { lang } = useLanguage();
  return ONBOARDING_TRANSLATIONS[lang];
}
