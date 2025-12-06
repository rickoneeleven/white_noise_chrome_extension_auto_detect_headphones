let offscreenReady = false;

chrome.runtime.onInstalled.addListener(async () => {
  const { enabled, volume } = await chrome.storage.local.get(['enabled', 'volume']);
  if (enabled === undefined) {
    await chrome.storage.local.set({
      enabled: false,
      volume: 50,
      isPlaying: false,
      headphonesConnected: false
    });
  }
  updateIcon();
  await ensureOffscreenDocument();
});

chrome.runtime.onStartup.addListener(async () => {
  updateIcon();
  await ensureOffscreenDocument();
});

async function ensureOffscreenDocument() {
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT']
  });

  if (existingContexts.length > 0) {
    offscreenReady = true;
    console.log('[Background] Offscreen document already exists');
    return;
  }

  try {
    await chrome.offscreen.createDocument({
      url: 'offscreen.html',
      reasons: ['USER_MEDIA', 'AUDIO_PLAYBACK'],
      justification: 'Monitoring audio devices for headphone detection and playing white noise'
    });
    offscreenReady = true;
    console.log('[Background] Offscreen document created');
  } catch (err) {
    console.error('[Background] Failed to create offscreen document:', err);
    offscreenReady = false;
  }
}

async function recreateOffscreenDocument() {
  // Close existing if any
  try {
    await chrome.offscreen.closeDocument();
  } catch (err) {
    // Ignore if doesn't exist
  }
  offscreenReady = false;

  // Small delay then recreate
  await new Promise(r => setTimeout(r, 100));
  await ensureOffscreenDocument();
}

async function playNoise() {
  await ensureOffscreenDocument();
  const { volume = 50 } = await chrome.storage.local.get(['volume']);
  try {
    await chrome.runtime.sendMessage({ type: 'PLAY_NOISE', volume });
    await chrome.storage.local.set({ isPlaying: true });
    console.log('[Background] Play noise command sent');
  } catch (err) {
    console.error('[Background] Failed to send play message:', err);
  }
}

async function stopNoise() {
  if (!offscreenReady) return;
  try {
    await chrome.runtime.sendMessage({ type: 'STOP_NOISE' });
    await chrome.storage.local.set({ isPlaying: false });
    console.log('[Background] Stop noise command sent');
  } catch (err) {
    console.error('[Background] Failed to send stop message:', err);
  }
}

async function setVolume(volume) {
  if (!offscreenReady) return;
  try {
    await chrome.runtime.sendMessage({ type: 'SET_VOLUME', volume });
  } catch (err) {
    // Ignore
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[Background] Received:', message.type);

  switch (message.type) {
    case 'TOGGLE_ENABLED':
      (async () => {
        await updateIcon();
        console.log('[Background] Icon updated after toggle');
        if (!message.enabled) {
          await stopNoise();
        }
      })();
      break;

    case 'SET_VOLUME':
      setVolume(message.volume);
      break;

    case 'MANUAL_PLAY':
      playNoise().then(() => sendResponse({ success: true }));
      return true;

    case 'MANUAL_STOP':
      stopNoise().then(() => sendResponse({ success: true }));
      return true;

    case 'HEADPHONES_CHANGED':
      handleHeadphonesChanged(message);
      break;

    case 'PERMISSION_GRANTED':
      console.log('[Background] Permission granted, recreating offscreen document');
      recreateOffscreenDocument();
      sendResponse({ success: true });
      return true;
  }
});

async function handleHeadphonesChanged(message) {
  const { connected, initial, deviceCount, labels, note } = message;
  console.log(`[Background] Headphones ${connected ? 'CONNECTED' : 'DISCONNECTED'}${initial ? ' (initial)' : ''}`);

  if (deviceCount !== undefined) {
    console.log(`[Background] Device count: ${deviceCount}`);
  }
  if (labels) {
    console.log(`[Background] Labels:`, labels);
  }
  if (note) {
    console.log(`[Background] Note: ${note}`);
  }

  await chrome.storage.local.set({ headphonesConnected: connected });

  // Auto-play logic
  const { enabled = false, isPlaying = false } = await chrome.storage.local.get(['enabled', 'isPlaying']);

  if (connected && enabled && !isPlaying) {
    console.log('[Background] Auto-starting noise (headphones connected + enabled)');
    await playNoise();
  } else if (!connected && isPlaying) {
    console.log('[Background] Auto-stopping noise (headphones disconnected)');
    await stopNoise();
  }

  // Update icon AFTER play/stop state changes
  await updateIcon();
}

async function updateIcon() {
  const { enabled = false, headphonesConnected = false, isPlaying = false } =
    await chrome.storage.local.get(['enabled', 'headphonesConnected', 'isPlaying']);

  let iconState;
  if (!enabled) {
    iconState = 'off';      // Grey - disabled
  } else if (headphonesConnected || isPlaying) {
    iconState = 'on';       // Green - connected/playing
  } else {
    iconState = 'waiting';  // Amber - enabled but waiting
  }

  console.log(`[Background] updateIcon: enabled=${enabled}, hp=${headphonesConnected}, playing=${isPlaying} -> ${iconState}`);

  await chrome.action.setIcon({
    path: {
      16: `icons/icon-${iconState}-16.png`,
      48: `icons/icon-${iconState}-48.png`,
      128: `icons/icon-${iconState}-128.png`
    }
  });
}

// Periodically check if offscreen document is still alive and recreate if needed
setInterval(async () => {
  const contexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT']
  });
  if (contexts.length === 0 && offscreenReady) {
    console.log('[Background] Offscreen document died, recreating...');
    offscreenReady = false;
    await ensureOffscreenDocument();
  }
}, 10000); // Check every 10 seconds
