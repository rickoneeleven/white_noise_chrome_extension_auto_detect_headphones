let audioContext = null;
let noiseNode = null;
let gainNode = null;
let isPlaying = false;

// Device tracking
let knownDeviceIds = new Set();
let headphonesConnected = false;

async function startNoise(volume) {
  if (isPlaying) return;

  try {
    audioContext = new AudioContext();

    // Load AudioWorklet module
    await audioContext.audioWorklet.addModule('noise-processor.js');

    noiseNode = new AudioWorkletNode(audioContext, 'brown-noise-processor');
    gainNode = audioContext.createGain();
    gainNode.gain.value = volume / 100;

    noiseNode.connect(gainNode);
    gainNode.connect(audioContext.destination);

    isPlaying = true;
    console.log('[Offscreen] Noise started, volume:', volume);
  } catch (err) {
    console.error('[Offscreen] Error starting noise:', err);
  }
}

function stopNoise() {
  if (!isPlaying) return;

  try {
    if (noiseNode) {
      noiseNode.disconnect();
      noiseNode = null;
    }
    if (gainNode) {
      gainNode.disconnect();
      gainNode = null;
    }
    if (audioContext) {
      audioContext.close();
      audioContext = null;
    }
  } catch (err) {
    console.error('[Offscreen] Error stopping noise:', err);
  }

  isPlaying = false;
  console.log('[Offscreen] Noise stopped');
}

function setVolume(volume) {
  if (gainNode) {
    gainNode.gain.value = volume / 100;
    console.log('[Offscreen] Volume set to:', volume);
  }
}

// Headphone detection
function isHeadphoneDevice(label) {
  if (!label) return false;
  const keywords = [
    'headphone', 'headset', 'earphone', 'earbud', 'airpod',
    'bose', 'sony wh', 'sony wf', 'beats', 'jabra', 'sennheiser',
    'bluetooth', 'wireless', 'buds', 'qc35', 'qc45', 'wh-1000', 'wf-1000'
  ];
  const lower = label.toLowerCase();
  return keywords.some(kw => lower.includes(kw));
}

async function checkDevices() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const audioOutputs = devices.filter(d => d.kind === 'audiooutput');

    console.log('[Offscreen] Checking devices...');
    console.log(`[Offscreen] Found ${audioOutputs.length} audio outputs:`);
    audioOutputs.forEach((d, i) => {
      console.log(`[Offscreen]   ${i + 1}. "${d.label || '(no label)'}" [${d.deviceId.slice(0, 8)}...]`);
    });

    const currentDeviceIds = new Set(audioOutputs.map(d => d.deviceId));

    // Check for NEW devices
    let newHeadphones = false;
    for (const device of audioOutputs) {
      if (!knownDeviceIds.has(device.deviceId)) {
        console.log(`[Offscreen] New device: "${device.label}"`);

        // Skip default/communications placeholders
        if (device.deviceId !== 'default' && device.deviceId !== 'communications') {
          if (isHeadphoneDevice(device.label) || device.label !== '') {
            newHeadphones = true;
          }
        }
      }
    }

    // Check for REMOVED devices
    let removedDevice = false;
    for (const oldId of knownDeviceIds) {
      if (!currentDeviceIds.has(oldId)) {
        console.log(`[Offscreen] Device removed: ${oldId.slice(0, 8)}...`);
        removedDevice = true;
      }
    }

    // Update known devices
    knownDeviceIds = currentDeviceIds;

    // Determine headphone state
    // Check if any current device is headphones
    let hasHeadphones = false;
    for (const device of audioOutputs) {
      if (isHeadphoneDevice(device.label)) {
        hasHeadphones = true;
        break;
      }
    }

    // Update state if changed
    if (hasHeadphones !== headphonesConnected) {
      headphonesConnected = hasHeadphones;
      console.log(`[Offscreen] >>> Headphones ${headphonesConnected ? 'CONNECTED' : 'DISCONNECTED'}`);

      chrome.runtime.sendMessage({
        type: 'HEADPHONES_CHANGED',
        connected: headphonesConnected,
        deviceCount: audioOutputs.length,
        labels: audioOutputs.map(d => d.label || '(no label)')
      }).catch(err => console.log('[Offscreen] Message error:', err.message));
    }

  } catch (err) {
    console.error('[Offscreen] Error checking devices:', err);
  }
}

async function initDeviceMonitoring() {
  console.log('[Offscreen] Starting device monitoring...');

  // Initial device check
  await checkDevices();

  // Report initial state
  chrome.runtime.sendMessage({
    type: 'HEADPHONES_CHANGED',
    connected: headphonesConnected,
    initial: true,
    note: 'Initial state'
  }).catch(() => {});

  // Listen for device changes
  navigator.mediaDevices.ondevicechange = () => {
    console.log('[Offscreen] Device change event!');
    checkDevices();
  };

  // Also poll as backup (some changes don't trigger event)
  setInterval(() => {
    checkDevices();
  }, 3000);

  console.log('[Offscreen] Device monitoring active');
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[Offscreen] Received:', message.type);

  switch (message.type) {
    case 'PLAY_NOISE':
      startNoise(message.volume || 50);
      sendResponse({ success: true });
      break;
    case 'STOP_NOISE':
      stopNoise();
      sendResponse({ success: true });
      break;
    case 'SET_VOLUME':
      setVolume(message.volume);
      sendResponse({ success: true });
      break;
    case 'CHECK_HEADPHONES':
      checkDevices().then(() => {
        sendResponse({ connected: headphonesConnected });
      });
      return true;
  }

  return true;
});

// Start monitoring
initDeviceMonitoring();

console.log('[Offscreen] Audio handler ready');
