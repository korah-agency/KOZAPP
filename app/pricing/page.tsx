"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, ChevronDown, ChevronUp, Globe2, Star } from "lucide-react";
import { ApiError, getToken, updateProfile } from "@/lib/api";
import { WHATSAPP_CONTACT_URL } from "@/lib/social-proof";
import { LanguageProvider, useLanguage, usePricingT } from "@/lib/i18n";

const CONTACT_WHATSAPP_URL = WHATSAPP_CONTACT_URL;

/** Metadonnees structurelles (non traduites) alignees par index avec PricingT.plans. */
const PLAN_META = [
  { slug: "decouverte", price: "0 FCFA", period: "/mois", ctaStyle: "outline", recommended: false },
  { slug: "starter", price: "9 900 FCFA", period: "/mois", ctaStyle: "outline", recommended: false },
  { slug: "business", price: "24 900 FCFA", period: "/mois", ctaStyle: "filled", recommended: true },
  { slug: "scale", price: "dès 59 900 FCFA", period: "", ctaStyle: "outline", recommended: false },
];

function isExternal(slug: string) {
  return slug === "scale";
}

function PricingContent() {
  const { lang, setLang } = useLanguage();
  const t = usePricingT();
  const router = useRouter();
  const [showTable, setShowTable] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [applyingSlug, setApplyingSlug] = useState<string | null>(null);
  const [applyError, setApplyError] = useState<string | null>(null);

  useEffect(() => {
    setAuthed(!!getToken());
  }, []);

  const plans = t.plans.map((p, i) => ({ ...p, ...PLAN_META[i] }));

  async function handlePlanChoice(slug: string) {
    setApplyError(null);
    if (!authed) {
      router.push(`/auth?mode=register&plan=${slug}`);
      return;
    }
    setApplyingSlug(slug);
    try {
      await updateProfile({ plan: slug });
      router.push("/app?view=billing");
    } catch (err) {
      setApplyError(err instanceof ApiError ? err.message : t.genericError);
    } finally {
      setApplyingSlug(null);
    }
  }

  return (
    <main className="pricing2-page">
      <header className="pricing2-header">
        <a href="/" className="pricing2-back"><ArrowLeft size={20} /></a>
        <a href="/" className="pricing2-logo">
          <img src="/kozapp-logo.png" alt="Kozapp" />
        </a>
        <div className="pricing2-lang" role="group" aria-label="Langue">
          <Globe2 size={14} />
          <button type="button" className={lang === "fr" ? "pricing2-lang-active" : ""} onClick={() => setLang("fr")}>FR</button>
          <button type="button" className={lang === "en" ? "pricing2-lang-active" : ""} onClick={() => setLang("en")}>EN</button>
        </div>
      </header>

      <section className="pricing2-hero">
        <span className="lp-eyebrow lp-eyebrow-light">{t.eyebrow}</span>
        <h1>{t.title}</h1>
        <p>{t.subtitle}</p>
      </section>

      <section className="pricing2-cards-section">
        {applyError && <p className="auth2-error" style={{ marginBottom: 16 }}>{applyError}</p>}
        <div className="pricing2-cards">
          {plans.map(p => (
            <div key={p.slug} className={`pricing2-card ${p.recommended ? "recommended" : ""}`}>
              {p.recommended && <span className="pricing2-badge"><Star size={12} /> {t.recommended}</span>}
              <h2>{p.name}</h2>
              <p className="pricing2-target">{p.target}</p>
              <div className="pricing2-price">
                <strong>{p.price}<small>{p.period}</small></strong>
                {p.sub && <span className="pricing2-sub">{p.sub}</span>}
              </div>
              <ul className="pricing2-features">
                {p.features.map((f, i) => (
                  <li key={i}><Check size={16} className="pricing2-check" />{f}</li>
                ))}
              </ul>
              {isExternal(p.slug) ? (
                <a href={CONTACT_WHATSAPP_URL} className={`pricing2-cta ${p.ctaStyle}`}>{p.cta}</a>
              ) : (
                <button
                  type="button"
                  className={`pricing2-cta ${p.ctaStyle}`}
                  onClick={() => handlePlanChoice(p.slug)}
                  disabled={applyingSlug === p.slug}
                >
                  {applyingSlug === p.slug ? t.applying : p.cta}
                </button>
              )}
            </div>
          ))}
        </div>
      </section>

      <div className="pricing2-compare-toggle">
        <button onClick={() => setShowTable(!showTable)}>
          {t.compareAll}
          {showTable ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>

      {showTable && (
        <section className="pricing2-table-section">
          <div className="pricing2-table-wrap">
            <table className="pricing2-table">
              <thead>
                <tr>
                  <th></th>
                  {plans.map(p => <th key={p.slug}>{p.name}</th>)}
                </tr>
              </thead>
              <tbody>
                {t.comparisonRows.map(row => (
                  <tr key={row.label}>
                    <td className="pricing2-row-label">{row.label}</td>
                    {row.values.map((v, i) => (
                      <td key={i} className={i === 2 ? "pricing2-highlight-col" : ""}>{v}</td>
                    ))}
                  </tr>
                ))}
                <tr>
                  <td className="pricing2-row-label">{t.priceCol}</td>
                  {plans.map(p => (
                    <td key={p.slug} className={p.recommended ? "pricing2-highlight-col" : ""}>
                      <strong>{p.price}</strong>
                    </td>
                  ))}
                </tr>
                <tr>
                  <td></td>
                  {plans.map(p => (
                    <td key={p.slug} className={p.recommended ? "pricing2-highlight-col" : ""}>
                      {isExternal(p.slug) ? (
                        <a href={CONTACT_WHATSAPP_URL} className={`pricing2-table-cta ${p.ctaStyle}`}>{p.cta}</a>
                      ) : (
                        <button
                          type="button"
                          className={`pricing2-table-cta ${p.ctaStyle}`}
                          onClick={() => handlePlanChoice(p.slug)}
                          disabled={applyingSlug === p.slug}
                        >
                          {p.cta}
                        </button>
                      )}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      )}
    </main>
  );
}

export default function PricingPage() {
  return (
    <LanguageProvider>
      <PricingContent />
    </LanguageProvider>
  );
}
