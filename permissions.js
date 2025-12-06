const grantBtn = document.getElementById('grant-btn');
const statusEl = document.getElementById('status');

grantBtn.addEventListener('click', async () => {
  try {
    grantBtn.disabled = true;
    grantBtn.textContent = 'Requesting...';

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    // Stop immediately - we just needed permission
    stream.getTracks().forEach(track => track.stop());

    statusEl.textContent = 'Permission granted! You can now close this tab and use the extension.';
    statusEl.className = 'status success';
    grantBtn.textContent = 'Done!';

    // Notify background
    chrome.runtime.sendMessage({ type: 'PERMISSION_GRANTED' });

  } catch (err) {
    console.error('Permission error:', err);
    statusEl.textContent = 'Permission denied: ' + err.message;
    statusEl.className = 'status error';
    grantBtn.textContent = 'Try Again';
    grantBtn.disabled = false;
  }
});
