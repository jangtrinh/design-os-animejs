// Determines which of the 6 stacked acts is currently driving the scene, and
// derives the page-global scroll progress from each act's local progress.
// Registered FIRST on the render loop (registration order = call order) so
// every per-act ScrubController's frame() reads THIS frame's activeIndex,
// not last frame's stale value (see scrub-controller.ts's report-then-gate).
export type ActId = 'hero' | 'blueprint' | 'zoom' | 'scroll' | 'clockwork' | 'outro';

export interface ActDef {
  id: ActId;
  domId: string;
  heightVh: number;
  rangeVh: number;
}

// heightVh = CSS min-height (main.css); rangeVh = usable scrub distance
// (= heightVh - 100, since onScroll's top-top/bottom-bottom range is
// sectionHeight - viewportHeight) and doubles as globalProgress's weight.
// Encoded explicitly (not derived from heightVh at runtime) so a future
// height edit can't silently reweight the ticker — see plan.md §step 3.
export const ACTS: readonly ActDef[] = [
  { id: 'hero', domId: 'act-hero', heightVh: 180, rangeVh: 80 },
  { id: 'blueprint', domId: 'act-blueprint', heightVh: 400, rangeVh: 300 },
  { id: 'zoom', domId: 'act-zoom', heightVh: 220, rangeVh: 120 },
  { id: 'scroll', domId: 'act-scroll', heightVh: 300, rangeVh: 200 },
  { id: 'clockwork', domId: 'act-clockwork', heightVh: 300, rangeVh: 200 },
  { id: 'outro', domId: 'act-outro', heightVh: 230, rangeVh: 130 },
];

/** Pure: index of the last act with p > 0 (0 when every act is at 0). */
export function activeIndex(local: readonly number[]): number {
  for (let i = local.length - 1; i >= 0; i--) {
    if (local[i] > 0) return i;
  }
  return 0;
}

/**
 * Pure: weighted page progress from per-act local progress.
 * P = (sum of full-weight ranges before the active act + active act's own
 * weighted local progress) / total weight, clamped to [0,1].
 */
export function globalProgress(local: readonly number[], acts: readonly ActDef[] = ACTS): number {
  const a = activeIndex(local);
  const totalWeight = acts.reduce((sum, act) => sum + act.rangeVh, 0);
  if (totalWeight <= 0) return 0;

  let before = 0;
  for (let i = 0; i < a; i++) before += acts[i].rangeVh;

  const raw = (before + acts[a].rangeVh * local[a]) / totalWeight;
  return Math.min(1, Math.max(0, raw));
}

export interface SectionRouter {
  isActive(index: number): boolean;
  global(): number;
  active(): ActId;
  report(index: number, p: number): void;
  frame(): void;
  refresh(): void;
}

export function createSectionRouter(args: {
  onActChange?: (id: ActId, index: number) => void;
  onGlobal?: (p: number) => void;
}): SectionRouter {
  const { onActChange, onGlobal } = args;
  const local: number[] = ACTS.map(() => 0);
  let currentIndex = 0;
  let currentGlobal = 0;

  // Stamp the initial act immediately so `document.body.dataset.act` is
  // never empty before the first frame() runs.
  document.body.dataset.act = ACTS[currentIndex].id;

  return {
    isActive(index: number): boolean {
      return index === currentIndex;
    },
    global(): number {
      return currentGlobal;
    },
    active(): ActId {
      return ACTS[currentIndex].id;
    },
    report(index: number, p: number): void {
      local[index] = p;
    },
    frame(): void {
      const nextIndex = activeIndex(local);
      if (nextIndex !== currentIndex) {
        currentIndex = nextIndex;
        document.body.dataset.act = ACTS[currentIndex].id;
        onActChange?.(ACTS[currentIndex].id, currentIndex);
      }
      currentGlobal = globalProgress(local);
      onGlobal?.(currentGlobal);
    },
    refresh(): void {
      // The router holds no measurement state of its own — each act's own
      // ScrubController owns an onScroll observer and refresh()es that.
      // Present so main.ts can forward resize to "every collaborator"
      // uniformly (act-wiring.ts's ActWiring.refresh()).
    },
  };
}
