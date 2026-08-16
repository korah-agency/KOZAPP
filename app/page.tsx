"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useInView } from "@/lib/hooks";
import { LanguageProvider, useLanguage, type Lang } from "@/lib/i18n";
import {
  ArrowRight, Bot, ChevronDown, ChevronUp,
  Globe2, Headphones, MessageCircle, Package, PieChart,
  Send, ShoppingBag, Sparkles, Star, Shield,
  Clock, Zap, CreditCard, Smartphone,
  Shirt, Scissors, UtensilsCrossed, Monitor, Wrench, BarChart3,
  ShieldCheck, Lock, Tag, Mic, Image as ImageIcon
} from "lucide-react";
import { KORAH_WEBSITE_URL, SOCIAL_PROOF, WHATSAPP_CONTACT_URL } from "@/lib/social-proof";

/* ─── Traductions FR / EN ─── */
const T = {
  fr: {
    nav: { cta: "Commencer gratuitement" },
    hero: {
      h1: "Kozapp répond à tes clients sur WhatsApp\net suit tes ventes, jour et nuit",
      p: "Une seule solution pour ne plus rater une commande et savoir exactement ce que ça rapporte.",
      ctaPrimary: "Commencer gratuitement",
      ctaWhatsapp: "Discuter sur WhatsApp",
      guarantees: ["Sans carte bancaire", "Prêt en 5 minutes", "Annulation à tout moment"],
      demoLabel: "Démo en direct",
      chat: [
        { from: "client", text: "Bonsoir, la robe verte est encore dispo ?", time: "19:02" },
        { from: "bot", text: "Bonsoir ! Oui, la robe Ndop verte est disponible en M et L — 18 500 FCFA.", time: "19:02" },
        { from: "client", text: "Tu peux faire 16 000 ?", time: "19:03" },
        { from: "bot", text: "Je peux faire 17 500 FCFA livraison incluse à Douala. Je réserve la M ?", time: "19:03" },
        { from: "client", text: "Ok je prends", time: "19:04" },
        { from: "bot", text: "Commande #1042 enregistrée. Livraison demain avant 14h.", time: "19:04" },
      ],
    },
    socialProof: {
      lead: SOCIAL_PROOF.ambitionMessage,
      points: [
        "API officielle WhatsApp Business (Meta)",
        "Données hébergées et chiffrées",
        "Équipe fondatrice joignable en direct",
        "Sans engagement, résiliable à tout moment",
      ],
    },
    problemSolution: {
      eyebrow: "Le problème",
      h2: "Gérer votre activité vous prend tout votre temps",
      sub: "Vous êtes commerçant, pas informaticien. Pourtant vous passez plus de temps à gérer les messages et le suivi qu'à vendre.",
      items: [
        { problem: "Vous passez des heures à répondre aux messages un par un", solution: "L'agent IA répond en quelques secondes, 24h/24, même pendant votre sommeil" },
        { problem: "Les commandes sont éparpillées dans vos discussions WhatsApp", solution: "Chaque commande est enregistrée, suivie et centralisée dans votre tableau de bord" },
        { problem: "Vous n'avez aucune visibilité sur vos revenus et meilleurs produits", solution: "Un dashboard en temps réel vous donne commandes, revenus et tendances en un coup d'œil" },
        { problem: "Vous oubliez les relances et perdez des ventes", solution: "Les relances automatiques et le suivi client s'enclenchent sans intervention manuelle" },
      ],
    },
    benefits: {
      eyebrow: "Ce que Kozapp change concrètement",
      h2: "Deux piliers, une seule solution",
      sub: "Un agent IA qui répond à vos clients, et un espace web qui pilote toute votre activité.",
      agentTitle: "Agent IA WhatsApp",
      gestionTitle: "Espace de gestion",
      agent: [
        { title: "Réponse instantanée 24h/24", stat: "24h/24", desc: "Votre agent comprend français, anglais et pidgin. Il répond comme vous le feriez, avec le ton de votre boutique.", statLabel: "disponible" },
        { title: "Comprend les vocaux", stat: "2 langues", desc: "Les notes vocales de vos clients sont comprises et traitées comme du texte. Pas de perte d'information.", statLabel: "" },
        { title: "Négocie intelligemment", stat: "0 perte", desc: "L'IA négocie dans les marges que vous fixez. Jamais en dessous de votre prix plancher.", statLabel: "de marge préservée" },
      ],
      gestion: [
        { title: "Commandes centralisées", stat: "100%", desc: "Chaque commande WhatsApp est enregistrée, suivie et archivée dans votre tableau de bord. Zéro commande oubliée.", statLabel: "automatisé" },
        { title: "Tableau de bord en temps réel", stat: "Temps réel", desc: "Revenus, produits vedettes, quartiers les plus actifs, taux de livraison — tout est visible d'un coup d'œil.", statLabel: "" },
        { title: "Relances automatiques", stat: "+30%", desc: "Les relances automatiques ramènent les clients qui n'ont pas répondu. Suivi client sans effort.", statLabel: "de ventes en plus" },
      ],
    },
    demo: {
      eyebrow: "Démo",
      h2: "Voyez Kozapp en action",
      sub: "Découvrez comment l'agent gère une conversation, puis comment la commande apparaît dans votre tableau de bord.",
      label: "Voir comment ça marche",
    },
    useCases: {
      eyebrow: "Secteurs",
      h2: "Kozapp s'adapte à votre activité",
      sub: "Que vous vendiez des robes, des plats ou des services, votre agent se configure en quelques minutes.",
      sectors: [
        { label: "Mode", example: "Présentez vos collections, négociez les prix, enregistrez les commandes" },
        { label: "Beauté", example: "Conseillez vos produits, gérez les rendez-vous, relancez les clientes" },
        { label: "Restauration", example: "Envoyez le menu, prenez les commandes, confirmez la livraison" },
        { label: "E-commerce", example: "Gérez votre catalogue, suivez les ventes, relancez les paniers" },
        { label: "Électronique", example: "Répondez aux questions techniques, comparez les produits, conseillez" },
        { label: "Services", example: "Prenez les rendez-vous, envoyez les devis, suivez les interventions" },
      ],
    },
    launch: {
      eyebrow: "Programme de lancement",
      h2: "Construit avec les premiers commerçants, pas après",
      sub: "Kozapp est un produit jeune : chaque retour des premiers utilisateurs façonne directement les prochaines fonctionnalités. Vous ne rejoignez pas un produit figé.",
      pillars: [
        { title: "Ligne directe avec l'équipe", desc: "Vos messages arrivent aux fondateurs, pas à un centre d'appel anonyme. Chaque retour est lu et pris en compte." },
        { title: "Tarif de lancement bloqué", desc: "Les commerçants qui démarrent maintenant gardent leur prix, même quand nos offres évolueront." },
        { title: "Zéro risque pour commencer", desc: "Aucune carte bancaire, aucun engagement. Vous testez, vous décidez." },
      ],
    },
    pricingPreview: {
      eyebrow: "Forfaits",
      h2: "Un prix clair, sans surprise",
      p: "Commencez gratuitement, changez de formule quand votre volume grandit.",
      link: "Voir tous les forfaits",
      plans: [
        { name: "Découverte", price: "0 FCFA", period: "/mois", sub: "Gratuit, sans carte", highlight: false, cta: "Essayer" },
        { name: "Starter", price: "9 900 FCFA", period: "/mois", sub: "", highlight: false, cta: "Commencer" },
        { name: "Business", price: "24 900 FCFA", period: "/mois", sub: "", highlight: true, cta: "Commencer" },
        { name: "Scale", price: "dès 59 900", period: " FCFA/mois", sub: "ou sur devis", highlight: false, cta: "Nous contacter" },
      ],
      payments: ["Carte bancaire", "Orange Money", "MTN Mobile Money"],
      recommended: "Recommandé",
    },
    faq: {
      eyebrow: "FAQ",
      h2: "Questions fréquentes",
      items: [
        { q: "Faut-il des compétences techniques pour démarrer ?", a: "Non. Vous créez votre compte, connectez votre WhatsApp en quelques clics, et votre agent est prêt. Aucune installation, aucun code, aucune intervention technique." },
        { q: "Comment Kozapp se connecte à mon WhatsApp ?", a: "Kozapp utilise l'API officielle de WhatsApp Business de Meta. La connexion se fait en quelques minutes, sans intervention technique. Vous gardez le contrôle total de votre numéro." },
        { q: "Est-ce que mes clients savent qu'ils parlent à un bot ?", a: "L'agent est configuré pour répondre comme le ferait un membre de votre équipe. La plupart des clients ne font pas la différence. Vous pouvez personnaliser le ton et les réponses." },
        { q: "Que se passe-t-il si je dépasse mes conversations ?", a: "Votre agent continue de fonctionner. Vous serez notifié et pourrez upgrader vers un forfait plus volumineux. Aucune interruption de service." },
        { q: "Puis-je essayer gratuitement ?", a: "Oui. Le forfait Découverte est entièrement gratuit, sans carte bancaire. Vous pouvez tester toutes les fonctionnalités de base avant de vous engager." },
        { q: "Comment fonctionne la négociation automatique ?", a: "Vous définissez un prix plancher et une marge maximale. L'IA négocie avec le client dans ces limites, jamais en dessous de votre prix plancher." },
      ],
    },
    cta: {
      h2: "Prêt à automatiser votre WhatsApp ?",
      p: "Créez votre boutique Kozapp gratuitement, sans carte bancaire.",
      ctaPrimary: "Commencer gratuitement",
      ctaWhatsapp: "Discuter sur WhatsApp",
      guarantees: ["Sans carte bancaire", "Configuration en 5 minutes", "Annulation à tout moment"],
    },
    footer: {
      tagline: "Notre engagement : faire vendre les commerçants africains avec des outils IA simples, honnêtes et accessibles.",
      links: ["Confidentialité", "CGU", "Contact"],
      rights: "© 2026 Kozapp — Tous droits réservés.",
      builtBy: "Développé par",
    },
  },
  en: {
    nav: { cta: "Start for free" },
    hero: {
      h1: "Kozapp replies to your customers on WhatsApp\nand tracks your sales, day and night",
      p: "One solution so you never miss an order again and know exactly what it's earning you.",
      ctaPrimary: "Start for free",
      ctaWhatsapp: "Chat on WhatsApp",
      guarantees: ["No credit card", "Ready in 5 minutes", "Cancel anytime"],
      demoLabel: "Live demo",
      chat: [
        { from: "client", text: "Hi, is the green dress still available?", time: "7:02 PM" },
        { from: "bot", text: "Hello! Yes, the green Ndop dress is available in M and L — 18,500 FCFA.", time: "7:02 PM" },
        { from: "client", text: "Can you do 16,000?", time: "7:03 PM" },
        { from: "bot", text: "I can do 17,500 FCFA, delivery included in Douala. Should I reserve the M?", time: "7:03 PM" },
        { from: "client", text: "Ok I'll take it", time: "7:04 PM" },
        { from: "bot", text: "Order #1042 saved. Delivery tomorrow before 2 PM.", time: "7:04 PM" },
      ],
    },
    socialProof: {
      lead: "Kozapp is launching: we're building with our very first partner merchants",
      points: [
        "Official WhatsApp Business API (Meta)",
        "Hosted and encrypted data",
        "Direct access to the founding team",
        "No commitment, cancel anytime",
      ],
    },
    problemSolution: {
      eyebrow: "The problem",
      h2: "Running your business takes up all your time",
      sub: "You're a merchant, not an IT expert. Yet you spend more time managing messages and follow-ups than actually selling.",
      items: [
        { problem: "You spend hours replying to messages one by one", solution: "The AI agent replies within seconds, 24/7, even while you sleep" },
        { problem: "Orders are scattered across your WhatsApp chats", solution: "Every order is recorded, tracked, and centralized in your dashboard" },
        { problem: "You have no visibility into your revenue and best-selling products", solution: "A real-time dashboard gives you orders, revenue, and trends at a glance" },
        { problem: "You forget to follow up and lose sales", solution: "Automatic follow-ups and customer tracking kick in without manual work" },
      ],
    },
    benefits: {
      eyebrow: "What Kozapp changes, concretely",
      h2: "Two pillars, one solution",
      sub: "An AI agent that replies to your customers, and a web dashboard that runs your whole business.",
      agentTitle: "WhatsApp AI Agent",
      gestionTitle: "Management dashboard",
      agent: [
        { title: "Instant replies, 24/7", stat: "24/7", desc: "Your agent understands French, English, and Pidgin. It replies the way you would, in your shop's tone.", statLabel: "available" },
        { title: "Understands voice notes", stat: "2 languages", desc: "Your customers' voice notes are understood and handled just like text. Nothing gets lost.", statLabel: "" },
        { title: "Negotiates intelligently", stat: "0 loss", desc: "The AI negotiates within the margins you set. Never below your floor price.", statLabel: "margin preserved" },
      ],
      gestion: [
        { title: "Centralized orders", stat: "100%", desc: "Every WhatsApp order is recorded, tracked, and archived in your dashboard. Zero orders forgotten.", statLabel: "automated" },
        { title: "Real-time dashboard", stat: "Real-time", desc: "Revenue, top products, most active neighborhoods, delivery rate — all visible at a glance.", statLabel: "" },
        { title: "Automatic follow-ups", stat: "+30%", desc: "Automatic follow-ups bring back customers who didn't respond. Effortless customer tracking.", statLabel: "more sales" },
      ],
    },
    demo: {
      eyebrow: "Demo",
      h2: "See Kozapp in action",
      sub: "See how the agent handles a conversation, then how the order appears in your dashboard.",
      label: "See how it works",
    },
    useCases: {
      eyebrow: "Industries",
      h2: "Kozapp adapts to your business",
      sub: "Whether you sell dresses, meals, or services, your agent is set up in minutes.",
      sectors: [
        { label: "Fashion", example: "Showcase your collections, negotiate prices, record orders" },
        { label: "Beauty", example: "Advise on products, manage appointments, follow up with clients" },
        { label: "Food & Restaurants", example: "Send the menu, take orders, confirm delivery" },
        { label: "E-commerce", example: "Manage your catalog, track sales, recover abandoned carts" },
        { label: "Electronics", example: "Answer technical questions, compare products, advise customers" },
        { label: "Services", example: "Book appointments, send quotes, track service jobs" },
      ],
    },
    launch: {
      eyebrow: "Launch program",
      h2: "Built with our first merchants, not after",
      sub: "Kozapp is a young product: every early user's feedback directly shapes what we build next. You're not joining a finished product.",
      pillars: [
        { title: "Direct line to the team", desc: "Your messages reach the founders, not an anonymous call center. Every piece of feedback is read and acted on." },
        { title: "Launch pricing locked in", desc: "Merchants who start now keep their price, even as our plans evolve." },
        { title: "Zero risk to get started", desc: "No credit card, no commitment. You try it, you decide." },
      ],
    },
    pricingPreview: {
      eyebrow: "Plans",
      h2: "Clear pricing, no surprises",
      p: "Start for free, change plans as your volume grows.",
      link: "See all plans",
      plans: [
        { name: "Découverte", price: "0 FCFA", period: "/mo", sub: "Free, no card", highlight: false, cta: "Try it" },
        { name: "Starter", price: "9,900 FCFA", period: "/mo", sub: "", highlight: false, cta: "Get started" },
        { name: "Business", price: "24,900 FCFA", period: "/mo", sub: "", highlight: true, cta: "Get started" },
        { name: "Scale", price: "from 59,900", period: " FCFA/mo", sub: "or custom quote", highlight: false, cta: "Contact us" },
      ],
      payments: ["Credit card", "Orange Money", "MTN Mobile Money"],
      recommended: "Recommended",
    },
    faq: {
      eyebrow: "FAQ",
      h2: "Frequently asked questions",
      items: [
        { q: "Do I need technical skills to get started?", a: "No. You create your account, connect your WhatsApp in a few clicks, and your agent is ready. No installation, no code, no technical work." },
        { q: "How does Kozapp connect to my WhatsApp?", a: "Kozapp uses Meta's official WhatsApp Business API. The connection takes a few minutes and requires no technical work. You keep full control of your number." },
        { q: "Do my customers know they're talking to a bot?", a: "The agent is set up to reply the way a member of your team would. Most customers can't tell the difference. You can customize the tone and the replies." },
        { q: "What happens if I go over my conversation limit?", a: "Your agent keeps working. You'll be notified and can upgrade to a higher-volume plan. No service interruption." },
        { q: "Can I try it for free?", a: "Yes. The Découverte plan is entirely free, no credit card required. You can test all the core features before committing." },
        { q: "How does automatic negotiation work?", a: "You set a floor price and a maximum discount. The AI negotiates with the customer within those limits, never below your floor price." },
      ],
    },
    cta: {
      h2: "Ready to automate your WhatsApp?",
      p: "Create your Kozapp shop for free, no credit card required.",
      ctaPrimary: "Start for free",
      ctaWhatsapp: "Chat on WhatsApp",
      guarantees: ["No credit card", "Set up in 5 minutes", "Cancel anytime"],
    },
    footer: {
      tagline: "Our commitment: helping African merchants sell more with AI tools that are simple, honest, and accessible.",
      links: ["Privacy", "Terms", "Contact"],
      rights: "© 2026 Kozapp — All rights reserved.",
      builtBy: "Built by",
    },
  },
} satisfies Record<Lang, unknown>;

