// ── FIREBASE CONFIG ──
const firebaseConfig = {
  apiKey: "AIzaSyAD6OhXJvjuBPmCJuaDhrMoRC8C4LgwBZI",
  authDomain: "the-daily-gut.firebaseapp.com",
  projectId: "the-daily-gut",
  storageBucket: "the-daily-gut.firebasestorage.app",
  messagingSenderId: "1001795175756",
  appId: "1:1001795175756:web:97e673b9b2a85f30163be9"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// ── APP STATE ──
let currentProfile = null;
let profiles = [];
let entries = [];
let currentSpreadIndex = 0;
let spreads = [];
let selectedColour = "#8a6e52";
let trackCycle = false;

// ── INIT ──
window.addEventListener('DOMContentLoaded', () => {
  buildToast();
  loadProfiles();
});

// ── TOAST ──
function buildToast() {
  const t = document.createElement('div');
  t.className = 'toast';
  t.id = 'toast';
  document.body.appendChild(t);
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}

// ── PROFILES ──
async function loadProfiles() {
  try {
    const snap = await db.collection('profiles').get();
    profiles = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (profiles.length === 0) await seedDefaultProfile();
    else renderProfiles();
  } catch (e) {
    console.error('Error loading profiles:', e);
    renderProfiles();
  }
}

async function seedDefaultProfile() {
  const defaultProfile = { name: 'Micole', colour: '#8a6e52', trackCycle: true, createdAt: new Date().toISOString() };
  try {
    const ref = await db.collection('profiles').add(defaultProfile);
    profiles = [{ id: ref.id, ...defaultProfile }];
    renderProfiles();
  } catch (e) { console.error('Error seeding profile:', e); }
}

function renderProfiles() {
  const grid = document.getElementById('profileGrid');
  grid.innerHTML = '';
  profiles.forEach(p => {
    const card = document.createElement('div');
    card.className = 'profile-card';
    card.onclick = () => selectProfile(p);
    card.innerHTML = `
      <div class="profile-avatar" style="background:${p.colour}">${p.name.charAt(0).toUpperCase()}</div>
      <span class="profile-name">${p.name}</span>
    `;
    grid.appendChild(card);
  });
}

function selectProfile(profile) {
  currentProfile = profile;
  document.getElementById('topBarName').textContent = profile.name;
  document.getElementById('profileScreen').classList.remove('active');
  document.getElementById('profileScreen').classList.add('hidden');
  document.getElementById('appScreen').classList.remove('hidden');
  document.getElementById('appScreen').classList.add('active');
  loadEntries();
}

function goToProfiles() {
  currentProfile = null;
  entries = [];
  currentSpreadIndex = 0;
  document.getElementById('appScreen').classList.remove('active');
  document.getElementById('appScreen').classList.add('hidden');
  document.getElementById('profileScreen').classList.remove('hidden');
  document.getElementById('profileScreen').classList.add('active');
}

// ── ADD PROFILE MODAL ──
function openAddProfile() {
  selectedColour = '#8a6e52';
  trackCycle = false;
  document.getElementById('newProfileName').value = '';
  document.getElementById('cycleYes').classList.remove('active');
  document.getElementById('cycleNo').classList.add('active');
  document.querySelectorAll('.colour-dot').forEach(d => d.classList.remove('active'));
  document.querySelector('.colour-dot').classList.add('active');
  document.getElementById('addProfileModal').classList.remove('hidden');
}

function closeAddProfile() {
  document.getElementById('addProfileModal').classList.add('hidden');
}

function setCycle(val) {
  trackCycle = val;
  document.getElementById('cycleYes').classList.toggle('active', val);
  document.getElementById('cycleNo').classList.toggle('active', !val);
}

function selectColour(el) {
  document.querySelectorAll('.colour-dot').forEach(d => d.classList.remove('active'));
  el.classList.add('active');
  selectedColour = el.dataset.colour;
}

async function saveNewProfile() {
  const name = document.getElementById('newProfileName').value.trim();
  if (!name) { showToast('please enter a name'); return; }
  const profile = { name, colour: selectedColour, trackCycle, createdAt: new Date().toISOString() };
  try {
    const ref = await db.collection('profiles').add(profile);
    profiles.push({ id: ref.id, ...profile });
    renderProfiles();
    closeAddProfile();
    showToast(`welcome, ${name}!`);
  } catch (e) { showToast('something went wrong, try again'); console.error(e); }
}

// ── ENTRIES ──
async function loadEntries() {
  try {
    const snap = await db.collection('profiles').doc(currentProfile.id)
      .collection('entries').orderBy('date', 'desc').get();
    entries = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) { console.error('Error loading entries:', e); entries = []; }
  buildSpreads();
  renderCurrentSpread();
}

function startNewEntry() {
  const today = new Date().toISOString().split('T')[0];
  const exists = entries.find(e => e.date === today);
  if (exists) {
    showToast("today's entry already exists");
    const idx = spreads.findIndex(s => s.type === 'entry' && s.date === today);
    if (idx >= 0) { currentSpreadIndex = idx; renderCurrentSpread(); }
    return;
  }
  entries.unshift({ date: today, isNew: true });
  buildSpreads();
  const idx = spreads.findIndex(s => s.type === 'entry' && s.date === today);
  currentSpreadIndex = idx >= 0 ? idx : 0;
  renderCurrentSpread();
}

// ── SPREAD BUILDER ──
// Each "spread" = one open book (left page + right page)
// Spread types: 'toc' | 'entry' | 'patterns'
function buildSpreads() {
  spreads = [];
  spreads.push({ type: 'toc' });
  entries.forEach(entry => {
    spreads.push({ type: 'entry', date: entry.date, entry });
  });
  spreads.push({ type: 'patterns' });
}

// ── RENDER SPREAD ──
function renderCurrentSpread() {
  const left = document.getElementById('bookLeft');
  const right = document.getElementById('bookRight');
  left.innerHTML = '';
  right.innerHTML = '';

  const spread = spreads[currentSpreadIndex];
  if (!spread) return;

  document.getElementById('prevBtn').disabled = currentSpreadIndex === 0;
  document.getElementById('nextBtn').disabled = currentSpreadIndex === spreads.length - 1;
  renderDots();

  if (spread.type === 'toc') {
    renderTOCLeft(left);
    renderTOCRight(right);
  } else if (spread.type === 'entry') {
    renderMealsLeft(left, spread);
    renderRightPage(right, spread);
  } else if (spread.type === 'patterns') {
    renderPatternsLeft(left);
    renderPatternsRight(right);
  }

  addDecoFlower(right);
}

function renderDots() {
  const dotsEl = document.getElementById('pageDots');
  dotsEl.innerHTML = '';
  const total = Math.min(spreads.length, 11);
  for (let i = 0; i < total; i++) {
    const d = document.createElement('div');
    d.className = 'dot' + (i === Math.min(currentSpreadIndex, total - 1) ? ' active' : '');
    d.onclick = () => { currentSpreadIndex = i; renderCurrentSpread(); };
    dotsEl.appendChild(d);
  }
}

function changePage(dir) {
  currentSpreadIndex = Math.max(0, Math.min(spreads.length - 1, currentSpreadIndex + dir));
  renderCurrentSpread();
}

function addDecoFlower(container) {
  container.insertAdjacentHTML('beforeend', `
    <svg class="deco-flower" width="80" height="80" viewBox="0 0 90 90" fill="none" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="45" cy="18" rx="9" ry="22" fill="#8a6e52" transform="rotate(0 45 45)"/>
      <ellipse cx="45" cy="18" rx="9" ry="22" fill="#8a6e52" transform="rotate(45 45 45)"/>
      <ellipse cx="45" cy="18" rx="9" ry="22" fill="#8a6e52" transform="rotate(90 45 45)"/>
      <ellipse cx="45" cy="18" rx="9" ry="22" fill="#8a6e52" transform="rotate(135 45 45)"/>
      <circle cx="45" cy="45" r="10" fill="#c4a882"/>
    </svg>
  `);
}

// ── PAGE HEADER HELPER ──
function pageHeader(dateStr, pageLabel) {
  const formatted = dateStr
    ? new Date(dateStr + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    : '';
  return `
    <div class="page-header">
      <span class="page-date-label">${formatted}</span>
      <span class="page-num">${pageLabel}</span>
    </div>
  `;
}

// ── TABLE OF CONTENTS ──
function renderTOCLeft(container) {
  container.innerHTML = `
    ${pageHeader('', '—')}
    <p class="page-title">The Daily Gut</p>
    <p class="page-subtitle">a journal for patterns your body is trying to tell you</p>
    <div style="margin-top: 1.5rem;">
      <p style="font-family:'Lato',sans-serif; font-size:12px; font-weight:300; color:#9a8a72; line-height:1.8;">
        every day you log is a data point.<br>
        every data point is a clue.<br>
        this journal finds the pattern.
      </p>
    </div>
  `;
}

function renderTOCRight(container) {
  const completedEntries = entries.filter(e => e.date);
  let items = `<li class="toc-item" onclick="goToPatterns()" style="border-top: 1px dashed #e8dfd0;">
      <span class="toc-entry-date" style="font-style:normal; color:#8a6e52;">✦ patterns</span>
      <span class="toc-entry-arrow">→</span>
    </li>`;
  if (completedEntries.length === 0) {
    items = `<p class="toc-empty">your journal is empty — tap "+ new entry" to write your first page.</p>`;
  } else {
    items = '<ul class="toc-list">';
    completedEntries.forEach(entry => {
      const d = new Date(entry.date + 'T12:00:00');
      const label = d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'long' });
      const mood = entry.mood || '';
      items += `
        <li class="toc-item" onclick="goToEntry('${entry.date}')">
          <span class="toc-entry-date">${label}</span>
          <span>${mood ? '<span class="toc-entry-mood">' + mood + '</span>' : ''} <span class="toc-entry-arrow">→</span></span>
        </li>
      `;
    });
    items += '</ul>';
  items += `
    <li class="toc-item" onclick="goToPatterns()">
      <span class="toc-entry-date" style="font-style:normal;">patterns</span>
      <span class="toc-entry-arrow">→</span>
    </li>
  `;
  }
  container.innerHTML = `
    ${pageHeader('', 'contents')}
    <p class="page-title">Contents</p>
    ${items}
  `;
}

