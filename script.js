// AI Car Panel Inspector — frontend
// Sends stress/strain/yield_strength to the Flask backend (app.py) at /predict.
// The uploaded image is kept client-side for preview/reporting only — there is
// no trained image model yet, so no visual defect detection is claimed here.

const API_URL = 'https://3-85-93-223.nip.io/predict';
const IMAGE_API_URL = 'https://3-85-93-223.nip.io/predict_image';
const HISTORY_KEY = 'panelDetectorHistory';

// ---------- View navigation ----------
const views = document.querySelectorAll('.view');
const navLinks = document.querySelectorAll('.nav-link');

function showView(name){
  views.forEach(v => v.classList.toggle('active', v.id === 'view-' + name));
  navLinks.forEach(n => n.classList.toggle('active', n.dataset.view === name));
  window.scrollTo({ top: 0 });
}

navLinks.forEach(btn => {
  btn.addEventListener('click', () => {
    showView(btn.dataset.view);
    if (btn.dataset.view === 'home') renderRecent();
    if (btn.dataset.view === 'reports') renderReports();
    if (btn.dataset.view === 'settings') document.getElementById('settings-api-url').textContent = API_URL;
  });
});

document.querySelectorAll('[data-goto]').forEach(btn => {
  btn.addEventListener('click', () => showView(btn.dataset.goto));
});

// ---------- Mode tabs (Data vs Image) ----------
document.querySelectorAll('.mode-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.mode-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.mode-panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    document.querySelector(`[data-mode-panel="${tab.dataset.mode}"]`).classList.add('active');
  });
});

// ---------- History (localStorage) ----------
function loadHistory(){
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; }
  catch { return []; }
}
function saveHistory(list){ localStorage.setItem(HISTORY_KEY, JSON.stringify(list)); }

function addToHistory(entry){
  const items = loadHistory();
  items.unshift(entry);
  saveHistory(items.slice(0, 50));
}

function formatRow(item){
  return `<tr>
    <td>${item.id}</td>
    <td>${item.date}</td>
    <td>${item.status}</td>
    <td><span class="dot ${item.status === 'Pass' ? 'pass' : 'broken'}"></span>${item.status === 'Pass' ? 'Pass' : 'Broken'}</td>
  </tr>`;
}

function renderRecent(){
  const items = loadHistory().slice(0, 5);
  const tbody = document.querySelector('#recent-table tbody');
  const empty = document.getElementById('recent-empty');
  tbody.innerHTML = items.map(formatRow).join('');
  empty.hidden = items.length > 0;
}

function renderReports(){
  const items = loadHistory();
  const tbody = document.querySelector('#reports-table tbody');
  const empty = document.getElementById('reports-empty');
  tbody.innerHTML = items.map(formatRow).join('');
  empty.hidden = items.length > 0;
}

// ---------- Image upload (New Inspection) ----------
const imageInput = document.getElementById('image-input');
const dropzone = document.getElementById('image-dropzone');
const imagePreview = document.getElementById('image-preview');
const imagePreviewPlaceholder = document.querySelector('#image-preview-box .preview-placeholder');
const imageClearBtn = document.getElementById('image-clear');

let currentImageDataUrl = null;
let currentImageFile = null;
const imageSubmitBtn = document.getElementById('image-submit-btn');

function setImage(file){
  if (!file) return;
  currentImageFile = file;
  const reader = new FileReader();
  reader.onload = () => {
    currentImageDataUrl = reader.result;
    imagePreview.src = currentImageDataUrl;
    imagePreview.hidden = false;
    imagePreviewPlaceholder.hidden = true;
    imageClearBtn.hidden = false;
    imageSubmitBtn.disabled = false;
  };
  reader.readAsDataURL(file);
}

imageInput.addEventListener('change', () => setImage(imageInput.files[0]));

dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('dragover'); });
dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
dropzone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropzone.classList.remove('dragover');
  const file = e.dataTransfer.files[0];
  if (file) setImage(file);
});

imageClearBtn.addEventListener('click', (e) => {
  e.preventDefault();
  currentImageDataUrl = null;
  currentImageFile = null;
  imageInput.value = '';
  imagePreview.hidden = true;
  imagePreviewPlaceholder.hidden = false;
  imageClearBtn.hidden = true;
  imageSubmitBtn.disabled = true;
});

// ---------- Validation ----------
function setError(fieldId, message){
  const input = document.getElementById(fieldId);
  const err = document.getElementById('err-' + fieldId.split('_')[0]);
  input.classList.toggle('invalid', !!message);
  if (err) err.textContent = message || '';
}

