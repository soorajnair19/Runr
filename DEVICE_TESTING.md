# Device validation notes

Use this checklist on a real phone against the deployed HTTPS URL.

## Target browsers

- Mobile Safari (iOS)
- Mobile Chrome (Android)

## Acceptance runs

| Test | Expected | Observed (fill in) |
|------|----------|--------------------|
| Start + permission | Live screen after grant | |
| Live tracking outdoors | Distance/time/pace/route update | |
| Pause / resume | Timer & distance freeze; no pause-gap distance | |
| Finish | Watcher stops; summary correct | |
| Download card | PNG saves; iOS long-press fallback if needed | |
| Privacy | Refresh clears run; no GPS network calls | |

## Background / lock behavior (known browser limits)

| Condition | Expected MVP behavior | Observed |
|-----------|----------------------|----------|
| Phone unlocked, browser visible | Continuous GPS | |
| Browser minimized | Updates may pause | |
| Switch apps | Updates may pause | |
| Phone locked | Updates typically pause | |
| Unlock after several minutes | Tracking resumes; may show gap | |
| Phone in pocket (screen on) | Should continue | |
| 30–60 min run, screen on | App remains usable | |

**Do not claim native-app background tracking.** Document actual device results above after field testing.

## Distance accuracy comparison (vs Nike Run Club / Strava)

Browser GPS is noisier than native apps. After filter changes, validate outdoors:

1. Start **Nike Run Club** (or Strava) and **Runr** on the same phone at the same time.
2. Walk or jog a known short loop (~0.3–1.0 km), keep the browser foregrounded.
3. Finish both apps and compare distance.

| Metric | Target | Observed (fill in) |
|--------|--------|--------------------|
| Runr vs NRC absolute delta | ideally ≤ ~10–15% on open outdoor routes | |
| Two phones both on Runr | should stay within ~0.02 km of each other | |
| Live map trail | green line + breadcrumbs appear while moving (not only after download) | |
| Downloaded card “KM” | clear space between number and KM, no overlap | |

### Tuning notes

Filter knobs live in `src/lib/gps.ts` (`GPS_CONFIG`):

- Raise `minIntervalMs` / `accuracyDistanceFactor` if Runr still overcounts.
- Lower them slightly if sharp turns or slow walks are undercounted.
- Re-check after changes with the same NRC comparison loop above.

