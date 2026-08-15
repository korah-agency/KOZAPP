"use client";

import { Star } from "lucide-react";
import { SOCIAL_PROOF } from "@/lib/social-proof";

export default function SocialProofBanner() {
  const {
    showAvatars,
    showStarRating,
    starRating = 5,
    ambitionMessage,
    realMetric,
    avatars,
  } = SOCIAL_PROOF;

  const message = realMetric ?? ambitionMessage;

  return (
    <div className="social-proof">
      {showAvatars && avatars.length > 0 && (
        <div className="social-proof-avatars" aria-hidden="true">
          {avatars.map((avatar, i) => (
            <img
              key={avatar.src}
              src={avatar.src}
              alt={avatar.alt}
              style={{ zIndex: avatars.length - i }}
            />
          ))}
        </div>
      )}
      <div className="social-proof-text">
        {showStarRating && (
          <div className="social-proof-stars" aria-label={`${starRating} étoiles sur 5`}>
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                size={14}
                fill={i < starRating ? "currentColor" : "none"}
                strokeWidth={i < starRating ? 0 : 2}
              />
            ))}
          </div>
        )}
        <p>{message}</p>
      </div>
    </div>
  );
}
