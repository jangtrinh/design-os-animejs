// Hero Intro: wireframe draw-in (0->1.2s) then crossfade to PBR (1.3->2.2s),
// driven by an anime.js v4 timeline. The timeline only tweens a plain state
// object; render-loop.ts owns the actual RAF and calls engine.update() for
// us, and main.ts registers `tick()` as the per-frame apply step.
import { createTimeline } from 'animejs';
import type { WireframeOverlay } from '../scene/wireframe-overlay';
import type { ArmRig } from '../scene/arm-rig';
import type { SceneContext } from '../scene/scene-setup';

export interface HeroIntro {
  play(): Promise<void>;
  skipToEnd(): void;
  /** Re-applies current timeline state to the overlay; call once per render-loop frame. */
  tick(): void;
}

interface IntroState {
  draw: number;
  mix: number;
}

export function createHeroIntro(overlay: WireframeOverlay, rig: ArmRig, _scene: SceneContext): HeroIntro {
  // Rig stays at zero pose for the whole intro (plan.md §Requirements).
  rig.setPose({ baseYawDeg: 0, shoulderPitchDeg: 0, elbowPitchDeg: 0 });

  const state: IntroState = { draw: 0, mix: 1 };
  const timeline = createTimeline({ defaults: { ease: 'inOutQuad' }, autoplay: false })
    .add(state, { draw: [0, 1], duration: 1200 }, 0)
    .add(state, { mix: [1, 0], duration: 900, ease: 'inOutCubic' }, 1300);

  // Review finding M-1: intro.tick() used to stay registered on the render
  // loop forever and kept re-applying the finished state (mix=0) every
  // frame, silently overwriting the Scrub controller's wireMix once the
  // intro was done. `done` makes tick() a no-op after completion so the
  // Scrub controller (added to the loop later, per main.ts step 14) owns
  // wireMix uncontested from then on.
  let done = false;

  function applyState(): void {
    overlay.setDrawIn(state.draw);
    overlay.setMix(state.mix);
  }
  applyState();

  return {
    play(): Promise<void> {
      return new Promise((resolve) => {
        timeline.play();
        timeline.then(() => {
          done = true;
          resolve();
        });
      });
    },
    skipToEnd(): void {
      state.draw = 1;
      state.mix = 0;
      applyState();
      done = true;
    },
    tick(): void {
      if (done) return;
      applyState();
    },
  };
}
