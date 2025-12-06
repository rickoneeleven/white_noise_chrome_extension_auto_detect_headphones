const enabledToggle = document.getElementById('enabled');
const volumeSlider = document.getElementById('volume');
const volumeDisplay = document.getElementById('volume-display');
const statusEl = document.getElementById('status');
const testBtn = document.getElementById('test-btn');
const permSection = document.getElementById('perm-section');
const permBtn = document.getElementById('perm-btn');

async function checkMicPermission() {
  try {
    const result = await navigator.permissions.query({ name: 'microphone' });
    return result.state === 'granted';
  } catch {
    return false;
  }
}

async function updatePermissionUI() {
  const granted = await checkMicPermission();
  if (granted) {
    permSection.classList.add('granted');
    permBtn.textContent = 'Permission Granted';
    permBtn.disabled = true;
  } else {
    permSection.classList.remove('granted');
    permBtn.textContent = 'Grant Permission';
    permBtn.disabled = false;
  }
  return granted;
}

async function loadState() {
  const { enabled = false, volume = 50, isPlaying = false } = await chrome.storage.local.get(['enabled', 'volume', 'isPlaying']);
  enabledToggle.checked = enabled;
  volumeSlider.value = volume;
  volumeDisplay.textContent = `${volume}%`;
  updateStatus();
  updateTestButton(isPlaying);
  updatePermissionUI();
}

async function updateStatus() {
  const { enabled = false, isPlaying = false, headphonesConnected = false } = await chrome.storage.local.get(['enabled', 'isPlaying', 'headphonesConnected']);

  let statusText = '';
  let statusClass = 'status';

  if (isPlaying) {
    statusText = 'Playing noise';
    statusClass = 'status playing';
  } else if (enabled && headphonesConnected) {
    statusText = 'Headphones detected';
    statusClass = 'status playing';
  } else if (enabled) {
    statusText = 'Waiting for headphones...';
  } else {
    statusText = 'Disabled';
  }

  statusEl.textContent = statusText;
  statusEl.className = statusClass;

  updateTestButton(isPlaying);
}

function updateTestButton(isPlaying) {
  if (isPlaying) {
    testBtn.textContent = 'Stop';
    testBtn.className = 'test-btn stop';
  } else {
    testBtn.textContent = 'Start';
    testBtn.className = 'test-btn play';
  }
}

enabledToggle.addEventListener('change', async () => {
  const enabled = enabledToggle.checked;
  await chrome.storage.local.set({ enabled });
  chrome.runtime.sendMessage({ type: 'TOGGLE_ENABLED', enabled });
  updateStatus();
});

volumeSlider.addEventListener('input', async () => {
  const volume = parseInt(volumeSlider.value, 10);
  volumeDisplay.textContent = `${volume}%`;
  await chrome.storage.local.set({ volume });
  chrome.runtime.sendMessage({ type: 'SET_VOLUME', volume });
});

testBtn.addEventListener('click', async () => {
  const { isPlaying = false } = await chrome.storage.local.get(['isPlaying']);
  if (isPlaying) {
    chrome.runtime.sendMessage({ type: 'MANUAL_STOP' });
  } else {
    chrome.runtime.sendMessage({ type: 'MANUAL_PLAY' });
  }
});

permBtn.addEventListener('click', () => {
  // Open permissions page in new tab (popup can't request getUserMedia reliably)
  const url = chrome.runtime.getURL('permissions.html');
  console.log('Opening:', url);
  chrome.tabs.create({ url: url }, (tab) => {
    if (chrome.runtime.lastError) {
      console.error('Tab create error:', chrome.runtime.lastError);
    } else {
      console.log('Tab created:', tab);
    }
  });
});

chrome.storage.onChanged.addListener((changes) => {
  if (changes.isPlaying || changes.headphonesConnected) {
    updateStatus();
  }
});

loadState();
