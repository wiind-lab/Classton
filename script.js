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
let currentTab  = 'roster';
let currentMode = 'list';   /* [v6-G] 'list' | 'draw' */

/* [v6-G] 방문자 카운트 */
(function(){
  try {
    const key = 'seat_visitor_count';
    const c = parseInt(localStorage.getItem(key) || '0') + 1;
    localStorage.setItem(key, c);
  } catch(e) {}
})();
let savedLayouts = [];

/* ─── [6-A] 성별 배치 상태 ─── */
let genderPanelOpen   = false;     // 확장 패널 열림 여부
let genderZoneMode    = false;     // 남여 자리지정 모드 ON/OFF
let genderZones       = Array(40).fill('');  // '' | 'M' | 'F' — 각 셀의 성별존
let genderBrush       = 'M';       // 현재 선택된 브러시: 'M' | 'F' | ''(지우개)
let sameGenderOn      = false;     // 같은 성별끼리 앉기 ON/OFF
let _groupViewBeforeZone = null;   // [6-B.1] 성별존 진입 직전 groupViewOn 상태 저장

/* ─── 뽑기 상태 ─── */
let pickedSeatIndexes = [];
let historyPickedNames = [];
let excludePickedEnabled = true;

/* ─── [1번 수정] 뽑기 인원 수 유지용 변수 ─── */
let lastPickAllCount = 1;
let lastPickGroupCount = 1;
let lastPickMaleCount = 0;
let lastPickFemaleCount = 0;
let lastPickGroupSize = 2;  /* [6-E] 한번에 다 뽑기 — 그룹 크기 */

/* ─── UI 상태 ─── */
let isDragging = false;
let startCellState = null;
let fixModeActive = false;
let fixModeStudentIdx = null;
let groupViewOn = true; // [6번] 모둠보기 상태

/* ─── [13번] 다했어요 (개인) 상태 ─── */
let dahaesseoMode = false;      // 개인 다했어요 모드 ON/OFF
let dahaesseoSet  = new Set();  // 완료된 학생 이름 Set

/* ─── [14번] 다했어요 (모둠) 상태 ─── */
let dahaesseoGroupMode    = false;    // 모둠 다했어요 모드 ON/OFF
let dahaesseoGroupDoneSet = new Set(); // 완료된 모둠 번호(1~8) Set

/* ─── [21~29] 다했어요 히스토리 상태 ───
   dahaesseoCompletionOrder : 개인 모드 — 완료된 이름 순서 배열 (클릭 순서대로 push)
   dahaesseoGroupOrder      : 모둠 모드 — 완료된 모둠 번호 순서 배열
   dahaesseoHistories       : localStorage에서 로드된 히스토리 전체 배열
*/
let dahaesseoCompletionOrder = []; // ['홍길동', '김철수', ...]
let dahaesseoGroupOrder      = []; // [2, 1, 3, ...]  모둠 번호 순서
let dahaesseoHistories       = []; // 저장된 기록 전체

/* ─── 상수 ─── */
const groupColors = [
  '#93c5fd', '#f8a5d8', '#fde68a', '#c084fc',
  '#86efac', '#fca5a5', '#fed7aa', '#e9d5ff'
];
const DEFAULT_PASSWORD = '1234';

/* ─── [5차] 1인1역 상태 ───
   roleRows        : 역할 배정 표 행 배열
                     { id, roleName, count, assignedNames[] }
   roleDragSource  : 현재 드래그 중인 항목 정보 { type:'preset'|'student', value }
   roleViewOn      : 기본 화면 역할 표시 ON/OFF (localStorage 저장)
*/
let roleRows       = [];          // 역할 배정 표
let roleDragSource = null;        // 드래그 출처
let roleViewOn     = true;        // [5차-B] 역할 표시 여부

const ROLE_PRESETS = [
  '칠판','우유','분리수거','정리정돈','교실쓸기','교실닦기',
  '복도쓸기','복도닦기','책상줄','줄서기','시간관리','안내장','체육'
];  /* [5차-D] 목록 교체 — 직접입력은 별도 타일로 표시 */
const ROLE_SUFFIXES = ['부장','도우미','담당','']; // 마지막=접미사없음

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
          /* [5차] role 필드 추가 — 없으면 빈 문자열 */
          return { name: x.name || '무명', milk: !!x.milk, gender: x.gender || 'M', role: x.role || '' };
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
  /* [21] 다했어요 히스토리 로드 */
  try { const h = localStorage.getItem('seat_daha_histories'); if (h) dahaesseoHistories = JSON.parse(h) || []; } catch(e) {}
  /* [5차] 1인1역 행 로드 */
  try { const r = localStorage.getItem('seat_role_rows'); if (r) roleRows = JSON.parse(r) || []; } catch(e) {}
  /* [5차-B] 역할 표시 ON/OFF 로드 */
  try { const rv = localStorage.getItem('seat_role_view_on'); if (rv !== null) roleViewOn = JSON.parse(rv); } catch(e) {}
  /* [6-A] 성별존 / 같은성별앉기 로드 */
  try { const gz = localStorage.getItem('seat_gender_zones'); if (gz) { const p = JSON.parse(gz); if (Array.isArray(p) && p.length === 40) genderZones = p; } } catch(e) {}
  try { const sg = localStorage.getItem('seat_same_gender'); if (sg !== null) sameGenderOn = JSON.parse(sg); } catch(e) {}
}

