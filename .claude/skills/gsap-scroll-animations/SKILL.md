---
name: gsap-scroll-animations
description: Apply when porting a reference web animation (Codrops/CodePen/GSAP demo) into the app, or building/reviewing any GSAP + ScrollTrigger + Lenis scroll-driven effect (components/blocks/carousel-3d-scroll.tsx and similar). Use it to land the effect in a few iterations instead of many — fetch the real source first, then verify visually with the Playwright harness.
---

# GSAP scroll-animation playbook

Hard-won rules from porting the Codrops "On-Scroll 3D Carousel" (`components/blocks/carousel-3d-scroll.tsx`). The goal of this skill is to **collapse the round-trips**: most of the iteration on that feature came from approximating instead of reading the source, and from numeric checks that passed while the animation looked wrong. Do these in order.

## 1. Fetch the reference SOURCE before writing anything
Codrops/CodePen demos ship their JS. **Do not eyeball values from the video.**
- Find the repo (Codrops → `github.com/codrops/<Name>`), list `js/`, `WebFetch` the raw `index.js`/`utils.js`.
- Transcribe the trigger handlers verbatim into a **beat list**: every tween's `{ property, from, to, duration, ease, stagger, position }`, in order, for BOTH directions (open AND close — they are usually different; the close is often far simpler).
- Note the exact `radius` / `perspective` / cell count and whether they change by screen size (the carousel ref: radius 500, perspective fixed, **no** mobile handling at all — so mobile is yours to add).
- Write down intentional deviations and why. Ours: the ref uses **ScrollSmoother** (hijacks page scroll); we use **Lenis** + manual parallax instead. Keep a one-line "deviation log" in the component comments.

A beat you skip is a beat the user will notice. The carousel "fly toward viewer" beat (`z: 1500, rotationZ: 270` at +0.7) was missing for many iterations purely because the first tween (`z: -2000`) looked complete on its own.

## 2. ScrollTrigger scrub maps scroll→value THROUGH the tween's ease
A scrubbed tween applies its `ease`. To invert (find the scroll for a target value) you must invert the ease, not interpolate linearly.
- `sine.inOut`: value at progress `p` is `from + range·(0.5·(1−cos(πp)))`. Invert: `p = acos(1 − 2·e)/π` where `e` is the desired eased fraction.
- A **linear** scroll map drifts ~¼-step and looks like a "snap". This single bug cost several iterations.
- Use the trigger's **real** `start`/`end` (`spinST.start`, `spinST.end`) — stash the ScrollTrigger on the element (`el.__spinST = tween.scrollTrigger`). A hand-rolled `scrollStart`/`range` (svh-vs-vh, rounding) drifts.

## 3. Scrub hand-off must match the FULL transform state, or it snaps
When a click-timeline animates an element the scrub also controls, then you re-enable the scrub, the resting states must be identical on **every** channel — not just the obvious one.
- The carousel snap on close was an unmatched **wobble** (`rotationX/rotationZ`, the ±3° the scrub drives), even though `rotationY` matched. Record the scrub's value for every animated channel at the target scroll and land the close tween there.
- The final resting rotation is decided by `ScrollTrigger.refresh()` reading `window.scrollY` — the close tween's end value is cosmetic. So the real fix is **putting the scroll where the scrub yields the target**, then re-syncing.

## 4. Lenis interop
- Drive page scroll **through Lenis** (`window.__lenis`, exposed in `components/webgl/smooth-scroll.tsx`). A plain `window.scrollTo` is overwritten by Lenis's rAF loop.
- **Lock with `lenis.stop()`, not `body{overflow:hidden}`** — `overflow:hidden` shrinks the scrollable height and **clamps** any `lenis.scrollTo`, so your target lands short. `scrollTo(target, { immediate, force: true })` overrides the stop.
- **Restart on unmount.** If you `lenis.stop()` on open, the cleanup must `lenis.start()` — otherwise unmounting mid-animation leaves the next page's scroll locked.
- For a *seamless* scroll adjustment (e.g. re-centering), animate it **smoothly** concurrent with a busy beat (drive a proxy with GSAP, call `lenis.scrollTo(proxy.y, {immediate,force})` in `onUpdate`) — the reference scrolls to target over ~1.5s at the start. An **instant** jump reads as a snap even mid-transition.

## 5. CSS / GSAP gotchas that bit us
- `gsap.set(el, { rotateY, z })` emits `translate() rotate()` (translate FIRST) — wrong for a 3D ring. Set `el.style.transform = \`rotateY(${a}deg) translateZ(${r}px)\`` as a string for faces-outward.
- **`autoAlpha` vs `opacity`.** `autoAlpha:0` sets `visibility:hidden`. If you hide with `autoAlpha` but reveal with plain `opacity`, the element stays `visibility:hidden` and shows **nothing**. Pick one consistently per element (this caused "preview sometimes shows nothing").
- `perspective` clipping: `translateZ` past the perspective value puts the element behind the camera (it vanishes) — that's how the "rush past the viewer" works; don't fight it.
- Measure AFTER adding the enhancement class (`is-enhanced`) so `offsetWidth` is the real size, not the fallback grid width.
- Progressive enhancement is non-negotiable here: SSR/`prefers-reduced-motion` renders a plain photo grid; GSAP enhances on mount. See `.claude/agents/frontend-webgl.md` and `docs/PERFORMANCE.md` §4.

## 6. Verify VISUALLY, not just numerically — use the harness
Numeric assertions (angles) passed while wobble-snaps, title shifts, and centering snaps were visibly wrong. Always add a visual/continuity check. Patterns that work (Playwright, `channel:'chrome'`, `reducedMotion:'no-preference'`):
- Read GSAP-tracked values from the cache: `el._gsap.rotationY` (accurate; DOM-matrix `atan2` is corrupted by the wobble). **`el._gsap.z` does NOT exist** — translateZ isn't cached there; `rotationZ` is under `_gsap.rotation`. Sample the rendered `getComputedStyle(el).transform` matrix when you need z.
- **Front-facing** check: a cell faces front when `rotationY ≡ 0 (mod 360/cellCount)`.
- **Seamless hand-off** check: after the scrub re-takes control, the channel value must equal the close-tween target within ~0.1° (proves no jump). Frame-to-frame `Math.max` over the whole tween is swamped by intended motion — measure the *endpoint match* instead.
- **Centered-on-screen** check: `scene.getBoundingClientRect()` center vs `innerHeight/2`.
- **Screenshot the mid-transition** (e.g. ~1.9s into the open) to confirm a beat is actually visible, not just present in code.
- Always assert **0 console/page errors**, and test **reduced-motion** (static fallback, not enhanced) and **mobile** (iPhone 13 device) contexts.
- Filter `NaN`/`null` samples before `Math.min/max` (one bad `_gsap` read poisons the aggregate).

## 7. The example/demo page state lives in the DB — persist it
The "scroll-showcase-example" page stores its block style in Postgres `page.blocks[2].style`. Setting it only via Redis gets wiped by `redis-cli FLUSHALL`. To pin a demo to `carousel3d`:
```sql
UPDATE page SET blocks = jsonb_set(blocks, '{2,style}', '"carousel3d"')
WHERE slug='scroll-showcase-example';
```
then `redis-cli FLUSHALL`. Verify with the `jsonb_array_elements … WITH ORDINALITY` query. Don't `FLUSHALL` and assume the demo survives.

## Iteration budget
If you're more than ~2 visual round-trips in and still "not matching", STOP and re-read the source (step 1) — you're almost certainly missing a beat or applying an ease you didn't invert (steps 2–3).
