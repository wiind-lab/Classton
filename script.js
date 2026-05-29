/* ==============================
   script.js — 스마트 자리 바꾸기
   ============================== */

/* ─── 전역 상태 ─── */
let students = [];
let gridEnabled = Array(40).fill(true);
let currentSeats = Array(40).fill(null);
let previousSeats = Array(40).fill(null);
let groups = { count: 0, assignments: Array(40).fill(0) };
let activeGroup = 0;
let fixedSeats = {};
let banned = [];
let avoidPrevPair = false;
let currentTab = 'roster';
let savedLayouts = [];

/* ─── 뽑기 상태 ─── */
let pickedSeatIndexes = [];
let historyPickedNames = [];
let excludePickedEnabled = true;

/* ─── [1번 수정] 뽑기 인원 수 유지용 변수 ─── */
let lastPickAllCount = 1;
let lastPickGroupCount = 1;
let lastPickMaleCount = 0;
let lastPickFemaleCount = 0;

/* ─── UI 상태 ─── */
let isDragging = false;
let startCellState = null;
let fixModeActive = false;
let fixModeStudentIdx = null;
let groupViewOn = true; // [6번] 모둠보기 상태

/* ─── 상수 ─── */
const groupColors = [
  '#93c5fd', '#f8a5d8', '#fde68a', '#c084fc',
  '#86efac', '#fca5a5', '#fed7aa', '#e9d5ff'
];
const DEFAULT_PASSWORD = '1234';

/* ══════════════════════════════════
   localStorage 로드 / 저장
══════════════════════════════════ */
function loadFromStorage() {
  try {
    const s = localStorage.getItem('seat_students');
    if (s) {
      const p = JSON.parse(s);
      if (Array.isArray(p)) {
        students = p.map(x => {
          if (!x || typeof x !== 'object') return null;
          return { name: x.name || '무명', milk: !!x.milk, gender: x.gender || 'M' };
        }).filter(Boolean);
      }
    }
  } catch(e) { students = []; }

  try {
    const g = localStorage.getItem('seat_grid_enabled');
    if (g) {
      const p = JSON.parse(g);
      if (Array.isArray(p) && p.length === 40) gridEnabled = p;
    }
  } catch(e) { gridEnabled = Array(40).fill(true); }

  try { const g = localStorage.getItem('seat_groups');      if (g) groups     = JSON.parse(g); } catch(e) {}
  try { const f = localStorage.getItem('seat_fixed_seats'); if (f) fixedSeats = JSON.parse(f); } catch(e) {}
  try { const b = localStorage.getItem('seat_banned');      if (b) banned     = JSON.parse(b); } catch(e) {}
  try { const l = localStorage.getItem('seat_layouts');     if (l) savedLayouts = JSON.parse(l) || []; } catch(e) {}
}

function saveStudentsToStorage() {
  localStorage.setItem('seat_students', JSON.stringify(students));
}
function saveSettingsToStorage() {
  localStorage.setItem('seat_grid_enabled', JSON.stringify(gridEnabled));
  localStorage.setItem('seat_groups', JSON.stringify(groups));
  localStorage.setItem('seat_fixed_seats', JSON.stringify(fixedSeats));
  localStorage.setItem('seat_banned', JSON.stringify(banned));
}

/* [5번] 비밀번호 localStorage 저장/로드 */
function getSavedPassword() {
  return localStorage.getItem('seat_settings_password') || DEFAULT_PASSWORD;
}
function savePassword(pw) {
  localStorage.setItem('seat_settings_password', pw);
}

/* ══════════════════════════════════
   그리드 렌더링
══════════════════════════════════ */
function renderGrid() {
  const g = document.getElementById('grid');
  if (!g) return;
  g.innerHTML = '';

  for (let i = 0; i < 40; i++) {
    const isCurrentPicked  = pickedSeatIndexes.includes(i);
    const isPreviousPicked = !isCurrentPicked &&
      currentSeats[i] && historyPickedNames.includes(currentSeats[i].name);

    const cell = document.createElement('div');
    let cls = 'grid-cell relative flex items-center justify-center rounded-lg border-2 cursor-pointer transition-all ';

    if (isCurrentPicked) {
      cls += 'picked-cell-current';
    } else if (isPreviousPicked) {
      cls += 'picked-cell-previous';
    } else {
      cls += gridEnabled[i]
        ? 'bg-white border-slate-300 hover:border-indigo-300'
        : 'bg-slate-200 border-slate-200 opacity-50';
    }
    cell.className = cls;
    cell.dataset.idx = i;

    /* 자리 번호 (고정자리 지정 모드) */
    if (fixModeActive) {
      const sn = document.createElement('span');
      sn.className = 'seat-number';
      sn.textContent = i + 1;
      cell.appendChild(sn);
    }

    /* 모둠 테두리 */
    if (!isCurrentPicked && !isPreviousPicked &&
        groups && groups.assignments && groups.assignments[i] > 0) {
      cell.style.borderColor = groupColors[(groups.assignments[i] - 1) % 8];
      cell.style.borderWidth = '3px';
    }

    /* 학생 이름 */
    if (currentSeats[i]) {
      const s = currentSeats[i];
      const inner = document.createElement('div');
      inner.className = 'flex items-center gap-1 z-20';
      const dotColor = s.gender === 'F' ? 'bg-pink-400' : 'bg-blue-400';
      let textCls = 'text-base font-semibold text-slate-800';
      if (isCurrentPicked)  textCls = 'text-lg font-black text-white';
      if (isPreviousPicked) textCls = 'text-base font-bold text-slate-500';

      inner.innerHTML = `
        <span class="${textCls} whitespace-nowrap">${s.name}</span>
        ${(isCurrentPicked || isPreviousPicked) ? '' : `<span class="w-1.5 h-1.5 rounded-full ${dotColor}"></span>`}
        ${s.milk ? milkSVG(isCurrentPicked, isPreviousPicked) : ''}`;
      cell.appendChild(inner);
    }

    /* 모둠 번호 라벨 */
    if (!isCurrentPicked && !isPreviousPicked &&
        groups && groups.assignments && groups.assignments[i] > 0) {
      const gn = document.createElement('span');
      gn.className = 'absolute top-0 left-1 text-xs font-bold opacity-60 z-20 group-number-label';
      gn.textContent = `${groups.assignments[i]}모둠`;
      cell.appendChild(gn);
    }

    cell.addEventListener('mousedown', (e) => handleMouseDown(i, e));
    cell.addEventListener('mouseenter', (e) => handleMouseEnter(i, e));
    g.appendChild(cell);
  }
}

