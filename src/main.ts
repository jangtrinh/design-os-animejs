// Composition root: wires renderer/scene, model load, Arm Rig, wireframe
// overlay and the Hero Intro behind the single owned render loop.
import './styles/main.css';
// Fable typography ruling: Space Grotesk Variable (display+body) + JetBrains
// Mono (labels/code/chip/ticker/credit) via fontsource self-hosted files.
import '@fontsource-variable/space-grotesk';
import '@fontsource/jetbrains-mono/400.css';
import { isWebGLAvailable, prefersReducedMotion } from './lib/motion-prefs';
import { createSceneContext } from './scene/scene-setup';
import { createRenderLoop } from './scene/render-loop';
import { loadArmModel, type LoadedModel } from './scene/model-loader';
import { buildArmRig } from './scene/arm-rig';
import { createWireframeOverlay } from './scene/wireframe-overlay';
import { createHeroIntro } from './motion/hero-intro';
import { wireActs, type ActWiring } from './motion/act-wiring';
import { createLoaderOverlay } from './ui/loader-overlay';
import { createHeroReveals } from './ui/hero-reveals';
import { createPartLabels } from './ui/part-labels';
import { createTicker } from './ui/ticker';

const RESIZE_DEBOUNCE_MS = 150;

function showFallback(canvas: HTMLCanvasElement | null): void {
  document.getElementById('webgl-fallback')?.removeAttribute('hidden');
  if (canvas) canvas.hidden = true;
}

async function bootstrap(): Promise<void> {
  const canvas = document.getElementById('scene-canvas') as HTMLCanvasElement | null;
  const loader = createLoaderOverlay();
  // Hoisted so both fallback branches below (no-WebGL, gltf load error) can
  // reveal the headline instantly too, not just the happy path (M-4).
  const reducedMotion = prefersReducedMotion();

  // Step 1: WebGL unavailable -> static fallback, no canvas/loader.
  if (!canvas || !isWebGLAvailable()) {
    showFallback(canvas);
    // M-4: spec §3 requires the poster + headline visible immediately in
    // every fallback state; the reveal used to stay at CSS's initial
    // opacity:0 because createHeroReveals() was never reached on this path.
    createHeroReveals(reducedMotion).showInstantly();
    loader.hide();
    return;
  }

  // Step 2: renderer/camera/lights + the single owned render loop.
  const ctx = createSceneContext(canvas);
  const loop = createRenderLoop(() => ctx.render());

  // Step 4: load gltf with real loader %; bail to fallback on failure.
  let model: LoadedModel;
  try {
    model = await loadArmModel('/model/scene.gltf', (ratio) => loader.setProgress(ratio));
  } catch (err) {
    console.error('Failed to load arm model', err);
    loader.showError('3D preview unavailable');
    showFallback(canvas);
    // M-4: same instant reveal as the no-WebGL branch, plus loader.hide() —
    // without it the loading spinner overlay (z-index 1) stayed on top of
    // the fallback poster forever since nothing ever called hide() here.
    createHeroReveals(reducedMotion).showInstantly();
    loader.hide();
    return;
  }

  // Steps 5-6: mount model, build Arm Rig + wireframe overlay, zero pose.
  ctx.scene.add(model.root);
  const rig = buildArmRig(model);
  // M-5: overlay computes its clipping bounds from the rig (union of bboxes
  // across the choreography's pose range) — see wireframe-overlay.ts.
  const overlay = createWireframeOverlay(model, rig);
  rig.setPose({ baseYawDeg: 0, shoulderPitchDeg: 0, elbowPitchDeg: 0 });

  // Step 7: resize wiring lives in main.ts per scene-setup contract. Camera
  // aspect updates immediately; every act's scroll-range recompute is
  // debounced 150ms on the same listener via ActWiring.refresh().
  let wiring: ActWiring | null = null;
  let resizeDebounceTimer = 0;
  function handleResize(): void {
    ctx.resize();
    window.clearTimeout(resizeDebounceTimer);
    resizeDebounceTimer = window.setTimeout(() => wiring?.refresh(), RESIZE_DEBOUNCE_MS);
  }
  window.addEventListener('resize', handleResize);
  ctx.resize();

  // Step 8: start the single RAF loop.
  loop.start();

  // Step 9: Hero Intro — wireframe draw-in then crossfade to PBR, once.
  const intro = createHeroIntro(overlay, rig, ctx);
  loop.add(() => intro.tick());

  if (reducedMotion) {
    intro.skipToEnd();
  } else {
    await intro.play();
  }

  // Step 10: reveal the scene once the first frame has rendered.
  loader.hide();

  // Step 12: headline -> subtitle -> CTA reveal, right after the Hero Intro
  // resolves (UC-01a), before the scrub controller (step 14) is created.
  const reveals = createHeroReveals(reducedMotion);
  if (reducedMotion) {
    reveals.showInstantly();
  } else {
    reveals.play();
  }

  // Step 13-14: part labels + film-strip ticker. act-wiring.ts creates the
  // section router + one ScrubController per act (single render-loop owner,
  // per-frame gating so exactly one act writes camera/rig/background), wires
  // labels to the blueprint act's onProgress and the ticker to the router's
  // page-global progress.
  // Phase 03: part-labels.ts now resolves each of its 8 anchors generically
  // from the live scene graph (model.byName), so main.ts no longer needs
  // rig.pivotWorldPositions() here (the rig method itself stays — it is
  // still the documented rig contract and is cheap).
  const labels = createPartLabels({
    camera: ctx.camera,
    canvas,
    nodes: model.byName,
    reducedMotion,
  });
  const ticker = createTicker();
  // Phase 05: shared zoom-through veil element (#zoom-veil, index.html) —
  // forwarded to every act's ScrubController; only acts 2 (zoom) and 3
  // (scroll) ever write a non-zero opacity (act-tracks.ts).
  const veilEl = document.getElementById('zoom-veil') ?? undefined;

  wiring = wireActs({ rig, ctx, overlay, loop, reducedMotion, labels, ticker, veilEl });
}

bootstrap().catch((err) => {
  console.error('Bootstrap failed', err);
});
