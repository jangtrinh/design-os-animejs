// Thin DOM wrapper around the #loader-overlay markup created in phase 01.

export interface LoaderOverlay {
  setProgress(r01: number): void;
  hide(): void;
  showError(msg: string): void;
}

const HIDE_TRANSITION_MS = 400;

export function createLoaderOverlay(): LoaderOverlay {
  const overlay = document.getElementById('loader-overlay');
  const percent = document.getElementById('loader-percent');

  return {
    setProgress(r01: number): void {
      if (!percent) return;
      percent.textContent = `${Math.round(r01 * 100)}%`;
    },
    hide(): void {
      if (!overlay) return;
      overlay.classList.add('is-hidden');
      window.setTimeout(() => {
        overlay.setAttribute('hidden', '');
      }, HIDE_TRANSITION_MS);
    },
    showError(msg: string): void {
      if (percent) percent.textContent = msg;
    },
  };
}