window.addEventListener('mouseup', () => {
  if (isDragging) {
    isDragging = false;
    startCellState = null;
    saveSettingsToStorage();
  }
});

function handleMouseDown(i, e) {
  e.preventDefault();
  if (fixModeActive) {
    if (fixModeStudentIdx !== null) {
      fixedSeats[fixModeStudentIdx] = i;
      fixModeActive = false;
      fixModeStudentIdx = null;
      saveSettingsToStorage();
      renderSide();
      renderGrid();
    }
    return;
  }
  isDragging = true;
  if (activeGroup > 0) {
    startCellState = groups.assignments[i] === activeGroup ? 0 : activeGroup;
    groups.assignments[i] = startCellState;
  } else {
    startCellState = !gridEnabled[i];
    gridEnabled[i] = startCellState;
  }
  renderGrid();
}

function handleMouseEnter(i, e) {
  if (!isDragging || fixModeActive) return;
  if (activeGroup > 0) groups.assignments[i] = startCellState;
  else gridEnabled[i] = startCellState;
  renderGrid();
}

function milkSVG(isCurrentPicked, isPreviousPicked) {
  let stroke = '#3b82f6', fill = '#bfdbfe', text = '#1e40af';
  if (isCurrentPicked)  { stroke = '#ffffff'; fill = 'rgba(255,255,255,0.2)'; text = '#ffffff'; }
  if (isPreviousPicked) { stroke = '#94a3b8'; fill = '#cbd5e1'; text = '#64748b'; }
  return `<svg width="16" height="20" viewBox="0 0 16 20" class="flex-shrink-0">
    <rect x="3" y="7" width="10" height="12" rx="1" fill="#fff" stroke="${stroke}" stroke-width="1.5"/>
    <polygon points="5,7 8,3 11,7" fill="#fff" stroke="${stroke}" stroke-width="1.5" stroke-linejoin="round"/>
    <rect x="5" y="9" width="6" height="4" rx="0.5" fill="${fill}"/>
    <text x="8" y="12" text-anchor="middle" font-size="3.5" fill="${text}" font-weight="bold">우유</text>
  </svg>`;
}

/* ══════════════════════════════════
   자리 바꾸기 (셔플)
══════════════════════════════════ */
function startShuffle() {
  if (students.length === 0) return;
  pickedSeatIndexes = [];

  const btn = document.getElementById('btnShuffle');
  btn.disabled = true;
  btn.classList.add('opacity-50');

  const cells = document.getElementById('grid').children;
  const enabled = [];
  for (let i = 0; i < 40; i++) if (gridEnabled[i]) enabled.push(i);

  const rollInterval = setInterval(() => {
    for (let idx of enabled) {
      const cell = cells[idx];
      if (!cell) continue;
      const rnd = students[Math.floor(Math.random() * students.length)];
      cell.innerHTML = `<span class="text-base font-semibold slot-roll text-slate-800">${rnd.name}</span>`;
      cell.classList.add('shake');
    }
  }, 80);

  setTimeout(() => {
    clearInterval(rollInterval);
    for (let idx of enabled) { if (cells[idx]) cells[idx].classList.remove('shake'); }
    doShuffle();
    btn.disabled = false;
    btn.classList.remove('opacity-50');
    fireConfetti();
  }, 3000);
}

