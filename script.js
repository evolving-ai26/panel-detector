// Panel Detector front end
// Sends stress/strain/yield_strength to the Flask backend (app.py) at /predict
// and shows back whichever status the trained model returns.

const API_URL = 'http://localhost:5000/predict';

const form = document.getElementById('panel-form');
const submitBtn = document.getElementById('submit-btn');
const btnLabel = submitBtn.querySelector('.btn-label');
const btnSpinner = submitBtn.querySelector('.btn-spinner');

const resultCard = document.getElementById('result-card');
const resultIcon = document.getElementById('result-icon');
const resultTitle = document.getElementById('result-title');
const resultSubtitle = document.getElementById('result-subtitle');
const resultDetails = document.getElementById('result-details');

const historyCard = document.getElementById('history-card');
const historyList = document.getElementById('history-list');
const clearHistoryBtn = document.getElementById('clear-history');

const HISTORY_KEY = 'panelDetectorHistory';

function getField(id){
  return document.getElementById(id);
}

function setError(id, message){
  const input = getField(id);
  const err = document.getElementById('err-' + id.split('_')[0]);
  if (message){
    input.classList.add('invalid');
    if (err) err.textContent = message;
  } else {
    input.classList.remove('invalid');
    if (err) err.textContent = '';
  }
}

function validate(values){
  let valid = true;

  if (isNaN(values.stress)){
    setError('stress', 'Enter a valid number');
    valid = false;
  } else setError('stress', '');

  if (isNaN(values.strain)){
    setError('strain', 'Enter a valid number');
    valid = false;
  } else setError('strain', '');

  if (isNaN(values.yield_strength)){
    setError('yield_strength', 'Enter a valid number');
    valid = false;
  } else setError('yield_strength', '');

  return valid;
}

// Sends the panel's measurements to the Flask backend and returns its verdict.
async function evaluatePanel({ stress, strain, yield_strength }){
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ stress, strain, yield_strength })
  });

  if (!response.ok){
    throw new Error('Server error: ' + response.status);
  }

  const data = await response.json();
  return { status: data.status };
}

function renderResult({ stress, strain, yield_strength, status }){
  resultCard.hidden = false;
  resultCard.classList.remove('pass', 'broken');

  const isPass = status === 'Pass';
  resultCard.classList.add(isPass ? 'pass' : 'broken');
  resultIcon.textContent = isPass ? '✓' : '✕';
  resultTitle.textContent = isPass ? 'Panel: Pass' : 'Panel: Broken';
  resultSubtitle.textContent = isPass
    ? 'This panel meets structural standards.'
    : 'Possible defect detected — halt panel for inspection.';

  resultDetails.innerHTML = `
    <dt>Stress</dt><dd>${stress} MPa</dd>
    <dt>Strain</dt><dd>${strain} mm/mm</dd>
    <dt>Yield Strength</dt><dd>${yield_strength} MPa</dd>
  `;

  resultCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function loadHistory(){
  try{
    return JSON.parse(localStorage.getItem(HISTORY_KEY)) || [];
  } catch {
    return [];
  }
}

function saveHistory(list){
  localStorage.setItem(HISTORY_KEY, JSON.stringify(list));
}

function renderHistory(){
  const items = loadHistory();
  if (items.length === 0){
    historyCard.hidden = true;
    return;
  }
  historyCard.hidden = false;
  historyList.innerHTML = items.map(item => `
    <li>
      <span class="h-values">S:${item.stress} · ε:${item.strain} · Y:${item.yield_strength}</span>
      <span class="h-tag ${item.status === 'Pass' ? 'pass' : 'broken'}">${item.status}</span>
    </li>
  `).join('');
}

function addToHistory(entry){
  const items = loadHistory();
  items.unshift(entry);
  saveHistory(items.slice(0, 8));
  renderHistory();
}

clearHistoryBtn.addEventListener('click', () => {
  saveHistory([]);
  renderHistory();
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const values = {
    stress: parseFloat(getField('stress').value),
    strain: parseFloat(getField('strain').value),
    yield_strength: parseFloat(getField('yield_strength').value),
  };

  if (!validate(values)) return;

  submitBtn.disabled = true;
  btnLabel.textContent = 'Analyzing...';
  btnSpinner.hidden = false;

  try {
    const { status } = await evaluatePanel(values);
    renderResult({ ...values, status });
    addToHistory({ ...values, status });
  } catch (err) {
    alert('Could not reach the backend. Is app.py running?\n' + err.message);
  } finally {
    submitBtn.disabled = false;
    btnLabel.textContent = 'Run Diagnostic';
    btnSpinner.hidden = true;
  }
});

renderHistory();