function goToPatterns() {
  const idx = spreads.findIndex(s => s.type === 'patterns');
  if (idx >= 0) { currentSpreadIndex = idx; renderCurrentSpread(); }
}

function goToEntry(date) {
  const idx = spreads.findIndex(s => s.type === 'entry' && s.date === date);
  if (idx >= 0) { currentSpreadIndex = idx; renderCurrentSpread(); }
}

// ── LEFT PAGE: MEALS ──
function renderMealsLeft(container, spread) {
  const d = spread.date;
  const saved = spread.entry || {};

  container.innerHTML = `
    ${pageHeader(d, 'meals')}
    <p class="page-title">Today's Meals</p>
    <p class="page-subtitle">what went in, and when</p>
    ${mealBlock('breakfast', 'Breakfast', saved)}
    ${mealBlock('lunch', 'Lunch', saved)}
    ${mealBlock('dinner', 'Dinner', saved)}
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;margin-top:0.5rem;">
      <div class="field">
        <span class="section-label">snacks</span>
        <input type="text" id="snacks" placeholder="e.g. apple, crackers" value="${saved.snacks || ''}" />
      </div>
      <div class="field">
        <span class="section-label">dessert</span>
        <input type="text" id="dessert" placeholder="e.g. ice cream" value="${saved.dessert || ''}" />
      </div>
    </div>
    <button onclick="clearEntry('${d}')" style="margin-top:1rem;font-family:'Lato',sans-serif;font-size:11px;letter-spacing:0.06em;color:#b8a480;background:transparent;border:1px solid #e0d5c4;border-radius:3px;padding:6px 14px;cursor:pointer;" onmouseover="this.style.color='#c0392b';this.style.borderColor='#c0392b'" onmouseout="this.style.color='#b8a480';this.style.borderColor='#e0d5c4'">clear this entry</button>
  `;
}

