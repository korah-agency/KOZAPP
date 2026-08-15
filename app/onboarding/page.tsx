"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight, Circle, Facebook, Globe2, MessageCircle, Users } from "lucide-react";
import PhoneInput from "@/components/PhoneInput";
import { LanguageProvider, useLanguage, useOnboardingT, tFormat } from "@/lib/i18n";

const TOTAL_STEPS = 5;

function OnboardingContent() {
  const { lang, setLang } = useLanguage();
  const t = useOnboardingT();
  const [step, setStep] = useState(1);
  const [selectedNeed, setSelectedNeed] = useState<string | null>(null);
  const [selectedSource, setSelectedSource] = useState<string | null>(null);
  const [whatsappValid, setWhatsappValid] = useState(false);

  const sources = [
    { icon: <Facebook size={22} />, label: t.sourceFacebook },
    { icon: <MessageCircle size={22} />, label: t.sourceWhatsapp },
    { icon: <Users size={22} />, label: t.sourceWordOfMouth },
    { icon: <Circle size={22} />, label: t.sourceOther },
  ];

  const next = () => setStep(s => Math.min(s + 1, TOTAL_STEPS));
  const prev = () => setStep(s => Math.max(s - 1, 1));
  const skip = () => next();

  return (
    <main className="ob2-page">
      <header className="ob2-header">
        <a href="/" className="ob2-back"><ArrowLeft size={20} /></a>
        <a href="/" className="ob2-logo">
          <img src="/kozapp-logo.png" alt="Kozapp" />
        </a>
        <div className="ob2-lang" role="group" aria-label="Langue">
          <Globe2 size={14} />
          <button type="button" className={lang === "fr" ? "ob2-lang-active" : ""} onClick={() => setLang("fr")}>FR</button>
          <button type="button" className={lang === "en" ? "ob2-lang-active" : ""} onClick={() => setLang("en")}>EN</button>
        </div>
      </header>

      <div className="ob2-progress-bar">
        <span>{tFormat(t.stepOf, { current: step, total: TOTAL_STEPS })}</span>
        <div className="ob2-progress-track">
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <i key={i} className={i < step ? "done" : ""} />
          ))}
        </div>
        {(step === 2 || step === 5) && (
          <button className="ob2-skip" onClick={skip}>{t.skip}</button>
        )}
      </div>

      <section className="ob2-card">
        {step === 1 && (
          <>
            <h1>{t.step1Title}</h1>
            <p className="ob2-desc">{t.step1Desc}</p>
            <div className="ob2-fields">
              <label className="ob2-field">
                <span>{t.fullName}</span>
                <input type="text" placeholder={t.fullNamePlaceholder} />
              </label>
              <label className="ob2-field">
                <span>{t.role}</span>
                <input type="text" placeholder={t.rolePlaceholder} />
              </label>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h1>{t.step2Title}</h1>
            <p className="ob2-desc">{t.step2Desc}</p>
            <div className="ob2-fields">
              <label className="ob2-field">
                <span>{t.companyName}</span>
                <input type="text" placeholder={t.companyNamePlaceholder} />
              </label>
              <label className="ob2-field">
                <span>{t.sector}</span>
                <div className="ob2-select-wrapper">
                  <select defaultValue="">
                    <option value="" disabled>{t.chooseSector}</option>
                    <option value="mode">{t.sectorMode}</option>
                    <option value="beaute">{t.sectorBeaute}</option>
                    <option value="restauration">{t.sectorRestauration}</option>
                    <option value="ecommerce">{t.sectorEcommerce}</option>
                    <option value="electronique">{t.sectorElectronique}</option>
                    <option value="services">{t.sectorServices}</option>
                    <option value="autre">{t.sectorAutre}</option>
                  </select>
                </div>
              </label>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <h1>{t.step3Title}</h1>
            <p className="ob2-desc">{t.step3Desc}</p>
            <div className="ob2-needs-list">
              {t.needs.map(n => (
                <button
                  key={n}
                  className={`ob2-need-btn ${selectedNeed === n ? "selected" : ""}`}
                  onClick={() => setSelectedNeed(n)}
                >
                  {n}
                </button>
              ))}
            </div>
          </>
        )}

        {step === 4 && (
          <>
            <h1>{t.step4Title}</h1>
            <p className="ob2-desc">{t.step4Desc}</p>
            <div className="ob2-fields">
              <label className="ob2-field">
                <span>{t.whatsappNumber}</span>
                <PhoneInput onChange={(_full, valid) => setWhatsappValid(valid)} />
              </label>
              <div className="ob2-info-box">
                <p>{t.infoBoxText}</p>
              </div>
            </div>
          </>
        )}

        {step === 5 && (
          <>
            <h1>{t.step5Title}</h1>
            <p className="ob2-desc">{t.step5Desc}</p>
            <div className="ob2-sources-grid">
              {sources.map(s => (
                <button
                  key={s.label}
                  className={`ob2-source-btn ${selectedSource === s.label ? "selected" : ""}`}
                  onClick={() => setSelectedSource(s.label)}
                >
                  {s.icon}
                  <span>{s.label}</span>
                </button>
              ))}
            </div>
          </>
        )}

        <button
          className="ob2-continue-btn"
          onClick={step === TOTAL_STEPS ? () => window.location.href = "/pricing" : next}
          disabled={step === 4 && !whatsappValid}
        >
          {step === TOTAL_STEPS ? t.finish : t.continueLabel} <ArrowRight size={18} />
        </button>
      </section>
    </main>
  );
}

export default function OnboardingPage() {
  return (
    <LanguageProvider>
      <OnboardingContent />
    </LanguageProvider>
  );
}
