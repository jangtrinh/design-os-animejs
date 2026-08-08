# Robotic Arm — an anime.js-style scrollytelling site

**Live demo:** https://design-os-animejs.vercel.app

A single-page 3D showcase inspired by [animejs.com](https://animejs.com): a robotic arm that
assembles itself from wireframe, explodes into a labeled blueprint, and plays through
color-coded feature acts — all driven by one scroll value.

Built with **Vite + TypeScript + Three.js + anime.js v4**. No framework, no custom shaders,
one `requestAnimationFrame` loop.

**Design system & tooling:** [design:os by JANG](https://github.com/jangtrinh/design-os)

## How this was built, step by step

1. **Start from the asset.** Inspect the glTF model first: node hierarchy, mesh names,
   whether it ships animations or skins (this one had neither — every joint would have to be
   rotated by hand around manually-built pivot groups).
2. **Steal the design language, not the pixels.** Record a scroll-through video of the
   reference site, extract keyframes, and turn them into a written spec: color tokens, type
   scale, layout patterns, and the motion vocabulary (pinned center object, blueprint
   line-art with leader-line labels, film-strip progress ticker).
3. **Decide the hard rules before any code.** Scroll = scrub (two-way, position-mapped, never
   trigger-once). One RAF loop owns the frame; the animation library only produces values.
   One writer applies the pose. Every file stays under 200 lines.
4. **Plan in phases, each with its own success criteria.** Scaffold + asset compression →
   scene + arm rig + hero intro → scrub controller + choreography → UI/labels/ticker →
   feature acts → transitions + outro → tests → polish.
5. **Implement phase by phase, verifying each gate** (typecheck, unit tests, build) before
   moving on. Pure motion math (tracks, easing, rig limits) gets unit tests; every new test
   is mutation-proven (break the source → test must go red).
6. **Review adversarially, then look at it in a real browser.** Code review caught the bugs
   tests couldn't (double RAF in hidden tabs, state fights between intro and scrub); visual
   QA caught the ones review couldn't (content bleeding between sections, clipped geometry).
   Fix rounds are root-cause only — no patching symptoms.
7. **Tune the feel last.** A dedicated motion pass: velocity-continuous easing between
   keyframes (no mechanical corners), plus a subtle idle "breathing" layer so the model is
   alive before the first scroll.
8. **Ship.** Commit, push to GitHub, deploy to Vercel.

## Run it

```bash
npm install
npm run dev        # http://127.0.0.1:4313
npm run build      # production build in dist/
npx vitest run     # unit tests
```

## Credits

This work is based on ["robotic arm"](https://sketchfab.com/3d-models/robotic-arm-daaffeda139a441cbb3ca9c835045fb4)
by [yuki](https://sketchfab.com/yuki97), licensed under
[CC-BY-NC-4.0](http://creativecommons.org/licenses/by-nc/4.0/). Non-commercial showcase only.

Design direction inspired by [animejs.com](https://animejs.com) (Julian Garnier).
