"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { COUNTRY_CODES, DEFAULT_COUNTRY, type CountryCode } from "@/lib/country-codes";

type PhoneInputProps = {
  /** Valeur complete (ex. "+237612345678"). Fournir pour piloter le champ depuis un etat parent. */
  value?: string;
  defaultValue?: string;
  /** Appele a chaque changement avec le numero complet (sans espaces) et sa validite. */
  onChange?: (fullNumber: string, isValid: boolean) => void;
  placeholder?: string;
  id?: string;
};

function parsePhoneValue(value: string): { country: CountryCode; local: string } {
  const trimmed = value.trim();
  const match = COUNTRY_CODES.find(c => trimmed.startsWith(c.dial));
  if (match) {
    return { country: match, local: trimmed.slice(match.dial.length).replace(/\D/g, "") };
  }
  return { country: DEFAULT_COUNTRY, local: trimmed.replace(/\D/g, "") };
}

/** Regroupe les chiffres par paires pour l'affichage (ex. "699999999" -> "6 99 99 99 99"). */
function formatGrouped(digits: string): string {
  if (!digits) return "";
  const groups = [digits.slice(0, 1)];
  for (let i = 1; i < digits.length; i += 2) {
    groups.push(digits.slice(i, i + 2));
  }
  return groups.filter(Boolean).join(" ");
}

export default function PhoneInput({
  value,
  defaultValue = "",
  onChange,
  placeholder,
  id,
}: PhoneInputProps) {
  const initial = parsePhoneValue(value ?? defaultValue);
  const [country, setCountry] = useState<CountryCode>(initial.country);
  const [localNumber, setLocalNumber] = useState(initial.local);
  const [open, setOpen] = useState(false);
  const [touched, setTouched] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (value === undefined) return;
    const parsed = parsePhoneValue(value);
    setCountry(parsed.country);
    setLocalNumber(parsed.local);
  }, [value]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const isValid = localNumber.length === country.length;

  function updateLocal(raw: string) {
    // Les espaces (ajoutés automatiquement pour la lisibilité) et tout
    // caractère non numérique tapé par l'utilisateur sont retirés ici.
    const cleaned = raw.replace(/\D/g, "").slice(0, country.length);
    setLocalNumber(cleaned);
    onChange?.(`${country.dial}${cleaned}`, cleaned.length === country.length);
  }

  function updateCountry(c: CountryCode) {
    const cleaned = localNumber.slice(0, c.length);
    setCountry(c);
    setLocalNumber(cleaned);
    setOpen(false);
    onChange?.(`${c.dial}${cleaned}`, cleaned.length === c.length);
  }

  return (
    <div className="phone-input" ref={wrapperRef}>
      <input type="hidden" name={id ? `${id}-full` : "phone-full"} value={`${country.dial}${localNumber}`} />
      <div className={`phone-input-row ${touched && !isValid ? "invalid" : ""}`}>
        <button
          type="button"
          className="country-selector"
          onClick={() => setOpen(v => !v)}
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-label={`Indicatif pays : ${country.name}`}
        >
          <span className="country-flag" aria-hidden="true">{country.flag}</span>
<span className="country-dial">{country.dial}</span>
        <ChevronDown size={14} className={open ? "rotated" : ""} />
      </button>
        <input
          id={id}
          type="tel"
          inputMode="numeric"
          className="phone-number"
          value={formatGrouped(localNumber)}
          onChange={e => updateLocal(e.target.value)}
          onBlur={() => setTouched(true)}
          placeholder={placeholder ?? formatGrouped("6".padEnd(country.length, "9"))}
          autoComplete="tel-national"
        />
      </div>
      {touched && !isValid && (
        <small className="phone-input-hint">Le numéro doit contenir exactement {country.length} chiffres.</small>
      )}
      {open && (
        <ul className="country-dropdown" role="listbox" aria-label="Choisir un indicatif pays">
          {COUNTRY_CODES.map(c => (
            <li key={c.code} role="option" aria-selected={c.code === country.code}>
              <button
                type="button"
                className={c.code === country.code ? "selected" : ""}
                onClick={() => updateCountry(c)}
              >
                <span className="country-flag" aria-hidden="true">{c.flag}</span>
                <span className="country-name">{c.name}</span>
                <span className="country-dial">{c.dial}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
