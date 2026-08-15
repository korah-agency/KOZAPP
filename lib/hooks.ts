"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Tracks whether an element is in the viewport.
 * By default (`once = true`) it reports the first intersection and stops
 * observing — used for one-shot scroll-reveal animations.
 * With `once = false` it keeps observing and toggles back to `false` when
 * the element leaves the viewport — used to pause/resume decorative
 * infinite animations that would otherwise run forever off-screen.
 */
export function useInView(threshold = 0.15, once = true) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          if (once) observer.unobserve(el);
        } else if (!once) {
          setVisible(false);
        }
      },
      { threshold }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold, once]);

  return { ref, visible };
}
