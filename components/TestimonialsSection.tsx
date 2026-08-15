"use client";

import { SOCIAL_PROOF } from "@/lib/social-proof";

export default function TestimonialsSection() {
  const { showTestimonials, testimonials } = SOCIAL_PROOF;

  if (!showTestimonials || testimonials.length === 0) return null;

  return (
    <section className="testimonials" aria-label="Témoignages clients">
      {testimonials.map(t => (
        <blockquote key={t.author} className="testimonial-card">
          <p>&ldquo;{t.quote}&rdquo;</p>
          <footer>
            {t.avatarSrc && <img src={t.avatarSrc} alt="" />}
            <span>
              <strong>{t.author}</strong>
              <small>{t.role}</small>
            </span>
          </footer>
        </blockquote>
      ))}
    </section>
  );
}