function validate(values){
  let valid = true;
  ['stress', 'strain', 'yield_strength'].forEach(key => {
    if (isNaN(values[key])){
      setError(key, 'Enter a valid number');
      valid = false;
    } else {
      setError(key, '');
    }
  });
  return valid;
}

// ---------- Prediction call ----------
async function evaluatePanel({ stress, strain, yield_strength }){
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ stress, strain, yield_strength })
  });
  if (!response.ok) throw new Error('Server error: ' + response.status);
  return response.json(); // { status, physics_check }
}

async function evaluateImage(file){
  const formData = new FormData();
  formData.append('image', file);

  const response = await fetch(IMAGE_API_URL, { method: 'POST', body: formData });
  if (!response.ok) throw new Error('Server error: ' + response.status);
  return response.json(); // { status, confidence }
}

// ---------- Processing animation ----------
function runProcessingAnimation(){
  return new Promise((resolve) => {
    const steps = document.querySelectorAll('#steps-list .step');
    const fill = document.getElementById('progress-fill');
    steps.forEach(s => { s.classList.remove('done', 'active'); s.querySelector('.step-status').textContent = 'Pending'; });
    fill.style.width = '0%';

    let i = 0;
    function next(){
      if (i > 0){
        steps[i - 1].classList.remove('active');
        steps[i - 1].classList.add('done');
        steps[i - 1].querySelector('.step-status').textContent = 'Completed';
      }
      if (i < steps.length){
        steps[i].classList.add('active');
        steps[i].querySelector('.step-status').textContent = 'In Progress';
        fill.style.width = `${((i + 1) / steps.length) * 100}%`;
        i++;
        setTimeout(next, 550);
      } else {
        resolve();
      }
    }
    next();
  });
}

// ---------- Last result state (feeds Results / Detailed / Report views) ----------
let lastResult = null;

function renderResultsView(){
  const r = lastResult;
  if (!r) return;

  const badge = document.getElementById('result-badge');
  const isPass = r.status === 'Pass';

  badge.textContent = isPass ? '✓ PASS' : '⚠ DEFECT DETECTED';
  badge.className = 'result-badge ' + (isPass ? 'pass' : 'broken');
  document.getElementById('result-confidence').textContent = r.method === 'image'
    ? `Image model confidence: ${r.confidence}%`
    : `Physics check: ${r.physics_check}`;

  document.getElementById('stat-row').innerHTML = r.method === 'image'
    ? `<div class="stat"><small>Panel ID</small><strong>${r.panelId || '—'}</strong></div>
       <div class="stat"><small>Method</small><strong>Image (CNN)</strong></div>
       <div class="stat"><small>Confidence</small><strong>${r.confidence}%</strong></div>`
    : `<div class="stat"><small>Panel ID</small><strong>${r.panelId || '—'}</strong></div>
       <div class="stat"><small>Stress</small><strong>${r.stress} MPa</strong></div>
       <div class="stat"><small>Strain</small><strong>${r.strain} mm/mm</strong></div>
       <div class="stat"><small>Yield Strength</small><strong>${r.yield_strength} MPa</strong></div>`;

  const imgCard = document.getElementById('image-result-card');
  const imgEl = document.getElementById('result-image');
  if (r.image){
    imgCard.hidden = false;
    imgEl.src = r.image;
  } else {
    imgCard.hidden = true;
  }

  document.getElementById('meta-date').textContent = r.date;
}

function renderDetailedView(){
  const r = lastResult;
  if (!r) return;

  const detailedImg = document.getElementById('detailed-image');
  if (r.image){
    detailedImg.hidden = false;
    detailedImg.src = r.image;
  } else {
    detailedImg.hidden = true;
  }

  const isPass = r.status === 'Pass';
  const graphTab = document.getElementById('bars');

  if (r.method === 'image'){
    graphTab.innerHTML = `<p class="note">No stress/strain data was provided for this inspection — it was analyzed from the uploaded image only (confidence: ${r.confidence}%).</p>`;
    document.getElementById('explain-text').textContent = isPass
      ? `No damage was detected by the YOLOv8 model. Note: this model currently misses a majority of real damage cases (low recall) — a Pass result does not strongly guarantee the panel is undamaged.`
      : `The YOLOv8 model detected damage with ${r.confidence}% confidence. This is a real model trained on real car damage photos, not a synthetic placeholder.`;
    return;
  }

  const maxVal = Math.max(r.stress, r.yield_strength, 1);
  graphTab.innerHTML = `
    <div class="bar-row">
      <div class="bar-label"><span>Stress</span><span>${r.stress} MPa</span></div>
      <div class="bar-track"><div class="bar-fill" style="width:${(r.stress / maxVal) * 100}%"></div></div>
    </div>
    <div class="bar-row">
      <div class="bar-label"><span>Yield Strength</span><span>${r.yield_strength} MPa</span></div>
      <div class="bar-track"><div class="bar-fill" style="width:${(r.yield_strength / maxVal) * 100}%; background:#34d399"></div></div>
    </div>
    <div class="bar-row">
      <div class="bar-label"><span>Strain</span><span>${r.strain} mm/mm</span></div>
      <div class="bar-track"><div class="bar-fill" style="width:${Math.min(r.strain * 100, 100)}%; background:#fbbf24"></div></div>
    </div>
  `;

  document.getElementById('explain-text').textContent = isPass
    ? `The model classified this panel as Pass based on the stress (${r.stress} MPa), strain (${r.strain}) and yield strength (${r.yield_strength} MPa) provided. The physics check (stress < yield strength) also returned "${r.physics_check}".`
    : `The model classified this panel as Broken. Its stress (${r.stress} MPa) and strain (${r.strain}) relative to the yield strength (${r.yield_strength} MPa) match patterns associated with structural failure in training data. The physics check returned "${r.physics_check}". Recommend manual inspection before use.`;
}

