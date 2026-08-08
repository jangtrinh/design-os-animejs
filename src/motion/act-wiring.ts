// Extracted from main.ts (plan.md §step 8's ">180 lines" contingency):
// creates the section router plus one ScrubController per act, and wires the
// blueprint act's part-labels + the router's page-global progress into the
// ticker. All still driven by the single owned render loop (render-loop.ts).
import { ACTS, createSectionRouter, type ActId } from './section-router';
import { poseAtAct } from './act-tracks';
import { createScrubController, type ScrubController } from './scrub-controller';
import { createIdleMotion } from './idle-motion';
import { createActReveals, type ActReveals } from '../ui/reveals';
import type { ArmRig } from '../scene/arm-rig';
import type { SceneContext } from '../scene/scene-setup';
import type { WireframeOverlay } from '../scene/wireframe-overlay';
import type { RenderLoop } from '../scene/render-loop';
import type { PartLabels } from '../ui/part-labels';
import type { Ticker } from '../ui/ticker';

// DOM order in section-router.ts's ACTS ('hero', 'blueprint', ...) matches
// this index — labels are wired to the blueprint act only, per plan.md
// §step 8 ("onProgress stays wired only for act 1").
const BLUEPRINT_ACT_INDEX = 1;

// Phase 04 §step 7: the two feature acts ("Scroll", "Clockwork") get a
// stagger reveal, played once per act. Set here (not in section-router.ts)
// since it's this phase's own concern, same "one file owns one thing" split
// the router's own header comment already follows.
const REVEALABLE_ACTS: ReadonlySet<ActId> = new Set(['scroll', 'clockwork']);

export interface ActWiring {
  refresh(): void;
}

export function wireActs(args: {
  rig: ArmRig;
  ctx: SceneContext;
  overlay: WireframeOverlay;
  loop: RenderLoop;
  reducedMotion: boolean;
  labels: PartLabels;
  ticker: Ticker;
  // Phase 05: shared #zoom-veil element (main.ts), forwarded to every
  // controller — see scrub-controller.ts's veilEl doc comment for why one
  // shared element is correct.
  veilEl?: HTMLElement;
}): ActWiring {
  const { rig, ctx, overlay, loop, reducedMotion, labels, ticker, veilEl } = args;

  // Resolved once, reused by both the reveal map below and the controller
  // loop — same lookup act-wiring.ts already did per-act, just hoisted so
  // createActReveals() doesn't have to re-query the DOM a second time.
  const sectionEls: HTMLElement[] = ACTS.map((act) => {
    const sectionEl = document.getElementById(act.domId);
    if (!sectionEl) {
      throw new Error(`act-wiring: section missing for act "${act.id}" (#${act.domId})`);
    }
    return sectionEl;
  });

  const actReveals = new Map<ActId, ActReveals>();
  ACTS.forEach((act, index) => {
    if (REVEALABLE_ACTS.has(act.id)) {
      actReveals.set(act.id, createActReveals(sectionEls[index], reducedMotion));
    }
  });
  const playedReveals = new Set<ActId>();

  const router = createSectionRouter({
    onGlobal: (p) => ticker.update(p),
    onActChange: (id) => {
      if (playedReveals.has(id)) return;
      const reveal = actReveals.get(id);
      if (!reveal) return;
      playedReveals.add(id);
      reveal.play();
    },
  });
  loop.add(() => router.frame());

  // Phase 02: idle motion layer — additive Arm-Rig-only offsets (idle-
  // motion.ts). Registered right after the router so its clock advances
  // before any controller samples it this frame (registration order = call
  // order, render-loop.ts). One extra callback on the existing render loop;
  // no new RAF.
  const idle = createIdleMotion({ reducedMotion });
  loop.add((dt) => idle.advance(dt));

  const controllers: ScrubController[] = ACTS.map((act, index) =>
    createScrubController({
      sectionEl: sectionEls[index],
      rig,
      ctx,
      overlay,
      loop,
      reducedMotion,
      actIndex: index,
      poseFn: (p) => poseAtAct(index, p),
      router,
      veilEl,
      idle,
      onProgress: index === BLUEPRINT_ACT_INDEX ? (p) => labels.update(p) : undefined,
    }),
  );

  return {
    refresh(): void {
      router.refresh();
      for (const controller of controllers) controller.refresh();
    },
  };
}
