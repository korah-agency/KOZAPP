"use client";

import { Suspense, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Eye, EyeOff, Globe2 } from "lucide-react";
import { ApiError, PASSWORD_PATTERN, login, register, setToken, updateProfile } from "@/lib/api";
import { LanguageProvider, useLanguage, useAuthT } from "@/lib/i18n";

function AuthForm() {
  const router = useRouter();
  const t = useAuthT();
  const searchParams = useSearchParams();
  const requestedPlan = searchParams.get("plan");
  const [mode, setMode] = useState<"login" | "register">(searchParams.get("mode") === "register" ? "register" : "login");
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [shopName, setShopName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const passwordValid = mode === "login" || PASSWORD_PATTERN.test(password);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (mode === "register" && !passwordValid) {
      setError(t.passwordHint);
      return;
    }

    setLoading(true);
    try {
      const res =
        mode === "login"
          ? await login({ email, password })
          : await register({ email, password, shop_name: shopName });
      setToken(res.access_token);
      if (requestedPlan) {
        // Le forfait choisi sur la page tarifs est appliqué au profil qui vient d'être créé/connecté.
        try {
          await updateProfile({ plan: requestedPlan });
        } catch {
          // Le compte reste utilisable même si le forfait n'a pas pu être enregistré ; l'utilisateur pourra le changer depuis les paramètres.
        }
      }
      router.push(mode === "register" ? "/auth/transition" : "/app");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.genericError);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="auth2-tabs">
        <button type="button" className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}>{t.login}</button>
        <button type="button" className={mode === "register" ? "active" : ""} onClick={() => setMode("register")}>{t.register}</button>
      </div>

      <h1>{mode === "login" ? t.welcomeBackTitle : t.registerTitle}</h1>
      <p className="auth2-sub">
        {mode === "login" ? t.welcomeBackSub : t.registerSub}
      </p>

      <div className="auth2-social-buttons">
        <button className="auth2-btn-google" type="button">
          <svg width="18" height="18" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
          {t.googleContinue}
        </button>
        <span className="auth2-otp-hint">{t.comingSoon}</span>
      </div>

      <div className="auth2-divider"><span>{t.or}</span></div>

      <form className="auth2-form" onSubmit={handleSubmit}>
        {mode === "register" && (
          <label className="auth2-field">
            <span>{t.shopNameLabel}</span>
            <input
              type="text"
              placeholder={t.shopNamePlaceholder}
              value={shopName}
              onChange={e => setShopName(e.target.value)}
              required
            />
          </label>
        )}
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
        <label className="auth2-field">
          <span>{t.passwordLabel}</span>
          <div className="auth2-password-row">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              value={password}
              onChange={e => setPassword(e.target.value)}
              minLength={mode === "register" ? 6 : undefined}
              pattern={mode === "register" ? PASSWORD_PATTERN.source : undefined}
              title={mode === "register" ? t.passwordHint : undefined}
              required
            />
            <button type="button" className="auth2-eye" onClick={() => setShowPassword(!showPassword)}>
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {mode === "register" && (
            <small className={`auth2-field-hint ${password && !passwordValid ? "invalid" : ""}`}>{t.passwordHint}</small>
          )}
          {mode === "login" && (
            <Link href="/auth/forgot-password" className="auth2-forgot-link">{t.forgotPassword}</Link>
          )}
        </label>

        {error && <p className="auth2-error">{error}</p>}

        <button type="submit" className="auth2-submit" disabled={loading}>
          {loading ? t.submitLoading : mode === "login" ? t.submitLogin : t.submitRegister} <ArrowRight size={18} />
        </button>
      </form>

      <p className="auth2-legal">
        {t.legalPrefix}{" "}
        <a href="#">{t.terms}</a> {t.legalAnd}{" "}
        <a href="#">{t.privacy}</a>.
      </p>
    </>
  );
}

function AuthTopBar() {
  const { lang, setLang } = useLanguage();
  return (
    <div className="auth2-top-bar">
      <a href="/" className="auth2-back"><ArrowLeft size={20} /></a>
      <div className="auth2-lang" role="group" aria-label="Langue">
        <Globe2 size={14} />
        <button type="button" className={lang === "fr" ? "auth2-lang-active" : ""} onClick={() => setLang("fr")}>FR</button>
        <button type="button" className={lang === "en" ? "auth2-lang-active" : ""} onClick={() => setLang("en")}>EN</button>
      </div>
    </div>
  );
}

export default function AuthPage() {
  return (
    <LanguageProvider>
      <main className="auth2-page">
        <AuthTopBar />
        <div className="auth2-card">
          <a href="/" className="auth2-logo">
            <img src="/kozapp-logo.png" alt="Kozapp" />
          </a>
          <Suspense fallback={<p className="auth2-sub">…</p>}>
            <AuthForm />
          </Suspense>
        </div>
      </main>
    </LanguageProvider>
  );
}