function useT() {
  const { lang } = useLanguage();
  return { lang, t: T[lang] };
}

/* ─── Bloc 1 : Navigation minimale ─── */
function Navbar() {
  const { lang, setLang } = useLanguage();
  const { t } = useT();
  return (
    <header className="lp-navbar">
      <div className="lp-navbar-inner">
        <Link href="/" className="lp-logo">
          <img src="/kozapp-logo.png" alt="Kozapp" />
        </Link>
        <div className="lp-nav-right">
          <div className="lp-lang-toggle" role="group" aria-label="Langue du site">
            <Globe2 size={14} aria-hidden="true" />
            <button type="button" className={lang === "fr" ? "lp-lang-active" : ""} aria-current={lang === "fr"} onClick={() => setLang("fr")}>FR</button>
            <button type="button" className={lang === "en" ? "lp-lang-active" : ""} aria-current={lang === "en"} onClick={() => setLang("en")}>EN</button>
          </div>
          <Link href="/auth?mode=register" className="lp-btn-primary lp-btn-sm">{t.nav.cta}</Link>
        </div>
      </div>
    </header>
  );
}

/* ─── Bloc 2 : Hero — résultat concret + vrai produit ─── */
function Hero() {
  const { t } = useT();
  const [chatStep, setChatStep] = useState(0);
  const [paused, setPaused] = useState(false);
  const { ref: viewportRef, visible: inViewport } = useInView(0.2, false);
  const chatMessages = t.hero.chat;

  useEffect(() => {
    if (!inViewport || paused) return;
    const isLast = chatStep >= chatMessages.length - 1;
    const delay = isLast ? 2800 : 1700;
    const timer = setTimeout(() => {
      setChatStep(s => (isLast ? 0 : s + 1));
    }, delay);
    return () => clearTimeout(timer);
  }, [chatStep, inViewport, paused, chatMessages.length]);

  function scrollToNext() {
    window.scrollTo({ top: window.innerHeight * 0.92, behavior: "smooth" });
  }

  return (
    <section className={`lp-hero ${inViewport ? "lp-in-view" : ""}`} ref={viewportRef}>
      <div className="lp-hero-gradient" />
      <div className="lp-hero-content">
        <div className="lp-hero-text">
          <h1 style={{ whiteSpace: "pre-line" }}>{t.hero.h1}</h1>
          <p>{t.hero.p}</p>
          <div className="lp-hero-ctas">
            <Link href="/auth?mode=register" className="lp-btn-primary lp-btn-lg">{t.hero.ctaPrimary} <ArrowRight size={18} /></Link>
            <a href={WHATSAPP_CONTACT_URL} className="lp-btn-whatsapp lp-btn-lg">
              <MessageCircle size={18} /> {t.hero.ctaWhatsapp}
            </a>
          </div>
          <div className="lp-hero-guarantees">
            <span><Shield size={14} /> {t.hero.guarantees[0]}</span>
            <span><Clock size={14} /> {t.hero.guarantees[1]}</span>
            <span><Zap size={14} /> {t.hero.guarantees[2]}</span>
          </div>
        </div>
        <div className="lp-hero-demo">
          <div
            className="lp-demo-phone"
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
          >
            <div className="lp-demo-header">
              <span className="lp-demo-logo">K</span>
              <div>
                <strong>Kozapp</strong>
                <small>{t.hero.demoLabel}</small>
              </div>
              <RefreshIcon />
            </div>
            <div className="lp-demo-chat">
              {chatMessages.slice(0, chatStep + 1).map((msg, i) => (
                <div key={i} className={`lp-demo-bubble ${msg.from === "client" ? "client" : "bot"}`}>
                  {msg.text}
                  <time>{msg.time}</time>
                </div>
              ))}
            </div>
          </div>
          {/* Icônes de messages statiques : illustration décorative du canal WhatsApp */}
          <div className="lp-hero-float-icon lp-float-1" aria-hidden="true"><MessageCircle size={20} /></div>
          <div className="lp-hero-float-icon lp-float-2" aria-hidden="true"><Mic size={17} /></div>
          <div className="lp-hero-float-icon lp-float-3" aria-hidden="true"><ImageIcon size={17} /></div>
        </div>
      </div>
      <button type="button" className="lp-scroll-cue" onClick={scrollToNext} aria-label="Défiler vers le bas">
        <ChevronDown size={22} />
      </button>
    </section>
  );
}

function RefreshIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: "auto", color: "#999" }}>
      <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" /><path d="M21 3v5h-5" />
    </svg>
  );
}

/* ─── Bloc 3 : Preuve de confiance (lancement — sans chiffres inventés) ─── */
function SocialProofBand() {
  const { t } = useT();
  const { ref, visible } = useInView(0.2);
  const icons = [<ShieldCheck size={20} key="s" />, <Lock size={20} key="l" />, <MessageCircle size={20} key="m" />, <Zap size={20} key="z" />];
  return (
    <section className="lp-social-proof-band" ref={ref}>
      <div className="lp-section-container">
        <p className="lp-proof-lead">{t.socialProof.lead}</p>
        <div className={`lp-proof-items lp-stagger ${visible ? "lp-visible" : ""}`}>
          {t.socialProof.points.map((label, i) => (
            <div className="lp-proof-item" key={i}>
              <span className="lp-proof-icon">{icons[i]}</span>
              <span>{label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Bloc 4 : Problème → Solution ─── */
function ProblemSolution() {
  const { t } = useT();
  const { ref, visible } = useInView(0.1);
  return (
    <section className="lp-problem-solution" ref={ref}>
      <div className="lp-section-container">
        <span className="lp-eyebrow lp-eyebrow-pink">{t.problemSolution.eyebrow}</span>
        <h2>{t.problemSolution.h2}</h2>
        <p className="lp-section-subtitle">{t.problemSolution.sub}</p>
        <div className={`lp-ps-grid lp-stagger ${visible ? "lp-visible" : ""}`}>
          {t.problemSolution.items.map((item, i) => (
            <div key={i} className="lp-ps-card">
              <div className="lp-ps-problem">
                <span className="lp-ps-x">✕</span>
                <p>{item.problem}</p>
              </div>
              <div className="lp-ps-arrow">→</div>
              <div className="lp-ps-solution">
                <span className="lp-ps-check">✓</span>
                <p>{item.solution}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Bloc 5 : Fonctionnalités transformées en bénéfices ─── */
function BenefitsSection() {
  const { t } = useT();
  const { ref, visible } = useInView(0.1);
  const agentIcons = [<Bot size={22} key="a1" />, <Headphones size={22} key="a2" />, <Sparkles size={22} key="a3" />];
  const gestionIcons = [<Package size={22} key="g1" />, <PieChart size={22} key="g2" />, <Send size={22} key="g3" />];
  return (
    <section className="lp-benefits" ref={ref}>
      <div className="lp-section-container">
        <span className="lp-eyebrow lp-eyebrow-green">{t.benefits.eyebrow}</span>
        <h2>{t.benefits.h2}</h2>
        <p className="lp-section-subtitle">{t.benefits.sub}</p>
        <div className={`lp-benefits-split ${visible ? "lp-visible" : ""}`}>
          <div className={`lp-benefits-column lp-reveal ${visible ? "lp-visible" : ""}`}>
            <h3><MessageCircle size={18} /> {t.benefits.agentTitle}</h3>
            {t.benefits.agent.map((b, i) => (
              <div key={i} className="lp-benefit-card-h">
                <span className="lp-benefit-icon">{agentIcons[i]}</span>
                <div className="lp-benefit-text">
                  <h4>{b.title}</h4>
                  <p>{b.desc}</p>
                </div>
                <div className="lp-benefit-stat">
                  <strong>{b.stat}</strong>
                  <span>{b.statLabel}</span>
                </div>
              </div>
            ))}
          </div>
          <div className={`lp-benefits-column lp-reveal ${visible ? "lp-visible" : ""}`} style={{ transitionDelay: ".15s" }}>
            <h3><BarChart3 size={18} /> {t.benefits.gestionTitle}</h3>
            {t.benefits.gestion.map((b, i) => (
              <div key={i} className="lp-benefit-card-h">
                <span className="lp-benefit-icon">{gestionIcons[i]}</span>
                <div className="lp-benefit-text">
                  <h4>{b.title}</h4>
                  <p>{b.desc}</p>
                </div>
                <div className="lp-benefit-stat">
                  <strong>{b.stat}</strong>
                  <span>{b.statLabel}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── Bloc 6 : Démonstration produit ─── */
function DemoSection() {
  const { t } = useT();
  const { ref, visible } = useInView(0.1);
  return (
    <section className="lp-demo-section" ref={ref}>
      <div className="lp-section-container">
        <span className="lp-eyebrow lp-eyebrow-pink">{t.demo.eyebrow}</span>
        <h2>{t.demo.h2}</h2>
        <p className="lp-section-subtitle">{t.demo.sub}</p>
        <div className={`lp-reveal ${visible ? "lp-visible" : ""}`}>
          <div className="lp-video-placeholder">
            <div className="lp-video-inner">
              <div className="lp-video-screen">
                <div className="lp-video-sidebar" />
                <div className="lp-video-content">
                  <div className="lp-video-metrics">
                    <span /><span /><span /><span />
                  </div>
                  <div className="lp-video-chart" />
                  <div className="lp-video-products">
                    <span /><span /><span /><span /><span />
                  </div>
                </div>
              </div>
              <button className="lp-video-play">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3" /></svg>
              </button>
              <span className="lp-video-label">{t.demo.label}</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── Bloc 7 : Cas d'usage / segmentation par secteur ─── */
function UseCases() {
  const { t } = useT();
  const { ref, visible } = useInView(0.1);
  const icons = [
    <Shirt size={24} key="1" />, <Scissors size={24} key="2" />, <UtensilsCrossed size={24} key="3" />,
    <ShoppingBag size={24} key="4" />, <Monitor size={24} key="5" />, <Wrench size={24} key="6" />,
  ];
  return (
    <section className="lp-use-cases" ref={ref}>
      <div className="lp-section-container">
        <span className="lp-eyebrow lp-eyebrow-pink">{t.useCases.eyebrow}</span>
        <h2>{t.useCases.h2}</h2>
        <p className="lp-section-subtitle">{t.useCases.sub}</p>
        <div className={`lp-sectors-grid lp-stagger ${visible ? "lp-visible" : ""}`}>
          {t.useCases.sectors.map((s, i) => (
            <article key={s.label} className="lp-sector-card-new">
              <span className="lp-sector-emoji">{icons[i]}</span>
              <h3>{s.label}</h3>
              <p>{s.example}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Bloc 8 : Programme de lancement — confiance sans faux témoignages ─── */
function LaunchProgramSection() {
  const { t } = useT();
  const { ref, visible } = useInView(0.1);
  const icons = [<MessageCircle size={22} key="1" />, <Tag size={22} key="2" />, <Shield size={22} key="3" />];
  return (
    <section className="lp-launch" ref={ref}>
      <div className="lp-section-container">
        <span className="lp-eyebrow lp-eyebrow-pink">{t.launch.eyebrow}</span>
        <h2>{t.launch.h2}</h2>
        <p className="lp-section-subtitle">{t.launch.sub}</p>
        <div className={`lp-launch-grid lp-stagger ${visible ? "lp-visible" : ""}`}>
          {t.launch.pillars.map((p, i) => (
            <article key={p.title} className="lp-launch-card">
              <span className="lp-launch-icon">{icons[i]}</span>
              <h3>{p.title}</h3>
              <p>{p.desc}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Bloc 9 : Tarification ─── */
function PricingPreview() {
  const { t } = useT();
  const { ref, visible } = useInView(0.1);
  return (
    <section className="lp-pricing-preview" id="pricing-preview" ref={ref}>
      <div className="lp-section-container">
        <span className="lp-eyebrow lp-eyebrow-pink">{t.pricingPreview.eyebrow}</span>
        <div className="lp-pricing-preview-header">
          <div>
            <h2>{t.pricingPreview.h2}</h2>
            <p>{t.pricingPreview.p}</p>
          </div>
          <Link href="/pricing" className="lp-text-link">{t.pricingPreview.link} <ArrowRight size={16} /></Link>
        </div>
        <div className={`lp-pricing-cards-row lp-stagger ${visible ? "lp-visible" : ""}`}>
          {t.pricingPreview.plans.map(p => (
            <div key={p.name} className={`lp-pricing-mini-card ${p.highlight ? "lp-highlight" : ""}`}>
              {p.highlight && <span className="lp-badge-recommended"><Star size={12} /> {t.pricingPreview.recommended}</span>}
              <h3>{p.name}</h3>
              <strong>{p.price}<small>{p.period}</small></strong>
              {p.sub && <span className="lp-pricing-sub">{p.sub}</span>}
              <Link href="/auth?mode=register" className={`lp-pricing-cta ${p.highlight ? "lp-pricing-cta-filled" : ""}`}>{p.cta}</Link>
            </div>
          ))}
        </div>
        <div className="lp-payment-methods">
          <span><CreditCard size={14} /> {t.pricingPreview.payments[0]}</span>
          <span><Smartphone size={14} /> {t.pricingPreview.payments[1]}</span>
          <span><Smartphone size={14} /> {t.pricingPreview.payments[2]}</span>
        </div>
      </div>
    </section>
  );
}

/* ─── Bloc 10 : FAQ / gestion des objections ─── */
function FaqSection() {
  const { t } = useT();
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  return (
    <section className="lp-faq" id="faq">
      <div className="lp-section-container">
        <span className="lp-eyebrow lp-eyebrow-pink">{t.faq.eyebrow}</span>
        <h2>{t.faq.h2}</h2>
        <div className="lp-faq-list">
          {t.faq.items.map((faq, i) => {
            const isOpen = openIndex === i;
            return (
              <div key={i} className={`lp-faq-item ${isOpen ? "open" : ""}`}>
                <button
                  className="lp-faq-question"
                  onClick={() => setOpenIndex(isOpen ? null : i)}
                  aria-expanded={isOpen}
                  aria-controls={`lp-faq-answer-${i}`}
                  id={`lp-faq-question-${i}`}
                >
                  {faq.q}
                  {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </button>
                <div
                  className="lp-faq-answer"
                  id={`lp-faq-answer-${i}`}
                  role="region"
                  aria-labelledby={`lp-faq-question-${i}`}
                >
                  <p>{faq.a}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ─── Bloc 11 : CTA final + garanties ─── */
function CtaBanner() {
  const { t } = useT();
  const { ref, visible } = useInView(0.15);
  const { ref: pulseRef, visible: inViewport } = useInView(0.2, false);
  return (
    <section className="lp-cta-banner" ref={ref}>
      <div className="lp-section-container">
        <div
          ref={pulseRef}
          className={`lp-cta-inner lp-reveal ${visible ? "lp-visible" : ""} ${inViewport ? "lp-in-view" : ""}`}
        >
          <h2>{t.cta.h2}</h2>
          <p>{t.cta.p}</p>
          <div className="lp-cta-buttons">
            <Link href="/auth?mode=register" className="lp-btn-white lp-btn-lg">{t.cta.ctaPrimary} <ArrowRight size={18} /></Link>
            <a href={WHATSAPP_CONTACT_URL} className="lp-btn-whatsapp-outline lp-btn-lg">
              <MessageCircle size={18} /> {t.cta.ctaWhatsapp}
            </a>
          </div>
          <div className="lp-cta-guarantees">
            <span><Shield size={14} /> {t.cta.guarantees[0]}</span>
            <span><Clock size={14} /> {t.cta.guarantees[1]}</span>
            <span><Zap size={14} /> {t.cta.guarantees[2]}</span>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── Bloc 12 : Footer ─── */
function Footer() {
  const { t } = useT();
  return (
    <footer className="lp-footer">
      <div className="lp-section-container">
        <div className="lp-footer-top">
          <div className="lp-footer-brand">
            <Link href="/" className="lp-logo">
              <img src="/kozapp-logo.png" alt="Kozapp" />
            </Link>
            <p>{t.footer.tagline}</p>
          </div>
          <div className="lp-footer-links">
            <a href="#">{t.footer.links[0]}</a>
            <a href="#">{t.footer.links[1]}</a>
            <a href="#">{t.footer.links[2]}</a>
          </div>
        </div>
        <div className="lp-footer-bottom">
          <span>{t.footer.rights}</span>
          <span>{t.footer.builtBy} <a href={KORAH_WEBSITE_URL}><img src="/korah-logo.png" alt="" />Korah</a></span>
        </div>
      </div>
    </footer>
  );
}

/* ─── Page ─── */
export default function LandingPage() {
  return (
    <LanguageProvider>
      <main className="lp-page">
        <Navbar />
        <Hero />
        <SocialProofBand />
        <ProblemSolution />
        <BenefitsSection />
        <DemoSection />
        <UseCases />
        <LaunchProgramSection />
        <PricingPreview />
        <FaqSection />
        <CtaBanner />
        <Footer />
      </main>
    </LanguageProvider>
  );
}
