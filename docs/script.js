/***** Config *****/
const TARGET_SIZE = 1024;           // export size (square). 224 for ML, 512/1024 for quality.
const HOLD_STILL_MS = 220;          // tiny delay before capture to let AF/AE settle

const PREVIEW_CONSTRAINTS = {
  video: {
    facingMode: { ideal: 'environment' },
    width:  { ideal: 1920 },
    height: { ideal: 1080 },
    frameRate: { ideal: 30, max: 30 },
  },
  audio: false
};

const LABELS = ['Snyders', 'Big Lot', 'C Press'];
const SNYDERS_SUBS = ['A', 'C', 'D', 'G', 'SUS3', 'SUS6', '他'];

/***** State *****/
let videoEl = null;
let baseDirHandle = null;
let currentLabel = null;
let currentSub   = null;
let shotCounter  = 0;

/***** Camera *****/
async function setupCamera() {
  const el = document.getElementById('webcam');
  const stream = await navigator.mediaDevices.getUserMedia(PREVIEW_CONSTRAINTS);
  el.srcObject = stream;
  await new Promise(res => el.onloadedmetadata = () => res());
  await el.play();
  videoEl = el;

  // Try to improve focus/exposure continuity if supported
  try {
    const track = stream.getVideoTracks()[0];
    await track.applyConstraints({
      advanced: [
        { focusMode: 'continuous' },
        { exposureMode: 'continuous' },
        { whiteBalanceMode: 'continuous' }
      ]
    });
  } catch (_) { /* some devices/browsers don't support these */ }

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
  return parent.getDirectoryHandle(name, { create: true });
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

/***** High-quality square capture *****/
// Draw helper with high-quality resampling
function drawSquareHighQuality(ctx, source, sx, sy, sSize, dstSize) {
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, sx, sy, sSize, sSize, 0, 0, dstSize, dstSize);
}

// Preferred: true still-photo (sharpest). Fallback to grabFrame(), then video.
async function captureSquareBlobHQ() {
  // 1) short settle delay so AF/AE can lock
  if (HOLD_STILL_MS > 0) await new Promise(r => setTimeout(r, HOLD_STILL_MS));

  const track = videoEl?.srcObject?.getVideoTracks?.()[0];
  const canvas = document.getElementById('captureCanvas');
  canvas.width = TARGET_SIZE; canvas.height = TARGET_SIZE;
  const ctx = canvas.getContext('2d');

  // Try still-photo
  if (track && 'ImageCapture' in window) {
    try {
      const ic = new ImageCapture(track);
      const photoBlob = await ic.takePhoto();                           // full-res still
      const bitmap = await createImageBitmap(photoBlob);
      const w = bitmap.width, h = bitmap.height;
      const side = Math.min(w, h);
      const sx = (w - side) / 2;
      const sy = (h - side) / 2;
      document.getElementById('modeBadge').textContent = 'mode: still-photo';
      drawSquareHighQuality(ctx, bitmap, sx, sy, side, TARGET_SIZE);
      return await new Promise(res => canvas.toBlob(b => res(b), 'image/png', 0.92));
    } catch (e) {
      console.warn('takePhoto failed, trying grabFrame:', e);
      // Try grabFrame next
      try {
        const ic2 = new ImageCapture(track);
        const frameBitmap = await ic2.grabFrame();                      // high-res video frame
        const w = frameBitmap.width, h = frameBitmap.height;
        const side = Math.min(w, h);
        const sx = (w - side) / 2;
        const sy = (h - side) / 2;
        document.getElementById('modeBadge').textContent = 'mode: grabFrame';
        drawSquareHighQuality(ctx, frameBitmap, sx, sy, side, TARGET_SIZE);
        return await new Promise(res => canvas.toBlob(b => res(b), 'image/png', 0.92));
      } catch (e2) {
        console.warn('grabFrame failed, falling back to <video> frame:', e2);
      }
    }
  }

  // Final fallback: draw from <video> element
  const vw = videoEl.videoWidth, vh = videoEl.videoHeight;
  const side = Math.min(vw, vh);
  const sx = (vw - side) / 2;
  const sy = (vh - side) / 2;
  document.getElementById('modeBadge').textContent = 'mode: preview';
  drawSquareHighQuality(ctx, videoEl, sx, sy, side, TARGET_SIZE);
  return await new Promise(res => canvas.toBlob(b => res(b), 'image/png', 0.92));
}

