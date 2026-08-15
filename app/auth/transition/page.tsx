"use client";

import { ArrowRight, Sparkles } from "lucide-react";

export default function TransitionPage() {
  return (
    <main className="transition-page">
      <div className="transition-card">
        <span className="transition-icon"><Sparkles size={28} /></span>
        <h1>Bienvenue sur Kozapp</h1>
        <p>Votre espace est prêt. Encore quelques questions et votre assistant IA se met au travail.</p>
        <a href="/onboarding" className="transition-btn">
          Continuer <ArrowRight size={18} />
        </a>
      </div>
    </main>
  );
}
