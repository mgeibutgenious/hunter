/***** Config *****/
const LABELS = ['Snyders', 'Big Lot', 'C Press'];
const SNYDERS_SUBS = ['C','D','E']; // appears only when Snyders is active

/***** State *****/
let videoEl = null;
let baseDirHandle = null;
let currentLabel = null;   // 'Snyders' | 'Big Lot' | 'C Press'
let currentSub   = null;   // 'C' | 'D' | 'E' | null  (only used for Snyders)
let shotCounter  = 0;      // UI counter (1,2,3,...)

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

function captureFrameToBlob() {
  return new Promise((resolve) => {
    const canvas = document.getElementById('captureCanvas');
    const vw = videoEl.videoWidth;
    const vh = videoEl.videoHeight;

    // Find the square region (center crop)
    const side = Math.min(vw, vh);
    const sx = (vw - side) / 2;
    const sy = (vh - side) / 2;

    canvas.width = side;
    canvas.height = side;

    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoEl, sx, sy, side, side, 0, 0, side, side);

    canvas.toBlob((b) => resolve(b), 'image/png', 0.92);
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
  const a = document.createElement('a'); a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
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
  }
}

function setActiveSub(sub) {
  currentSub = sub; // 'C' | 'D' | 'E'
  document.getElementById('activeSub').textContent = `サブ: ${sub}`;
  // small buttons highlight
  const ids = ['btnC','btnD','btnE'];
  const val = { btnC:'C', btnD:'D', btnE:'E' };
  ids.forEach(id=>{
    const el = document.getElementById(id);
    if (val[id] === sub) el.classList.add('selected'); else el.classList.remove('selected');
  });
}

/***** Single-shot save *****/
async function saveOneShot() {
  const statusEl = document.getElementById('saveStatus');
  statusEl.textContent = '';

  if (!videoEl) {
    statusEl.textContent = 'カメラが未起動です。';
    return;
  }
  if (!currentLabel) {
    statusEl.textContent = 'ラベルを選択してください。';
    return;
  }
  if (currentLabel === 'Snyders' && !currentSub) {
    statusEl.textContent = 'Snyders のサブ（C/D/E）を選択してください。';
    return;
  }

  const blob = await captureFrameToBlob();
  const ts   = yyyymmdd_HHMMSS();

  // Folder path + filename
  let folderParts = [currentLabel];
  if (currentLabel === 'Snyders' && currentSub) folderParts.push(currentSub);

  const filename = `${ts}_${currentLabel}${currentSub ? '_' + currentSub : ''}.png`;

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
  if (e.code === 'Space') { e.preventDefault(); saveOneShot(); }
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