function saveStudentsToStorage() {
  localStorage.setItem('seat_students', JSON.stringify(students));
}
function saveSettingsToStorage() {
  localStorage.setItem('seat_grid_enabled', JSON.stringify(gridEnabled));
  localStorage.setItem('seat_groups', JSON.stringify(groups));
  localStorage.setItem('seat_fixed_seats', JSON.stringify(fixedSeats));
  localStorage.setItem('seat_banned', JSON.stringify(banned));
  /* [6-A] 성별존 저장 */
  localStorage.setItem('seat_gender_zones', JSON.stringify(genderZones));
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
    const seat            = currentSeats[i];
    const isCurrentPicked = pickedSeatIndexes.includes(i);
    const isPreviousPicked = !isCurrentPicked &&
      seat && historyPickedNames.includes(seat.name);

    /* [13번] 개인 다했어요 */
    const inDahaesseo     = dahaesseoMode && seat;
    const isDahaesseoDone = inDahaesseo && dahaesseoSet.has(seat.name);

    /* [14번] 모둠 다했어요 */
    const cellGroupNum        = (groups && groups.assignments) ? groups.assignments[i] : 0;
    const inDahaesseoGroup    = dahaesseoGroupMode && seat && cellGroupNum > 0;
    const isDahaesseoGroupDone = inDahaesseoGroup && dahaesseoGroupDoneSet.has(cellGroupNum);

    const cell = document.createElement('div');

    /* ── 셀 클래스 결정 (우선순위: 다했어요 > 뽑기 > 기본) ── */
    let cls = 'grid-cell relative flex flex-col items-center justify-center rounded-lg border-2 cursor-pointer transition-all ';

    if (inDahaesseoGroup) {
      cls += isDahaesseoGroupDone ? 'dahaesseo-group-done' : 'dahaesseo-group-pending';
    } else if (inDahaesseo) {
      cls += isDahaesseoDone ? 'dahaesseo-done' : 'dahaesseo-pending';
    } else if (isCurrentPicked) {
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

    /* ── [6번 수정] 모둠 테두리: groupViewOn이 true이고 다했어요·뽑기 강조 없을 때만 적용 ──
       CSS body.group-view-off 방식 폐기 → JS 렌더 레벨에서 완전 차단 */
    const showGroupStyle = groupViewOn
      && !inDahaesseo
      && !inDahaesseoGroup
      && !isCurrentPicked
      && !isPreviousPicked
      && cellGroupNum > 0;

    if (showGroupStyle) {
      cell.style.borderColor = groupColors[(cellGroupNum - 1) % 8];
      cell.style.borderWidth = '3px';
    }

    /* [6-A] 성별존 테두리 — 다했어요·뽑기·모둠 강조 없을 때만, genderZoneMode OR sameGenderOn 시 표시 */
    const cellGenderZone = genderZones[i];
    const showGenderZone = cellGenderZone
      && !inDahaesseo
      && !inDahaesseoGroup
      && !isCurrentPicked
      && !isPreviousPicked
      && !showGroupStyle;  /* 모둠 강조 시 성별존 테두리 숨김 */

    if (showGenderZone) {
      cell.style.borderColor = cellGenderZone === 'M' ? '#3b82f6' : '#ec4899';
      cell.style.borderWidth = '3px';
    }

    /* 학생 이름 */
    if (seat) {
      const s = seat;
      const inner = document.createElement('div');
      inner.className = 'flex items-center gap-1 z-20';
      const dotColor = s.gender === 'F' ? 'bg-pink-400' : 'bg-blue-400';

      /* 텍스트 색상 결정 */
      let textCls = 'student-name text-lg font-bold text-slate-800';
      if (inDahaesseoGroup) {
        textCls = isDahaesseoGroupDone
          ? 'student-name text-lg font-black text-green-900'
          : 'student-name text-lg font-bold text-yellow-900';
      } else if (inDahaesseo) {
        textCls = isDahaesseoDone
          ? 'student-name text-lg font-black text-green-900'
          : 'student-name text-lg font-bold text-yellow-900';
      } else if (isCurrentPicked) {
        textCls = 'student-name text-xl font-black text-white';
      } else if (isPreviousPicked) {
        textCls = 'student-name text-lg font-bold text-slate-500';
      }

      /* 다했어요 모드에서는 성별점·우유 아이콘 생략 (깔끔하게) */
      const showDot  = !isCurrentPicked && !isPreviousPicked && !inDahaesseo && !inDahaesseoGroup;
      const showMilk = s.milk && !inDahaesseo && !inDahaesseoGroup;

      inner.innerHTML = `
        <span class="${textCls} whitespace-nowrap">${s.name}</span>
        ${showDot  ? `<span class="w-1.5 h-1.5 rounded-full ${dotColor}"></span>` : ''}
        ${showMilk ? `<span class="milk-icon-wrap">${milkSVG(isCurrentPicked, isPreviousPicked)}</span>` : ''}`;

      /* 다했어요 완료 체크 아이콘 */
      if ((inDahaesseo && isDahaesseoDone) || (inDahaesseoGroup && isDahaesseoGroupDone)) {
        inner.innerHTML += `<span class="text-green-600 font-black text-sm ml-0.5">✓</span>`;
      }

      cell.appendChild(inner);

      /* [5차-B] 역할 표시 — roleViewOn ON이고, 다했어요·뽑기 모드 아닐 때만 */
      const showRole = roleViewOn
        && s.role
        && !inDahaesseo
        && !inDahaesseoGroup
        && !isCurrentPicked
        && !isPreviousPicked;

      if (showRole) {
        const roleEl = document.createElement('span');
        roleEl.className = 'seat-role-label';
        roleEl.textContent = s.role;
        cell.appendChild(roleEl);
      }
    }

    /* ── [6번 수정] 모둠 번호 라벨: showGroupStyle 동일 조건 ── */
    if (showGroupStyle) {
      const gn = document.createElement('span');
      gn.className = 'absolute top-0 left-1 text-xs font-bold opacity-60 z-20 group-number-label';
      gn.textContent = `${cellGroupNum}모둠`;
      cell.appendChild(gn);
    }

    /* [14번] 모둠 다했어요 모드: groupViewOn 무관하게 모둠 번호 라벨 강제 표시 */
    if (inDahaesseoGroup) {
      const gn = document.createElement('span');
      gn.className = 'absolute top-0 left-1 text-xs font-bold opacity-70 z-20';
      gn.style.color = isDahaesseoGroupDone ? '#16a34a' : '#92400e';
      gn.textContent = `${cellGroupNum}모둠`;
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

  /* [13번] 개인 다했어요 모드 — 학생 클릭 시 완료 토글 */
  if (dahaesseoMode) {
    const seat = currentSeats[i];
    if (!seat) return;
    if (dahaesseoSet.has(seat.name)) {
      dahaesseoSet.delete(seat.name);
      /* [23] 완료 취소 시 순서 배열에서도 제거 */
      dahaesseoCompletionOrder = dahaesseoCompletionOrder.filter(n => n !== seat.name);
    } else {
      dahaesseoSet.add(seat.name);
      /* [23] 완료 시 순서 배열에 추가 */
      dahaesseoCompletionOrder.push(seat.name);
    }
    renderGrid();
    checkDahaesseoAllDone();
    return;
  }

  /* [14번] 모둠 다했어요 모드 — 클릭 시 해당 모둠 전체 완료 토글 */
  if (dahaesseoGroupMode) {
    const seat     = currentSeats[i];
    if (!seat) return;
    const groupNum = (groups && groups.assignments) ? groups.assignments[i] : 0;
    if (!groupNum) return;
    if (dahaesseoGroupDoneSet.has(groupNum)) {
      dahaesseoGroupDoneSet.delete(groupNum);
      /* [29] 완료 취소 시 순서 배열에서도 제거 */
      dahaesseoGroupOrder = dahaesseoGroupOrder.filter(n => n !== groupNum);
    } else {
      dahaesseoGroupDoneSet.add(groupNum);
      /* [29] 완료 시 순서 배열에 추가 */
      dahaesseoGroupOrder.push(groupNum);
    }
    renderGrid();
    checkDahaesseoGroupAllDone();
    return;
  }

  /* [6-A] 성별 자리 지정 모드 */
  if (genderZoneMode) {
    if (!gridEnabled[i]) return; // 비활성 자리는 무시
    if (genderBrush === '') {
      // 지우개: 기존 지정 해제
      genderZones[i] = '';
    } else {
      // 이미 같은 브러시로 지정된 경우 → 해제(토글)
      genderZones[i] = genderZones[i] === genderBrush ? '' : genderBrush;
    }
    saveSettingsToStorage();
    _renderGenderZoneBar();
    renderGrid();
    return;
  }

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
  /* [6-A] 성별 지정 모드 드래그 페인팅 */
  if (genderZoneMode && isDragging) {
    if (!gridEnabled[i]) return;
    genderZones[i] = genderBrush === '' ? '' : genderBrush;
    renderGrid();
    return;
  }
  if (!isDragging || fixModeActive || dahaesseoMode || dahaesseoGroupMode) return;
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

  /* [6-A] 성별 초과 경고 — 초과 시 셔플 차단 */
  const mStudents = students.filter(s => s.gender === 'M').length;
  const fStudents = students.filter(s => s.gender === 'F').length;
  const mZones    = genderZones.filter((z, i) => z === 'M' && gridEnabled[i]).length;
  const fZones    = genderZones.filter((z, i) => z === 'F' && gridEnabled[i]).length;
  if (mZones > mStudents) {
    alert(`⚠️ 남학생 수보다 지정된 자리가 많습니다.\n남학생: ${mStudents}명 / 지정된 남학생 자리: ${mZones}칸`);
    return;
  }
  if (fZones > fStudents) {
    alert(`⚠️ 여학생 수보다 지정된 자리가 많습니다.\n여학생: ${fStudents}명 / 지정된 여학생 자리: ${fZones}칸`);
    return;
  }

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

  /* [6-A] 성별존 또는 같은성별앉기 활성 여부 */
  const hasGenderZones = genderZones.some((z, i) => z !== '' && gridEnabled[i]);
  const useGenderLogic = hasGenderZones || sameGenderOn;

  if (!useGenderLogic) {
    /* ── 기존 로직 완전 동일 (성별 기능 비활성 시) ── */
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
  } else {
    /* ── [6-A] 성별 배치 로직 ── */

    /* 성별존이 지정된 슬롯과 미지정 슬롯 분리 */
    const mZoneSlots = slots.filter(i => genderZones[i] === 'M');
    const fZoneSlots = slots.filter(i => genderZones[i] === 'F');
    const freeSlots  = slots.filter(i => genderZones[i] === '');

    /* pool에서 성별 분리 */
    let mPool = pool.filter(s => s.gender === 'M');
    let fPool = pool.filter(s => s.gender === 'F');

    /* 성별존 슬롯에 먼저 해당 성별 배치 */
    shuffle(mPool);
    shuffle(fPool);

    const tempSeats = [...currentSeats];

    /* 남학생존 → 남학생 배치 */
    for (let k = 0; k < mZoneSlots.length && k < mPool.length; k++) {
      tempSeats[mZoneSlots[k]] = mPool[k];
    }
    const mUsed = Math.min(mZoneSlots.length, mPool.length);

    /* 여학생존 → 여학생 배치 */
    for (let k = 0; k < fZoneSlots.length && k < fPool.length; k++) {
      tempSeats[fZoneSlots[k]] = fPool[k];
    }
    const fUsed = Math.min(fZoneSlots.length, fPool.length);

    /* 남은 학생: 존에 배치되지 않은 학생들 */
    let remainM = mPool.slice(mUsed);
    let remainF = fPool.slice(fUsed);
    let remainAll = [...remainM, ...remainF];

    /* 남은 슬롯 — 남은 학생 배치 (sameGenderOn이면 성별 묶음 정렬) */
    let remSlots = [...freeSlots];

    if (sameGenderOn && remainAll.length > 0 && remSlots.length > 0) {
      /* [6-C] 탐욕적 인접 배정 — fullPairs 중심 구조
         핵심 원리:
           슬롯을 사전 분류하지 않고 배정 시점에 인접 여부를 동적으로 판단.
           행 내 인접 슬롯이 있으면 fullPairs(동성 2인)를 즉시 배정,
           없으면 단독 slotm에 단일 학생 배정.
           → twoSlots/oneSlots 분류 폐기, surplus 구조 폐기.
         보장: achievable_maxPair = min(maxPair, 물리적인접쌍수) 를 항상 달성. */

      shuffle(remainM);
      shuffle(remainF);

      /* ── 1. fullPairs 생성 (동성 2인) + 홀수 잉여 처리 ── */
      const mFullPairs = [];
      for (let i = 0; i + 1 < remainM.length; i += 2) mFullPairs.push([remainM[i], remainM[i + 1]]);
      const mHalf = remainM.length % 2 === 1 ? [remainM[remainM.length - 1]] : [];

      const fFullPairs = [];
      for (let i = 0; i + 1 < remainF.length; i += 2) fFullPairs.push([remainF[i], remainF[i + 1]]);
      const fHalf = remainF.length % 2 === 1 ? [remainF[remainF.length - 1]] : [];

      const fullPairs = [...mFullPairs, ...fFullPairs];
      shuffle(fullPairs);                       // 페어 순서 랜덤화

      const singles = [...mHalf, ...fHalf];
      shuffle(singles);

      /* ── 2. 탐욕적 인접 배정 ──
              col%2===0 시작 인접쌍(짝꿍 카운트 기준)을 먼저 처리,
              남은 인접쌍을 이후 처리.
              배정 시점에 인접 여부를 동적으로 판단. */
      remSlots.sort((a, b) => a - b);
      const usedSlots = new Set();
      let fpIdx = 0;

      /* 1패스: col%2===0 시작 인접쌍 → fullPairs 우선 배정 (동성짝 카운트 직접 기여) */
      for (let i = 0; i < remSlots.length; i++) {
        const cur  = remSlots[i];
        if (usedSlots.has(cur)) continue;
        const col  = cur % 8;
        const next = remSlots[i + 1];
        const isColPairAdj = col % 2 === 0
          && next !== undefined
          && next === cur + 1
          && Math.floor(cur / 8) === Math.floor(next / 8);

        if (isColPairAdj && fpIdx < fullPairs.length) {
          tempSeats[cur]  = fullPairs[fpIdx][0];
          tempSeats[next] = fullPairs[fpIdx][1];
          fpIdx++;
          usedSlots.add(cur);
          usedSlots.add(next);
        }
      }

      /* 2패스: 남은 fullPairs → 나머지 행내 인접쌍에 배정 */
      for (let i = 0; i < remSlots.length; i++) {
        const cur  = remSlots[i];
        if (usedSlots.has(cur)) continue;
        const next = remSlots[i + 1];
        const isAdjacent = next !== undefined
          && next === cur + 1
          && Math.floor(cur / 8) === Math.floor(next / 8)
          && !usedSlots.has(next); // next가 이미 배정된 자리면 건너뜀

        if (isAdjacent && fpIdx < fullPairs.length) {
          tempSeats[cur]  = fullPairs[fpIdx][0];
          tempSeats[next] = fullPairs[fpIdx][1];
          fpIdx++;
          usedSlots.add(cur);
          usedSlots.add(next);
        }
      }

      /* 3패스: 나머지 슬롯 → 남은 fullPairs.flat() + singles 배정 */
      const rest = [...fullPairs.slice(fpIdx).flat(), ...singles];
      shuffle(rest);
      let ri = 0;
      for (let i = 0; i < remSlots.length; i++) {
        const s = remSlots[i];
        if (!usedSlots.has(s) && ri < rest.length) {
          tempSeats[s] = rest[ri++];
        }
      }

    } else {
      shuffle(remainAll);
      for (let k = 0; k < remSlots.length && k < remainAll.length; k++) {
        tempSeats[remSlots[k]] = remainAll[k];
      }
    }

    /* 짝꿍방지·직전짝 검증 (30회 시도, 마지막 시도는 강제 적용) */
    let finalSeats = tempSeats;
    for (let attempt = 0; attempt < 30; attempt++) {
      let valid = true;
      for (let [a, b] of banned) {
        for (let i = 0; i < 40; i++) {
          if (!finalSeats[i]) continue;
          const col = i % 8;
          if (finalSeats[i] === students[a]) {
            if (col > 0 && finalSeats[i-1] === students[b]) valid = false;
            if (col < 7 && finalSeats[i+1] === students[b]) valid = false;
          }
        }
      }
      if (avoidPrevPair && valid) {
        for (let i = 0; i < 40; i++) {
          if (!finalSeats[i]) continue;
          const col = i % 8;
          if (col > 0 && finalSeats[i-1] && prevPairs.has(finalSeats[i].name + '|' + finalSeats[i-1].name)) valid = false;
          if (col < 7 && finalSeats[i+1] && prevPairs.has(finalSeats[i].name + '|' + finalSeats[i+1].name)) valid = false;
        }
      }
      if (valid || attempt === 29) break;
      /* 재시도: fullPairs 재셔플 후 col%2 우선 2패스 재배정 */
      shuffle(fullPairs);
      fpIdx = 0;
      for (const s of usedSlots) finalSeats[s] = null;
      usedSlots.clear();
      /* 1패스: col%2===0 우선 */
      for (let i = 0; i < remSlots.length; i++) {
        const cur = remSlots[i];
        if (usedSlots.has(cur)) continue;
        const col  = cur % 8;
        const next = remSlots[i + 1];
        const isColAdj = col % 2 === 0 && next !== undefined && next === cur + 1
          && Math.floor(cur / 8) === Math.floor(next / 8);
        if (isColAdj && fpIdx < fullPairs.length) {
          finalSeats[cur] = fullPairs[fpIdx][0]; finalSeats[next] = fullPairs[fpIdx][1];
          fpIdx++; usedSlots.add(cur); usedSlots.add(next);
        }
      }
      /* 2패스: 나머지 인접 */
      for (let i = 0; i < remSlots.length; i++) {
        const cur = remSlots[i];
        if (usedSlots.has(cur)) continue;
        const next = remSlots[i + 1];
        const isAdj = next !== undefined && next === cur + 1
          && Math.floor(cur / 8) === Math.floor(next / 8)
          && !usedSlots.has(next);
        if (isAdj && fpIdx < fullPairs.length) {
          finalSeats[cur] = fullPairs[fpIdx][0]; finalSeats[next] = fullPairs[fpIdx][1];
          fpIdx++; usedSlots.add(cur); usedSlots.add(next);
        }
      }
      /* 3패스: 나머지 */
      const rest2 = [...fullPairs.slice(fpIdx).flat(), ...singles];
      shuffle(rest2);
      let ri2 = 0;
      for (let i = 0; i < remSlots.length; i++) {
        const s = remSlots[i];
        if (!usedSlots.has(s) && ri2 < rest2.length) finalSeats[s] = rest2[ri2++];
      }
    }
    currentSeats = finalSeats;
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
  if (!confirm('현재 자리배치가 초기화됩니다. 실행하시겠습니까?')) return;
  currentSeats      = Array(40).fill(null);
  pickedSeatIndexes = [];
  /* [5차-D] gridEnabled는 초기화하지 않음 — 빈 자리 클릭·드래그 정상 유지 */
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
  /* [6-B] 모둠 탭이 아닌 탭으로 전환 시 activeGroup 초기화 — 타일 클릭 버그 방지 */
  if (tab !== 'group') {
    activeGroup = 0;
  }
  renderSide();
}

function toggleSidebar() {
  /* [v6-G] mode='list', toggle open/close */
  const sb = document.getElementById('sidebar');
  if (!sb) return;
  const hidden = sb.style.transform === 'translateX(100%)' || sb.style.transform === '';
  if (hidden) {
    sb.style.transform = 'translateX(0)';
    currentMode = 'list';
    showTab('roster');
  } else {
    if (currentMode === 'list') {
      sb.style.transform = 'translateX(100%)';  /* 같은 mode → close */
    } else {
      currentMode = 'list';                      /* draw→list 전환 */
      showTab('roster');
    }
  }
}

function openPickerTab() {
  /* [v6-G] mode='draw', toggle open/close */
  const sb = document.getElementById('sidebar');
  if (!sb) return;
  const hidden = sb.style.transform === 'translateX(100%)' || sb.style.transform === '';
  if (hidden) {
    sb.style.transform = 'translateX(0)';
    currentMode = 'draw';
    showTab('picker');
  } else {
    if (currentMode === 'draw') {
      sb.style.transform = 'translateX(100%)';  /* 같은 mode → close */
    } else {
      currentMode = 'draw';                      /* list→draw 전환 */
      showTab('picker');
    }
  }
}

/* [3번] 설정 탭 비밀번호 입력 */
function openSettingsWithPassword() {
  const pw    = getSavedPassword();
  const input = prompt('설정 메뉴 비밀번호 4자리를 입력하세요.');
  if (input === null) return;
  if (input === pw) {
    const sb = document.getElementById('sidebar');
    if (sb) sb.style.transform = 'translateX(0)';
    currentMode = 'list'; /* [v6-G] */
    showTab('settings');
  } else {
    alert('비밀번호가 올바르지 않습니다.');
  }
}

/* ══════════════════════════════════
   [6번] 모둠보기 ON/OFF
   — CSS body.group-view-off 방식 폐기
   — renderGrid() 안에서 groupViewOn 조건으로 직접 제어
══════════════════════════════════ */
function toggleGroupView() {
  groupViewOn = !groupViewOn;
  // body 클래스 방식은 테두리(인라인 스타일)를 못 막으므로 사용 안 함
  updateGroupViewButton();
  renderGrid();
}

function updateGroupViewButton() {
  /* [v8-A] groupViewSwitch DOM 제거됨 — 상태 영역 갱신만 유지 */
  _updateStatusBadges();
}

/* ══════════════════════════════════
   [5차-B] 1인1역 보기 ON/OFF
══════════════════════════════════ */
function toggleRoleView() {
  roleViewOn = !roleViewOn;
  localStorage.setItem('seat_role_view_on', JSON.stringify(roleViewOn));
  updateRoleViewButton();
  renderGrid();
}

function updateRoleViewButton() {
  /* [v8-A] roleViewSwitch DOM 제거됨 — 상태 영역 갱신만 유지 */
  _updateStatusBadges();
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
      const s = currentSeats[i];
      /* [5차-B] 프린트 역할 표시 */
      if (roleViewOn && s.role) {
        cell.innerHTML = `<span style="font-weight:800;">${s.name}</span><span style="font-size:9px;color:#6d28d9;margin-top:2px;">${s.role}</span>`;
        cell.style.flexDirection = 'column';
        cell.style.display = 'flex';
        cell.style.alignItems = 'center';
        cell.style.justifyContent = 'center';
      } else {
        cell.textContent = s.name;
      }
    }
    pg.appendChild(cell);
  }

  window.print();
}

/* ══════════════════════════════════
   [13번] 다했어요 (개인)
══════════════════════════════════ */
function toggleDahaesseo() {
  /* 14번 모드가 켜져 있으면 먼저 종료 */
  if (dahaesseoGroupMode) {
    dahaesseoGroupMode    = false;
    dahaesseoGroupDoneSet = new Set();
    dahaesseoGroupOrder   = [];
    updateDahaesseoGroupMainBtn();
    timerStop();
    hideTimerPanel();
  }
  dahaesseoMode = !dahaesseoMode;
  if (dahaesseoMode) {
    dahaesseoSet             = new Set();
    dahaesseoCompletionOrder = []; /* [21] 모드 시작 시 순서 초기화 */
    showTimerPanel();
  } else {
    timerStop();
    hideTimerPanel();
    dahaesseoCompletionOrder = []; /* 종료 시도 초기화 */
  }
  updateDahaesseoMainBtn();
  updateSaveHistoryBtn();
  renderGrid();
}

/* [2차 ■3] 개인 다했어요 메인 버튼 색/텍스트 업데이트 */
function updateDahaesseoMainBtn() {
  const btn = document.getElementById('btnDahaesseoMain');
  if (!btn) return;
  if (dahaesseoMode) {
    btn.classList.add('active-mode');
    btn.innerHTML = '🔴<br><span class="text-xs">다했어요 종료</span>';
  } else {
    btn.classList.remove('active-mode');
    btn.innerHTML = '✅<br><span class="text-xs">다했어요</span>';
  }
}

/* 더보기 메뉴에서 제거됐으므로 no-op 유지 */
function updateDahaesseoMenuBtn() {}

function checkDahaesseoAllDone() {
  const seated = currentSeats.filter(Boolean).map(s => s.name);
  if (seated.length === 0) return;
  if (seated.every(name => dahaesseoSet.has(name))) {
    document.getElementById('dahaesseoSubText').textContent = '모든 학생이 완료했습니다 👏';
    showDahaesseoOverlay();
  }
}

/* ══════════════════════════════════
   [14번] 다했어요 (모둠)
══════════════════════════════════ */
function toggleDahaesseoGroup() {
  /* 13번 모드가 켜져 있으면 먼저 종료 */
  if (dahaesseoMode) {
    dahaesseoMode            = false;
    dahaesseoSet             = new Set();
    dahaesseoCompletionOrder = [];
    updateDahaesseoMainBtn();
    timerStop();
    hideTimerPanel();
  }
  dahaesseoGroupMode = !dahaesseoGroupMode;
  if (dahaesseoGroupMode) {
    dahaesseoGroupDoneSet = new Set();
    dahaesseoGroupOrder   = []; /* [21] 모드 시작 시 순서 초기화 */
    showTimerPanel();
  } else {
    timerStop();
    hideTimerPanel();
    dahaesseoGroupOrder = [];
  }
  updateDahaesseoGroupMainBtn();
  updateSaveHistoryBtn();
  renderGrid();
}

/* [2차 ■3] 모둠 다했어요 메인 버튼 색/텍스트 업데이트 */
function updateDahaesseoGroupMainBtn() {
  const btn = document.getElementById('btnDahaesseoGroupMain');
  if (!btn) return;
  if (dahaesseoGroupMode) {
    btn.classList.add('active-mode');
    btn.innerHTML = '🔴<br><span class="text-xs">모둠 종료</span>';
  } else {
    btn.classList.remove('active-mode');
    btn.innerHTML = '👥<br><span class="text-xs">모둠완료</span>';
  }
}

/* 더보기 메뉴에서 제거됐으므로 no-op 유지 */
function updateDahaesseoGroupMenuBtn() {}

function checkDahaesseoGroupAllDone() {
  if (!groups || groups.count === 0) return;
  const activeGroups = new Set();
  for (let i = 0; i < 40; i++) {
    if (currentSeats[i] && groups.assignments && groups.assignments[i] > 0)
      activeGroups.add(groups.assignments[i]);
  }
  if (activeGroups.size === 0) return;
  if ([...activeGroups].every(gn => dahaesseoGroupDoneSet.has(gn))) {
    document.getElementById('dahaesseoSubText').textContent = '모든 모둠이 완료했습니다 👏';
    showDahaesseoOverlay();
  }
}

/* ── 오버레이 공통 ── */
function showDahaesseoOverlay() {
  const ov = document.getElementById('dahaesseoOverlay');
  if (!ov) return;
  ov.style.display = 'flex';
  const end = Date.now() + 2200;
  (function frame() {
    confetti({ particleCount: 7, angle: 60,  spread: 70, origin: { x: 0 }, colors: ['#22c55e','#86efac','#fde68a','#fff'] });
    confetti({ particleCount: 7, angle: 120, spread: 70, origin: { x: 1 }, colors: ['#22c55e','#86efac','#fde68a','#fff'] });
    if (Date.now() < end) requestAnimationFrame(frame);
  })();
}

function closeDahaesseoOverlay() {
  const ov = document.getElementById('dahaesseoOverlay');
  if (ov) ov.style.display = 'none';
}

/* ══════════════════════════════════
   [21~29] 다했어요 히스토리 시스템
══════════════════════════════════ */

/* [22] 기록하기 버튼 표시/숨김 업데이트 */
function updateSaveHistoryBtn() {
  const btn = document.getElementById('btnSaveHistory');
  if (!btn) return;
  const active = dahaesseoMode || dahaesseoGroupMode;
  btn.style.display = active ? 'flex' : 'none';
}

/* [23/27] 기록 저장 — 과제명 입력 포함 */
function saveHistory() {
  const isGroup = dahaesseoGroupMode;
  const isIndi  = dahaesseoMode;
  if (!isIndi && !isGroup) return;

  /* [27] 과제명 입력 */
  const title = (prompt('과제명을 입력하세요. (입력하지 않으면 "제목 없음")') || '').trim() || '제목 없음';

  /* [21] 저장 시각 */
  const now  = new Date();
  const date = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;

  /* [23] 완료 순서 저장
     개별 모드: dahaesseoCompletionOrder (이름 배열)
     모둠 모드: dahaesseoGroupOrder (모둠번호 배열) */
  const order = isGroup
    ? [...dahaesseoGroupOrder]
    : [...dahaesseoCompletionOrder];

  /* 아직 완료 안 된 항목도 뒤에 붙임 (부분 저장 지원) */
  if (isGroup) {
    const activeGroups = new Set();
    for (let i = 0; i < 40; i++) {
      if (currentSeats[i] && groups.assignments && groups.assignments[i] > 0)
        activeGroups.add(groups.assignments[i]);
    }
    activeGroups.forEach(gn => { if (!order.includes(gn)) order.push(gn); });
  } else {
    const seated = currentSeats.filter(Boolean).map(s => s.name);
    seated.forEach(name => { if (!order.includes(name)) order.push(name); });
  }

  const record = {
    id:    Date.now(),
    date,
    title,
    mode:  isGroup ? 'group' : 'individual',
    order  /* string[] (이름) 또는 number[] (모둠번호) */
  };

  dahaesseoHistories.unshift(record); /* 최신순 */
  localStorage.setItem('seat_daha_histories', JSON.stringify(dahaesseoHistories));
  alert(`"${title}" 기록이 저장되었습니다.`);

  /* 히스토리 탭이 열려있으면 즉시 갱신 */
  if (currentTab === 'history') renderSide();
}

/* [21] localStorage 저장 */
function saveDahaHistoriesToStorage() {
  localStorage.setItem('seat_daha_histories', JSON.stringify(dahaesseoHistories));
}

/* [26] 히스토리 탭 렌더링 */
function renderHistory(c) {
  if (dahaesseoHistories.length === 0) {
    c.innerHTML = `
      <div class="flex flex-col items-center justify-center h-40 text-slate-400 gap-2">
        <span class="text-3xl">📭</span>
        <span class="text-sm font-bold">저장된 기록이 없습니다</span>
        <span class="text-xs">다했어요 실행 후 기록하기 버튼을 눌러보세요</span>
      </div>`;
    return;
  }

  c.innerHTML = `
    <div class="flex flex-col gap-2">
      ${dahaesseoHistories.map(rec => `
        <div class="history-card" onclick="showHistoryDetail(${rec.id})">
          <div class="history-card-header">
            <span class="history-title">${rec.title}</span>
            <span class="history-mode-badge ${rec.mode === 'group' ? 'badge-group' : 'badge-indi'}">
              ${rec.mode === 'group' ? '모둠' : '개인'}
            </span>
          </div>
          <div class="history-date">${rec.date}</div>
          <div class="history-preview">
            ${rec.order.slice(0, 3).map((item, idx) =>
              `<span class="rank-chip">${idx+1}. ${rec.mode === 'group' ? item+'모둠' : item}</span>`
            ).join('')}${rec.order.length > 3 ? `<span class="text-slate-400 text-xs">+${rec.order.length - 3}명</span>` : ''}
          </div>
          <!-- [6-B] 목록 카드 삭제 버튼 — stopPropagation으로 카드 클릭과 충돌 방지 -->
          <div class="flex justify-end mt-1.5">
            <button
              onclick="event.stopPropagation(); deleteHistoryFromList(${rec.id})"
              class="history-card-del-btn" title="삭제">
              🗑️
            </button>
          </div>
        </div>
      `).join('')}
    </div>`;
}

/* [28] 기록 상세보기 */
function showHistoryDetail(id) {
  const rec = dahaesseoHistories.find(r => r.id === id);
  if (!rec) return;

  const c = document.getElementById('sideContent');
  if (!c) return;

  const isGroup = rec.mode === 'group';
  const listHTML = rec.order.map((item, idx) => `
    <div class="history-detail-row">
      <span class="detail-rank">${idx + 1}</span>
      <span class="detail-name">${isGroup ? item + '모둠' : item}</span>
      ${idx === 0 ? '<span class="detail-crown">🥇</span>' : idx === 1 ? '<span class="detail-crown">🥈</span>' : idx === 2 ? '<span class="detail-crown">🥉</span>' : ''}
    </div>`).join('');

  c.innerHTML = `
    <div class="flex flex-col gap-3">
      <!-- 뒤로가기 -->
      <button onclick="showTab('history')"
        class="flex items-center gap-1 text-indigo-500 font-bold text-sm hover:text-indigo-700 transition">
        ← 목록으로
      </button>

      <!-- 헤더 -->
      <div class="history-detail-header">
        <div class="flex items-center justify-between mb-1">
          <span class="text-lg font-black text-slate-800">${rec.title}</span>
          <span class="history-mode-badge ${isGroup ? 'badge-group' : 'badge-indi'}">
            ${isGroup ? '모둠' : '개인'}
          </span>
        </div>
        <div class="text-xs text-slate-400">${rec.date}</div>
      </div>

      <!-- 순위 목록 -->
      <div class="flex flex-col gap-1">
        ${listHTML}
      </div>

      <!-- 삭제 버튼 -->
      <button onclick="deleteHistory(${rec.id})"
        class="w-full mt-2 py-2 bg-rose-400 hover:bg-rose-500 text-white rounded-lg font-bold text-xs transition">
        🗑️ 이 기록 삭제
      </button>
    </div>`;
}

/* 기록 삭제 */
function deleteHistory(id) {
  if (!confirm('이 기록을 삭제하시겠습니까?')) return;
  dahaesseoHistories = dahaesseoHistories.filter(r => r.id !== id);
  saveDahaHistoriesToStorage();
  showTab('history');
}

/* [6-B] 목록 화면에서 바로 삭제 — 상세 진입 없이 목록 갱신 */
function deleteHistoryFromList(id) {
  if (!confirm('이 기록을 삭제하시겠습니까?')) return;
  dahaesseoHistories = dahaesseoHistories.filter(r => r.id !== id);
  saveDahaHistoriesToStorage();
  const c = document.getElementById('sideContent');
  if (c) renderHistory(c);
}

/* ══════════════════════════════════
   [5차] 1인1역 관리 시스템
══════════════════════════════════ */

/* ── 팝업 열기 ── */
function openRolePopup() {
  /* roleRows가 비어있으면 기본 빈 행 5개 제공 */
  if (roleRows.length === 0) {
    roleRows = Array.from({ length: 5 }, () => _newRoleRow());
  }
  _renderRolePopup();
  document.getElementById('rolePopupOverlay').style.display = 'flex';
}

/* ── 팝업 닫기 ── */
function closeRolePopup() {
  document.getElementById('rolePopupOverlay').style.display = 'none';
}

/* 새 역할 행 생성 헬퍼 */
function _newRoleRow() {
  return { id: Date.now() + Math.random(), roleName: '', count: 1, assignedNames: [] };
}

/* ── 현재 선택된 접미사 ── */
let _roleSuffix = '부장';

/* ── 팝업 전체 렌더링 ── */
function _renderRolePopup() {
  const pop = document.getElementById('rolePopupContent');
  if (!pop) return;

  /* 이미 배정된 학생 Set */
  const assigned = new Set(roleRows.flatMap(r => r.assignedNames));

  /* 접미사 버튼 라벨 */
  const suffixLabels = ['부장','도우미','담당','접미사 없음'];

  pop.innerHTML = `

    <!-- ── 역할 예시 섹션 ── -->
    <div class="role-section">
      <div class="role-section-title">역할 예시</div>

      <!-- 접미사 선택 버튼 -->
      <div class="flex gap-1 mb-2 flex-wrap">
        ${suffixLabels.map((lb, idx) => `
          <button onclick="_roleSuffix='${ROLE_SUFFIXES[idx]}'; _renderRolePopup();"
            class="role-suffix-btn ${_roleSuffix === ROLE_SUFFIXES[idx] ? 'active' : ''}">
            ${lb}
          </button>`).join('')}
      </div>

      <!-- 프리셋 타일 + 직접입력 -->
      <div class="role-preset-grid">
        ${ROLE_PRESETS.map(base => {
          const label = base + _roleSuffix;
          return `<div class="role-preset-tile"
            draggable="true"
            ondragstart="roleDragStart(event,'preset','${label}')"
            ondragend="roleDragEnd(event)"
            onclick="rolePresetClick('${label}')">
            ${label}
          </div>`;
        }).join('')}
        <!-- 직접입력 타일 -->
        <div class="role-preset-tile role-custom-tile"
          draggable="true"
          ondragstart="roleDragStart(event,'custom','')"
          ondragend="roleDragEnd(event)">
          ✏️ 직접입력
        </div>
      </div>
    </div>

    <!-- ── [2] 역할 배정 표 섹션 (명단보다 위로 이동) ── -->
    <div class="role-section">
      <div class="role-section-title" style="justify-content:space-between;">
        <span>역할 배정 표</span>
        <button onclick="roleRandomAssign()" class="role-random-btn">🎲 랜덤배치</button>
      </div>
      <table class="role-table">
        <thead>
          <tr>
            <th>역할</th>
            <th>인원</th>
            <th>배정된 학생</th>
            <th></th>
          </tr>
        </thead>
        <tbody id="roleTableBody">
          ${roleRows.map(row => _renderRoleRow(row, assigned)).join('')}
        </tbody>
      </table>
      <button onclick="addRoleRow()" class="role-add-row-btn">+ 역할 추가</button>

      <!-- 남은 인원 표시 -->
      <div class="role-remaining">
        남은 인원: <strong>${students.length - roleRows.reduce((sum, r) => sum + (parseInt(r.count) || 0), 0)}명</strong>
        <span class="text-slate-400 text-xs ml-1">(전체 ${students.length}명 / 배정 계획 ${roleRows.reduce((sum, r) => sum + (parseInt(r.count) || 0), 0)}명)</span>
      </div>
    </div>

    <!-- ── [2] 우리 반 명단 섹션 (배정표 아래로 이동) ── -->
    <div class="role-section">
      <div class="role-section-title">우리 반 명단</div>
      <div class="role-student-grid">
        ${students.map(s => `
          <div class="role-student-tile ${assigned.has(s.name) ? 'assigned' : ''}"
            draggable="${assigned.has(s.name) ? 'false' : 'true'}"
            ondragstart="roleDragStart(event,'student','${s.name}')"
            ondragend="roleDragEnd(event)">
            ${s.name}
          </div>`).join('')}
      </div>
    </div>
  `;
}

/* ── 역할 행 한 줄 HTML ── */
function _renderRoleRow(row, assigned) {
  /* 슬롯: count 개수만큼 생성 */
  const slots = Array.from({ length: row.count }, (_, si) => {
    const name = row.assignedNames[si] || '';
    return `<div class="role-slot ${name ? 'filled' : ''}"
      data-rowid="${row.id}" data-slot="${si}"
      ondragover="event.preventDefault()"
      ondrop="roleDropToSlot(event,'${row.id}',${si})"
      ondragstart="${name ? `roleDragStart(event,'student','${name}')` : 'void 0'}"
      draggable="${name ? 'true' : 'false'}">
      ${name
        ? `${name}<button class="slot-remove-btn" onclick="roleRemoveFromSlot('${row.id}',${si})">✕</button>`
        : '<span class="slot-placeholder">드래그</span>'}
    </div>`;
  }).join('');

  return `<tr data-rowid="${row.id}">
    <td>
      <div class="role-name-cell"
        ondragover="event.preventDefault()"
        ondrop="roleDropToName(event,'${row.id}')">
        ${row.roleName
          ? `<span class="role-name-badge">${row.roleName}</span>
             <button class="role-name-clear" onclick="roleClearName('${row.id}')">✕</button>`
          : '<span class="role-name-drop-hint">← 드래그</span>'}
      </div>
    </td>
    <td>
      <input type="number" value="${row.count}" min="1" max="10"
        class="role-count-input"
        onchange="roleChangeCount('${row.id}', this.value)">
    </td>
    <td><div class="role-slots-wrap">${slots}</div></td>
    <td>
      <button onclick="deleteRoleRow('${row.id}')" class="role-delete-row-btn" title="행 삭제">🗑</button>
    </td>
  </tr>`;
}

/* ── 행 추가 ── */
function addRoleRow() {
  roleRows.push(_newRoleRow());
  _renderRolePopup();
}

/* ── 행 삭제 ── */
function deleteRoleRow(rowId) {
  roleRows = roleRows.filter(r => String(r.id) !== String(rowId));
  _renderRolePopup();
}

/* ── 인원 수 변경 ── */
function roleChangeCount(rowId, val) {
  const row = roleRows.find(r => String(r.id) === String(rowId));
  if (!row) return;
  const newCount = Math.max(1, Math.min(10, parseInt(val) || 1));
  row.count = newCount;
  /* 슬롯이 줄면 초과분 이름 제거 */
  row.assignedNames = row.assignedNames.slice(0, newCount);
  _renderRolePopup();
}

/* ── 드래그 시작 ── */
function roleDragStart(e, type, value) {
  roleDragSource = { type, value };
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', value);
  setTimeout(() => e.target.classList.add('dragging'), 0);
}
function roleDragEnd(e) {
  e.target.classList.remove('dragging');
}

/* ── 역할 이름 칸에 드롭 ── */
function roleDropToName(e, rowId) {
  e.preventDefault();
  if (!roleDragSource) return;
  const { type, value } = roleDragSource;
  const row = roleRows.find(r => String(r.id) === String(rowId));
  if (!row) return;

  if (type === 'preset') {
    row.roleName = value;
    _renderRolePopup();
  } else if (type === 'custom') {
    /* 직접입력: 인라인 input으로 교체 */
    const cell = e.currentTarget;
    cell.innerHTML = `<input id="roleNameInput_${rowId}" type="text" value="${row.roleName}"
      class="role-name-input-inline" placeholder="역할 이름 입력"
      onkeydown="roleNameInputKeydown(event,'${rowId}')"
      onblur="roleNameInputCommit('${rowId}')">`;
    document.getElementById(`roleNameInput_${rowId}`)?.focus();
  }
  roleDragSource = null;
}

/* 직접입력 엔터/확정 */
function roleNameInputKeydown(e, rowId) {
  if (e.key === 'Enter') { e.preventDefault(); roleNameInputCommit(rowId); }
  if (e.key === 'Escape') _renderRolePopup();
}
function roleNameInputCommit(rowId) {
  const inp = document.getElementById(`roleNameInput_${rowId}`);
  if (!inp) return;
  const row = roleRows.find(r => String(r.id) === String(rowId));
  if (row) row.roleName = inp.value.trim();
  _renderRolePopup();
}

/* 역할 이름 지우기 */
function roleClearName(rowId) {
  const row = roleRows.find(r => String(r.id) === String(rowId));
  if (row) { row.roleName = ''; _renderRolePopup(); }
}

/* ── 학생 슬롯에 드롭 ── */
function roleDropToSlot(e, rowId, slotIdx) {
  e.preventDefault();
  if (!roleDragSource || roleDragSource.type !== 'student') return;
  const name = roleDragSource.value;
  if (!name) return;

  /* 중복 배정 방지 */
  const alreadyAssigned = roleRows.some(r => r.assignedNames.includes(name));
  if (alreadyAssigned) { roleDragSource = null; return; }

  const row = roleRows.find(r => String(r.id) === String(rowId));
  if (!row) return;
  if (slotIdx >= row.count) return;

  /* 해당 슬롯이 비어있을 때만 배정 */
  if (!row.assignedNames[slotIdx]) {
    row.assignedNames[slotIdx] = name;
  }
  roleDragSource = null;
  _renderRolePopup();
}

/* 슬롯에서 학생 제거 */
function roleRemoveFromSlot(rowId, slotIdx) {
  const row = roleRows.find(r => String(r.id) === String(rowId));
  if (!row) return;
  row.assignedNames[slotIdx] = '';
  _renderRolePopup();
}

/* 프리셋 타일 클릭 → 비어있는 첫 번째 역할 이름 칸에 자동 입력 */
function rolePresetClick(label) {
  const emptyRow = roleRows.find(r => !r.roleName);
  if (emptyRow) { emptyRow.roleName = label; _renderRolePopup(); }
  else { const nr = _newRoleRow(); nr.roleName = label; roleRows.push(nr); _renderRolePopup(); }
}

/* ── 저장 ── */
function saveRoles() {
  /* 학생 데이터에 role 필드 반영 */
  /* 먼저 전체 초기화 */
  students.forEach(s => { s.role = ''; });

  roleRows.forEach(row => {
    if (!row.roleName) return;
    row.assignedNames.forEach(name => {
      if (!name) return;
      const stu = students.find(s => s.name === name);
      if (stu) stu.role = row.roleName;
    });
  });

  /* 학생 데이터 저장 */
  saveStudentsToStorage();
  /* 역할 행 데이터 저장 */
  localStorage.setItem('seat_role_rows', JSON.stringify(roleRows));

  alert('1인1역이 저장되었습니다.');
  closeRolePopup();
  renderSide(); /* 명단 탭 role 태그 갱신 */
}

/* ── [5차-D] 1인1역 전체 초기화 ── */
function resetAllRoles() {
  if (!confirm('모든 1인1역 배정을 초기화합니다.\n실행하시겠습니까?')) return;
  /* 역할 행 초기화 */
  roleRows = [];
  /* 학생 role 필드 초기화 */
  students.forEach(s => { s.role = ''; });
  /* localStorage 제거 */
  localStorage.removeItem('seat_role_rows');
  saveStudentsToStorage();
  alert('1인1역 배정이 초기화되었습니다.');
  /* [보완] 창을 닫지 않고 팝업 내용만 재렌더링 */
  _renderRolePopup();
  renderGrid();
}

/* ── [5차-C] 랜덤배치 ── */
function roleRandomAssign() {
  if (!confirm('현재 배정 내용을 초기화하고 랜덤배치를 진행하시겠습니까?')) return;

  /* 기존 배정 초기화 */
  roleRows.forEach(r => { r.assignedNames = []; });

  /* 전체 학생 목록 셔플 */
  const pool = [...students.map(s => s.name)];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  let idx = 0;
  roleRows.forEach(row => {
    const count = Math.max(0, parseInt(row.count) || 0);
    row.assignedNames = [];
    for (let si = 0; si < count; si++) {
      row.assignedNames[si] = idx < pool.length ? pool[idx++] : '';
    }
  });

  _renderRolePopup();
}

/* ── [5차-C] 역할표 프린트 ── */
function printRoleTable() {
  /* 배정된 역할이 하나도 없으면 안내 */
  const hasData = roleRows.some(r => r.roleName && r.assignedNames.some(n => n));
  if (!hasData) { alert('저장된 역할 배정 내용이 없습니다.'); return; }

  /* 프린트용 창 생성 */
  const win = window.open('', '_blank', 'width=700,height=600');
  if (!win) { alert('팝업이 차단되었습니다. 팝업 허용 후 다시 시도하세요.'); return; }

  const rows = roleRows
    .filter(r => r.roleName)
    .map(r => {
      const names = r.assignedNames.filter(n => n).join('&nbsp;&nbsp;');
      return `<tr>
        <td class="role-col">${r.roleName}</td>
        <td class="names-col">${names || '<span style="color:#94a3b8">미배정</span>'}</td>
      </tr>`;
    }).join('');

  win.document.write(`<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<title>1인1역 배정표</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;700;900&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Noto Sans KR', sans-serif; padding: 24px; }
  h1 { font-size: 20px; font-weight: 900; text-align: center; margin-bottom: 16px; color: #1e293b; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #f1f5f9; padding: 8px 12px; text-align: left;
       font-weight: 800; font-size: 13px; color: #475569;
       border: 1px solid #e2e8f0; }
  td { padding: 8px 12px; border: 1px solid #e2e8f0;
       font-size: 13px; vertical-align: middle; }
  .role-col { font-weight: 800; color: #6d28d9; width: 140px; background: #faf5ff; }
  .names-col { color: #1e293b; line-height: 1.8; }
  tr:nth-child(even) td.names-col { background: #f8fafc; }
  @media print {
    body { padding: 12px; }
    button { display: none !important; }
  }
</style>
</head>
<body>
<h1>우리 반 1인1역</h1>
<table>
  <thead><tr><th>역할</th><th>담당 학생</th></tr></thead>
  <tbody>${rows}</tbody>
</table>
<script>window.onload = function(){ window.print(); }<\/script>
</body>
</html>`);
  win.document.close();
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
  const elGS = document.getElementById('pickGroupSize');
  if (elGS) lastPickGroupSize = parseInt(elGS.value) || 2;

  if      (currentTab === 'roster')   renderRoster(c);
  else if (currentTab === 'group')    renderGroup(c);
  else if (currentTab === 'history')  renderHistory(c);
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
      placeholder="예) 홍길동, 서길동, 정길동, 김길동...&#10;(엑셀에서 이름이 적힌 행을 드래그하여 복사/붙여넣기 가능)"></textarea>
    <div class="flex gap-1 mb-3">
      <button onclick="loadRoster(false)" class="flex-1 py-2 bg-emerald-400 text-white rounded-lg font-bold text-xs hover:bg-emerald-500">명단 등록</button>
      <button onclick="loadRoster(true)"  class="flex-1 py-2 bg-sky-400    text-white rounded-lg font-bold text-xs hover:bg-sky-500">명단 추가</button>
      <button onclick="openRolePopup()"   class="flex-1 py-2 bg-violet-400 text-white rounded-lg font-bold text-xs hover:bg-violet-500">1인1역 등록</button>
      <button onclick="clearRoster()"     class="flex-1 py-2 bg-rose-400   text-white rounded-lg font-bold text-xs hover:bg-rose-500">명단 초기화</button>
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
          <td class="p-1 border font-medium">
            <div class="flex items-center justify-between gap-1">
              <span>${s ? s.name : ''}</span>
              ${s && s.role ? `<span class="role-tag">${s.role}</span>` : ''}
            </div>
          </td>
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
    /* 우유 기본값: ON(true) — 탭+O 명시 시에도 ON, 미명시 시에도 ON */
    const milkFlag = parts[1] ? parts[1].trim().toUpperCase() === 'O' : true;
    return { name: parts[0].trim(), milk: milkFlag, gender: 'M' };
  });
  if (append) students = [...students, ...newS];
  else        students = newS;
  saveStudentsToStorage();
  renderSide();
  renderGrid();
}

