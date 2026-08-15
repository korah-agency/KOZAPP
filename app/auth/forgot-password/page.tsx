"use client";

import { useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, Globe2 } from "lucide-react";
import { ApiError, forgotPassword } from "@/lib/api";
import { LanguageProvider, useLanguage, useAuthT } from "@/lib/i18n";

function ForgotPasswordContent() {
  const { lang, setLang } = useLanguage();
  const t = useAuthT();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await forgotPassword({ email });
      setSent(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.genericError);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth2-page">
      <div className="auth2-top-bar">
        <a href="/auth" className="auth2-back"><ArrowLeft size={20} /></a>
        <div className="auth2-lang" role="group" aria-label="Langue">
          <Globe2 size={14} />
          <button type="button" className={lang === "fr" ? "auth2-lang-active" : ""} onClick={() => setLang("fr")}>FR</button>
          <button type="button" className={lang === "en" ? "auth2-lang-active" : ""} onClick={() => setLang("en")}>EN</button>
        </div>
      </div>

      <div className="auth2-card">
        <a href="/" className="auth2-logo">
          <img src="/kozapp-logo.png" alt="Kozapp" />
        </a>

        {sent ? (
          <div className="auth2-confirm">
            <span className="auth2-confirm-icon"><CheckCircle2 size={28} /></span>
            <h1>{t.checkEmailTitle}</h1>
            <p className="auth2-sub">{t.checkEmailBefore}<b>{email}</b>{t.checkEmailAfter}</p>
            <a href="/auth" className="auth2-submit">{t.forgotBackToLogin}</a>
          </div>
        ) : (
          <>
            <h1>{t.forgotTitle}</h1>
            <p className="auth2-sub">{t.forgotSub}</p>

            <form className="auth2-form" onSubmit={handleSubmit}>
              <label className="auth2-field">
                <span>{t.emailLabel}</span>
                <input
                  type="email"
                  placeholder={t.emailPlaceholder}
                  autoComplete="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                />
              </label>

              {error && <p className="auth2-error">{error}</p>}

              <button type="submit" className="auth2-submit" disabled={loading}>
                {loading ? t.forgotSending : t.forgotSend} <ArrowRight size={18} />
              </button>
            </form>

            <p className="auth2-legal">
              <a href="/auth">{t.forgotBackToLogin}</a>
            </p>
          </>
        )}
      </div>
    </main>
  );
}

export default function ForgotPasswordPage() {
  return (
    <LanguageProvider>
      <ForgotPasswordContent />
    </LanguageProvider>
  );
}