function mealBlock(key, label, saved) {
  const skipped = saved[key + 'Skipped'] || false;
  const location = saved[key + 'Location'] || '';
  return `
    <div class="meal-block" id="${key}Block">
      <div class="meal-header">
        <span class="section-label" style="margin-bottom:0">${label}</span>
        <span class="skip-link ${skipped ? 'skipped' : ''}" id="${key}SkipLink" onclick="toggleSkip('${key}')">${skipped ? 'skipped ✓' : 'skip'}</span>
      </div>
      <div id="${key}Fields" style="${skipped ? 'opacity:0.3;pointer-events:none;' : ''}">
        <div style="display:grid;grid-template-columns:1fr auto;gap:0.5rem;align-items:end;margin-bottom:4px;">
          <input type="text" id="${key}Food" placeholder="what did you eat?" value="${saved[key + 'Food'] || ''}" style="font-family:'Lato',sans-serif;font-size:12px;font-weight:300;background:transparent;border:none;border-bottom:1px solid #d6c9b0;padding:3px 2px 5px;color:#4a3728;outline:none;width:100%;"/>
          <input type="time" id="${key}Time" value="${saved[key + 'Time'] || ''}" style="font-family:'Lato',sans-serif;font-size:11px;background:transparent;border:none;border-bottom:1px solid #d6c9b0;padding:3px 2px 5px;color:#7a6652;outline:none;width:80px;"/>
        </div>
        <div class="in-out-row" id="${key}InOut">
          <button class="in-out-btn ${location === 'in' || location === '' ? 'active' : ''}" onclick="setMealLocation('${key}', 'in', this)">in</button>
          <button class="in-out-btn ${location === 'out' ? 'active' : ''}" onclick="setMealLocation('${key}', 'out', this)">out</button>
        </div>
      </div>
    </div>
  `;
}