/* 명단 초기화 — 확인창 포함 */
function clearRoster() {
  if (!confirm('모든 명단이 초기화됩니다. 실행하시겠습니까?')) return;
  students   = [];
  fixedSeats = {};
  saveStudentsToStorage();
  saveSettingsToStorage();
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
  /* [6-B] 모둠설정 진입 시 모둠보기 OFF면 자동 ON */
  if (!groupViewOn) {
    groupViewOn = true;
    updateGroupViewButton();
    renderGrid();
  }
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
        ❌ 모둠 초기화
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
      <div class="flex flex-col gap-2 items-start">
        <input type="password" id="pwCurrent" class="pw-input w-48" placeholder="현재 비밀번호 (4자리)" maxlength="4">
        <input type="password" id="pwNew"     class="pw-input w-48" placeholder="새 비밀번호 (4자리)"   maxlength="4">
        <input type="password" id="pwConfirm" class="pw-input w-48" placeholder="새 비밀번호 확인"       maxlength="4">
        <button onclick="changePassword()"
          class="px-4 py-1.5 bg-indigo-400 hover:bg-indigo-500 text-white rounded-lg font-bold text-sm shadow transition">
          🔑 변경
        </button>
        <p class="text-xs text-slate-400">숫자 4자리만 허용됩니다.</p>
      </div>
    </div>

    <!-- ── 전체 초기화 카드 ── -->
    <div class="settings-card" style="background:#ffffff; border-color:#fecaca;">
      <div class="settings-card-title" style="color:#dc2626;">⚠️ 데이터 초기화</div>
      <p class="text-xs text-slate-500 mb-3">모든 명단, 배치, 설정을 삭제합니다. 되돌릴 수 없습니다.</p>
      <button onclick="clearAllData()"
        class="w-full py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold text-xs shadow-md transition tracking-wider">
        ⚠️ 전체 데이터 초기화
      </button>
    </div>`;

  /* [v6-I] Google Sheets 피드백 센터 */
  const sheetsArea = document.createElement('div');
  sheetsArea.id = 'sheetsFeedbackArea';
  c.appendChild(sheetsArea);
  renderSheetsFeedback(sheetsArea);
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
          ❌ 뽑기 초기화
        </button>
      </div>

      <!-- 한번에 다 뽑기 -->
      <div class="p-3 bg-slate-50 rounded-xl border border-slate-200 shadow-sm">
        <h4 class="font-bold text-sm text-slate-800 mb-2">🎲 한번에 다 뽑기</h4>
        <div class="flex items-center gap-2 mb-3">
          <input type="number" id="pickGroupSize"
            value="${lastPickGroupSize}" min="1" max="${Math.max(1, students.length)}"
            class="w-16 border rounded p-1 text-center font-bold">
          <span class="text-xs font-medium text-slate-600">명씩 묶어서 뽑기</span>
          <button onclick="openPickAllPairs()"
            class="ml-auto px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs rounded-lg shadow transition">
            뽑기
          </button>
        </div>
        <p class="text-[11px] text-slate-400">마지막 조는 남은 인원 그대로 포함됩니다.</p>
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
          <div class="flex justify-end mt-1">
            <button onclick="pickFromGender()"
              class="px-3 py-1.5 bg-sky-400 hover:bg-sky-500 text-white font-bold text-xs rounded-lg shadow transition">
              뽑기
            </button>
          </div>
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
   [6-E] 한번에 다 뽑기 — 전체 2인 1조 자동 배정
══════════════════════════════════ */

let _pickAllPairsResult = [];

function openPickAllPairs() {
  const seated = currentSeats.filter(Boolean);
  if (seated.length === 0) {
    return alert('배치된 명단이 없습니다. 자리 바꾸기를 먼저 해주세요.');
  }
  const gs = document.getElementById('pickGroupSize');
  if (gs) lastPickGroupSize = Math.max(1, parseInt(gs.value) || 2);
  _pickAllPairsResult = _buildPairs(seated.map(s => s.name), lastPickGroupSize);
  _renderPickAllPairs();
  document.getElementById('pickAllPairsOverlay').style.display = 'flex';
  confetti({ particleCount: 50, spread: 70, origin: { y: 0.5 } });
}

function reshufflePickAllPairs() {
  const seated = currentSeats.filter(Boolean);
  if (seated.length === 0) return;
  _pickAllPairsResult = _buildPairs(seated.map(s => s.name), lastPickGroupSize);
  _renderPickAllPairs();
  confetti({ particleCount: 30, spread: 55, origin: { y: 0.5 } });
}

function closePickAllPairs() {
  document.getElementById('pickAllPairsOverlay').style.display = 'none';
}

function _buildPairs(names, groupSize) {
  groupSize = Math.max(1, groupSize || 2);
  const arr = [...names];
  shuffle(arr);
  const pairs = [];
  for (let i = 0; i < arr.length; i += groupSize) {
    pairs.push(arr.slice(i, i + groupSize));
  }
  return pairs;
}

function _renderPickAllPairs() {
  const body = document.getElementById('pickAllPairsBody');
  if (!body) return;
  const total = _pickAllPairsResult.reduce((s, p) => s + p.length, 0);
  const pairs = _pickAllPairsResult.length;
  const mainSize = pairs > 0 ? _pickAllPairsResult[0].length : 0;

  /* row 하나를 HTML로 변환하는 헬퍼 */
  const rowHTML = (pair, idx) => `
    <div class="pick-pair-row">
      <span class="pick-pair-num">${idx + 1}</span>
      <div class="pick-pair-names">
        ${pair.map(name => `<span class="pick-pair-chip">${name}</span>`).join(
          '<span class="pick-pair-dash">—</span>'
        )}
      </div>
      ${pair.length !== mainSize ? `<span class="pick-pair-tag3">${pair.length}인조</span>` : ''}
    </div>`;

  /* [6-F.2] groupSize===1 일 때: 2열 구조 (좌 1~half / 우 half+1~end) */
  const summary = `<div class="pick-pairs-summary">${total}명 → ${pairs}조 (${lastPickGroupSize}인 기준)</div>`;

  if (lastPickGroupSize === 1 && pairs > 1) {
    const half = Math.ceil(pairs / 2);
    const leftList  = _pickAllPairsResult.slice(0, half);
    const rightList = _pickAllPairsResult.slice(half);
    body.innerHTML = summary + `
      <div class="pick-pairs-2col">
        <div class="pick-pairs-col">${leftList.map( (p, i) => rowHTML(p, i)).join('')}</div>
        <div class="pick-pairs-col">${rightList.map((p, i) => rowHTML(p, i + half)).join('')}</div>
      </div>`;
  } else {
    /* groupSize > 1: 기존 1열 구조 유지 */
    body.innerHTML = summary + `
      <div class="pick-pairs-list">
        ${_pickAllPairsResult.map((pair, idx) => rowHTML(pair, idx)).join('')}
      </div>`;
  }
}

/* ══════════════════════════════════
   [15~20] 타이머
   activeTimerPanel: 현재 제어 중인 패널 ID
   'timerPanel'      = 다했어요 전용
   'timerPanelFree'  = 독립 타이머
══════════════════════════════════ */

/* ── 타이머 상태 변수 ──
   timerTotal    : 설정된 전체 초 (기본 5분)
   timerRemaining: 현재 남은 초
   timerRunning  : 실행 중 여부
   timerInterval : setInterval 핸들
*/
let timerTotal     = 0;
let timerRemaining = 0;
let timerRunning   = false;
let timerInterval  = null;

/* [독립 타이머] 별도 상태 */
let freeTimerTotal     = 0;
let freeTimerRemaining = 0;
let freeTimerRunning   = false;
let freeTimerInterval  = null;

/* [독립 타이머 표시 여부] */
let freeTimerVisible = false;

const TIMER_CIRCUMFERENCE = 2 * Math.PI * 52; // r=52 → 326.73...

/* [5차-D] 독립 타이머 닫기 — 시간 데이터 초기화 없이 패널만 숨김 */
function closeFreeTimer() {
  freeTimerVisible = false;
  const panel = document.getElementById('timerPanelFree');
  if (panel) panel.classList.add('hidden');
  const lbl = document.getElementById('freeTimerMenuLabel');
  if (lbl) lbl.textContent = '타이머';
}

/* ── 헬퍼: 패널 ID로 상태 객체 반환 ── */
function _ts(panelId) {
  if (panelId === 'timerPanelFree') {
    return {
      get total()     { return freeTimerTotal; },
      set total(v)    { freeTimerTotal = v; },
      get remaining() { return freeTimerRemaining; },
      set remaining(v){ freeTimerRemaining = v; },
      get running()   { return freeTimerRunning; },
      set running(v)  { freeTimerRunning = v; },
      get interval()  { return freeTimerInterval; },
      set interval(v) { freeTimerInterval = v; },
      arcId:    'timerArcFree',
      digitsId: 'timerDigitsFree',
      wrapSel:  '#timerPanelFree .timer-circle-wrap',
    };
  }
  return {
    get total()     { return timerTotal; },
    set total(v)    { timerTotal = v; },
    get remaining() { return timerRemaining; },
    set remaining(v){ timerRemaining = v; },
    get running()   { return timerRunning; },
    set running(v)  { timerRunning = v; },
    get interval()  { return timerInterval; },
    set interval(v) { timerInterval = v; },
    arcId:    'timerArc',
    digitsId: 'timerDigits',
    wrapSel:  '#timerPanel .timer-circle-wrap',
  };
}

/* [20] 다했어요 전용 패널 표시/숨김 */
function showTimerPanel() {
  const panel = document.getElementById('timerPanel');
  if (panel) panel.classList.remove('hidden');
  _renderTimer('timerPanel');
}
function hideTimerPanel() {
  const panel = document.getElementById('timerPanel');
  if (panel) panel.classList.add('hidden');
}

/* [독립] 독립 타이머 패널 토글 */
function toggleFreeTimer() {
  freeTimerVisible = !freeTimerVisible;
  const panel = document.getElementById('timerPanelFree');
  if (!panel) return;
  if (freeTimerVisible) {
    panel.classList.remove('hidden');
    _renderTimer('timerPanelFree');
  } else {
    _stopTimer('timerPanelFree');
    panel.classList.add('hidden');
  }
  /* 더보기 메뉴 라벨 업데이트 */
  const lbl = document.getElementById('freeTimerMenuLabel');
  if (lbl) lbl.textContent = freeTimerVisible ? '타이머 닫기' : '타이머';
}

/* ── 공통 타이머 내부 함수 ── */
function _stopTimer(panelId) {
  const s = _ts(panelId);
  s.running  = false;
  clearInterval(s.interval);
  s.interval = null;
}

function _renderTimer(panelId) {
  const s      = _ts(panelId);
  const arc    = document.getElementById(s.arcId);
  const digits = document.getElementById(s.digitsId);
  const wrap   = document.querySelector(s.wrapSel);
  if (!arc || !digits) return;

  const rem = Math.max(0, s.remaining);
  const mm  = String(Math.floor(rem / 60)).padStart(2, '0');
  const ss  = String(rem % 60).padStart(2, '0');
  digits.textContent = `${mm}:${ss}`;

  const ratio  = s.total > 0 ? rem / s.total : 0;
  const offset = TIMER_CIRCUMFERENCE * (1 - ratio);
  arc.style.strokeDashoffset = offset;

  const isWarning = s.total > 0 && rem / s.total <= 0.1 && rem > 0;
  arc.classList.toggle('warning',    isWarning);
  digits.classList.toggle('warning', isWarning);
  if (wrap) wrap.classList.toggle('time-up', rem === 0);
}

function _onTimerEnd(panelId) {
  /* [6-B] 솔(784Hz) → 미(659Hz) → 도(523Hz) 3회 순차 재생 */
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const notes = [
      { freq: 784, start: 0.0  },  // 솔
      { freq: 659, start: 0.55 },  // 미
      { freq: 523, start: 1.1  },  // 도
    ];
    notes.forEach(({ freq, start }) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
      gain.gain.setValueAtTime(0, ctx.currentTime + start);
      gain.gain.linearRampToValueAtTime(0.6, ctx.currentTime + start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + 0.5);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime  + start + 0.5);
    });
  } catch(e) {}
  _renderTimer(panelId);
}

/* ── [17] 공개 제어 함수 (HTML onclick에서 패널ID 전달) ── */
function timerStart(panelId) {
  panelId = panelId || 'timerPanel';
  const s = _ts(panelId);
  if (s.running) return;
  if (s.remaining <= 0 && s.total <= 0) return; // 시간 미설정 시 무시
  if (s.remaining <= 0) s.remaining = s.total;
  s.running  = true;
  s.interval = setInterval(() => {
    s.remaining--;
    _renderTimer(panelId);
    if (s.remaining <= 0) { _stopTimer(panelId); _onTimerEnd(panelId); }
  }, 1000);
}

function timerPause(panelId) {
  panelId = panelId || 'timerPanel';
  _stopTimer(panelId);
}

function timerReset(panelId) {
  panelId = panelId || 'timerPanel';
  _stopTimer(panelId);
  const s = _ts(panelId);
  s.total     = 0;
  s.remaining = 0;
  const arc    = document.getElementById(s.arcId);
  const digits = document.getElementById(s.digitsId);
  const wrap   = document.querySelector(s.wrapSel);
  if (arc)    { arc.classList.remove('warning'); arc.style.strokeDashoffset = '0'; }
  if (digits) { digits.classList.remove('warning'); digits.textContent = '00:00'; }
  if (wrap)   wrap.classList.remove('time-up');
}

function timerAddTime(seconds, panelId) {
  panelId = panelId || 'timerPanel';
  const s = _ts(panelId);
  s.total     += seconds;
  s.remaining += seconds;
  if (s.remaining < 0) s.remaining = 0;
  _renderTimer(panelId);
}

/* 하위 호환: 기존 코드에서 인수 없이 호출되는 경우 대비 */
function timerStop() { _stopTimer('timerPanel'); }
function timerRender() { _renderTimer('timerPanel'); }
function timerOnEnd()  { _onTimerEnd('timerPanel'); }

/* ══════════════════════════════════
   [6-A] 성별 배치 시스템
══════════════════════════════════ */

/* 확장 패널 열기/닫기 */
function toggleGenderPanel() {
  genderPanelOpen = !genderPanelOpen;
  const panel = document.getElementById('genderPanel');
  const icon  = document.getElementById('genderExpandIcon');
  const shuffleBtn = document.getElementById('btnShuffle');
  if (!panel || !icon) return;

  if (genderPanelOpen) {
    panel.classList.remove('hidden');
    icon.textContent = '◂';
    if (shuffleBtn) {
      shuffleBtn.classList.remove('rounded-l-xl');
      shuffleBtn.classList.add('rounded-l-xl');
    }
  } else {
    panel.classList.add('hidden');
    icon.textContent = '▸';
    /* 패널 닫을 때 성별 지정 모드도 종료 */
    if (genderZoneMode) _exitGenderZoneMode();
  }
  _updateGenderButtons();
}

/* 남여 자리지정 모드 토글 */
function toggleGenderZoneMode() {
  genderZoneMode = !genderZoneMode;
  if (genderZoneMode) {
    _enterGenderZoneMode();
  } else {
    _exitGenderZoneMode();
  }
}

function _enterGenderZoneMode() {
  genderZoneMode = true;
  /* [6-B.1] 진입 직전 groupViewOn 상태 저장 후 자동 OFF — 성별 테두리가 보이도록 */
  _groupViewBeforeZone = groupViewOn;
  if (groupViewOn) {
    groupViewOn = false;
    updateGroupViewButton();
    renderGrid();
  }
  document.body.classList.add('gender-zone-mode');
  _updateGenderButtons();
  _renderGenderZoneBar();
}

function _exitGenderZoneMode() {
  genderZoneMode = false;
  document.body.classList.remove('gender-zone-mode');
  /* [6-B.1] 진입 직전 저장된 groupViewOn 상태 복원 */
  if (_groupViewBeforeZone !== null) {
    groupViewOn = _groupViewBeforeZone;
    _groupViewBeforeZone = null;
    updateGroupViewButton();
    renderGrid();
  }
  _updateGenderButtons();
  _removeGenderZoneBar();
}

/* 같은 성별끼리 앉기 ON/OFF */
function toggleSameGender() {
  sameGenderOn = !sameGenderOn;
  localStorage.setItem('seat_same_gender', JSON.stringify(sameGenderOn));
  _updateGenderButtons();
}

/* 버튼 상태 업데이트 */
function _updateGenderButtons() {
  const zoneBtn  = document.getElementById('btnGenderZone');
  const sameBtn  = document.getElementById('btnSameGender');
  const badge    = document.getElementById('genderActiveBadge');

  if (zoneBtn) {
    if (genderZoneMode) {
      zoneBtn.classList.add('active-mode');
      zoneBtn.innerHTML = '<span class="text-base leading-none">🗺️</span><span class="text-xs mt-0.5 leading-tight text-center">지정<br>종료</span>';
    } else {
      zoneBtn.classList.remove('active-mode');
      zoneBtn.innerHTML = '<span class="text-base leading-none">🗺️</span><span class="text-xs mt-0.5 leading-tight text-center">남여<br>자리지정</span>';
    }
  }

  if (sameBtn) {
    if (sameGenderOn) {
      sameBtn.classList.add('same-on');
      sameBtn.innerHTML = '<span class="text-base leading-none">👫</span><span class="text-xs mt-0.5 leading-tight text-center">같은성별<br>앉기ON</span>';
    } else {
      sameBtn.classList.remove('same-on');
      sameBtn.innerHTML = '<span class="text-base leading-none">👫</span><span class="text-xs mt-0.5 leading-tight text-center">같은성별<br>앉기OFF</span>';
    }
  }

  /* [UI통합] 확장 버튼 뱃지: sameGenderOn=true일 때 초록 점 표시 */
  if (badge) badge.classList.toggle('hidden', !sameGenderOn);

  _updateStatusBadges();
}

/* 성별 지정 모드 브러시 바 렌더링 */
function _renderGenderZoneBar() {
  /* 기존 바 제거 */
  _removeGenderZoneBar();

  const mCount = students.filter(s => s.gender === 'M').length;
  const fCount = students.filter(s => s.gender === 'F').length;
  const mZones = genderZones.filter((z, i) => z === 'M' && gridEnabled[i]).length;
  const fZones = genderZones.filter((z, i) => z === 'F' && gridEnabled[i]).length;

  const mWarn = mZones > mCount;
  const fWarn = fZones > fCount;

  const bar = document.createElement('div');
  bar.id = 'genderZoneBar';
  bar.className = 'gender-brush-bar';
  bar.innerHTML = `
    <span class="gender-count-info">
      <span class="male-count">남 ${mCount}명</span> /
      <span class="female-count">여 ${fCount}명</span>
    </span>
    <button id="brushM" class="gender-brush-btn male ${genderBrush === 'M' ? 'active' : ''}"
      onclick="setGenderBrush('M')">🔵 남학생</button>
    <button id="brushF" class="gender-brush-btn female ${genderBrush === 'F' ? 'active' : ''}"
      onclick="setGenderBrush('F')">🔴 여학생</button>
    <button id="brushE" class="gender-brush-btn erase ${genderBrush === '' ? 'active' : ''}"
      onclick="setGenderBrush('')">✕ 지우개</button>
    <span class="gender-count-info">
      지정:
      <span class="male-count">${mZones}칸</span> /
      <span class="female-count">${fZones}칸</span>
    </span>
    ${mWarn ? `<span class="gender-over-warn">⚠️ 남학생 자리 초과</span>` : ''}
    ${fWarn ? `<span class="gender-over-warn">⚠️ 여학생 자리 초과</span>` : ''}
    <button onclick="clearAllGenderZones()"
      style="padding:3px 8px;background:#fee2e2;color:#dc2626;border:none;border-radius:6px;font-size:11px;font-weight:800;cursor:pointer;font-family:'Noto Sans KR',sans-serif;">
      전체해제
    </button>`;

  /* 메인 버튼 행 뒤에 삽입 */
  const btnRow = document.querySelector('.main-btn-row');
  if (btnRow && btnRow.parentNode) {
    btnRow.parentNode.insertBefore(bar, btnRow.nextSibling);
  }
}

function _removeGenderZoneBar() {
  const existing = document.getElementById('genderZoneBar');
  if (existing) existing.remove();
}

function setGenderBrush(brush) {
  genderBrush = brush;
  _renderGenderZoneBar();
}

function clearAllGenderZones() {
  if (!confirm('모든 성별 자리 지정을 해제하시겠습니까?')) return;
  genderZones = Array(40).fill('');
  saveSettingsToStorage();
  _renderGenderZoneBar();
  renderGrid();
}

/* ══════════════════════════════════
   [UI통합] 칠판 상태 뱃지 업데이트
   활성 기능(모둠보기 / 1인1역 / 성별같이앉기)을 칠판 우측에 표시
══════════════════════════════════ */
function _updateStatusBadges() {
  /* [v8-A] 상태뱃지 제거 — statusBadgeArea는 DOM 유지(빈 상태) */
  const area = document.getElementById('statusBadgeArea');
  if (!area) return;
  area.innerHTML = '';
}

/* ══════════════════════════════════
   초기화
══════════════════════════════════ */
window.addEventListener('DOMContentLoaded', () => {
  loadFromStorage();
  renderGrid();
  showTab('roster');
  updateGroupViewButton();
  updateRoleViewButton();
  /* [6-A] 성별 버튼 초기 상태 반영 */
  _updateGenderButtons();
  /* [UI통합] 칠판 상태 뱃지 초기 반영 */
  _updateStatusBadges();
  /* [v6-G] 방문자 카운트 (콘솔 확인용) */
  try {
    const vc = localStorage.getItem('seat_visitor_count') || '1';
    console.log('[Classton] 누적 방문: ' + vc + '회');
  } catch(e) {}
});

/* ══════════════════════════════════════════
   [v6-G] 매뉴얼 모달 시스템
══════════════════════════════════════════ */
const _MANUAL_DATA = [
  { title: '📢 뽑기 메뉴', desc: '학생을 무작위로 뽑습니다. 개인/모둠/남녀 구분 뽑기가 가능합니다.' },
  { title: '🎲 자리바꾸기', desc: '전체 자리를 무작위로 섞습니다. 고정 자리는 제외됩니다.' },
  { title: '👤 다했어요 (개인)', desc: '과제를 완료한 학생을 체크합니다. 모두 완료 시 알림이 표시됩니다.' },
  { title: '👥 다했어요 (모둠)', desc: '모둠 단위로 완료를 체크합니다.' },
  { title: '👁 모둠보기', desc: '자리 배치를 모둠 색상으로 구분하여 표시합니다.' },
  { title: '🏷 1인1역', desc: '각 학생의 역할 태그를 자리에 표시합니다.' },
  { title: '⏱ 타이머', desc: '화면 상단에 자유 타이머를 표시합니다.' },
  { title: '⚙️ 설정', desc: '명단 관리, 모둠 구성, 기록, 보안 설정을 포함한 전체 설정 패널을 엽니다.' },
];
function openManualModal() {
  /* [v6-H] 아코디언 UX — 클릭 시 상세 설명 펼침 */
  const el = document.getElementById('manualModal');
  if (!el) return;
  el.style.display = 'flex';
  const list = document.getElementById('manualList');
  if (!list) return;
  list.innerHTML = _MANUAL_DATA.map((item, i) => `
    <div style="border:1px solid #e2e8f0;border-radius:8px;margin-bottom:6px;overflow:hidden;">
      <button onclick="_toggleManualItem(${i})"
        style="width:100%;display:flex;justify-content:space-between;align-items:center;
               padding:9px 12px;background:#f8fafc;border:none;cursor:pointer;text-align:left;">
        <span style="font-weight:700;font-size:13px;">${item.title}</span>
        <span id="manualArrow${i}" style="font-size:11px;color:#94a3b8;transition:transform 0.2s;">▼</span>
      </button>
      <div id="manualDetail${i}"
        style="display:none;padding:8px 12px 10px;font-size:12px;color:#475569;line-height:1.6;background:#fff;">
        ${item.desc}${item.detail ? '<br><br><span style=\'color:#64748b;\'>'+item.detail+'</span>' : ''}
      </div>
    </div>`).join('');
}

function _toggleManualItem(i) {
  const detail = document.getElementById('manualDetail' + i);
  const arrow  = document.getElementById('manualArrow' + i);
  if (!detail) return;
  const open = detail.style.display === 'block';
  detail.style.display = open ? 'none' : 'block';
  if (arrow) arrow.textContent = open ? '▼' : '▲';
}
function closeManualModal() {
  const el = document.getElementById('manualModal');
  if (el) el.style.display = 'none';
}

/* ══════════════════════════════════════════
   [v6-I] Google Sheets 피드백 시스템
   ─────────────────────────────────────────
   배포 전 필수: _SHEETS_ENDPOINT 를 실제
   Google Apps Script 배포 URL로 교체하세요.
   Apps Script 코드: 이 블록 끝 주석 참고
══════════════════════════════════════════ */
const _SHEETS_ENDPOINT = 'https://script.google.com/macros/s/AKfycbzlbt-KXjx3kQ--JYp_VDpTvREGTIkazr_BXjOAMLrAs8vLPVn2k6FnFlaKo9mxXhwrCA/exec';

const _FB_TYPES = {
  bug:     { label: '🐛 버그 신고',  color: '#b91c1c', bg: '#fee2e2', border: '#fca5a5' },
  feature: { label: '🚀 기능 요청', color: '#1d4ed8', bg: '#dbeafe', border: '#93c5fd' },
  etc:     { label: '💬 기타 의견', color: '#15803d', bg: '#f0fdf4', border: '#86efac' },
};
let _currentFbType = 'bug';

/* renderSettings에서 호출 — 피드백 UI + 방문자 카운트 렌더 */
function renderSheetsFeedback(container) {
  const vc = parseInt(localStorage.getItem('seat_visitor_count') || '0');
  container.innerHTML = `
    <div style="margin-top:14px;">
      <div style="font-size:11px;color:#94a3b8;margin-bottom:10px;">
        누적 방문자: <strong style="color:#64748b;">${vc}회</strong>
      </div>
      <div style="border:1px solid #e2e8f0;border-radius:10px;padding:12px;background:#f8fafc;">
        <div style="font-weight:800;font-size:13px;color:#1e293b;margin-bottom:10px;">📬 피드백 보내기</div>

        <div style="display:flex;gap:6px;margin-bottom:10px;" id="fbTypeBtns">
          <button onclick="selectFeedbackType('bug')" id="fbBtn_bug"
            style="flex:1;padding:6px 2px;font-size:11px;font-weight:700;background:#fee2e2;color:#b91c1c;border:2px solid #fca5a5;border-radius:6px;cursor:pointer;">
            🐛 버그 신고
          </button>
          <button onclick="selectFeedbackType('feature')" id="fbBtn_feature"
            style="flex:1;padding:6px 2px;font-size:11px;font-weight:700;background:#dbeafe;color:#1d4ed8;border:2px solid #93c5fd;border-radius:6px;cursor:pointer;">
            🚀 기능 요청
          </button>
          <button onclick="selectFeedbackType('etc')" id="fbBtn_etc"
            style="flex:1;padding:6px 2px;font-size:11px;font-weight:700;background:#f0fdf4;color:#15803d;border:2px solid #86efac;border-radius:6px;cursor:pointer;">
            💬 기타 의견
          </button>
        </div>

        <div id="fbTypeLabel" style="font-size:11px;font-weight:700;color:#64748b;margin-bottom:6px;min-height:16px;"></div>

        <input id="fbTitle" type="text" placeholder="제목을 입력하세요"
          style="width:100%;box-sizing:border-box;border:1px solid #cbd5e1;border-radius:6px;padding:5px 8px;font-size:12px;margin-bottom:6px;">

        <textarea id="fbMessage" rows="4" placeholder="내용을 입력하세요"
          style="width:100%;box-sizing:border-box;border:1px solid #cbd5e1;border-radius:6px;padding:5px 8px;font-size:12px;resize:vertical;margin-bottom:6px;"></textarea>

        <button onclick="submitSheetsFeedback()"
          style="width:100%;padding:8px;font-size:12px;font-weight:700;background:#1e293b;color:#fff;border:none;border-radius:6px;cursor:pointer;">
          전송하기
        </button>
        <div id="fbStatus" style="font-size:11px;text-align:center;margin-top:6px;min-height:16px;color:#64748b;"></div>
      </div>
    </div>`;
  selectFeedbackType('bug');
}

function selectFeedbackType(type) {
  _currentFbType = type;
  ['bug','feature','etc'].forEach(t => {
    const btn = document.getElementById('fbBtn_' + t);
    if (!btn) return;
    btn.style.borderWidth = (t === type) ? '3px' : '2px';
    btn.style.opacity     = (t === type) ? '1'   : '0.6';
  });
  const lbl = document.getElementById('fbTypeLabel');
  if (lbl) lbl.textContent = (_FB_TYPES[type]?.label || '') + ' 선택됨';
}

function submitSheetsFeedback() {
  const title   = (document.getElementById('fbTitle')?.value   || '').trim();
  const message = (document.getElementById('fbMessage')?.value || '').trim();
  const status  = document.getElementById('fbStatus');
  const setStatus = (msg, color) => { if (status) { status.textContent = msg; status.style.color = color; } };

  if (!title)   { setStatus('⚠️ 제목을 입력해 주세요.',   '#ef4444'); return; }
  if (!message) { setStatus('⚠️ 내용을 입력해 주세요.',   '#ef4444'); return; }

  setStatus('전송 중...', '#64748b');

  fetch(_SHEETS_ENDPOINT, {
    method:  'POST',
    mode:    'no-cors',
    body:    JSON.stringify({ type: _currentFbType, title, message, timestamp: Date.now(), version: 'v6-I' }),
  })
  .then(() => {
    setStatus('✅ 전송 완료! 소중한 의견 감사합니다.', '#16a34a');
    document.getElementById('fbTitle').value   = '';
    document.getElementById('fbMessage').value = '';
    selectFeedbackType('bug');
  })
  .catch(err => {
    setStatus('❌ 전송 실패. 네트워크를 확인해 주세요.', '#ef4444');
    console.error('[Classton] 피드백 전송 오류:', err);
  });
}

/* ──────────────────────────────────────────
   Google Apps Script 배포 코드 (참고)
   1. https://script.google.com 에서 새 프로젝트 생성
   2. 아래 코드를 붙여넣기
   3. 배포 → 웹 앱 → 모든 사용자 액세스
   4. 배포 URL을 _SHEETS_ENDPOINT 에 입력

   function doPost(e) {
     try {
       const d = JSON.parse(e.postData.contents);
       SpreadsheetApp.getActiveSpreadsheet()
         .getActiveSheet()
         .appendRow([new Date(d.timestamp), d.type, d.title, d.message]);
       return ContentService
         .createTextOutput(JSON.stringify({result:'success'}))
         .setMimeType(ContentService.MimeType.JSON);
     } catch(err) {
       return ContentService
         .createTextOutput(JSON.stringify({result:'error',message:err.toString()}))
         .setMimeType(ContentService.MimeType.JSON);
     }
   }
────────────────────────────────────────── */
