/***** Config *****/
const INPUT_SIZE = 224;       // not used for saving; only if you later add ML
const LABELS = ['Snyders', 'Big Lot', 'C Press'];

// Burst settings
const BURST_COUNT = 5;        // number of frames per burst
const BURST_INTERVAL_MS = 150; // delay between frames in a burst

/***** State *****/
let videoEl = null;
let baseDirHandle = null;
let currentLabel = null;
let burstCounter = 0; // shown in UI; increments each burst (1,2,3,...)

/***** Camera *****/
async function setupCamera() {
  const el = document.getElementById('webcam');
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: 'environment' }, audio: false
  });
  el.srcObject = stream;
  await new Promise(res => el.onloadedmetadata = () => res());
  await el.play();
  videoEl = el;
}

/***** Helpers *****/
function yyyymmdd_HHMMSS() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm   = String(d.getMonth()+1).padStart(2,'0');
  const dd   = String(d.getDate()).padStart(2,'0');
  const hh   = String(d.getHours()).padStart(2,'0');
  const mi   = String(d.getMinutes()).padStart(2,'0');
  const ss   = String(d.getSeconds()).padStart(2,'0');
  return `${yyyy}${mm}${dd}_${hh}${mi}${ss}`;
}
const pad3 = n => String(n).padStart(3,'0');

function captureFrameToBlob() {
  return new Promise((resolve) => {
    const canvas = document.getElementById('captureCanvas');
    const w = videoEl.videoWidth, h = videoEl.videoHeight;
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoEl, 0, 0, w, h);
    canvas.toBlob(b => resolve(b), 'image/png', 0.92);
  });
}

async function ensureSubdir(parent, name) {
  return await parent.getDirectoryHandle(name, { create: true });
}

async function writeBlobTo(dirHandle, filename, blob) {
  const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(blob);
  await writable.close();
}

function downloadFallback(filename, blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/***** Folder selection *****/
async function chooseBaseFolder() {
  if (!window.showDirectoryPicker) {
    document.getElementById('saveStatus').textContent =
      'ブラウザがフォルダ保存に未対応です（Chrome/Edge 推奨）。ダウンロード保存に切替えます。';
    document.getElementById('folderChosen').textContent = 'ダウンロード保存';
    baseDirHandle = null;
    return;
  }
  baseDirHandle = await window.showDirectoryPicker();
  document.getElementById('folderChosen').textContent = '選択済み';
  document.getElementById('saveStatus').textContent   = '保存先を設定しました。';
}

/***** Label selection *****/
function setActiveLabel(label) {
  currentLabel = label;
  document.getElementById('activeLabel').textContent = `選択: ${label}`;

  // UI highlight for buttons
  for (const [id, name] of [['btnSnyders','Snyders'],['btnBigLot','Big Lot'],['btnCPress','C Press']]) {
    const b = document.getElementById(id);
    if (name === label) b.classList.add('selected'); else b.classList.remove('selected');
  }
}

/***** Burst capture *****/
async function burstCapture() {
  const statusEl = document.getElementById('saveStatus');
  statusEl.textContent = '';

  if (!videoEl) {
    statusEl.textContent = 'カメラが未起動です。「▶️」を押してください。';
    return;
  }
  if (!currentLabel) {
    statusEl.textContent = 'ラベルを選択してください（Snyders / Big Lot / C Press）。';
    return;
  }

  // Increment burst counter and update UI (first burst -> 1)
  burstCounter += 1;
  document.getElementById('burstCount').textContent = String(burstCounter);

  // Make sure the per-label folder exists (or prepare fallback)
  let labelDir = null;
  if (baseDirHandle) {
    const root = baseDirHandle;
    labelDir = await ensureSubdir(root, currentLabel);
  }

  const timestampBase = yyyymmdd_HHMMSS();
  let saved = 0;

  for (let i = 0; i < BURST_COUNT; i++) {
    /* eslint-disable no-await-in-loop */
    const blob = await captureFrameToBlob();

    const filename = `${timestampBase}_${currentLabel}_${pad3(i+1)}.png`;
    try {
      if (labelDir) {
        await writeBlobTo(labelDir, filename, blob);
      } else {
        downloadFallback(`${currentLabel}_${filename}`, blob);
      }
      saved++;
      statusEl.textContent = `保存中… ${saved}/${BURST_COUNT}`;
    } catch (e) {
      statusEl.textContent = `保存エラー: ${e.message || e}`;
    }

    if (i < BURST_COUNT - 1) {
      await new Promise(r => setTimeout(r, BURST_INTERVAL_MS));
    }
    /* eslint-enable no-await-in-loop */
  }

  statusEl.textContent = `保存完了: ${currentLabel} に ${saved} 枚`;
}

/***** Start camera *****/
async function start() {
  document.getElementById('err').textContent = '';
  if (!videoEl || !videoEl.srcObject) {
    try {
      await setupCamera();
      document.getElementById('status').textContent = 'カメラ起動中…OK';
    } catch (e) {
      document.getElementById('err').textContent = 'カメラ起動エラー: ' + (e?.message || e);
    }
  } else {
    document.getElementById('status').textContent = 'カメラ準備完了';
  }
}

/***** Hotkeys *****/
function onKey(e) {
  if (e.repeat) return;
  if (e.code === 'Digit1') { setActiveLabel('Snyders'); }
  if (e.code === 'Digit2') { setActiveLabel('Big Lot'); }
  if (e.code === 'Digit3') { setActiveLabel('C Press'); }
  if (e.code === 'Space')  { e.preventDefault(); burstCapture(); }
}

/***** Wire up *****/
window.addEventListener('DOMContentLoaded', async () => {
  // Buttons
  document.getElementById('chooseFolderBtn').addEventListener('click', chooseBaseFolder);
  document.getElementById('startBtn').addEventListener('click', start);
  document.getElementById('captureBtn').addEventListener('click', burstCapture);

  // Label buttons
  document.getElementById('btnSnyders').addEventListener('click', () => setActiveLabel('Snyders'));
  document.getElementById('btnBigLot').addEventListener('click',  () => setActiveLabel('Big Lot'));
  document.getElementById('btnCPress').addEventListener('click',  () => setActiveLabel('C Press'));

  // Hotkeys
  window.addEventListener('keydown', onKey);

  // Auto-start camera for convenience
  await start();
});
