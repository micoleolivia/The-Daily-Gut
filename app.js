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
let currentPageIndex = 0;
let pages = [];
let selectedColour = "#8a6e52";
let trackCycle = false;
let currentEntryDate = null;
let currentEntryData = {};

// ── INIT ──
window.addEventListener('DOMContentLoaded', () => {
  loadProfiles();
  buildToast();
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
    if (profiles.length === 0) {
      await seedDefaultProfile();
    } else {
      renderProfiles();
    }
  } catch (e) {
    console.error('Error loading profiles:', e);
    renderProfiles();
  }
}

async function seedDefaultProfile() {
  const defaultProfile = {
    name: 'Micole',
    colour: '#8a6e52',
    trackCycle: true,
    createdAt: new Date().toISOString()
  };
  try {
    const ref = await db.collection('profiles').add(defaultProfile);
    profiles = [{ id: ref.id, ...defaultProfile }];
    renderProfiles();
  } catch (e) {
    console.error('Error seeding profile:', e);
  }
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
  currentPageIndex = 0;
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
  const profile = {
    name,
    colour: selectedColour,
    trackCycle,
    createdAt: new Date().toISOString()
  };
  try {
    const ref = await db.collection('profiles').add(profile);
    profiles.push({ id: ref.id, ...profile });
    renderProfiles();
    closeAddProfile();
    showToast(`welcome, ${name}!`);
  } catch (e) {
    showToast('something went wrong, try again');
    console.error(e);
  }
}

// ── ENTRIES ──
async function loadEntries() {
  try {
    const snap = await db.collection('profiles').doc(currentProfile.id)
      .collection('entries').orderBy('date', 'desc').get();
    entries = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) {
    console.error('Error loading entries:', e);
    entries = [];
  }
  buildPages();
  renderCurrentPage();
}

function startNewEntry() {
  const today = new Date().toISOString().split('T')[0];
  const exists = entries.find(e => e.date === today);
  if (exists) {
    showToast("today's entry already exists");
    const idx = pages.findIndex(p => p.type === 'meals' && p.date === today);
    if (idx >= 0) { currentPageIndex = idx; renderCurrentPage(); }
    return;
  }
  currentEntryDate = today;
  currentEntryData = { date: today, profileId: currentProfile.id };
  entries.unshift({ date: today, isNew: true });
  buildPages();
  const idx = pages.findIndex(p => p.type === 'meals' && p.date === today);
  currentPageIndex = idx >= 0 ? idx : 0;
  renderCurrentPage();
}

// ── PAGE BUILDER ──
function buildPages() {
  pages = [];

  // Cover / Table of contents
  pages.push({ type: 'toc' });

  // Entry pages (3 pages per entry)
  entries.forEach(entry => {
    pages.push({ type: 'meals', date: entry.date, entry });
    pages.push({ type: 'wellbeing', date: entry.date, entry });
    pages.push({ type: 'symptoms', date: entry.date, entry });
  });

  // Patterns page always last
  pages.push({ type: 'patterns' });
}

// ── RENDER ──
function renderCurrentPage() {
  const container = document.getElementById('bookPages');
  container.innerHTML = '';

  const page = pages[currentPageIndex];
  if (!page) return;

  document.getElementById('prevBtn').disabled = currentPageIndex === 0;
  document.getElementById('nextBtn').disabled = currentPageIndex === pages.length - 1;
  renderDots();

  if (page.type === 'toc') renderTOC(container);
  else if (page.type === 'meals') renderMealsPage(container, page);
  else if (page.type === 'wellbeing') renderWellbeingPage(container, page);
  else if (page.type === 'symptoms') renderSymptomsPage(container, page);
  else if (page.type === 'patterns') renderPatternsPage(container);

  addDecoFlower(container);
}

function renderDots() {
  const dotsEl = document.getElementById('pageDots');
  dotsEl.innerHTML = '';
  const total = Math.min(pages.length, 9);
  for (let i = 0; i < total; i++) {
    const d = document.createElement('div');
    d.className = 'dot' + (i === Math.min(currentPageIndex, total - 1) ? ' active' : '');
    d.onclick = () => { currentPageIndex = i; renderCurrentPage(); };
    dotsEl.appendChild(d);
  }
}

function changePage(dir) {
  currentPageIndex = Math.max(0, Math.min(pages.length - 1, currentPageIndex + dir));
  renderCurrentPage();
}

function addDecoFlower(container) {
  container.insertAdjacentHTML('beforeend', `
    <svg class="deco-flower" width="90" height="90" viewBox="0 0 90 90" fill="none" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="45" cy="18" rx="9" ry="22" fill="#8a6e52" transform="rotate(0 45 45)"/>
      <ellipse cx="45" cy="18" rx="9" ry="22" fill="#8a6e52" transform="rotate(45 45 45)"/>
      <ellipse cx="45" cy="18" rx="9" ry="22" fill="#8a6e52" transform="rotate(90 45 45)"/>
      <ellipse cx="45" cy="18" rx="9" ry="22" fill="#8a6e52" transform="rotate(135 45 45)"/>
      <circle cx="45" cy="45" r="10" fill="#c4a882"/>
    </svg>
  `);
}

