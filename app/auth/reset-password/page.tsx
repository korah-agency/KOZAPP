"use client";

import { Suspense, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, CheckCircle2, Eye, EyeOff, Globe2 } from "lucide-react";
import { ApiError, PASSWORD_PATTERN, resetPassword } from "@/lib/api";
import { LanguageProvider, useLanguage, useAuthT } from "@/lib/i18n";

function ResetPasswordForm() {
  const token = useSearchParams().get("token") ?? "";
  const t = useAuthT();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const passwordValid = PASSWORD_PATTERN.test(password);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!passwordValid) {
      setError(t.passwordHint);
      return;
    }
    if (password !== confirm) {
      setError(t.passwordMismatch);
      return;
    }

    setLoading(true);
    try {
      await resetPassword({ token, new_password: password });
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.genericError);
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="auth2-confirm">
        <h1>{t.resetInvalidTitle}</h1>
        <p className="auth2-sub">{t.resetInvalidSub}</p>
        <a href="/auth/forgot-password" className="auth2-submit">{t.resetInvalidCta}</a>
      </div>
    );
  }

  if (done) {
    return (
      <div className="auth2-confirm">
        <span className="auth2-confirm-icon"><CheckCircle2 size={28} /></span>
        <h1>{t.resetDone}</h1>
        <p className="auth2-sub">{t.resetDoneSub}</p>
        <a href="/auth" className="auth2-submit">{t.resetLoginLink}</a>
      </div>
    );
  }

  return (
    <>
      <h1>{t.resetTitle}</h1>
      <p className="auth2-sub">{t.resetSub}</p>

      <form className="auth2-form" onSubmit={handleSubmit}>
        <label className="auth2-field">
          <span>{t.resetNewPassword}</span>
          <div className="auth2-password-row">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              autoComplete="new-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              minLength={6}
              required
            />
            <button type="button" className="auth2-eye" onClick={() => setShowPassword(!showPassword)}>
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <small className={`auth2-field-hint ${password && !passwordValid ? "invalid" : ""}`}>{t.passwordHint}</small>
        </label>

        <label className="auth2-field">
          <span>{t.resetConfirm}</span>
          <input
            type={showPassword ? "text" : "password"}
            placeholder="••••••••"
            autoComplete="new-password"
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            required
          />
        </label>

        {error && <p className="auth2-error">{error}</p>}

        <button type="submit" className="auth2-submit" disabled={loading}>
          {loading ? t.resetSaving : t.resetSubmit} <ArrowRight size={18} />
        </button>
      </form>
    </>
  );
}

function ResetPasswordTopBar() {
  const { lang, setLang } = useLanguage();
  return (
    <div className="auth2-top-bar">
      <a href="/auth" className="auth2-back"><ArrowLeft size={20} /></a>
      <div className="auth2-lang" role="group" aria-label="Langue">
        <Globe2 size={14} />
        <button type="button" className={lang === "fr" ? "auth2-lang-active" : ""} onClick={() => setLang("fr")}>FR</button>
        <button type="button" className={lang === "en" ? "auth2-lang-active" : ""} onClick={() => setLang("en")}>EN</button>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <LanguageProvider>
      <main className="auth2-page">
        <ResetPasswordTopBar />
        <div className="auth2-card">
          <a href="/" className="auth2-logo">
            <img src="/kozapp-logo.png" alt="Kozapp" />
          </a>
          <Suspense fallback={<p className="auth2-sub">…</p>}>
            <ResetPasswordForm />
          </Suspense>
        </div>
      </main>
    </LanguageProvider>
  );
}
