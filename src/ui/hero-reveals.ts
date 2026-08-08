// Headline -> subtitle -> CTA stagger reveal, played exactly once right
// after the Hero Intro (wireframe->PBR crossfade) resolves - never in
// parallel with it (UC-01a). Word-cycle (subtitle's rotating verb) is P1 per
// superprompt.md §5 and is skipped entirely under reduced-motion.
//
// Split out of reveals.ts (phase 04 §Related code files' own ">120 lines"
// contingency, triggered once createActReveals landed) — reveals.ts now
// holds only the feature-act version.
//
// Deliberately NOT given reveals.ts's handBackToCss/onComplete-clear
// treatment (Fable audit, fix-act-bleed-systemic-report.md): .word/
// #hero-subtitle/#hero-cta are nested inside .hero-copy, whose own opacity
// is the ONLY CSS gate (body[data-act='hero'] .hero-copy, hero.css) — same
// safe "parent multiplies a stale inline value down to 0" pattern
// fix-outro-overlap-report.md already verified for feature-copy's
// title/lede/bullets, so there is nothing to fix here. Giving these three
// their own CSS active-state rule (the fix applied to feature.css) would
// actively regress UC-01a: body[data-act='hero'] is already true from
// page load (section-router.ts stamps it before the first frame), but
// play() below is only called once the async Hero Intro crossfade resolves
// — a real delay, unlike act-wiring.ts's feature-act reveals which fire
// synchronously in the same tick body[data-act] switches. A CSS rule keyed
// to body[data-act='hero'] alone would show these words during that delay,
// before the intro has even finished.
import { createTimeline, stagger } from 'animejs';

export interface HeroReveals {
  play(): void;
  showInstantly(): void;
}

const STAGGER_MS = 80;
const CTA_OFFSET = '-=200';
const WORD_CYCLE_HOLD_MS = 1800;
const WORD_CYCLE_FADE_MS = 200; // hold + 2*fade = 2200ms per cycle, per spec

function startWordCycle(): void {
  const el = document.getElementById('word-cycle');
  if (!el) return;
  const words = (el.dataset.words ?? '')
    .split(',')
    .map((w) => w.trim())
    .filter(Boolean);
  if (words.length < 2) return;

  let index = 0;
  createTimeline({ loop: true, defaults: { ease: 'inOutQuad' } })
    .add(el, { opacity: 0, duration: WORD_CYCLE_FADE_MS }, WORD_CYCLE_HOLD_MS)
    .add(el, {
      opacity: 1,
      duration: WORD_CYCLE_FADE_MS,
      onBegin: () => {
        index = (index + 1) % words.length;
        el.textContent = words[index];
      },
    });
}

export function createHeroReveals(reducedMotion: boolean): HeroReveals {
  const words = document.querySelectorAll<HTMLElement>('#hero-headline .word');
  const subtitle = document.getElementById('hero-subtitle');
  const cta = document.getElementById('hero-cta');

  return {
    play(): void {
      const timeline = createTimeline({ defaults: { ease: 'outQuad' } }).add(
        words,
        { opacity: [0, 1], translateY: [24, 0], delay: stagger(STAGGER_MS), duration: 500 },
        0,
      );
      if (subtitle) timeline.add(subtitle, { opacity: [0, 1], duration: 500 });
      if (cta) timeline.add(cta, { opacity: [0, 1], duration: 400 }, CTA_OFFSET);

      if (!reducedMotion) startWordCycle();
    },
    showInstantly(): void {
      for (const word of words) {
        word.style.opacity = '1';
        word.style.transform = 'none';
      }
      if (subtitle) subtitle.style.opacity = '1';
      if (cta) cta.style.opacity = '1';
    },
  };
}
