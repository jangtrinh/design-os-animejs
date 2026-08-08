# Deployment

## Platform: Vercel

- **URL:** https://design-os-animejs.vercel.app
- **Project:** jangtrinhs-projects/design-os-animejs
- **Git:** https://github.com/jangtrinh/design-os-animejs (main → auto-deploy production)

## Deploy Command

```bash
vercel --prod --yes    # manual production deploy
# or: push to main — the connected GitHub repo auto-deploys
```

## Build

- Framework: Vite (auto-detected) — `npm run build` → `dist/`
- No environment variables required (fully static site)

## Rollback

```bash
vercel rollback <deployment-url>
```

## Notes

- Model license CC-BY-NC-4.0: non-commercial showcase only; footer credit must stay.
- Local dev runs on fixed port 4313 (`npm run dev`).
