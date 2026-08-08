// Feature-act reveal (phase 04 §step 7): headline -> lede -> bullets (own
// 60ms stagger) -> code card, 420ms each, outQuad, translateY 16 -> 0. The
// act's own `.feature-copy`/`.code-card`/`.feature-title`/`.feature-lede`/
// `.feature-bullets li` CSS opacity gates (feature.css) already show/hide
// every target on body[data-act] change — this adds the per-element cascade
// on top, same layering hero's own .word CSS baseline + JS [0,1] tween
// already uses. Hero's own reveal lives in hero-reveals.ts (split out once
// this file passed 120 lines, per spec).
import { createTimeline, stagger } from 'animejs';

export interface ActReveals {
  play(): void;
}

const ACT_STAGGER_MS = 60;
const ACT_DURATION_MS = 420;
const ACT_TRANSLATE_Y = 16;
const ACT_CASCADE_OFFSET_MS = 140; // each group starts this long after the previous

type RevealTarget = HTMLElement | NodeListOf<HTMLElement>;

// Hands opacity/transform back to the act's own CSS active-state rule the
// instant a tween lands on its target value (matches the CSS's already-
// active value, so no flash). anime.js writes opacity/transform as INLINE
// style while animating; inline style always beats a stylesheet rule
// regardless of specificity, so any target left with a stray inline value
// after its tween finishes keeps showing/hiding independently of
// body[data-act] forever after — the exact bug class Fable caught twice
// now: .code-card bleeding into the outro (fix-outro-overlap-report.md) and
// blueprint's .act-blueprint-heading bleeding into hero
// (fix-act-bleed-systemic-report.md, this fix's own root cause — a
// different element, same "inline/uncontrolled style outlives the act"
// family, fixed at the CSS layer there since that element is never JS-
// tweened). Applied uniformly to every reveal target here instead of listed
// per class, so a future target can't reintroduce this by omission — every
// target this function touches has a matching CSS active-state rule in
// feature.css that takes over the instant the inline value is cleared.
function handBackToCss(...targets: RevealTarget[]): void {
  for (const target of targets) {
    const els = target instanceof NodeList ? Array.from(target) : [target];
    for (const el of els) {
      el.style.opacity = '';
      el.style.transform = '';
    }
  }
}

export function createActReveals(sectionEl: HTMLElement, reducedMotion: boolean): ActReveals {
  const title = sectionEl.querySelector<HTMLElement>('.feature-title');
  const lede = sectionEl.querySelector<HTMLElement>('.feature-lede');
  const bullets = sectionEl.querySelectorAll<HTMLElement>('.feature-bullets li');
  const card = sectionEl.querySelector<HTMLElement>('.code-card');

  return {
    play(): void {
      // Reduced motion: feature.css's own active-state rules already show
      // every target (title/lede/bullets/card) at opacity:1 the instant the
      // act becomes active, and main.css's global
      // `@media (prefers-reduced-motion: reduce) { * { transition: none } }`
      // makes that an instant snap rather than a fade. Nothing left for JS
      // to do — previously this branch inline-set title/lede/bullets
      // (excluding card, which already had its own CSS rule) because those
      // three had no CSS active-state rule of their own yet; now that
      // feature.css supplies one for every target, this whole codepath
      // would just be redundant (and, if ever left uncleared, the exact
      // bug class this function guards against).
      if (reducedMotion) return;

      const timeline = createTimeline({ defaults: { ease: 'outQuad', duration: ACT_DURATION_MS } });
      if (title) {
        timeline.add(
          title,
          { opacity: [0, 1], translateY: [ACT_TRANSLATE_Y, 0], onComplete: () => handBackToCss(title) },
          0,
        );
      }
      if (lede) {
        timeline.add(
          lede,
          { opacity: [0, 1], translateY: [ACT_TRANSLATE_Y, 0], onComplete: () => handBackToCss(lede) },
          ACT_CASCADE_OFFSET_MS,
        );
      }
      if (bullets.length) {
        timeline.add(
          bullets,
          {
            opacity: [0, 1],
            translateY: [ACT_TRANSLATE_Y, 0],
            delay: stagger(ACT_STAGGER_MS),
            onComplete: () => handBackToCss(bullets),
          },
          ACT_CASCADE_OFFSET_MS * 2,
        );
      }
      if (card) {
        timeline.add(
          card,
          {
            opacity: [0, 1],
            translateY: [ACT_TRANSLATE_Y, 0],
            onComplete: () => handBackToCss(card),
          },
          ACT_CASCADE_OFFSET_MS * 3,
        );
      }
    },
  };
}