function renderReportView(){
  const r = lastResult;
  if (!r) return;

  const rows = r.method === 'image'
    ? `<dt>Panel / Vehicle ID</dt><dd>${r.panelId || '—'}</dd>
       <dt>Inspection Date</dt><dd>${r.date}</dd>
       <dt>Method</dt><dd>Image (CNN)</dd>
       <dt>Result</dt><dd>${r.status}</dd>
       <dt>Confidence</dt><dd>${r.confidence}%</dd>`
    : `<dt>Panel / Vehicle ID</dt><dd>${r.panelId || '—'}</dd>
       <dt>Inspection Date</dt><dd>${r.date}</dd>
       <dt>Method</dt><dd>Data (RandomForest)</dd>
       <dt>Result</dt><dd>${r.status}</dd>
       <dt>Physics Check</dt><dd>${r.physics_check}</dd>
       <dt>Stress</dt><dd>${r.stress} MPa</dd>
       <dt>Strain</dt><dd>${r.strain} mm/mm</dd>
       <dt>Yield Strength</dt><dd>${r.yield_strength} MPa</dd>`;

  document.getElementById('report-details').innerHTML = rows;
}

// ---------- Data form submit (numeric measurements -> RandomForest) ----------
const dataForm = document.getElementById('data-form');

dataForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const values = {
    stress: parseFloat(document.getElementById('stress').value),
    strain: parseFloat(document.getElementById('strain').value),
    yield_strength: parseFloat(document.getElementById('yield_strength').value),
  };

  if (!validate(values)) return;

  showView('processing');
  await runProcessingAnimation();

  try {
    const data = await evaluatePanel(values);

    lastResult = {
      id: 'CP-' + String(loadHistory().length + 1).padStart(3, '0'),
      panelId: document.getElementById('panel-id').value.trim(),
      date: new Date().toLocaleString(),
      method: 'data',
      status: data.status,
      physics_check: data.physics_check,
      image: null,
      ...values
    };

    addToHistory(lastResult);
    renderResultsView();
    renderDetailedView();
    renderReportView();
    showView('results');
  } catch (err) {
    alert('Could not reach the backend. Is the server running?\n' + err.message);
    showView('new-inspection');
  }
});

// ---------- Image form submit (uploaded photo -> CNN) ----------
const imageForm = document.getElementById('image-form');

imageForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  if (!currentImageFile){
    alert('Please choose an image first.');
    return;
  }

  showView('processing');
  await runProcessingAnimation();

  try {
    const data = await evaluateImage(currentImageFile);

    lastResult = {
      id: 'CP-' + String(loadHistory().length + 1).padStart(3, '0'),
      panelId: document.getElementById('panel-id-image').value.trim(),
      date: new Date().toLocaleString(),
      method: 'image',
      status: data.status,
      confidence: data.confidence,
      image: currentImageDataUrl,
    };

    addToHistory(lastResult);
    renderResultsView();
    renderDetailedView();
    renderReportView();
    showView('results');
  } catch (err) {
    alert('Could not reach the backend. Is the server running?\n' + err.message);
    showView('new-inspection');
  }
});

// ---------- Tabs (Detailed Analysis) ----------
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(btn.dataset.tab).classList.add('active');
  });
});

// ---------- Print / PDF ----------
document.getElementById('btn-print').addEventListener('click', () => window.print());

// ---------- Settings ----------
document.getElementById('btn-clear-all').addEventListener('click', () => {
  if (confirm('Clear all inspection history stored in this browser?')){
    saveHistory([]);
    renderRecent();
    renderReports();
  }
});

// ---------- Init ----------
renderRecent();
