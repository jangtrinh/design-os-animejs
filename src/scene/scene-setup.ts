// Renderer + camera + lights. Camera pose here doubles as poseAt(0) of the
// phase-03 Scrub controller (R=3.2, theta=0.62, phi=1.22, targetY=0.62) so
// control handoff never jumps — do not change these numbers without phase 03.
import * as THREE from 'three';

export interface SceneContext {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  render(): void;
  resize(): void;
  setBackgroundMix(t: number): void; // t 0=bg-dark, 1=bg-paper
}

const BG_DARK = new THREE.Color(0x171514);
const BG_PAPER = new THREE.Color(0xe9e5dd);

export function createSceneContext(canvas: HTMLCanvasElement): SceneContext {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  // Required for wireframe-overlay's draw-in clipping plane to have any
  // effect; renderer is the natural owner of this global flag.
  renderer.localClippingEnabled = true;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color();

  const aspect = canvas.clientWidth && canvas.clientHeight ? canvas.clientWidth / canvas.clientHeight : 1;
  const camera = new THREE.PerspectiveCamera(35, aspect, 0.05, 100);
  camera.position.set(1.75, 1.71, 2.45);
  camera.lookAt(0, 0.62, 0);

  const hemi = new THREE.HemisphereLight(0xffffff, 0x2a2724, 0.55);
  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(3, 4, 2);
  const fill = new THREE.DirectionalLight(0xffffff, 0.7);
  fill.position.set(-3, 1.5, -2);
  scene.add(hemi, key, fill);

  function setBackgroundMix(t: number): void {
    const clamped = THREE.MathUtils.clamp(t, 0, 1);
    (scene.background as THREE.Color).lerpColors(BG_DARK, BG_PAPER, clamped);
  }
  setBackgroundMix(0);

  function resize(): void {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (w === 0 || h === 0) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  return {
    scene,
    camera,
    renderer,
    render(): void {
      renderer.render(scene, camera);
    },
    resize,
    setBackgroundMix,
  };
}
