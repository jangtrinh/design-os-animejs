// createActReveals's reduced-motion branch (Fable audit,
// fix-act-bleed-systemic-report.md): feature.css now supplies opacity:1 for
// every reveal target (.feature-title/.feature-lede/.feature-bullets li/
// .code-card) directly via its own body[data-act] active-state rule, so
// play() no longer has anything to do under reduced motion — see reveals.ts's
// own comment on that branch. This test locks that simplification in: if a
// future edit reintroduces inline-style writes here without a matching CSS
// rule, this fails loudly instead of silently reintroducing the same
// "inline style outlives the act" bug class (.code-card in
// fix-outro-overlap-report.md, blueprint's .act-blueprint-heading here).
//
// The non-reduced, timeline-driven branch (createTimeline + onComplete)
// needs a real browser/jsdom layout engine and is NOT exercised here — same
// convention as scrub-controller.test.ts (this repo's vitest environment is
// plain "node", no DOM globals).
import { describe, expect, it } from 'vitest';
import { createActReveals } from '../src/ui/reveals';

function fakeEl(): HTMLElement {
  return { style: {} } as unknown as HTMLElement;
}

function fakeSectionEl(bulletCount: number): { sectionEl: HTMLElement; targets: HTMLElement[] } {
  const title = fakeEl();
  const lede = fakeEl();
  const card = fakeEl();
  const bullets = Array.from({ length: bulletCount }, fakeEl);
  const byClass: Record<string, HTMLElement | undefined> = {
    '.feature-title': title,
    '.feature-lede': lede,
    '.code-card': card,
  };
  const sectionEl = {
    querySelector: (sel: string) => byClass[sel] ?? null,
    querySelectorAll: (sel: string) => (sel === '.feature-bullets li' ? bullets : []),
  } as unknown as HTMLElement;

  return { sectionEl, targets: [title, lede, card, ...bullets] };
}

describe('createActReveals — reduced-motion branch', () => {
  it('is a no-op: does not throw and never writes an inline style on any target', () => {
    const { sectionEl, targets } = fakeSectionEl(3);
    const reveals = createActReveals(sectionEl, true);

    expect(() => reveals.play()).not.toThrow();

    // Visibility is fully CSS-driven now — a stray inline value here could
    // outlive the act and fight feature.css's body[data-act] gate the same
    // way the pre-fix .code-card bug did.
    for (const el of targets) {
      expect(el.style.opacity).toBeUndefined();
      expect(el.style.transform).toBeUndefined();
    }
  });

  it('is safe when the section has no matching targets at all', () => {
    const emptySectionEl = {
      querySelector: () => null,
      querySelectorAll: () => [],
    } as unknown as HTMLElement;

    expect(() => createActReveals(emptySectionEl, true).play()).not.toThrow();
  });

  it('is idempotent across repeated calls (matches act-wiring.ts calling play() only once per act, but must stay safe either way)', () => {
    const { sectionEl, targets } = fakeSectionEl(2);
    const reveals = createActReveals(sectionEl, true);

    reveals.play();
    reveals.play();

    for (const el of targets) {
      expect(el.style.opacity).toBeUndefined();
    }
  });
});
