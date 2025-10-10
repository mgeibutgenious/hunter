/***** Config *****/
// Saved image size (square). Change to 224 for ML-ready small files, or 1024 for high quality.
const TARGET_SIZE = 512;

// Optional: request higher preview size as well
const PREVIEW_CONSTRAINTS = {
  video: {
    facingMode: { ideal: 'environment' },
    width:  { ideal: 1920 },
    height: { ideal: 1080 },
    // aspectRatio: { ideal: 1.0 }, // uncomment if you prefer near-square preview
  },
  audio: false
};

const LABELS = ['Snyders', 'Big Lot', 'C Press'];
const SNYDERS_SUBS = ['C','D','E']; // only when Snyders selected

/***** State *****/
let videoEl = null;
let baseDirHandle = null;
let currentLabel = null;   // 'Snyders' | 'Big Lot' | 'C Press'
let currentSub   = null;   // 'C' | 'D' | 'E' | null
let shotCounter  = 0;

/***** Camera *****/
async function setupCamera() {
  const el = document.getElementById('webcam');
  const stream = await navigator.mediaDevices.getUserMedia(PREVIEW_CONSTRAINTS);
  el.srcObject = stream;
  await new Promise(res => el.onloadedmetadata = () => res());
  await el.play();
  videoEl = el;
  document.getElementById('status').textContent = 'カメラ準備完了';
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
  const a = document.createElement('a'); a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

/***** Capture methods *****/
// Preferred: true still-photo capture via ImageCapture API, then center-crop to square TARGET_SIZE
async function capturePhotoSquareBlob() {
  const track = videoEl?.srcObject?.getVideoTracks?.()[0];
  if (track && 'ImageCapture' in window) {
    try {
      const imageCapture = new ImageCapture(track);
      const photoBlob = await imageCapture.takePhoto(); // full-res still
      const bitmap = await createImageBitmap(photoBlob);
      const w = bitmap.width, h = bitmap.height;
      const side = Math.min(w, h);
      const sx = (w - side) / 2;
      const sy = (h - side) / 2;

      const canvas = document.getElementById('captureCanvas');
      canvas.width = TARGET_SIZE; canvas.height = TARGET_SIZE;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, TARGET_SIZE, TARGET_SIZE);

      document.getElementById('modeBadge').textContent = 'mode: still-photo';
      return await new Promise(res => canvas.toBlob(b => res(b), 'image/png', 0.92));
    } catch (e) {
      // fall back if still capture fails for any reason
      console.warn('ImageCapture failed, falling back to preview frame:', e);
    }
  }
  // Fallback: capture from the preview video frame (also center-cropped to TARGET_SIZE)
  return await capturePreviewSquareBlob();
}

// Fallback: capture from preview frame (center-crop to square TARGET_SIZE)
function capturePreviewSquareBlob() {
  return new Promise((resolve) => {
    const vw = videoEl.videoWidth, vh = videoEl.videoHeight;
    const side = Math.min(vw, vh);
    const sx = (vw - side) / 2;
    const sy = (vh - side) / 2;

    const canvas = document.getElementById('captureCanvas');
    canvas.width = TARGET_SIZE; canvas.height = TARGET_SIZE;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoEl, sx, sy, side, side, 0, 0, TARGET_SIZE, TARGET_SIZE);

    document.getElementById('modeBadge').textContent = 'mode: preview';
    canvas.toBlob((b) => resolve(b), 'image/png', 0.92);
  });
}

/***** Label selection *****/
function setActiveLabel(label) {
  currentLabel = label;
  document.getElementById('activeLabel').textContent = `選択: ${label}`;
  // highlight
  const map = { Snyders:'btnSnyders', 'Big Lot':'btnBigLot', 'C Press':'btnCPress' };
  for (const [lbl, id] of Object.entries(map)) {
    const b = document.getElementById(id);
    if (lbl === label) b.classList.add('selected'); else b.classList.remove('selected');
  }
  // Sub options
  const subRow = document.getElementById('snydersSubRow');
  if (label === 'Snyders') {
    subRow.style.display = '';
  } else {
    subRow.style.display = 'none';
    currentSub = null;
    document.getElementById('activeSub').textContent = 'サブ: なし';
    // clear small button highlights
    ['btnC','btnD','btnE'].forEach(id => document.getElementById(id).classList.remove('selected'));
  }
}
function setActiveSub(sub) {
  currentSub = sub; // 'C' | 'D' | 'E'
  document.getElementById('activeSub').textContent = `サブ: ${sub}`;
  const ids = { btnC:'C', btnD:'D', btnE:'E' };
  Object.entries(ids).forEach(([id,val])=>{
    const el = document.getElementById(id);
    if (val === sub) el.classList.add('selected'); else el.classList.remove('selected');
  });
}