function doShuffle() {
  previousSeats = [...currentSeats];
  currentSeats  = Array(40).fill(null);

  const enabled = [];
  for (let i = 0; i < 40; i++) if (gridEnabled[i]) enabled.push(i);

  let pool  = [...students];
  let slots = [...enabled];

  for (let si in fixedSeats) {
    const seatIdx = fixedSeats[si];
    if (gridEnabled[seatIdx]) {
      currentSeats[seatIdx] = students[si];
      pool  = pool.filter(s => s !== students[si]);
      slots = slots.filter(s => s !== seatIdx);
    }
  }

  let prevPairs = new Set();
  if (avoidPrevPair) {
    for (let i = 0; i < 40; i++) {
      if (!previousSeats[i]) continue;
      const col = i % 8;
      if (col > 0 && previousSeats[i-1]) prevPairs.add(previousSeats[i].name + '|' + previousSeats[i-1].name);
      if (col < 7 && previousSeats[i+1]) prevPairs.add(previousSeats[i].name + '|' + previousSeats[i+1].name);
    }
  }

  for (let attempt = 0; attempt < 100; attempt++) {
    let tempPool  = [...pool];
    let tempSlots = [...slots];
    let tempSeats = [...currentSeats];
    shuffle(tempPool);
    let valid = true;

    for (let k = 0; k < Math.min(tempPool.length, tempSlots.length); k++) {
      tempSeats[tempSlots[k]] = tempPool[k];
    }

    for (let [a, b] of banned) {
      for (let i = 0; i < 40; i++) {
        if (!tempSeats[i]) continue;
        const col = i % 8;
        if (tempSeats[i] === students[a]) {
          if (col > 0 && tempSeats[i-1] === students[b]) valid = false;
          if (col < 7 && tempSeats[i+1] === students[b]) valid = false;
        }
      }
    }

    if (avoidPrevPair && valid) {
      for (let i = 0; i < 40; i++) {
        if (!tempSeats[i]) continue;
        const col = i % 8;
        if (col > 0 && tempSeats[i-1] && prevPairs.has(tempSeats[i].name + '|' + tempSeats[i-1].name)) valid = false;
        if (col < 7 && tempSeats[i+1] && prevPairs.has(tempSeats[i].name + '|' + tempSeats[i+1].name)) valid = false;
      }
    }

    if (valid || attempt === 99) { currentSeats = tempSeats; break; }
  }

  renderGrid();
  const cells = document.getElementById('grid').children;
  for (let i = 0; i < 40; i++) {
    if (currentSeats[i] && cells[i]) {
      setTimeout(() => cells[i].classList.add('seat-pop'), i * 30);
    }
  }
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

function resetGrid() {
  currentSeats = Array(40).fill(null);
  pickedSeatIndexes = [];
  renderGrid();
}

function fireConfetti() {
  const dur = 1500, end = Date.now() + dur;
  (function frame() {
    confetti({ particleCount: 4, angle: 60,  spread: 55, origin: { x: 0 }, colors: ['#a7f3d0','#bfdbfe','#fde68a'] });
    confetti({ particleCount: 4, angle: 120, spread: 55, origin: { x: 1 }, colors: ['#fca5a5','#99f6e4','#fed7aa'] });
    if (Date.now() < end) requestAnimationFrame(frame);
  })();
}

/* ══════════════════════════════════
   탭 / 사이드바 제어
══════════════════════════════════ */
function showTab(tab) {
  currentTab = tab;
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active-tab'));
  const targetBtn = document.querySelector(`[data-tab="${tab}"]`);
  if (targetBtn) targetBtn.classList.add('active-tab');
  renderSide();
}

function toggleSidebar() {
  const sb = document.getElementById('sidebar');
  if (!sb) return;
  const hidden = sb.style.transform === 'translateX(100%)' || sb.style.transform === '';
  sb.style.transform = hidden ? 'translateX(0)' : 'translateX(100%)';
}

function openPickerTab() {
  const sb = document.getElementById('sidebar');
  if (sb) sb.style.transform = 'translateX(0)';
  showTab('picker');
}

/* [3번] 설정 탭 비밀번호 입력 */
function openSettingsWithPassword() {
  const pw = getSavedPassword();
  const input = prompt('설정 메뉴 비밀번호 4자리를 입력하세요.');
  if (input === null) return;
  if (input === pw) {
    const sb = document.getElementById('sidebar');
    if (sb) sb.style.transform = 'translateX(0)';
    showTab('settings');
  } else {
    alert('비밀번호가 올바르지 않습니다.');
  }
}

/* ══════════════════════════════════
   [6번] 모둠보기 ON/OFF
══════════════════════════════════ */
function toggleGroupView() {
  groupViewOn = !groupViewOn;
  document.body.classList.toggle('group-view-off', !groupViewOn);
  updateGroupViewButton();
  renderGrid();
}

function updateGroupViewButton() {
  const icon  = document.getElementById('groupViewIcon');
  const label = document.getElementById('groupViewLabel');
  if (!icon || !label) return;
  if (groupViewOn) {
    icon.textContent  = '👁️';
    label.textContent = '모둠보기 ON';
  } else {
    icon.textContent  = '🙈';
    label.textContent = '모둠보기 OFF';
  }
}

/* ══════════════════════════════════
   [8/9번] 더보기 메뉴
══════════════════════════════════ */
function toggleMoreMenu() {
  const dd = document.getElementById('moreMenuDropdown');
  if (!dd) return;
  dd.classList.toggle('hidden');
}

function closeMoreMenu() {
  const dd = document.getElementById('moreMenuDropdown');
  if (dd) dd.classList.add('hidden');
}

/* 더보기 외부 클릭 시 닫기 */
document.addEventListener('click', (e) => {
  const btn = document.getElementById('btnMoreMenu');
  const dd  = document.getElementById('moreMenuDropdown');
  if (dd && btn && !btn.contains(e.target) && !dd.contains(e.target)) {
    dd.classList.add('hidden');
  }
});

/* ══════════════════════════════════
   [7번] 프린트
══════════════════════════════════ */
function printSeats() {
  const pg = document.getElementById('printGrid');
  if (!pg) return;
  pg.innerHTML = '';

  for (let i = 0; i < 40; i++) {
    const cell = document.createElement('div');
    let cls = 'print-cell';
    if (!gridEnabled[i]) cls += ' disabled';
    if (groups && groups.assignments && groups.assignments[i] > 0) {
      cls += ' group-colored';
      cell.style.borderColor = groupColors[(groups.assignments[i] - 1) % 8];
    }
    cell.className = cls;
    if (currentSeats[i]) {
      cell.textContent = currentSeats[i].name;
    }
    pg.appendChild(cell);
  }

  window.print();
}

/* ══════════════════════════════════
   사이드바 렌더링 (renderSide)
══════════════════════════════════ */
function renderSide() {
  const c = document.getElementById('sideContent');
  if (!c) return;

  /* [1번] 뽑기 입력값 저장 (렌더 직전에 읽어둠) */
  const elAll    = document.getElementById('pickAllCount');
  const elGrp    = document.getElementById('pickGroupCount');
  const elMale   = document.getElementById('pickMaleCount');
  const elFemale = document.getElementById('pickFemaleCount');
  if (elAll)    lastPickAllCount    = parseInt(elAll.value)    || 1;
  if (elGrp)    lastPickGroupCount  = parseInt(elGrp.value)    || 1;
  if (elMale)   lastPickMaleCount   = parseInt(elMale.value)   || 0;
  if (elFemale) lastPickFemaleCount = parseInt(elFemale.value) || 0;

  if      (currentTab === 'roster')   renderRoster(c);
  else if (currentTab === 'group')    renderGroup(c);
  else if (currentTab === 'settings') renderSettings(c);
  else                                renderPickerMenu(c);
}

/* ══════════════════════════════════
   명단 관리 탭
══════════════════════════════════ */
function renderRoster(c) {
  c.innerHTML = `
    <textarea id="rosterInput"
      class="w-full h-24 border rounded-lg p-2 text-sm mb-2"
      placeholder="이름을 줄바꿈으로 입력&#10;(우유급식: 이름 뒤에 탭+O)"></textarea>
    <div class="flex gap-2 mb-3">
      <button onclick="loadRoster(false)" class="flex-1 py-2 bg-emerald-400 text-white rounded-lg font-bold text-sm hover:bg-emerald-500">명단 등록</button>
      <button onclick="loadRoster(true)"  class="flex-1 py-2 bg-sky-400    text-white rounded-lg font-bold text-sm hover:bg-sky-500">명단 추가</button>
    </div>
    <table class="w-full text-xs border-collapse">
      <tr class="bg-slate-100">
        <th class="p-1 border">#</th>
        <th class="p-1 border">이름</th>
        <th class="p-1 border">성별</th>
        <th class="p-1 border">우유</th>
        <th class="p-1 border">삭제</th>
      </tr>
      ${students.map((s, i) => `
        <tr class="hover:bg-slate-50">
          <td class="p-1 border text-center text-slate-400">${i + 1}</td>
          <td class="p-1 border font-medium">${s ? s.name : ''}</td>
          <td class="p-1 border text-center">
            <button class="gender-switch ${s && s.gender === 'F' ? 'female' : ''}" onclick="toggleGender(${i})">
              <span class="gender-switch-thumb"></span>
            </button>
          </td>
          <td class="p-1 border text-center">
            <button class="toggle-switch ${s && s.milk ? 'active' : ''}" onclick="toggleMilk(${i})"></button>
          </td>
          <td class="p-1 border text-center">
            <button onclick="removeStudent(${i})" class="text-red-400 hover:text-red-600">✕</button>
          </td>
        </tr>`).join('')}
    </table>`;
}

function loadRoster(append) {
  const txt = document.getElementById('rosterInput').value.trim();
  if (!txt) return;
  const lines = txt.split('\n').filter(l => l.trim());
  const newS = lines.map(l => {
    const parts = l.split(/\t/);
    return { name: parts[0].trim(), milk: parts[1] && parts[1].trim().toUpperCase() === 'O', gender: 'M' };
  });
  if (append) students = [...students, ...newS];
  else        students = newS;
  saveStudentsToStorage();
  renderSide();
  renderGrid();
}

function toggleMilk(i)   { if (students[i]) { students[i].milk   = !students[i].milk;   saveStudentsToStorage(); renderSide(); renderGrid(); } }
function toggleGender(i) { if (students[i]) { students[i].gender = students[i].gender === 'M' ? 'F' : 'M'; saveStudentsToStorage(); renderSide(); renderGrid(); } }
function removeStudent(i) { students.splice(i, 1); delete fixedSeats[i]; saveStudentsToStorage(); saveSettingsToStorage(); renderSide(); renderGrid(); }

/* ══════════════════════════════════
   모둠 설정 탭
══════════════════════════════════ */
function renderGroup(c) {
  c.innerHTML = `
    <div class="flex flex-col gap-2 mb-4 border-b pb-3">
      <div class="flex items-center gap-2">
        <label class="text-sm font-bold">모둠 수:</label>
        <input type="number" id="groupCount" value="${groups.count}" min="0" max="8"
          class="w-16 border rounded p-1 text-center">
        <button onclick="setGroups()" class="px-3 py-1 bg-violet-400 text-white rounded-lg text-sm font-bold hover:bg-violet-500">적용</button>
      </div>
      <button onclick="resetGroupSettings()"
        class="w-full mt-1 py-1.5 bg-rose-400 hover:bg-rose-500 text-white rounded-lg text-xs font-bold shadow transition">
        ❌ 모둠 설정 초기화
      </button>
    </div>
    <div class="flex flex-wrap gap-2 mb-2" id="groupBtns"></div>
    <p class="text-xs text-slate-500">모둠 버튼 선택 후 좌측 자리를 드래그하거나 클릭하여 연속 지정하세요.</p>`;
  renderGroupBtns();
}

function setGroups() {
  groups.count = parseInt(document.getElementById('groupCount').value) || 0;
  groups.assignments = Array(40).fill(0);
  activeGroup = 0;
  saveSettingsToStorage();
  renderSide();
  renderGrid();
}

function renderGroupBtns() {
  const container = document.getElementById('groupBtns');
  if (!container) return;
  container.innerHTML = '';
  for (let i = 1; i <= groups.count; i++) {
    const btn = document.createElement('button');
    btn.className = `px-3 py-1 rounded-full text-sm font-bold border-2 transition ${activeGroup === i ? 'ring-2 ring-offset-1 ring-indigo-500' : ''}`;
    btn.style.borderColor = groupColors[(i - 1) % 8];
    btn.style.background  = activeGroup === i ? groupColors[(i - 1) % 8] : 'white';
    btn.textContent = `${i}모둠`;
    btn.onclick = () => { activeGroup = (activeGroup === i) ? 0 : i; renderGroupBtns(); renderGrid(); };
    container.appendChild(btn);
  }
}

function resetGroupSettings() {
  if (confirm('모든 모둠 설정을 초기화하고 처음 상태로 되돌리시겠습니까?')) {
    groups = { count: 0, assignments: Array(40).fill(0) };
    activeGroup = 0;
    saveSettingsToStorage();
    renderSide();
    renderGrid();
  }
}

/* ══════════════════════════════════
   [11번] ⚙️ 설정 탭 — 카드형 UI
══════════════════════════════════ */
function renderSettings(c) {
  c.innerHTML = `

    <!-- ── 자리 지정 카드 ── -->
    <div class="settings-card">
      <div class="settings-card-title">📌 자리 지정</div>
      <div class="flex gap-1 mb-2">
        <select id="fixStudent" class="flex-1 border rounded p-1 text-sm" onchange="activateFixMode()">
          <option value="">- 학생 선택 -</option>
          ${students.map((s, i) => {
            const isFixed = fixedSeats.hasOwnProperty(i);
            return `<option value="${i}">${s.name}${isFixed ? ' (지정됨)' : ''}</option>`;
          }).join('')}
        </select>
      </div>
      <div id="fixModeStatus" class="text-xs text-indigo-600 font-bold mb-2 animate-pulse" style="display:none;">
        👆 좌측 그리드에서 원하는 자리를 클릭하여 지정하세요.
      </div>
      <div class="text-xs flex flex-wrap gap-1">
        ${Object.entries(fixedSeats).map(([si, seat]) =>
          `<span class="inline-flex items-center bg-amber-100 rounded px-2 py-0.5 font-medium">
            ${students[si]?.name} ➔ ${parseInt(seat) + 1}번
            <button onclick="removeFix(${si})" class="text-red-400 hover:text-red-600 ml-1 font-bold">✕</button>
          </span>`
        ).join('') || '<span class="text-slate-400">지정된 학생 없음</span>'}
      </div>
    </div>

    <!-- ── 짝꿍 방지 카드 ── -->
    <div class="settings-card">
      <div class="settings-card-title">🚫 짝꿍 방지</div>
      <div class="flex gap-1 mb-2">
        <select id="banA" class="flex-1 border rounded p-1 text-sm">
          <option value="">- 선택 -</option>
          ${students.map((s, i) => `<option value="${i}">${s.name}</option>`).join('')}
        </select>
        <select id="banB" class="flex-1 border rounded p-1 text-sm">
          <option value="">- 선택 -</option>
          ${students.map((s, i) => `<option value="${i}">${s.name}</option>`).join('')}
        </select>
        <button onclick="addBan()" class="px-2 py-1 bg-rose-400 text-white rounded text-sm font-bold hover:bg-rose-500">추가</button>
      </div>
      <div class="text-xs flex flex-wrap gap-1">
        ${banned.map(([a, b], i) =>
          `<span class="inline-flex items-center bg-rose-100 rounded px-2 py-0.5 font-medium">
            ${students[a]?.name}↔${students[b]?.name}
            <button onclick="removeBan(${i})" class="text-red-400 hover:text-red-600 ml-1 font-bold">✕</button>
          </span>`
        ).join('') || '<span class="text-slate-400">방지 쌍 없음</span>'}
      </div>
      <div class="mt-3">
        <label class="flex items-center gap-2 cursor-pointer">
          <button class="toggle-switch ${avoidPrevPair ? 'active' : ''}"
            onclick="avoidPrevPair=!avoidPrevPair; renderSide();"></button>
          <span class="text-sm font-bold text-slate-700">직전 짝 피하기</span>
        </label>
      </div>
    </div>

    <!-- ── 배치 역사 기록 카드 ── -->
    <div class="settings-card">
      <div class="settings-card-title">💾 배치 역사 기록</div>
      <button onclick="saveCurrentLayout()"
        class="w-full py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg font-bold text-sm shadow mb-3 transition">
        📂 현재 배치 결과 저장하기
      </button>
      <div id="layoutHistoryList" class="flex flex-col gap-1 max-h-40 overflow-y-auto">
        ${renderHistoryList()}
      </div>
    </div>

    <!-- ── 비밀번호 변경 카드 ── -->
    <div class="settings-card">
      <div class="settings-card-title">🔐 비밀번호 변경</div>
      <input type="password" id="pwCurrent" class="pw-input" placeholder="현재 비밀번호 (4자리)" maxlength="4">
      <input type="password" id="pwNew"     class="pw-input" placeholder="새 비밀번호 (4자리)"   maxlength="4">
      <input type="password" id="pwConfirm" class="pw-input" placeholder="새 비밀번호 확인"        maxlength="4">
      <button onclick="changePassword()"
        class="w-full py-2 bg-indigo-400 hover:bg-indigo-500 text-white rounded-lg font-bold text-sm shadow mt-1 transition">
        🔑 비밀번호 변경
      </button>
      <p class="text-xs text-slate-400 mt-1">숫자 4자리만 허용됩니다.</p>
    </div>

    <!-- ── 전체 초기화 카드 ── -->
    <div class="settings-card" style="border-color:#fecaca;">
      <div class="settings-card-title" style="color:#dc2626;">⚠️ 데이터 초기화</div>
      <p class="text-xs text-slate-500 mb-3">모든 명단, 배치, 설정을 삭제합니다. 되돌릴 수 없습니다.</p>
      <button onclick="clearAllData()"
        class="w-full py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold text-xs shadow-md transition tracking-wider">
        ⚠️ 전체 데이터 초기화
      </button>
    </div>`;
}

/* [5번] 비밀번호 변경 */
function changePassword() {
  const current = document.getElementById('pwCurrent')?.value || '';
  const newPw   = document.getElementById('pwNew')?.value     || '';
  const confirm = document.getElementById('pwConfirm')?.value || '';

  if (current !== getSavedPassword()) {
    alert('현재 비밀번호가 올바르지 않습니다.');
    return;
  }
  if (!/^\d{4}$/.test(newPw)) {
    alert('새 비밀번호는 숫자 4자리만 입력해주세요.');
    return;
  }
  if (newPw !== confirm) {
    alert('새 비밀번호와 확인이 일치하지 않습니다.');
    return;
  }
  savePassword(newPw);
  alert('비밀번호가 변경되었습니다.');
  renderSide();
}

function activateFixMode() {
  const si = document.getElementById('fixStudent').value;
  if (si === '') {
    fixModeActive = false;
    fixModeStudentIdx = null;
    document.getElementById('fixModeStatus').style.display = 'none';
    renderGrid();
    return;
  }
  fixModeActive = true;
  fixModeStudentIdx = parseInt(si);
  document.getElementById('fixModeStatus').style.display = 'block';
  renderGrid();
}

function removeFix(si) { delete fixedSeats[si]; saveSettingsToStorage(); renderSide(); renderGrid(); }

function addBan() {
  const a = parseInt(document.getElementById('banA').value);
  const b = parseInt(document.getElementById('banB').value);
  if (!isNaN(a) && !isNaN(b) && a !== b) banned.push([a, b]);
  saveSettingsToStorage();
  renderSide();
}

function removeBan(i) { banned.splice(i, 1); saveSettingsToStorage(); renderSide(); }

function saveCurrentLayout() {
  if (currentSeats.every(s => s === null)) {
    alert('배치된 자리가 없어 저장할 수 없습니다.');
    return;
  }
  const now = new Date();
  const date = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
  savedLayouts.unshift({
    id: Date.now(), date,
    seats: [...currentSeats],
    gridEnabled: [...gridEnabled],
    groups: JSON.parse(JSON.stringify(groups)),
    fixedSeats: JSON.parse(JSON.stringify(fixedSeats)),
    banned: [...banned]
  });
  localStorage.setItem('seat_layouts', JSON.stringify(savedLayouts));
  renderSide();
}

function renderHistoryList() {
  if (!savedLayouts || savedLayouts.length === 0) {
    return '<span class="text-xs text-slate-400 text-center py-2">저장된 기록이 없습니다.</span>';
  }
  return savedLayouts.map(l => `
    <div class="flex items-center justify-between border rounded p-1.5 bg-slate-50 hover:bg-slate-100 transition text-xs">
      <button onclick="loadLayout(${l.id})" class="text-left font-medium text-slate-700 flex-1 truncate mr-2">📅 ${l.date}</button>
      <button onclick="deleteLayout(${l.id}, event)" class="text-rose-400 hover:text-rose-600 font-bold px-1">✕</button>
    </div>`).join('');
}

function loadLayout(id) {
  const t = savedLayouts.find(l => l.id === id);
  if (!t) return;
  if (confirm(`${t.date}의 배치로 복원하시겠습니까?`)) {
    previousSeats = [...currentSeats];
    currentSeats  = [...t.seats];
    gridEnabled   = [...t.gridEnabled];
    groups        = JSON.parse(JSON.stringify(t.groups));
    fixedSeats    = JSON.parse(JSON.stringify(t.fixedSeats));
    banned        = [...t.banned];
    saveSettingsToStorage();
    resetPickerEffects();
  }
}

function deleteLayout(id, event) {
  event.stopPropagation();
  if (confirm('삭제하시겠습니까?')) {
    savedLayouts = savedLayouts.filter(l => l.id !== id);
    localStorage.setItem('seat_layouts', JSON.stringify(savedLayouts));
    renderSide();
  }
}

function clearAllData() {
  if (confirm('스토리지에 저장된 모든 데이터를 삭제하고 초기화하시겠습니까?')) {
    localStorage.clear();
    location.reload();
  }
}

/* ══════════════════════════════════
   뽑기 메뉴 탭
══════════════════════════════════ */
function renderPickerMenu(c) {
  const maleCount   = students.filter(s => s && s.gender === 'M').length;
  const femaleCount = students.filter(s => s && s.gender === 'F').length;

  /* [2번] 현재 가용 학생 수 계산 */
  let currentAvailableCount = students.length;
  if (excludePickedEnabled) {
    const activeNames = currentSeats.filter(Boolean).map(s => s.name);
    const available   = activeNames.filter(n => !historyPickedNames.includes(n) &&
      !pickedSeatIndexes.some(idx => currentSeats[idx]?.name === n));
    currentAvailableCount = available.length;
  }

  c.innerHTML = `
    <div class="flex flex-col gap-4">

      <!-- 뽑힌 사람 제외 옵션 -->
      <div class="p-3 bg-amber-50 rounded-xl border border-amber-200 shadow-sm flex flex-col gap-2">
        <label class="flex items-center justify-between cursor-pointer">
          <span class="text-sm font-bold text-slate-700">🔄 뽑힌 사람 추첨 제외</span>
          <button class="toggle-switch ${excludePickedEnabled ? 'active' : ''}"
            onclick="excludePickedEnabled=!excludePickedEnabled; renderSide();"></button>
        </label>
        <div class="text-[11px] text-slate-500 font-medium">
          현재 추첨 대상 학생 수: <span class="text-indigo-600 font-bold">${currentAvailableCount}</span>명
        </div>
        <button onclick="resetPickerEffects()"
          class="w-full mt-1 py-1.5 bg-rose-400 hover:bg-rose-500 text-white rounded-lg text-xs font-bold shadow transition">
          ❌ 뽑기 효과 초기화
        </button>
      </div>

      <!-- 학급 전체 뽑기 -->
      <div class="p-3 bg-slate-50 rounded-xl border border-slate-200 shadow-sm">
        <h4 class="font-bold text-sm text-slate-800 mb-2">🌐 학급 전체에서 뽑기</h4>
        <div class="flex items-center gap-2">
          <input type="number" id="pickAllCount"
            value="${lastPickAllCount}" min="1" max="40"
            class="w-16 border rounded p-1 text-center font-bold">
          <span class="text-xs font-medium text-slate-600">명 무작위 추첨</span>
          <button onclick="pickFromAll()"
            class="ml-auto px-3 py-1.5 bg-amber-400 hover:bg-amber-500 text-white font-bold text-xs rounded-lg shadow transition">
            뽑기
          </button>
        </div>
      </div>

      <!-- 모둠별 뽑기 -->
      <div class="p-3 bg-slate-50 rounded-xl border border-slate-200 shadow-sm">
        <h4 class="font-bold text-sm text-slate-800 mb-1">👥 각 모둠별로 뽑기</h4>
        <p class="text-[11px] text-slate-400 mb-2">현재 설정된 모든 모둠에서 균등하게 개별 추첨합니다.</p>
        <div class="flex items-center gap-2">
          <input type="number" id="pickGroupCount"
            value="${lastPickGroupCount}" min="1" max="5"
            class="w-16 border rounded p-1 text-center font-bold">
          <span class="text-xs font-medium text-slate-600">명씩 각각 추첨</span>
          <button onclick="pickFromGroups()"
            class="ml-auto px-3 py-1.5 bg-violet-400 hover:bg-violet-500 text-white font-bold text-xs rounded-lg shadow transition">
            뽑기
          </button>
        </div>
      </div>

      <!-- 성별 뽑기 -->
      <div class="p-3 bg-slate-50 rounded-xl border border-slate-200 shadow-sm">
        <h4 class="font-bold text-sm text-slate-800 mb-2">🚻 특정 성별에서 뽑기</h4>
        <div class="flex flex-col gap-2">
          <div class="flex items-center justify-between text-xs font-medium text-slate-600">
            <label>🔵 남학생 중에서</label>
            <div class="flex items-center gap-1">
              <input type="number" id="pickMaleCount"
                value="${lastPickMaleCount}" min="0" max="${maleCount}"
                class="w-12 border rounded p-0.5 text-center font-bold">
              <span>명</span>
            </div>
          </div>
          <div class="flex items-center justify-between text-xs font-medium text-slate-600">
            <label>🔴 여학생 중에서</label>
            <div class="flex items-center gap-1">
              <input type="number" id="pickFemaleCount"
                value="${lastPickFemaleCount}" min="0" max="${femaleCount}"
                class="w-12 border rounded p-0.5 text-center font-bold">
              <span>명</span>
            </div>
          </div>
          <button onclick="pickFromGender()"
            class="w-full mt-1 py-1.5 bg-sky-400 hover:bg-sky-500 text-white font-bold text-xs rounded-lg shadow transition">
            성별 조건으로 뽑기
          </button>
        </div>
      </div>

    </div>`;
}

/* ══════════════════════════════════
   뽑기 핵심 로직
══════════════════════════════════ */
function resetPickerEffects() {
  pickedSeatIndexes  = [];
  historyPickedNames = [];
  renderGrid();
  renderSide();
}

function highlightPickedSeats(pickedNames) {
  if (!pickedNames || pickedNames.length === 0) {
    alert('조건에 부합하는 대상 학생이 없습니다.');
    return;
  }
  /* 현재 회차 → 누적 이관 */
  const prevNames = pickedSeatIndexes.map(idx => currentSeats[idx]?.name).filter(Boolean);
  prevNames.forEach(n => { if (!historyPickedNames.includes(n)) historyPickedNames.push(n); });

  /* 새 회차 세팅 */
  pickedSeatIndexes = [];
  pickedNames.forEach(name => {
    for (let i = 0; i < 40; i++) {
      if (currentSeats[i] && currentSeats[i].name === name) pickedSeatIndexes.push(i);
    }
  });

  renderGrid();
  renderSide();
  confetti({ particleCount: 40, spread: 60, origin: { y: 0.6 } });
}

/* [2번] 필터링 풀 — 이미 뽑힌 학생 제외 */
function getFilteredPool(sourceArray) {
  if (!excludePickedEnabled) return [...sourceArray];
  const excluded = new Set(historyPickedNames);
  pickedSeatIndexes.forEach(idx => {
    if (currentSeats[idx]?.name) excluded.add(currentSeats[idx].name);
  });
  return sourceArray.filter(n => !excluded.has(n));
}

function pickFromAll() {
  const activeNames = currentSeats.filter(Boolean).map(s => s.name);
  if (activeNames.length === 0) return alert('배치된 명단이 없습니다. 자리 바꾸기를 먼저 해주세요.');

  /* [1번] 인원 수 저장 후 읽기 */
  lastPickAllCount = parseInt(document.getElementById('pickAllCount').value) || 1;
  const count = lastPickAllCount;
  if (count <= 0) return;

  let pool = getFilteredPool(activeNames);
  if (pool.length === 0) return alert('추첨 가능한 모든 학생이 이미 발표했습니다.');
  shuffle(pool);
  highlightPickedSeats(pool.slice(0, Math.min(count, pool.length)));
}

function pickFromGroups() {
  if (!groups || groups.count === 0) return alert('모둠이 설정되어 있지 않습니다.');

  lastPickGroupCount = parseInt(document.getElementById('pickGroupCount').value) || 1;
  const count = lastPickGroupCount;
  if (count <= 0) return;

  let groupMap = {};
  for (let i = 1; i <= groups.count; i++) groupMap[i] = [];
  for (let i = 0; i < 40; i++) {
    if (groups.assignments[i] > 0 && currentSeats[i]) {
      groupMap[groups.assignments[i]].push(currentSeats[i].name);
    }
  }

  let finalPicked = [];
  let hasAvailable = false;
  for (let gNum = 1; gNum <= groups.count; gNum++) {
    let pool = getFilteredPool(groupMap[gNum] || []);
    if (pool.length > 0) {
      hasAvailable = true;
      shuffle(pool);
      finalPicked = finalPicked.concat(pool.slice(0, Math.min(count, pool.length)));
    }
  }
  if (!hasAvailable) return alert('추첨 가능한 모든 모둠원이 이미 발표했습니다.');
  highlightPickedSeats(finalPicked);
}

function pickFromGender() {
  const activeStudents = currentSeats.filter(Boolean);
  if (activeStudents.length === 0) return alert('배치된 명단이 없습니다. 자리 바꾸기를 먼저 해주세요.');

  lastPickMaleCount   = parseInt(document.getElementById('pickMaleCount').value)   || 0;
  lastPickFemaleCount = parseInt(document.getElementById('pickFemaleCount').value) || 0;
  const mCount = lastPickMaleCount;
  const fCount = lastPickFemaleCount;

  let males   = getFilteredPool(activeStudents.filter(s => s.gender === 'M').map(s => s.name));
  let females = getFilteredPool(activeStudents.filter(s => s.gender === 'F').map(s => s.name));

  if (males.length   === 0 && mCount > 0) alert('남학생 중 추첨 가능한 인원이 없습니다.');
  if (females.length === 0 && fCount > 0) alert('여학생 중 추첨 가능한 인원이 없습니다.');

  shuffle(males);
  shuffle(females);
  const finalPicked = [
    ...males.slice(0,   Math.min(mCount, males.length)),
    ...females.slice(0, Math.min(fCount, females.length))
  ];
  highlightPickedSeats(finalPicked);
}

/* ══════════════════════════════════
   초기화
══════════════════════════════════ */
window.addEventListener('DOMContentLoaded', () => {
  loadFromStorage();
  renderGrid();
  showTab('roster');
});
