# Architecture

DATETIME of last agent review: 06 Dec 2025 12:40 (Europe/London)

## Purpose
MV3 Chrome extension with offscreen document for audio and device monitoring.

## Key Files
- `background.js` - Service worker, message routing, icon state, auto-play logic
- `offscreen.js` - Device enumeration, headphone detection, noise playback
- `noise-processor.js` - AudioWorklet generating deep rumble (cascaded integrators)
- `popup.js` - UI state management, permission flow trigger

## Data Flow
```
Headphones connect
  -> offscreen.js detects via mediaDevices.enumerateDevices()
  -> sends HEADPHONES_CHANGED to background.js
  -> background.js calls playNoise() if enabled
  -> offscreen.js starts AudioWorklet
```

## Notes
- Mic permission required to see device labels (requested via permissions.html)
- Offscreen doc kept alive by background.js polling every 10s
- Device polling every 3s as backup to devicechange event
