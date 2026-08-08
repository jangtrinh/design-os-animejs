// Blueprint-act part labels: 8 fixed-column labels, each joined to its 3D
// part anchor by an SVG leader line (#leader-lines). Reveal order + column
// come from the DOM (index.html's data-col/data-node/data-reveal attrs);
// anchors are generic per-node bbox centers (arm-rig.ts's real scene-graph
// nodes), pose-invariant by construction — see localBboxCenter below.
import * as THREE from 'three';
import { leaderPoints, leaderPathD, type LeaderSide } from './leader-line-geometry';

export interface PartLabels {
  update(p: number): void;
}

interface CreatePartLabelsArgs {
  camera: THREE.PerspectiveCamera;
  canvas: HTMLCanvasElement;
  nodes: Map<string, THREE.Object3D>;
  reducedMotion: boolean;
}

interface LabelEntry {
  el: HTMLElement;
  path: SVGPathElement;
  node: THREE.Object3D;
  localCenter: THREE.Vector3;
  side: LeaderSide;
  revealAt: number;
  // Captured once at creation (spec: never per frame) — labels are pinned by
  // fixed-column CSS (left/right inset px), so their rect never moves.
  labelPt: { x: number; y: number };
}

// World box at capture time -> local point via worldToLocal. Pose-invariant:
// the result is intrinsic to the mesh geometry, independent of the rig pose
// (or explode offset) at the moment of capture.
function localBboxCenter(node: THREE.Object3D): THREE.Vector3 {
  node.updateWorldMatrix(true, false);
  const worldCenter = new THREE.Box3().setFromObject(node).getCenter(new THREE.Vector3());
  return node.worldToLocal(worldCenter);
}

export function createPartLabels(args: CreatePartLabelsArgs): PartLabels {
  const { camera, canvas, nodes, reducedMotion } = args;
  const svg = document.getElementById('leader-lines');

  const entries: LabelEntry[] = Array.from(
    document.querySelectorAll<HTMLElement>('.part-label[data-node]'),
  ).map((el) => {
    const nodeName = el.dataset.node ?? '';
    const node = nodes.get(nodeName);
    if (!node) throw new Error(`part-labels: node missing for label "${nodeName}"`);

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    svg?.appendChild(path);

    const side: LeaderSide = el.dataset.col === 'right' ? 'right' : 'left';
    const rect = el.getBoundingClientRect();

    return {
      el,
      path,
      node,
      localCenter: localBboxCenter(node),
      side,
      revealAt: Number(el.dataset.reveal ?? '0'),
      // Leader line starts at the label edge NEAREST the 3D anchor (right
      // column -> object sits to the left -> start at rect.left; left column
      // -> object sits to the right -> start at rect.right), then
      // leaderPoints() adds LABEL_GAP_PX moving further away from the text.
      // Using the far edge here made the line run back across the whole
      // label and strike through the text (phase-07 polish fix, caught by
      // real-browser screenshot comparison against reference/f07.png).
      labelPt: { x: side === 'right' ? rect.left : rect.right, y: rect.top + rect.height / 2 },
    };
  });

  if (reducedMotion) {
    for (const { el, path } of entries) {
      el.classList.add('is-visible');
      path.classList.add('is-visible');
    }
  }

  const scratch = new THREE.Vector3();

  return {
    update(p: number): void {
      for (const entry of entries) {
        const { el, path, node, localCenter, side, revealAt, labelPt } = entry;

        if (!reducedMotion) {
          const visible = p >= revealAt;
          el.classList.toggle('is-visible', visible);
          if (!visible) {
            path.classList.remove('is-visible');
            continue;
          }
        }

        node.updateWorldMatrix(true, false);
        scratch.copy(localCenter);
        node.localToWorld(scratch);
        scratch.project(camera);

        // z > 1 = anchor projects behind the camera -> hide label + its line.
        if (scratch.z > 1) {
          if (!reducedMotion) {
            el.classList.remove('is-visible');
            path.classList.remove('is-visible');
          }
          continue;
        }
        if (!reducedMotion) path.classList.add('is-visible');

        const x = (scratch.x * 0.5 + 0.5) * canvas.clientWidth;
        const y = (-scratch.y * 0.5 + 0.5) * canvas.clientHeight;
        path.setAttribute('d', leaderPathD(leaderPoints(labelPt, { x, y }, side)));
      }
    },
  };
}