function setMealLocation(key, val, btn) {
  document.querySelectorAll(`#${key}InOut .in-out-btn`).forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

function getMealLocation(key) {
  const active = document.querySelector(`#${key}InOut .in-out-btn.active`);
  return active ? active.textContent.trim() : 'in';
}

function toggleSkip(key) {
  const link = document.getElementById(key + 'SkipLink');
  const fields = document.getElementById(key + 'Fields');
  const isSkipped = link.classList.contains('skipped');
  if (isSkipped) {
    link.classList.remove('skipped');
    link.textContent = 'skip';
    fields.style.opacity = '1';
    fields.style.pointerEvents = 'auto';
  } else {
    link.classList.add('skipped');
    link.textContent = 'skipped ✓';
    fields.style.opacity = '0.3';
    fields.style.pointerEvents = 'none';
  }
}

// ── RIGHT PAGE: WELLBEING + SYMPTOMS + NOTES ──
function renderRightPage(container, spread) {
  const d = spread.date;
  const saved = spread.entry || {};
  const savedSymptoms = saved.symptoms || [];

  const symptoms = [
    'bloating','stomach pain','nausea','leg pain',
    'fatigue','brain fog','headache','heartburn',
    'skin flare','joint ache','good energy','no symptoms'
  ];

  container.innerHTML = `
    ${pageHeader(d, 'wellbeing & symptoms')}
    <p class="page-title">How You Feel</p>
    <p class="page-subtitle">body, mind, and patterns</p>

    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:0.5rem;margin-bottom:1rem;">
      <div>
        <span class="section-label">mood</span>
        ${emojiScale('mood', ['awful','low','okay','good','great'], saved.mood)}
      </div>
      <div>
        <span class="section-label">stress</span>
        ${emojiScale('stress', ['calm','mild','moderate','stressed','overwhelmed'], saved.stress)}
      </div>
      <div>
        <span class="section-label">energy</span>
        ${emojiScale('energy', ['drained','tired','okay','energised','buzzing'], saved.energy)}
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;margin-bottom:0.75rem;">
      <div>
        <span class="section-label">water</span>
        <div class="slider-row">
          <input type="range" min="0" max="15" step="1" value="${saved.water || 6}" id="waterSlider" oninput="document.getElementById('waterVal').textContent = this.value"/>
          <span class="slider-val" id="waterVal">${saved.water || 6} <span style="font-size:10px;color:#b8a480;">glasses</span></span>
        </div>
      </div>
      <div>
        <span class="section-label">sleep</span>
        <div class="slider-row">
          <input type="range" min="0" max="12" step="1" value="${saved.sleep || 7}" id="sleepSlider" oninput="document.getElementById('sleepVal').textContent = this.value"/>
          <span class="slider-val" id="sleepVal">${saved.sleep || 7} <span style="font-size:10px;color:#b8a480;">hrs</span></span>
        </div>
      </div>
    </div>

    ${currentProfile.trackCycle ? `
      <div style="margin-bottom:0.75rem;">
        <span class="section-label">cycle day</span>
        <input type="number" id="cycleDay" min="1" max="35" placeholder="day e.g. 14" value="${saved.cycleDay || ''}" style="font-family:'Lato',sans-serif;font-size:13px;background:transparent;border:none;border-bottom:1px solid #d6c9b0;padding:4px 2px 6px;color:#4a3728;outline:none;width:100px;"/>
      </div>
    ` : ''}

    <hr class="divider" style="margin: 0.75rem 0;"/>

    <span class="section-label">symptoms</span>
    <div class="symptom-grid" id="symptomGrid" style="margin-bottom:0.75rem;">
      ${symptoms.map(s => `
        <button class="symptom-tag ${savedSymptoms.includes(s) ? 'active' : ''}" onclick="this.classList.toggle('active')">${s}</button>
      `).join('')}
    </div>

    <span class="section-label">notes</span>
    <textarea id="notesField" placeholder="anything else — patterns, timing, how you felt after eating..." style="font-family:'Lato',sans-serif;font-size:12px;font-weight:300;background:transparent;border:none;border-bottom:1px solid #d6c9b0;padding:4px 2px 6px;color:#4a3728;outline:none;width:100%;resize:none;height:44px;line-height:1.6;">${saved.notes || ''}</textarea>

    <button class="save-btn" onclick="saveEntrySpread('${d}')">save the day ✓</button>
  `;
}

function emojiScale(id, labels, savedVal) {
  const idx = savedVal ? labels.indexOf(savedVal) : 2;
  const safeIdx = idx === -1 ? 2 : idx;
  return `
    <div style="margin-bottom:0.75rem;">
      <input type="range" min="0" max="4" step="1" value="${safeIdx}" id="${id}Scale"
        oninput="document.getElementById('${id}Label').textContent = ${JSON.stringify(labels)}[this.value]"
        style="width:100%;"/>
      <span id="${id}Label" style="font-family:'Lato',sans-serif;font-size:11px;font-weight:300;color:#8a6e52;letter-spacing:0.05em;">${labels[safeIdx]}</span>
    </div>
  `;
}

function selectEmoji(scaleId, btn) {
  document.querySelectorAll(`#${scaleId} .emoji-btn`).forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

function getEmoji(scaleId) {
  const slider = document.getElementById(scaleId);
  if (!slider) return '';
  const maps = {
    moodScale: ['awful','low','okay','good','great'],
    stressScale: ['calm','mild','moderate','stressed','overwhelmed'],
    energyScale: ['drained','tired','okay','energised','buzzing']
  };
  return maps[scaleId] ? maps[scaleId][slider.value] : slider.value;
}

// ── SAVE FULL SPREAD ──
async function saveEntrySpread(date) {
  const data = {
    date,
    profileId: currentProfile.id,
    breakfastFood: val('breakfastFood'),
    breakfastTime: val('breakfastTime'),
    breakfastSkipped: document.getElementById('breakfastSkipLink')?.classList.contains('skipped') || false,
    breakfastLocation: getMealLocation('breakfast'),
    lunchFood: val('lunchFood'),
    lunchTime: val('lunchTime'),
    lunchSkipped: document.getElementById('lunchSkipLink')?.classList.contains('skipped') || false,
    lunchLocation: getMealLocation('lunch'),
    dinnerFood: val('dinnerFood'),
    dinnerTime: val('dinnerTime'),
    dinnerSkipped: document.getElementById('dinnerSkipLink')?.classList.contains('skipped') || false,
    dinnerLocation: getMealLocation('dinner'),
    snacks: val('snacks'),
    dessert: val('dessert'),
    mood: getEmoji('moodScale'),
    stress: getEmoji('stressScale'),
    energy: getEmoji('energyScale'),
    water: parseInt(document.getElementById('waterSlider')?.value || 6),
    sleep: parseInt(document.getElementById('sleepSlider')?.value || 7),
    cycleDay: document.getElementById('cycleDay')?.value || null,
    symptoms: [...document.querySelectorAll('#symptomGrid .symptom-tag.active')].map(b => b.textContent),
    notes: val('notesField'),
    updatedAt: new Date().toISOString()
  };
  await saveEntry(date, data);
  showToast('entry saved ✓');
}

// ── PATTERNS ──
function renderPatternsLeft(container) {
  const completed = entries.filter(e => e.symptoms && e.date);
  let content = '';

  if (completed.length < 3) {
    content = `<p class="pattern-empty">patterns appear here once you have at least 3 entries. keep going — your body is already talking.</p>`;
  } else {
    const total = completed.length;
    const avgSleep = (completed.reduce((a, e) => a + (e.sleep || 0), 0) / total).toFixed(1);
    const avgWater = (completed.reduce((a, e) => a + (e.water || 0), 0) / total).toFixed(1);

    const symptomCount = {};
    completed.forEach(e => {
      (e.symptoms || []).forEach(s => {
        if (s !== 'no symptoms') symptomCount[s] = (symptomCount[s] || 0) + 1;
      });
    });
    const topSymptom = Object.entries(symptomCount).sort((a, b) => b[1] - a[1])[0];

    content = `
      <div class="pattern-card">
        <p class="pattern-card-label">most frequent symptom</p>
        <p class="pattern-card-value">${topSymptom ? topSymptom[0] : 'none yet'}</p>
        <p class="pattern-card-sub">${topSymptom ? `${topSymptom[1]} out of ${total} days` : ''}</p>
      </div>
      <div class="pattern-card">
        <p class="pattern-card-label">average sleep</p>
        <p class="pattern-card-value">${avgSleep} hrs</p>
        <p class="pattern-card-sub">across ${total} entries</p>
      </div>
      <div class="pattern-card">
        <p class="pattern-card-label">average water</p>
        <p class="pattern-card-value">${avgWater} glasses</p>
        <p class="pattern-card-sub">across ${total} entries</p>
      </div>
    `;
  }

  container.innerHTML = `
    ${pageHeader('', 'patterns')}
    <p class="page-title">Patterns</p>
    <p class="page-subtitle">what your data is starting to say</p>
    ${content}
  `;
}

function renderPatternsRight(container) {
  const completed = entries.filter(e => e.symptoms && e.date);

  let content = '';
  if (completed.length >= 3) {
    const symptomCount = {};
    completed.forEach(e => {
      (e.symptoms || []).forEach(s => {
        if (s !== 'no symptoms') symptomCount[s] = (symptomCount[s] || 0) + 1;
      });
    });
    const topSymptom = Object.entries(symptomCount).sort((a, b) => b[1] - a[1])[0];

    const eatOutEntries = completed.filter(e =>
      e.breakfastLocation === 'out' || e.lunchLocation === 'out' || e.dinnerLocation === 'out'
    );
    const eatOutWithSymptom = topSymptom
      ? eatOutEntries.filter(e => (e.symptoms || []).includes(topSymptom[0])).length
      : 0;

    const moodScores = { '😣': 1, '😕': 2, '😐': 3, '🙂': 4, '😊': 5 };
    const moodDays = completed.filter(e => e.mood && moodScores[e.mood]);
    const avgMood = moodDays.length
      ? (moodDays.reduce((a, e) => a + moodScores[e.mood], 0) / moodDays.length).toFixed(1)
      : null;

    content = `
      ${eatOutEntries.length > 0 && topSymptom ? `
        <div class="pattern-card">
          <p class="pattern-card-label">eating out & ${topSymptom[0]}</p>
          <p class="pattern-card-value">${Math.round((eatOutWithSymptom / eatOutEntries.length) * 100)}% correlation</p>
          <p class="pattern-card-sub">${eatOutWithSymptom} of ${eatOutEntries.length} days eating out</p>
        </div>
      ` : ''}
      ${avgMood ? `
        <div class="pattern-card">
          <p class="pattern-card-label">average mood score</p>
          <p class="pattern-card-value">${avgMood} / 5</p>
          <p class="pattern-card-sub">across ${moodDays.length} logged days</p>
        </div>
      ` : ''}
      <div class="pattern-card">
        <p class="pattern-card-label">total entries</p>
        <p class="pattern-card-value">${completed.length} days</p>
        <p class="pattern-card-sub">keep going — more data = clearer patterns</p>
      </div>
    `;
  }

  container.innerHTML = `
    ${pageHeader('', '')}
    <p class="page-title"> </p>
    ${content}
  `;
}

// ── FIRESTORE SAVE ──
async function saveEntry(date, data) {
  try {
    const ref = db.collection('profiles').doc(currentProfile.id).collection('entries').doc(date);
    await ref.set(data, { merge: true });
    const idx = entries.findIndex(e => e.date === date);
    if (idx >= 0) entries[idx] = { ...entries[idx], ...data };
    else entries.unshift({ date, ...data });
    buildSpreads();
  } catch (e) {
    console.error('Save error:', e);
    showToast('save failed — check your connection');
  }
}

// ── UTIL ──
function val(id) {
  const el = document.getElementById(id);
  return el ? el.value.trim() : '';
}

async function clearEntry(date) {
  if (!confirm('clear everything logged for this day?')) return;
  try {
    await db.collection('profiles').doc(currentProfile.id).collection('entries').doc(date).delete();
    entries = entries.filter(e => e.date !== date);
    buildSpreads();
    currentSpreadIndex = 0;
    renderCurrentSpread();
    showToast('entry cleared ✓');
  } catch(e) {
    showToast('something went wrong');
    console.error(e);
  }
}
