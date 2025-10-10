<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Dataset Collector</title>
  <style>
    *{box-sizing:border-box}
    body{display:flex;flex-direction:column;align-items:center;gap:12px;margin:0;padding:16px;font-family:Arial,sans-serif;background:#f5f5f5;color:#111}
    h1{margin:8px 0 0;font-size:1.6em}

    .video-wrap{position:relative;width:90vw;height:90vw;max-width:400px;max-height:400px}
    video{
      position:absolute; inset:0; width:100%; height:100%;
      border:2px solid #444; border-radius:10px; object-fit:cover; background:#111;
    }

    .panel{width:90vw;max-width:480px;background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:12px}
    .muted{color:#6b7280;font-size:12px;margin-top:6px}

    .rows{display:flex;flex-direction:column;gap:10px;margin-top:8px}
    .row{display:flex;gap:8px;flex-wrap:wrap}

    /* Buttons */
    button{appearance:none;border:none;cursor:pointer;padding:10px 14px;border-radius:10px;
           font-size:14px;line-height:1;background:#fff;border:1px solid #e5e7eb;color:#111}
    .icon{width:56px;height:44px;font-size:22px;padding:0}

    /* Label buttons */
    .label-btn{min-width:96px}
    .selected{background:#111827;color:#fff;border-color:#111827}

    /* Info badges */
    .badge{display:inline-block;padding:4px 8px;border-radius:8px;background:#f3f4f6;font-size:12px}
    .badge-strong{background:#ecfeff;border:1px solid #bae6fd}

    #captureCanvas{display:none}
  </style>
</head>
<body>
  <h1>Dataset Collector</h1>

  <div class="video-wrap">
    <video id="webcam" autoplay playsinline muted></video>
  </div>

  <div class="panel">
    <!-- Row 1: 保存ファイル -->
    <div class="row">
      <button id="chooseFolderBtn">保存ファイル</button>
      <span id="folderChosen" class="badge">未選択</span>
      <span id="burstBadge" class="badge badge-strong">Burst: <span id="burstCount">0</span></span>
    </div>

    <!-- Row 2: ▶️ and 📸 (emoji only) -->
    <div class="row">
      <button id="startBtn"   class="icon" title="開始">▶️</button>
      <button id="captureBtn" class="icon" title="キャプチャ（バースト）">📸</button>
      <span class="muted">（Space で📸 / 1=Snyders, 2=Big Lot, 3=C Press）</span>
    </div>

    <!-- Row 3: Label selection (sticky until changed) -->
    <div class="row">
      <button id="btnSnyders" class="label-btn">Snyders</button>
      <button id="btnBigLot"  class="label-btn">Big Lot</button>
      <button id="btnCPress"  class="label-btn">C Press</button>
      <span id="activeLabel" class="badge">未選択</span>
    </div>

    <div id="status" class="muted"></div>
    <div id="err" class="muted"></div>
    <div id="saveStatus" class="muted"></div>
  </div>

  <canvas id="captureCanvas"></canvas>
  <script src="script.js" defer></script>
</body>
</html>
