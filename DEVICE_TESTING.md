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
