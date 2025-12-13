let audioContext = null;
let noiseNode = null;
let gainNode = null;
let lowpass1 = null;
let lowpass2 = null;
let bassBoost = null;
let subBoost = null;
let isPlaying = false;

// Device tracking
let knownDeviceIds = new Set();
let headphonesConnected = false;

async function startNoise(volume) {
  if (isPlaying) return;

  try {
    audioContext = new AudioContext();

    // Resume if suspended (Chrome autoplay policy)
    if (audioContext.state === 'suspended') {
      await audioContext.resume();
    }

    // Load AudioWorklet module
    await audioContext.audioWorklet.addModule('noise-processor.js');

    noiseNode = new AudioWorkletNode(audioContext, 'brown-noise-processor');

    // Two lowpass filters at 80Hz
    lowpass1 = audioContext.createBiquadFilter();
    lowpass1.type = 'lowpass';
    lowpass1.frequency.value = 80;
    lowpass1.Q.value = 0.5;

    lowpass2 = audioContext.createBiquadFilter();
    lowpass2.type = 'lowpass';
    lowpass2.frequency.value = 80;
    lowpass2.Q.value = 0.5;

    // Bass boost at 50Hz
    bassBoost = audioContext.createBiquadFilter();
    bassBoost.type = 'lowshelf';
    bassBoost.frequency.value = 50;
    bassBoost.gain.value = 12;

    // Sub boost at 25Hz
    subBoost = audioContext.createBiquadFilter();
    subBoost.type = 'lowshelf';
    subBoost.frequency.value = 25;
    subBoost.gain.value = 10;

    gainNode = audioContext.createGain();
    gainNode.gain.value = volume / 100;

    // Chain: noise -> lp1 -> lp2 -> bassBoost -> subBoost -> gain -> out
    noiseNode.connect(lowpass1);
    lowpass1.connect(lowpass2);
    lowpass2.connect(bassBoost);
    bassBoost.connect(subBoost);
    subBoost.connect(gainNode);
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
    if (lowpass1) {
      lowpass1.disconnect();
      lowpass1 = null;
    }
    if (lowpass2) {
      lowpass2.disconnect();
      lowpass2 = null;
    }
    if (bassBoost) {
      bassBoost.disconnect();
      bassBoost = null;
    }
    if (subBoost) {
      subBoost.disconnect();
      subBoost = null;
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