/***** Label selection *****/
function setActiveLabel(label) {
  currentLabel = label;
  document.getElementById('activeLabel').textContent = `選択: ${label}`;
  const map = { Snyders:'btnSnyders', 'Big Lot':'btnBigLot', 'C Press':'btnCPress' };
  for (const [lbl, id] of Object.entries(map)) {
    const b = document.getElementById(id);
    if (b) {
      if (lbl === label) b.classList.add('selected'); else b.classList.remove('selected');
    }
  }
  const subRow = document.getElementById('snydersSubRow');
  if (label === 'Snyders') {
    subRow.style.display = '';
  } else {
    subRow.style.display = 'none';
    currentSub = null;
    document.getElementById('activeSub').textContent = 'サブ: なし';
    ['btnA','btnC','btnD','btnG','btnSUS3','btnSUS6','btnOther'].forEach(id => {
      const el = document.getElementById(id);
      el && el.classList.remove('selected');
    });
  }
}
function setActiveSub(sub) {
  currentSub = sub;
  document.getElementById('activeSub').textContent = `サブ: ${sub}`;
  const ids = {
    btnA:'A', btnC:'C', btnD:'D', btnG:'G',
    btnSUS3:'SUS3', btnSUS6:'SUS6', btnOther:'他'
  };
  Object.entries(ids).forEach(([id,val])=>{
    const el = document.getElementById(id);
    if (!el) return;
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
    statusEl.textContent = 'Snyders のサブ（A/C/D/G/SUS3/SUS6/他）を選択してください。';
    return;
  }

  const blob = await captureSquareBlobHQ();

  const ts   = yyyymmdd_HHMMSS();
  let folderParts = [currentLabel];
  if (currentLabel === 'Snyders' && currentSub) folderParts.push(currentSub);
  const filename = `${ts}_${currentLabel}${currentSub ? '_' + currentSub : ''}_${TARGET_SIZE}sq.png`;

  try {
    if (baseDirHandle) {
      let dir = baseDirHandle;
      for (const part of folderParts) dir = await ensureSubdir(dir, part);
      await writeBlobTo(dir, filename, blob);
      statusEl.textContent = `保存しました: ${folderParts.join('/')}/${filename}`;
    } else {
      downloadFallback(`${folderParts.join('_')}_${filename}`, blob);
      statusEl.textContent = `ダウンロードしました: ${folderParts.join('/')}/${filename}`;
    }
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

  // Sub hotkeys (Snyders): letters only for the alphabetic subs
  if (currentLabel === 'Snyders') {
    const k = e.key.toLowerCase();
    if (k === 'a') setActiveSub('A');
    if (k === 'c') setActiveSub('C');
    if (k === 'd') setActiveSub('D');
    if (k === 'g') setActiveSub('G');
    // (No hotkeys for SUS3/SUS6/他 to avoid confusion—use the buttons)
  }

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

  // Snyders sub
  document.getElementById('btnA').addEventListener('click',     () => setActiveSub('A'));
  document.getElementById('btnC').addEventListener('click',     () => setActiveSub('C'));
  document.getElementById('btnD').addEventListener('click',     () => setActiveSub('D'));
  document.getElementById('btnG').addEventListener('click',     () => setActiveSub('G'));
  document.getElementById('btnSUS3').addEventListener('click',  () => setActiveSub('SUS3'));
  document.getElementById('btnSUS6').addEventListener('click',  () => setActiveSub('SUS6'));
  document.getElementById('btnOther').addEventListener('click', () => setActiveSub('他'));

  // Hotkeys
  window.addEventListener('keydown', onKey);
});
