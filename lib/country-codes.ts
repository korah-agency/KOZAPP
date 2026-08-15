export type CountryCode = {
  code: string;
  name: string;
  dial: string;
  flag: string;
  /** Nombre de chiffres du numéro local, hors indicatif. Doit rester
   * synchronisé avec PHONE_LOCAL_LENGTHS côté backend (schemas/profile.py). */
  length: number;
};

/** Pays prioritaires pour Kozapp (Afrique centrale & francophone). */
export const COUNTRY_CODES: CountryCode[] = [
  { code: "CM", name: "Cameroun", dial: "+237", flag: "🇨🇲", length: 9 },
  { code: "SN", name: "Sénégal", dial: "+221", flag: "🇸🇳", length: 9 },
  { code: "CI", name: "Côte d'Ivoire", dial: "+225", flag: "🇨🇮", length: 10 },
  { code: "GA", name: "Gabon", dial: "+241", flag: "🇬🇦", length: 9 },
  { code: "CG", name: "Congo", dial: "+242", flag: "🇨🇬", length: 9 },
  { code: "CD", name: "RD Congo", dial: "+243", flag: "🇨🇩", length: 9 },
  { code: "BJ", name: "Bénin", dial: "+229", flag: "🇧🇯", length: 8 },
  { code: "TG", name: "Togo", dial: "+228", flag: "🇹🇬", length: 8 },
  { code: "BF", name: "Burkina Faso", dial: "+226", flag: "🇧🇫", length: 8 },
  { code: "ML", name: "Mali", dial: "+223", flag: "🇲🇱", length: 8 },
  { code: "NE", name: "Niger", dial: "+227", flag: "🇳🇪", length: 8 },
  { code: "TD", name: "Tchad", dial: "+235", flag: "🇹🇩", length: 8 },
  { code: "CF", name: "Centrafrique", dial: "+236", flag: "🇨🇫", length: 8 },
  { code: "GQ", name: "Guinée équatoriale", dial: "+240", flag: "🇬🇶", length: 9 },
  { code: "GN", name: "Guinée", dial: "+224", flag: "🇬🇳", length: 9 },
  { code: "MG", name: "Madagascar", dial: "+261", flag: "🇲🇬", length: 9 },
  { code: "MA", name: "Maroc", dial: "+212", flag: "🇲🇦", length: 9 },
  { code: "TN", name: "Tunisie", dial: "+216", flag: "🇹🇳", length: 8 },
  { code: "DZ", name: "Algérie", dial: "+213", flag: "🇩🇿", length: 9 },
  { code: "FR", name: "France", dial: "+33", flag: "🇫🇷", length: 9 },
  { code: "BE", name: "Belgique", dial: "+32", flag: "🇧🇪", length: 9 },
  { code: "CH", name: "Suisse", dial: "+41", flag: "🇨🇭", length: 9 },
  { code: "CA", name: "Canada", dial: "+1", flag: "🇨🇦", length: 10 },
  { code: "US", name: "États-Unis", dial: "+1", flag: "🇺🇸", length: 10 },
];

export const DEFAULT_COUNTRY = COUNTRY_CODES[0];

export function findCountryByDial(dial: string): CountryCode | undefined {
  return COUNTRY_CODES.find(c => c.dial === dial);
}
