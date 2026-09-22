# Runr

Lightweight mobile-first GPS running tracker. No account, no database, no backend — open, run, finish, download a shareable run card.

## Stack

- React + Vite + TypeScript
- Browser Geolocation API
- MapLibre GL (live/summary map)
- html-to-image (1080×1350 PNG run card)
- Vercel static hosting

## Develop

```bash
npm install
npm run dev
```

Geolocation requires a secure context (HTTPS or `localhost`).

## Build & deploy

```bash
npm run build
```

Deploy the `dist/` output to Vercel (or connect the GitHub repo). `vercel.json` is included for SPA-friendly routing.

## MVP acceptance checklist

Test on a real phone over the Vercel HTTPS URL:

1. **Start** — grant location → live run screen appears
2. **Live tracking** — distance, timer, pace, and route update while moving
3. **Pause / resume** — timer and distance freeze while paused; resume does not count the pause gap as distance
4. **Finish** — confirm → GPS watcher stops → summary shows
5. **Download** — PNG run card generates; on iOS use long-press fallback if needed
6. **Privacy** — refresh clears the run; no GPS payloads leave the device

## Background / screen-lock limitation

Browser geolocation is **not** native background tracking. Expect degraded or paused updates when:

- the browser is backgrounded
- another app is foregrounded
- the phone is locked

Document observed behavior on your target device after a 30–60 minute outdoor run. Do not claim native-app background tracking.
