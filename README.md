# White Noise Chrome Extension

DATETIME of last agent review: 06 Dec 2025 12:40 (Europe/London)

Chrome extension for Misophonia relief. Auto-plays deep rumble noise when Bluetooth headphones connect, stops when they disconnect.

## Stack
- Chrome Extension (Manifest V3)
- Web Audio API with AudioWorklet (noise generation)
- MediaDevices API (headphone detection)

## Quick Start
```bash
# Load in Chrome
1. Open chrome://extensions
2. Enable "Developer mode"
3. Click "Load unpacked" -> select this folder
4. Click extension icon -> "Grant Permission" -> allow mic access
5. Toggle "Auto-play on headphones" ON
6. Connect Bluetooth headphones -> noise plays automatically
```

## Files
```
manifest.json         # Extension config
background.js         # Service worker, orchestrates everything
offscreen.html/js     # Audio playback + device monitoring
noise-processor.js    # AudioWorklet for deep rumble generation
popup.html/js         # User controls (toggle, volume)
permissions.html/js   # Mic permission page (unlocks device labels)
icons/                # Extension icons (grey/amber/green states)
```

## Icon States
- **Grey** - Extension disabled
- **Amber** - Enabled, waiting for headphones
- **Green** - Headphones connected / playing

## Dev Commands
```bash
node generate-icons.js  # Regenerate icon PNGs
```

## Operations
See `ops/` for architecture details.