/***** Single-shot save *****/
async function saveOneShot() {
  const statusEl = document.getElementById('saveStatus');
  statusEl.textContent = '';

  if (!videoEl) { statusEl.textContent = 'カメラが未起動です。'; return; }
  if (!currentLabel) { statusEl.textContent = 'ラベルを選択してください。'; return; }
  if (currentLabel === 'Snyders' && !currentSub) {
    statusEl.textContent = 'Snyders のサブ（C/D/E）を選択してください。';
    return;
  }

  // prefer still-photo; fallback to preview frame
  const blob = await capturePhotoSquareBlob();

  const ts   = yyyymmdd_HHMMSS();
  let folderParts = [currentLabel];
  if (currentLabel === 'Snyders' && currentSub) folderParts.push(currentSub);

  const filename = `${ts}_${currentLabel}${currentSub ? '_' + currentSub : ''}_${TARGET_SIZE}sq.png`;

  try {
    if (baseDirHandle) {
      // Create nested directories
      let dir = baseDirHandle;
      for (const part of folderParts) dir = await ensureSubdir(dir, part);
      await writeBlobTo(dir, filename, blob);
      statusEl.textContent = `保存しました: ${folderParts.join('/')}/${filename}`;
    } else {
      // Fallback: encode path in filename
      downloadFallback(`${folderParts.join('_')}_${filename}`, blob);
      statusEl.textContent = `ダウンロードしました: ${folderParts.join('/')}/${filename}`;
    }

    // Update counter (first shot becomes 1)
    shotCounter += 1;
    document.getElementById('shotCount').textContent = String(shotCounter);

  } catch (e) {
    statusEl.textContent = `保存エラー: ${e.message || e}`;
  }
}

/***** Restart counter *****/
function restartCounter() {
  shotCounter = 0;
  document.getElementById('shotCount').textContent = '0';
  document.getElementById('saveStatus').textContent = 'カウンターをリセットしました。';
}

/***** Hotkeys *****/
function onKey(e) {
  if (e.repeat) return;
  if (e.code === 'Digit1') setActiveLabel('Snyders');
  if (e.code === 'Digit2') setActiveLabel('Big Lot');
  if (e.code === 'Digit3') setActiveLabel('C Press');
  if (e.key.toLowerCase() === 'c' && currentLabel === 'Snyders') setActiveSub('C');
  if (e.key.toLowerCase() === 'd' && currentLabel === 'Snyders') setActiveSub('D');
  if (e.key.toLowerCase() === 'e' && currentLabel === 'Snyders') setActiveSub('E');
  if (e.code === 'Space')  { e.preventDefault(); saveOneShot(); }
}

/***** Wire up *****/
window.addEventListener('DOMContentLoaded', async () => {
  // Camera auto-start
  try { await setupCamera(); } catch (e) {
    document.getElementById('err').textContent = 'カメラ起動エラー: ' + (e?.message || e);
  }

  // Buttons
  document.getElementById('chooseFolderBtn').addEventListener('click', chooseBaseFolder);
  document.getElementById('captureBtn').addEventListener('click', saveOneShot);
  document.getElementById('restartBtn').addEventListener('click', restartCounter);

  // Label selection
  document.getElementById('btnSnyders').addEventListener('click', () => setActiveLabel('Snyders'));
  document.getElementById('btnBigLot').addEventListener('click',  () => setActiveLabel('Big Lot'));
  document.getElementById('btnCPress').addEventListener('click',  () => setActiveLabel('C Press'));

  // Sub selection (only visible when Snyders is selected)
  document.getElementById('btnC').addEventListener('click', () => setActiveSub('C'));
  document.getElementById('btnD').addEventListener('click', () => setActiveSub('D'));
  document.getElementById('btnE').addEventListener('click', () => setActiveSub('E'));

  // Hotkeys
  window.addEventListener('keydown', onKey);
});
