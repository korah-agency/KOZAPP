/**
 * Configuration de la preuve sociale et des témoignages.
 *
 * Quand vous aurez 5–10 vrais clients :
 *   - showAvatars = true + remplir avatars[]
 *   - showStarRating = true + définir starRating
 *
 * Quand vous aurez de vrais témoignages :
 *   - showTestimonials = true + remplir testimonials[]
 *
 * Pour afficher un indicateur réel à la place de la phrase d'ambition :
 *   - définir realMetric (ex. "1 200 messages traités en test")
 */

export type Testimonial = {
  quote: string;
  author: string;
  role: string;
  avatarSrc?: string;
};

export type SocialProofConfig = {
  /** Afficher les avatars clients (réservé — activer avec 5–10 vrais clients) */
  showAvatars: boolean;
  /** Afficher la note étoiles (réservé — activer avec de vrais avis) */
  showStarRating: boolean;
  /** Note sur 5 — à renseigner quand showStarRating = true */
  starRating?: number;
  /** Phrase d'ambiance affichée en l'absence de métrique réelle */
  ambitionMessage: string;
  /** Indicateur réel — prioritaire sur ambitionMessage si défini */
  realMetric?: string;
  /** Avatars clients réels — remplir avant d'activer showAvatars */
  avatars: { src: string; alt: string }[];
  /** Témoignages — activer showTestimonials quand remplis */
  showTestimonials: boolean;
  testimonials: Testimonial[];
};

export const SOCIAL_PROOF: SocialProofConfig = {
  showAvatars: false,
  showStarRating: false,
  ambitionMessage: "Kozapp est en lancement : nous construisons avec nos tout premiers commerçants partenaires",
  // realMetric: "En développement actif avec nos premiers partenaires",
  avatars: [],
  showTestimonials: false,
  testimonials: [],
};

/** URL du site vitrine Korah — remplacer quand disponible */
export const KORAH_WEBSITE_URL = "#";

/** Numéro WhatsApp de contact affiché sur le site public. */
export const WHATSAPP_CONTACT_URL = "https://wa.me/237673854185";