// ── PAGE HEADER HELPER ──
function pageHeader(dateStr, pageLabel, pageNum) {
  const formatted = dateStr
    ? new Date(dateStr + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    : '';
  return `
    <div class="page-header">
      <span class="page-date-label">${formatted}</span>
      <span class="page-num">${pageLabel} · ${pageNum}</span>
    </div>
  `;
}

// ── TABLE OF CONTENTS ──
function renderTOC(container) {
  const entryPages = entries.filter(e => !e.isNew || e.date);
  let items = '';
  if (entryPages.length === 0) {
    items = `<p class="toc-empty">your journal is empty — tap "+ new entry" to begin your first page.</p>`;
  } else {
    items = '<ul class="toc-list">';
    entryPages.forEach(entry => {
      const d = new Date(entry.date + 'T12:00:00');
      const label = d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
      const mood = entry.mood || '';
      const idx = pages.findIndex(p => p.type === 'meals' && p.date === entry.date);
      items += `
        <li class="toc-item" onclick="goToEntry('${entry.date}')">
          <span class="toc-entry-date">${label}</span>
          <span>${mood ? '<span class="toc-entry-mood">' + mood + '</span>' : ''} <span class="toc-entry-arrow">→</span></span>
        </li>
      `;
    });
    items += '</ul>';
  }

  container.innerHTML = `
    ${pageHeader('', 'contents', '—')}
    <p class="page-title">Table of Contents</p>
    <p class="page-subtitle">every day, one page at a time</p>
    ${items}
  `;
}

function goToEntry(date) {
  const idx = pages.findIndex(p => p.type === 'meals' && p.date === date);
  if (idx >= 0) { currentPageIndex = idx; renderCurrentPage(); }
}

// ── MEALS PAGE ──
function renderMealsPage(container, page) {
  const d = page.date;
  const saved = page.entry || {};

  container.innerHTML = `
    ${pageHeader(d, 'meals', '1 of 3')}
    <p class="page-title">Today's Meals</p>
    <p class="page-subtitle">what went in, and when</p>

    <span class="section-label">eating in or out today?</span>
    <div class="in-out-row" id="inOutRow">
      <button class="in-out-btn ${(saved.eatLocation || 'in') === 'in' ? 'active' : ''}" onclick="setInOut('in', this)">eating in</button>
      <button class="in-out-btn ${saved.eatLocation === 'out' ? 'active' : ''}" onclick="setInOut('out', this)">eating out</button>
      <button class="in-out-btn ${saved.eatLocation === 'both' ? 'active' : ''}" onclick="setInOut('both', this)">both</button>
    </div>

    ${mealField('Breakfast', 'breakfast', saved)}
    ${mealField('Lunch', 'lunch', saved)}
    ${mealField('Dinner', 'dinner', saved)}

    <div class="field-row">
      <div class="field">
        <span class="section-label">snacks</span>
        <input type="text" id="snacks" placeholder="e.g. apple, crackers" value="${saved.snacks || ''}" />
      </div>
      <div class="field">
        <span class="section-label">dessert</span>
        <input type="text" id="dessert" placeholder="e.g. ice cream" value="${saved.dessert || ''}" />
      </div>
    </div>

    <button class="save-btn" onclick="saveMealsPage('${d}')">save & continue →</button>
  `;

  setInOutState(saved.eatLocation || 'in');
}

function mealField(label, key, saved) {
  const skipped = saved[key + 'Skipped'] || false;
  return `
    <div style="margin-bottom: 1.1rem;">
      <div class="meal-header">
        <span class="section-label" style="margin-bottom:0">${label}</span>
        <span class="skip-link ${skipped ? 'skipped' : ''}" id="${key}SkipLink" onclick="toggleSkip('${key}')">${skipped ? 'skipped ✓' : 'skip'}</span>
      </div>
      <div class="field-row" id="${key}Fields" style="${skipped ? 'opacity:0.3;pointer-events:none;' : ''}">
        <div class="field">
          <input type="text" id="${key}Food" placeholder="what did you eat?" value="${saved[key + 'Food'] || ''}" />
        </div>
        <div class="field">
          <input type="time" id="${key}Time" value="${saved[key + 'Time'] || ''}" />
        </div>
      </div>
    </div>
  `;
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

let currentEatLocation = 'in';
function setInOut(val, btn) { setInOutState(val); }
function setInOutState(val) {
  currentEatLocation = val;
  document.querySelectorAll('.in-out-btn').forEach(b => b.classList.remove('active'));
  const btns = document.querySelectorAll('.in-out-btn');
  const map = { in: 0, out: 1, both: 2 };
  if (btns[map[val]]) btns[map[val]].classList.add('active');
}

async function saveMealsPage(date) {
  const data = {
    date,
    profileId: currentProfile.id,
    eatLocation: currentEatLocation,
    breakfastFood: val('breakfastFood'),
    breakfastTime: val('breakfastTime'),
    breakfastSkipped: document.getElementById('breakfastSkipLink')?.classList.contains('skipped') || false,
    lunchFood: val('lunchFood'),
    lunchTime: val('lunchTime'),
    lunchSkipped: document.getElementById('lunchSkipLink')?.classList.contains('skipped') || false,
    dinnerFood: val('dinnerFood'),
    dinnerTime: val('dinnerTime'),
    dinnerSkipped: document.getElementById('dinnerSkipLink')?.classList.contains('skipped') || false,
    snacks: val('snacks'),
    dessert: val('dessert'),
    updatedAt: new Date().toISOString()
  };
  await saveEntry(date, data);
  showToast('meals saved ✓');
  changePage(1);
}

// ── WELLBEING PAGE ──
function renderWellbeingPage(container, page) {
  const d = page.date;
  const saved = page.entry || {};

  container.innerHTML = `
    ${pageHeader(d, 'wellbeing', '2 of 3')}
    <p class="page-title">Wellbeing</p>
    <p class="page-subtitle">how your body and mind are doing</p>

    <span class="section-label">mood</span>
    ${emojiScale('mood', ['😣','😕','😐','🙂','😊'], saved.mood)}

    <span class="section-label">stress</span>
    ${emojiScale('stress', ['😌','😐','😤','😰','😩'], saved.stress)}

    <span class="section-label">energy</span>
    ${emojiScale('energy', ['🪫','😴','⚡','🔥','✨'], saved.energy)}

    <hr class="divider"/>

    <span class="section-label">water intake</span>
    <div class="slider-row">
      <input type="range" min="0" max="15" step="1" value="${saved.water || 6}" id="waterSlider" oninput="document.getElementById('waterVal').textContent = this.value + ' glasses'"/>
      <span class="slider-val" id="waterVal">${saved.water || 6} glasses</span>
    </div>

    <span class="section-label">sleep last night</span>
    <div class="slider-row">
      <input type="range" min="0" max="12" step="1" value="${saved.sleep || 7}" id="sleepSlider" oninput="document.getElementById('sleepVal').textContent = this.value + ' hrs'"/>
      <span class="slider-val" id="sleepVal">${saved.sleep || 7} hrs</span>
    </div>

    ${currentProfile.trackCycle ? `
      <hr class="divider"/>
      <span class="section-label">cycle day</span>
      <div class="cycle-row">
        <input type="number" id="cycleDay" min="1" max="35" placeholder="e.g. 14" value="${saved.cycleDay || ''}"/>
        <span class="cycle-label">day of cycle (leave blank if unsure)</span>
      </div>
    ` : ''}

    <button class="save-btn" onclick="saveWellbeingPage('${d}')">save & continue →</button>
  `;
}

function emojiScale(id, emojis, savedVal) {
  return `
    <div class="emoji-scale" id="${id}Scale" style="margin-bottom:1.25rem;">
      ${emojis.map((e, i) => `
        <button class="emoji-btn ${savedVal === e ? 'active' : ''}" onclick="selectEmoji('${id}Scale', this)" data-val="${e}">${e}</button>
      `).join('')}
    </div>
  `;
}

function selectEmoji(scaleId, btn) {
  document.querySelectorAll(`#${scaleId} .emoji-btn`).forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

function getEmoji(scaleId) {
  const active = document.querySelector(`#${scaleId} .emoji-btn.active`);
  return active ? active.dataset.val : '';
}

async function saveWellbeingPage(date) {
  const data = {
    mood: getEmoji('moodScale'),
    stress: getEmoji('stressScale'),
    energy: getEmoji('energyScale'),
    water: parseInt(document.getElementById('waterSlider')?.value || 6),
    sleep: parseInt(document.getElementById('sleepSlider')?.value || 7),
    cycleDay: document.getElementById('cycleDay')?.value || null,
    updatedAt: new Date().toISOString()
  };
  await saveEntry(date, data);
  showToast('wellbeing saved ✓');
  changePage(1);
}

// ── SYMPTOMS PAGE ──
function renderSymptomsPage(container, page) {
  const d = page.date;
  const saved = page.entry || {};
  const savedSymptoms = saved.symptoms || [];

  const symptoms = [
    'bloating', 'stomach pain', 'nausea', 'leg pain',
    'fatigue', 'brain fog', 'headache', 'heartburn',
    'skin flare', 'joint ache', 'good energy', 'no symptoms'
  ];

  container.innerHTML = `
    ${pageHeader(d, 'symptoms & notes', '3 of 3')}
    <p class="page-title">Symptoms & Notes</p>
    <p class="page-subtitle">tap everything that applies today</p>

    <span class="section-label">symptoms</span>
    <div class="symptom-grid" id="symptomGrid">
      ${symptoms.map(s => `
        <button class="symptom-tag ${savedSymptoms.includes(s) ? 'active' : ''}" onclick="this.classList.toggle('active')">${s}</button>
      `).join('')}
    </div>

    <hr class="divider"/>

    <span class="section-label">anything else to note?</span>
    <div class="field-full" style="margin-top:0.5rem;">
      <textarea id="notesField" placeholder="e.g. felt worse after lunch, leg pain started around 3pm, ate late...">${saved.notes || ''}</textarea>
    </div>

    <button class="save-btn" onclick="saveSymptomsPage('${d}')">close the day ✓</button>
  `;
}

async function saveSymptomsPage(date) {
  const selected = [...document.querySelectorAll('#symptomGrid .symptom-tag.active')].map(b => b.textContent);
  const data = {
    symptoms: selected,
    notes: val('notesField'),
    updatedAt: new Date().toISOString()
  };
  await saveEntry(date, data);
  showToast('entry complete ✓');
  loadEntries();
}

// ── PATTERNS PAGE ──
function renderPatternsPage(container) {
  const completedEntries = entries.filter(e => e.symptoms && e.date);

  let content = '';

  if (completedEntries.length < 3) {
    content = `
      <p class="pattern-empty">
        patterns will appear here once you have at least 3 entries.<br><br>
        keep logging daily — your body is already talking, this page just needs a little more data to translate it.
      </p>
    `;
  } else {
    const totalEntries = completedEntries.length;
    const avgSleep = (completedEntries.reduce((a, e) => a + (e.sleep || 0), 0) / totalEntries).toFixed(1);
    const avgWater = (completedEntries.reduce((a, e) => a + (e.water || 0), 0) / totalEntries).toFixed(1);

    const symptomCount = {};
    completedEntries.forEach(e => {
      (e.symptoms || []).forEach(s => {
        if (s !== 'no symptoms') symptomCount[s] = (symptomCount[s] || 0) + 1;
      });
    });

    const topSymptom = Object.entries(symptomCount).sort((a, b) => b[1] - a[1])[0];

    const eatOutEntries = completedEntries.filter(e => e.eatLocation === 'out' || e.eatLocation === 'both');
    const eatOutWithSymptom = topSymptom ? eatOutEntries.filter(e => (e.symptoms || []).includes(topSymptom[0])).length : 0;
    const eatOutTotal = eatOutEntries.length;

    content = `
      <div class="pattern-card">
        <p class="pattern-card-label">most frequent symptom</p>
        <p class="pattern-card-value">${topSymptom ? topSymptom[0] : 'none yet'}</p>
        <p class="pattern-card-sub">${topSymptom ? `logged ${topSymptom[1]} out of ${totalEntries} days` : ''}</p>
      </div>

      <div class="pattern-card">
        <p class="pattern-card-label">average sleep</p>
        <p class="pattern-card-value">${avgSleep} hrs</p>
        <p class="pattern-card-sub">across ${totalEntries} entries</p>
      </div>

      <div class="pattern-card">
        <p class="pattern-card-label">average water</p>
        <p class="pattern-card-value">${avgWater} glasses/day</p>
        <p class="pattern-card-sub">across ${totalEntries} entries</p>
      </div>

      ${eatOutTotal > 0 && topSymptom ? `
        <div class="pattern-card">
          <p class="pattern-card-label">eating out & ${topSymptom[0]}</p>
          <p class="pattern-card-value">${Math.round((eatOutWithSymptom / eatOutTotal) * 100)}% of the time</p>
          <p class="pattern-card-sub">you logged ${topSymptom[0]} on ${eatOutWithSymptom} out of ${eatOutTotal} days you ate out</p>
        </div>
      ` : ''}
    `;
  }

  container.innerHTML = `
    ${pageHeader('', 'patterns', '—')}
    <p class="page-title">Patterns</p>
    <p class="page-subtitle">what your data is starting to say</p>
    ${content}
  `;
}

// ── FIRESTORE SAVE ──
async function saveEntry(date, data) {
  try {
    const ref = db.collection('profiles').doc(currentProfile.id).collection('entries').doc(date);
    await ref.set(data, { merge: true });
    const idx = entries.findIndex(e => e.date === date);
    if (idx >= 0) {
      entries[idx] = { ...entries[idx], ...data };
    } else {
      entries.unshift({ date, ...data });
    }
    buildPages();
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
