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
let isShuffling   = false;     /* [v9-C.3] 중복 실행 방지 */

/* ── [9-D] 계속 새로운 짝 만나기 (Round Robin) ── */
let roundRobinMode    = false;  // 라운드 로빈 모드 ON/OFF
let currentRoundIndex = 0;      // 현재 회차 (0-indexed)
let rrStudentOrder    = [];     // 회전 기준 학생 배열 (s0 고정)
let currentTab  = 'roster';
let currentMode = 'list';   /* [v6-G] 'list' | 'draw' */

let savedLayouts = [];

/* ─── [6-A] 성별 배치 상태 ─── */
let genderPanelOpen   = false;     // 확장 패널 열림 여부
let genderZoneMode    = false;     // 남여 자리지정 모드 ON/OFF
let genderZones       = Array(40).fill('');  // '' | 'M' | 'F' — 각 셀의 성별존
let genderBrush       = 'M';       // 현재 선택된 브러시: 'M' | 'F' | ''(지우개)
let sameGenderOn      = false;     // 같은 성별끼리 앉기 ON/OFF
let _groupViewBeforeZone = null;   // [6-B.1] 성별존 진입 직전 groupViewOn 상태 저장

/* ─── 뽑기 상태 ─── */
let showMilkView = true;            /* [v9-F.8] 우유 아이콘 표시 여부 */
let pickedSeatIndexes = [];
let historyPickedNames = [];
let excludePickedEnabled = true;
let pickerHighlightSuppressed = false;  /* [v9-F.2] 창 닫힘 시 회색 효과 억제 플래그 */

/* ─── [1번 수정] 뽑기 인원 수 유지용 변수 ─── */
let lastPickAllCount = 1;
let lastPickGroupCount = 1;
let lastPickMaleCount = 0;
let lastPickFemaleCount = 0;
let lastPickGroupSize = 2;  /* [6-E] 한번에 다 뽑기 — 그룹 크기 */
let lastPickOneGroupNum   = 1;   /* [v9-F.1] 특정 모둠 뽑기 — 선택 모둠 번호 */
let lastPickOneGroupCount = 1;   /* [v9-F.1] 특정 모둠 뽑기 — 추첨 인원 수 */

/* ─── UI 상태 ─── */
let isDragging = false;
let startCellState = null;
let fixModeActive = false;
let fixModeStudentIdx = null;
let pickerPanelOpen = false;    /* [v9-B.3] 뽑기창 열림 플래그 — transform 문자열 비교 버그 수정 */
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
let seatChangeHistories      = []; // [v9-C.1] 자리변경 기록

/* [v9-I.1] 다중 학급 — 현재 활성 학급 ID */
let currentClassId = '';

/* [v9-J.1-B] 전학모드 — 삭제 버튼 표시 제어 */
let transferMode = false;
let rosterDragFrom = null;  /* [v9-J.6-C] 명단 드래그 정렬 — 그리드 isDragging과 독립 */
/* [v9-J.1-C] 명단 모달 저장 모드 — false:교체, true:추가 */
let rosterAppendMode = false;

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
   [v9-I.1] 다중 학급 엔진
   createClass / deleteClass / switchClass /
   saveCurrentClass / loadClassData /
   migrateExistingData / getClassKeys /
   renderClassSelector
══════════════════════════════════ */

/* 학급별 localStorage suffix 목록 */
const CLASS_DATA_KEYS = [
  'students','grid_enabled','seats','groups','fixed_seats','banned',
  'gender_zones','same_gender','layouts','change_histories',
  'daha_histories','role_rows','role_view_on',
  'avoid_prev_pair','rr_mode','rr_index','rr_order',
];

function getClassKeys(classId) {
  return CLASS_DATA_KEYS.map(k => `seat_${classId}_${k}`);
}

/* 현재 학급 전체 상태를 localStorage에 저장 */
function saveCurrentClass() {
  if (!currentClassId) return;
  const id = currentClassId;
  localStorage.setItem(`seat_${id}_students`,         JSON.stringify(students));
  localStorage.setItem(`seat_${id}_grid_enabled`,     JSON.stringify(gridEnabled));
  localStorage.setItem(`seat_${id}_seats`,            JSON.stringify(currentSeats));
  localStorage.setItem(`seat_${id}_groups`,           JSON.stringify(groups));
  localStorage.setItem(`seat_${id}_fixed_seats`,      JSON.stringify(fixedSeats));
  localStorage.setItem(`seat_${id}_banned`,           JSON.stringify(banned));
  localStorage.setItem(`seat_${id}_gender_zones`,     JSON.stringify(genderZones));
  localStorage.setItem(`seat_${id}_same_gender`,      JSON.stringify(sameGenderOn));
  localStorage.setItem(`seat_${id}_layouts`,          JSON.stringify(savedLayouts));
  localStorage.setItem(`seat_${id}_change_histories`, JSON.stringify(seatChangeHistories));
  localStorage.setItem(`seat_${id}_daha_histories`,   JSON.stringify(dahaesseoHistories));
  localStorage.setItem(`seat_${id}_role_rows`,        JSON.stringify(roleRows));
  localStorage.setItem(`seat_${id}_role_view_on`,     JSON.stringify(roleViewOn));
  localStorage.setItem(`seat_${id}_avoid_prev_pair`,  JSON.stringify(avoidPrevPair));
  localStorage.setItem(`seat_${id}_rr_mode`,          JSON.stringify(roundRobinMode));
  localStorage.setItem(`seat_${id}_rr_index`,         JSON.stringify(currentRoundIndex));
  localStorage.setItem(`seat_${id}_rr_order`,         JSON.stringify(rrStudentOrder));
}

/* 선택 학급 데이터를 로드하여 메모리에 적용 */
function loadClassData(classId) {
  const id = classId;
  const g = k => { try { const v = localStorage.getItem(`seat_${id}_${k}`); return v !== null ? JSON.parse(v) : null; } catch(e) { return null; } };

  /* 학생 명단 */
  const s = g('students');
  students = Array.isArray(s)
    ? s.map((x, idx) => (!x || typeof x !== 'object') ? null
        : {
            number: (x.number !== undefined && x.number !== null && x.number !== '')
                      ? Number(x.number) : (idx + 1),  /* [v9-J.6-A] number 마이그레이션 */
            name:   x.name||'무명',
            milk:   !!x.milk,
            gender: x.gender||'M',
            role:   x.role||'',
            absent: !!x.absent
          }
      ).filter(Boolean)
    : [];

  /* 그리드 */
  const ge = g('grid_enabled');
  gridEnabled = (Array.isArray(ge) && ge.length === 40) ? ge : Array(40).fill(true);

  /* 현재 자리 배치 */
  const seats = g('seats');
  currentSeats  = (Array.isArray(seats) && seats.length === 40) ? seats : Array(40).fill(null);
  previousSeats = Array(40).fill(null);  /* 학급 전환 시 초기화 */

  /* [v10-C.1] currentSeats → students 참조 재연결
     loadClassData 후 JSON.parse로 독립 생성된 currentSeats 객체를
     students 배열의 동일 학생 참조로 교체.
     식별 기준: number 우선, 없으면 name. */
  {
    const byNumber = new Map();
    const byName   = new Map();
    for (const stu of students) {
      if (stu.number != null) byNumber.set(stu.number, stu);
      byName.set(stu.name, stu);
    }
    for (let i = 0; i < 40; i++) {
      if (!currentSeats[i]) continue;
      const seat = currentSeats[i];
      const matched = (seat.number != null && byNumber.has(seat.number))
        ? byNumber.get(seat.number)
        : byName.get(seat.name);
      if (matched) currentSeats[i] = matched;
    }
  }

  /* 모둠 */
  const grp = g('groups');
  groups = grp || { count:0, assignments:Array(40).fill(0) };

  /* 자리 고정 */
  const fs = g('fixed_seats'); fixedSeats = fs || {};

  /* 짝 방지 */
  const bn = g('banned');      banned     = Array.isArray(bn) ? bn : [];

  /* 성별존 */
  const gz = g('gender_zones');
  genderZones = (Array.isArray(gz) && gz.length === 40) ? gz : Array(40).fill('');

  /* 같은성별 앉기 */
  const sg = g('same_gender'); sameGenderOn = sg !== null ? sg : false;

  /* savedLayouts */
  const ly = g('layouts'); savedLayouts = Array.isArray(ly) ? ly : [];

  /* 기록 */
  const ch = g('change_histories'); seatChangeHistories = Array.isArray(ch) ? ch : [];
  const dh = g('daha_histories');   dahaesseoHistories  = Array.isArray(dh) ? dh : [];

  /* 1인1역 */
  const rr = g('role_rows');   roleRows  = Array.isArray(rr) ? rr : [];
  const rv = g('role_view_on'); roleViewOn = rv !== null ? rv : true;

  /* 직전짝방지 / RR */
  const ap = g('avoid_prev_pair'); avoidPrevPair     = ap !== null ? ap : false;
  const rm = g('rr_mode');         roundRobinMode    = rm !== null ? rm : false;
  const ri = g('rr_index');        currentRoundIndex = ri !== null ? ri : 0;
  const ro = g('rr_order');        rrStudentOrder    = Array.isArray(ro) ? ro : [];
}

/* 신규 학급 생성 */
function createClass(name) {
  const trimmed = (name || '').trim();
  if (!trimmed) { alert('학급 이름을 입력해주세요.'); return null; }
  const classes = getClassList();
  const id = 'cls_' + Date.now();
  classes.push({ id, name: trimmed, createdAt: Date.now() });
  localStorage.setItem('seat_classes', JSON.stringify(classes));
  /* 빈 학급 기본 데이터 초기화 */
  const empty = id;
  localStorage.setItem(`seat_${empty}_students`,   JSON.stringify([]));
  localStorage.setItem(`seat_${empty}_grid_enabled`, JSON.stringify(Array(40).fill(true)));
  localStorage.setItem(`seat_${empty}_seats`,      JSON.stringify(Array(40).fill(null)));
  localStorage.setItem(`seat_${empty}_groups`,     JSON.stringify({count:0,assignments:Array(40).fill(0)}));
  localStorage.setItem(`seat_${empty}_fixed_seats`,JSON.stringify({}));
  localStorage.setItem(`seat_${empty}_banned`,     JSON.stringify([]));
  localStorage.setItem(`seat_${empty}_gender_zones`,JSON.stringify(Array(40).fill('')));
  localStorage.setItem(`seat_${empty}_same_gender`, JSON.stringify(false));
  localStorage.setItem(`seat_${empty}_change_histories`, JSON.stringify([]));
  localStorage.setItem(`seat_${empty}_daha_histories`,   JSON.stringify([]));
  localStorage.setItem(`seat_${empty}_role_rows`,        JSON.stringify([]));
  localStorage.setItem(`seat_${empty}_role_view_on`,     JSON.stringify(true));
  localStorage.setItem(`seat_${empty}_avoid_prev_pair`,  JSON.stringify(false));
  localStorage.setItem(`seat_${empty}_rr_mode`,          JSON.stringify(false));
  localStorage.setItem(`seat_${empty}_rr_index`,         JSON.stringify(0));
  localStorage.setItem(`seat_${empty}_rr_order`,         JSON.stringify([]));
  return id;
}

/* 학급 삭제 (마지막 학급 삭제 불가) */
function deleteClass(classId) {
  const classes = getClassList();
  if (classes.length <= 1) { alert('마지막 학급은 삭제할 수 없습니다.'); return; }
  if (!confirm(`"${getClassName(classId)}" 학급을 삭제하시겠습니까?\n모든 데이터가 삭제됩니다.`)) return;
  /* 관련 키 전체 삭제 */
  getClassKeys(classId).forEach(k => localStorage.removeItem(k));
  const updated = classes.filter(c => c.id !== classId);
  localStorage.setItem('seat_classes', JSON.stringify(updated));
  /* 삭제한 학급이 현재 학급이면 첫 번째 학급으로 전환 */
  if (currentClassId === classId) {
    switchClass(updated[0].id);
  } else {
    renderClassSelector();
  }
}

/* 학급 전환 */
function switchClass(classId) {
  if (classId === currentClassId) return;
  saveCurrentClass();
  currentClassId = classId;
  localStorage.setItem('seat_current_class', classId);
  loadClassData(classId);
  transferMode = false;  /* [v9-J.1-B] 학급 전환 시 전학모드 초기화 */
  renderGrid();
  renderSide();
  updateGroupViewButton();
  updateRoleViewButton();
  updateMilkViewButton();
  renderClassSelector();
}

/* 학급 목록 조회 */
function getClassList() {
  try { const v = localStorage.getItem('seat_classes'); return v ? JSON.parse(v) : []; }
  catch(e) { return []; }
}

/* 학급 이름 조회 */
function getClassName(classId) {
  return (getClassList().find(c => c.id === classId) || {}).name || classId;
}

/* 기존 단일 학급 데이터 → 다중 학급 구조로 마이그레이션 */
function migrateExistingData() {
  if (localStorage.getItem('seat_classes')) return;  /* 이미 마이그레이션됨 */
  const id   = 'cls_' + Date.now();
  const name = '기본 학급';
  /* 기존 단일 키 매핑 */
  const MAP = {
    'seat_students':         `seat_${id}_students`,
    'seat_grid_enabled':     `seat_${id}_grid_enabled`,
    'seat_groups':           `seat_${id}_groups`,
    'seat_fixed_seats':      `seat_${id}_fixed_seats`,
    'seat_banned':           `seat_${id}_banned`,
    'seat_gender_zones':     `seat_${id}_gender_zones`,
    'seat_same_gender':      `seat_${id}_same_gender`,
    'seat_layouts':          `seat_${id}_layouts`,
    'seat_change_histories': `seat_${id}_change_histories`,
    'seat_daha_histories':   `seat_${id}_daha_histories`,
    'seat_role_rows':        `seat_${id}_role_rows`,
    'seat_role_view_on':     `seat_${id}_role_view_on`,
  };
  Object.entries(MAP).forEach(([oldKey, newKey]) => {
    const v = localStorage.getItem(oldKey);
    if (v !== null) localStorage.setItem(newKey, v);
  });
  /* 마이그레이션에 없는 신규 키 기본값 */
  localStorage.setItem(`seat_${id}_seats`,           JSON.stringify(Array(40).fill(null)));
  localStorage.setItem(`seat_${id}_avoid_prev_pair`, JSON.stringify(false));
  localStorage.setItem(`seat_${id}_rr_mode`,         JSON.stringify(false));
  localStorage.setItem(`seat_${id}_rr_index`,        JSON.stringify(0));
  localStorage.setItem(`seat_${id}_rr_order`,        JSON.stringify([]));
  /* 학급 목록 + 현재 학급 설정 */
  localStorage.setItem('seat_classes',       JSON.stringify([{ id, name, createdAt: Date.now() }]));
  localStorage.setItem('seat_current_class', id);
  currentClassId = id;
}

/* 학급 선택 UI 임시 렌더링 (renderRoster 최상단에서 호출) */
function renderClassSelector() {
  const wrap = document.getElementById('classSelector');
  if (!wrap) return;
  const classes = getClassList();
  if (!classes.length) { wrap.innerHTML = ''; return; }
  /* [v9-I.2] 2줄 레이아웃: 첫 줄=select 단독, 둘째 줄=버튼 3개 */
  wrap.innerHTML =
    `<div class="mb-1">` +
      `<select id="classSelect" onchange="switchClass(this.value)"
        class="w-full border rounded-lg px-2 py-1 text-xs font-bold text-slate-700 bg-white">` +
        classes.map(c =>
          `<option value="${c.id}" ${c.id === currentClassId ? 'selected' : ''}>${c.name}</option>`
        ).join('') +
      `</select>` +
    `</div>` +
    `<div class="flex gap-1 mb-2">` +
      `<button onclick="(function(){const n=prompt('새 학급 이름을 입력하세요.');if(!n||!n.trim())return;const id=createClass(n);if(id)switchClass(id);})()"
        class="flex-1 py-1 bg-indigo-400 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold">➕ 학급추가</button>` +
      `<button onclick="renameClass(currentClassId)"
        class="flex-1 py-1 bg-amber-400 hover:bg-amber-500 text-white rounded-lg text-xs font-bold">✏️ 이름변경</button>` +
      `<button onclick="deleteClass(currentClassId)"
        class="flex-1 py-1 bg-rose-400 hover:bg-rose-500 text-white rounded-lg text-xs font-bold">🗑 학급삭제</button>` +
    `</div>`;
}

/* [v9-I.2] 명단 입력 모달 열기 */
function openRosterInputModal(append = false) {
  /* [v9-J.1-C] append 모드 저장 — 모달 저장 버튼이 loadRoster(rosterAppendMode) 사용 */
  rosterAppendMode = append;
  /* [v9-I.3] 명단 탭 활성화 보장 — loadRoster 후 renderRoster 경로 안정화 */
  showTab('roster');
  const el = document.getElementById('rosterInputModal');
  if (!el) return;
  el.style.display = 'flex';
  /* 기존 입력 초기화 */
  const ta = document.getElementById('rosterInput');
  if (ta) {
    ta.value = '';
    ta.placeholder = '예) 홍길동, 가길동, 나길동, 다길동 ...\n(엑셀, 한글 표의 이름 열을 드래그하여 복붙 가능)\n\n※ 학생 명단은 사용자 컴퓨터의 브라우저에만 저장됩니다.\n※ 인터넷의 다른 공간에 저장되는 것이 아닙니다.';
  }
}

/* [v9-I.2] 명단 입력 모달 닫기 */
function closeRosterInputModal() {
  const el = document.getElementById('rosterInputModal');
  if (el) el.style.display = 'none';
}

/* [v9-I.2] 학급명 변경 — classId 불변, seat_classes name 필드만 수정 */
function renameClass(classId) {
  const current = getClassName(classId);
  const newName = prompt('새 학급 이름을 입력하세요.', current);
  if (!newName || !newName.trim()) return;
  const classes = getClassList();
  const target  = classes.find(c => c.id === classId);
  if (!target) return;
  target.name = newName.trim();
  localStorage.setItem('seat_classes', JSON.stringify(classes));
  renderClassSelector();
}

/* ══════════════════════════════════
   localStorage 로드 / 저장
══════════════════════════════════ */
function loadFromStorage() {
  /* [v9-I.1] 마이그레이션 → 학급 ID 초기화 → 학급 데이터 로드 */
  migrateExistingData();
  currentClassId = localStorage.getItem('seat_current_class') || '';
  if (currentClassId) {
    loadClassData(currentClassId);
    return;  /* 학급 데이터로 완전 교체, 이하 구 로드 코드 skip */
  }
  /* ── fallback: 학급 ID 없는 경우(비정상) 기존 방식으로 로드 ── */
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
  try { const sc = localStorage.getItem('seat_change_histories'); if (sc) seatChangeHistories = JSON.parse(sc) || []; } catch(e) {}  /* [v9-C.1] */
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
  if (!currentClassId) return;
  localStorage.setItem(`seat_${currentClassId}_students`, JSON.stringify(students));
}
function saveSettingsToStorage() {
  if (!currentClassId) return;
  const id = currentClassId;
  localStorage.setItem(`seat_${id}_grid_enabled`, JSON.stringify(gridEnabled));
  localStorage.setItem(`seat_${id}_groups`,       JSON.stringify(groups));
  localStorage.setItem(`seat_${id}_fixed_seats`,  JSON.stringify(fixedSeats));
  localStorage.setItem(`seat_${id}_banned`,       JSON.stringify(banned));
  /* [6-A] 성별존 저장 */
  localStorage.setItem(`seat_${id}_gender_zones`, JSON.stringify(genderZones));
}

/* [5번] 비밀번호 localStorage 저장/로드 */
function getSavedPassword() {
  return localStorage.getItem('seat_settings_password') || DEFAULT_PASSWORD;
}
function savePassword(pw) {
  localStorage.setItem('seat_settings_password', pw);
}
/* [v9-H.4] 비밀번호 분실 복구 함수 */
function getRecoveryQuestion() {
  return localStorage.getItem('seat_recovery_question') || '';
}
function getRecoveryAnswer() {
  return localStorage.getItem('seat_recovery_answer') || '';
}
function saveRecovery(question, answer) {
  localStorage.setItem('seat_recovery_question', question);
  localStorage.setItem('seat_recovery_answer', answer.trim().toLowerCase());
  alert('복구 설정이 저장되었습니다.');
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
    const isAbsent        = !!(seat && seat.absent);  /* [v9-J.4-A] 결석 여부 */
    const isCurrentPicked = pickedSeatIndexes.includes(i);
    const isPreviousPicked = !isCurrentPicked &&
      !pickerHighlightSuppressed &&           /* [v9-F.2] 창 닫힘 시 회색 억제 */
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
      const showMilk = s.milk && !inDahaesseo && !inDahaesseoGroup && showMilkView;

      inner.innerHTML = `
        <span class="${textCls} whitespace-nowrap">${s.name}</span>
        ${showDot  ? `<span class="w-1.5 h-1.5 rounded-full ${dotColor}"></span>` : ''}
        ${showMilk ? `<span class="milk-icon-wrap">${milkSVG(isCurrentPicked, isPreviousPicked)}</span>` : ''}`;

      /* 다했어요 완료 체크 아이콘 */
      if ((inDahaesseo && isDahaesseoDone) || (inDahaesseoGroup && isDahaesseoGroupDone)) {
        inner.innerHTML += `<span class="text-green-600 font-black text-sm ml-0.5">✓</span>`;
      }

      cell.appendChild(inner);

      /* [v9-J.4-A] 결석 표시 라벨 */
      if (isAbsent) {
        const absentEl = document.createElement('span');
        absentEl.className = 'absent-label';
        absentEl.textContent = '결석';
        cell.appendChild(absentEl);
      }

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
    /* [v9-J.4-A] 결석 학생 셀 투명도 */
    if (isAbsent) cell.style.opacity = '0.45';
    g.appendChild(cell);
  }
}

window.addEventListener('mouseup', () => {
  if (isDragging) {
    isDragging = false;
    startCellState = null;
    saveSettingsToStorage();
    /* [9-D.2] 자리 구조 변경 시 RR 자동 초기화 */
    if (roundRobinMode) resetRoundRobinState();
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
      /* [9-D.2] RR ON 중 자리 고정 차단 */
      if (roundRobinMode) {
        alert('계속 새로운 짝 만나기 기능이 활성화되어 있을 때에는 자리 고정을 사용할 수 없습니다.');
        fixModeActive = false;
        fixModeStudentIdx = null;
        document.getElementById('fixModeStatus').style.display = 'none';
        renderGrid();
        return;
      }
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
    if (!gridEnabled[i]) return;  /* [v9-F.7] 비활성 셀 모둠 배정 차단 */
    startCellState = groups.assignments[i] === activeGroup ? 0 : activeGroup;
    groups.assignments[i] = startCellState;
    /* [v9-F.4] 모둠 배정 즉시 저장 — 닫기 경로와 무관하게 데이터 보존 */
    saveSettingsToStorage();
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
  if (activeGroup > 0) {
    if (!gridEnabled[i]) return;  /* [v9-F.7] 드래그 중 비활성 셀 모둠 배정 차단 */
    groups.assignments[i] = startCellState;
  } else gridEnabled[i] = startCellState;
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
/* [v9-H.1] 자리바꾸기 사전 충돌 검사
   반환: 충돌 없으면 [] / 있으면 사람이 읽을 수 있는 문자열 배열 */
function checkShuffleConflicts() {
  const conflicts = [];
  const seen = new Set();  /* 동일 쌍 중복 출력 방지 */

  /* ── 충돌 유형 #1: 자리 고정 + 짝 방지 ──────────────────────
     banned 쌍의 두 학생이 모두 fixedSeats에 등록되어 있고
     해당 좌석이 실제로 인접(같은 행, 열 차이 1)한 경우          */
  for (const [a, b] of banned) {
    const sA = fixedSeats[a];   // 학생a의 고정 좌석 번호 (없으면 undefined)
    const sB = fixedSeats[b];   // 학생b의 고정 좌석 번호
    if (sA === undefined || sB === undefined) continue;
    const sameRow = Math.floor(sA / 8) === Math.floor(sB / 8);
    const adjacent = Math.abs(sA - sB) === 1;
    if (sameRow && adjacent) {
      const nameA = students[a]?.name ?? `학생${a}`;
      const nameB = students[b]?.name ?? `학생${b}`;
      const key   = `${Math.min(a, b)}-${Math.max(a, b)}`;
      if (!seen.has(key)) {
        seen.add(key);
        conflicts.push(`${nameA} ↔ ${nameB} : 자리 고정 + 짝 방지`);
      }
    }
  }

  /* ── 충돌 유형 #2: 같은성별 앉기 + 짝 방지 ─────────────────
     sameGenderOn 활성 상태에서 banned 쌍의 두 학생이 동성이고
     해당 성별 학생이 2명 이하인 경우 (필연적으로 짝이 됨)        */
  if (sameGenderOn) {
    for (const [a, b] of banned) {
      if (!students[a] || !students[b]) continue;
      const gA = students[a].gender;
      const gB = students[b].gender;
      if (gA !== gB) continue;
      const sameGenderCount = students.filter(s => s.gender === gA).length;
      if (sameGenderCount <= 2) {
        const key = `${Math.min(a, b)}-${Math.max(a, b)}`;
        if (!seen.has(key)) {
          seen.add(key);
          const nameA = students[a].name;
          const nameB = students[b].name;
          conflicts.push(`${nameA} ↔ ${nameB} : 같은성별 앉기 + 짝 방지`);
        }
      }
    }
  }

  return conflicts;
}

function startShuffle() {
  /* [v9-H.3] 자리 지정 모드 종료 — 자리바꾸기 실행 시 번호 잔류 방지 */
  exitFixMode();
  /* [v9-H.1] 사전 충돌 검사 — 애니메이션/doShuffle 진입 전 차단 */
  const conflicts = checkShuffleConflicts();
  if (conflicts.length > 0) {
    alert(
      '자리바꾸기를 실행할 수 없습니다.\n\n' +
      conflicts.map((v, i) => `${i + 1}. ${v}`).join('\n') +
      '\n\n설정을 수정한 후 다시 시도하세요.'
    );
    return;
  }

  if (students.length === 0) return;
  pickedSeatIndexes = [];

  /* [6-A] 성별 초과 경고 — 초과 시 셔플 차단 */
  const mStudents = students.filter(s => !s.absent && s.gender === 'M').length;
  const fStudents = students.filter(s => !s.absent && s.gender === 'F').length;
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

  /* [9-D.5] RR 종료 사전 검사 — 애니메이션 시작 전 차단 */
  if (roundRobinMode) {
    const _rrN  = rrStudentOrder.length + (rrStudentOrder.length % 2 === 1 ? 1 : 0);
    const _maxR = _rrN > 1 ? _rrN - 1 : 0;
    if (currentRoundIndex >= _maxR) {
      alert(`모든 회차(${_maxR}번)가 완료되었습니다.\n설정 탭에서 초기화하거나 모드를 끄고 다시 시작하세요.`);
      return;
    }
  }

  /* [v9-C.3] 중복 실행 방지 */
  if (isShuffling) return;
  isShuffling = true;

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
    /* [v10-B.3] 자리변경 기록 자동 저장 — 확인창 제거 */
    setTimeout(() => {
      saveSeatChangeHistory();
      isShuffling = false;
    }, 1200);
  }, 3000);
}

function doShuffle() {
  /* [9-D] 라운드 로빈 모드 분기 */
  if (roundRobinMode) {
    executeRoundRobinShuffle();
    return;
  }

  /* ── 기존 random shuffle (변경 없음) ── */
  previousSeats = [...currentSeats];
  currentSeats  = Array(40).fill(null);

  const enabled = [];
  for (let i = 0; i < 40; i++) if (gridEnabled[i]) enabled.push(i);

  let pool  = students.filter(s => !s.absent);  /* [v9-J.2] 결석 학생 제외 */
  let slots = [...enabled];

  for (let si in fixedSeats) {
    const seatIdx = fixedSeats[si];
    if (gridEnabled[seatIdx]) {
      if (students[si] && students[si].absent) continue;  /* [v9-J.4-A] 결석 학생 고정 배치 skip */
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
  saveCurrentClass();  /* [v10-B.1] 자리배치 결과 즉시 저장 */
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
  /* [9-D.2] 자리 초기화 시 RR 자동 초기화 */
  if (roundRobinMode) resetRoundRobinState();
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
  /* [v9-H.3] 자리 지정 모드 종료 — 탭 전환 시 fixModeActive 상태 누수 방지 */
  exitFixMode();
  renderSide();
}

function toggleSidebar() {
  /* [v9-B.1] mode='list', toggle open/close + 뽑기창 자동 닫기 */
  const sb = document.getElementById('sidebar');
  if (!sb) return;
  const hidden = sb.style.transform === 'translateX(100%)' || sb.style.transform === '';
  if (hidden) {
    /* 뽑기창 자동 닫기 */
    closePickerPanel();
    sb.style.transform = 'translateX(0)';
    currentMode = 'list';
    showTab('roster');
    updateSidebarBtn(true);
  } else {
    if (currentMode === 'list') {
      sb.style.transform = 'translateX(100%)';  /* 같은 mode → close */
      updateSidebarBtn(false);
      /* [v9-F.4] 사이드바 닫힘 시 모둠 편집 상태 종료 — showTab 미호출 경로 보완 */
      activeGroup = 0;
      /* [v9-H.3] 자리 지정 모드 종료 — 사이드바 닫힘 시 fixModeActive 누수 방지 */
      exitFixMode();
    } else {
      currentMode = 'list';                      /* draw→list 전환 */
      showTab('roster');
      updateSidebarBtn(true);
    }
  }
}

function openPickerTab() {
  /* [v9-H.3] 자리 지정 모드 종료 — 뽑기 메뉴 진입 시 showTab 우회 경로 보완 */
  exitFixMode();
  /* [v9-B.3] pickerPanelOpen 플래그 방식 — transform 문자열 비교 버그 수정 */
  const pp = document.getElementById('pickerPanel');
  if (!pp) return;
  if (pickerPanelOpen) {
    closePickerPanel();
  } else {
    /* [v9-F.2] 모둠 편집 상태 초기화 — 뽑기창에서 모둠 배정 누수 방지 */
    activeGroup = 0;
    /* [v9-F.2] 창 열림 시 하이라이트 억제 해제 — 이전 회차 기록 표시 복원 */
    pickerHighlightSuppressed = false;
    /* 설정창 자동 닫기 */
    const sb = document.getElementById('sidebar');
    if (sb) sb.style.transform = 'translateX(100%)';
    updateSidebarBtn(false);
    /* 뽑기창 열기 */
    pp.style.transform = 'translateX(0)';
    pickerPanelOpen = true;
    updatePickerBtn(true);
    renderPickerPanel();
  }
}

function closePickerPanel() {
  const pp = document.getElementById('pickerPanel');
  if (pp) pp.style.transform = 'translateX(100%)';
  pickerPanelOpen = false;    /* [v9-B.3] */
  updatePickerBtn(false);
  /* [v9-F.2] 모둠 편집 상태 초기화 — 뽑기창 닫힘 후 모둠 배정 누수 방지 */
  activeGroup = 0;
  /* [v9-F.2] UI 하이라이트 제거 (historyPickedNames 유지) */
  clearPickerUIEffects();
}

function renderPickerPanel() {
  /* 뽑기 입력값 저장 (렌더 직전) */
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
  /* [v9-F.1] 특정 모둠 뽑기 입력값 저장 */
  const elOGN = document.getElementById('pickOneGroupNum');
  const elOGC = document.getElementById('pickOneGroupCount');
  if (elOGN) lastPickOneGroupNum   = parseInt(elOGN.value)   || 1;
  if (elOGC) lastPickOneGroupCount = parseInt(elOGC.value)   || 1;
  /* 기존 renderPickerMenu 재사용 */
  const c = document.getElementById('pickerContent');
  if (c) renderPickerMenu(c);
}

/* 뽑기 버튼 상태 업데이트 */
function updatePickerBtn(active) {
  const btn = document.getElementById('btnOpenPicker');
  if (!btn) return;
  if (active) {
    btn.classList.add('active-mode');
    btn.innerHTML = '🔴<br><span class="text-xs">뽑기메뉴<br>닫힘</span>';
  } else {
    btn.classList.remove('active-mode');
    btn.innerHTML = '📢 뽑기 메뉴';
  }
}

/* 설정 버튼 상태 업데이트 */
function updateSidebarBtn(active) {
  const btn = document.getElementById('btnToggleSidebar');
  if (!btn) return;
  if (active) {
    btn.classList.add('active-mode');
    btn.innerHTML = '🔴<br><span class="text-xs">설정창<br>닫힘</span>';
  } else {
    btn.classList.remove('active-mode');
    btn.innerHTML = '⚙️ 설정';
  }
}

/* [3번] 설정 탭 비밀번호 입력 */
function openSettingsWithPassword() {
  const pw    = getSavedPassword();
  const input = prompt('설정 메뉴 비밀번호 4자리를 입력하세요.');
  if (input === null) return;
  if (input === pw) {
    /* [v9-B.1] 뽑기창 자동 닫기 */
    closePickerPanel();
    const sb = document.getElementById('sidebar');
    if (sb) sb.style.transform = 'translateX(0)';
    currentMode = 'list';
    showTab('settings');
    updateSidebarBtn(true);
  } else {
    alert('비밀번호가 올바르지 않습니다.');
    /* [v9-H.4] 복구 질문이 설정된 경우 복구 절차 제공 */
    const rq = getRecoveryQuestion();
    if (!rq) return;
    const ans = prompt(`비밀번호를 잊으셨나요?\n\n복구 질문: ${rq}`);
    if (ans === null) return;
    if (ans.trim().toLowerCase() === getRecoveryAnswer()) {
      alert(`현재 비밀번호는 [ ${getSavedPassword()} ] 입니다.`);
    } else {
      alert('복구 답변이 올바르지 않습니다.');
    }
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
  /* [UI통합] 토글 스위치 active 클래스로 ON/OFF 표현
     groupViewOn=true  → 스위치 활성(우측)
     groupViewOn=false → 스위치 비활성(좌측) */
  const sw = document.getElementById('groupViewSwitch');
  if (!sw) return;
  sw.classList.toggle('active', groupViewOn);
}

/* ══════════════════════════════════
   [5차-B] 1인1역 보기 ON/OFF
══════════════════════════════════ */
function toggleRoleView() {
  roleViewOn = !roleViewOn;
  if (currentClassId) localStorage.setItem(`seat_${currentClassId}_role_view_on`, JSON.stringify(roleViewOn));
  updateRoleViewButton();
  renderGrid();
}

function updateRoleViewButton() {
  /* [UI통합] 토글 스위치 active 클래스로 ON/OFF 표현
     roleViewOn=true  → 스위치 활성(우측)
     roleViewOn=false → 스위치 비활성(좌측) */
  const sw = document.getElementById('roleViewSwitch');
  if (!sw) return;
  sw.classList.toggle('active', roleViewOn);
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
    btn.innerHTML = '👤<br><span class="text-xs">다했어요</span>';
  }
}

/* 더보기 메뉴에서 제거됐으므로 no-op 유지 */
function updateDahaesseoMenuBtn() {}

function checkDahaesseoAllDone() {
  const seated = currentSeats.filter(s => s && !s.absent).map(s => s.name);  /* [v9-J.4-A] absent 제외 */
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
    btn.innerHTML = '🔴<br><span class="text-xs" style="line-height:1.2;text-align:center;">다했어요(모둠)<br>종료</span>';
  } else {
    btn.classList.remove('active-mode');
    btn.innerHTML = '👥<br><span class="text-xs">다했어요(모둠)</span>';
  }
}

/* 더보기 메뉴에서 제거됐으므로 no-op 유지 */
function updateDahaesseoGroupMenuBtn() {}

function checkDahaesseoGroupAllDone() {
  if (!groups || groups.count === 0) return;
  const activeGroups = new Set();
  for (let i = 0; i < 40; i++) {
    if (currentSeats[i] && !currentSeats[i].absent && groups.assignments && groups.assignments[i] > 0)  /* [v9-J.4-A] absent 제외 */
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
  if (currentClassId) localStorage.setItem(`seat_${currentClassId}_daha_histories`, JSON.stringify(dahaesseoHistories));
  alert(`"${title}" 기록이 저장되었습니다.`);

  /* 히스토리 탭이 열려있으면 즉시 갱신 */
  if (currentTab === 'history') renderSide();
}

/* [21] localStorage 저장 */
function saveDahaHistoriesToStorage() {
  if (currentClassId) localStorage.setItem(`seat_${currentClassId}_daha_histories`, JSON.stringify(dahaesseoHistories));
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
        남은 인원: <strong>${students.filter(s=>!s.absent).length - roleRows.reduce((sum, r) => sum + (parseInt(r.count) || 0), 0)}명</strong>
        <span class="text-slate-400 text-xs ml-1">(출석 ${students.filter(s=>!s.absent).length}명 / 배정 계획 ${roleRows.reduce((sum, r) => sum + (parseInt(r.count) || 0), 0)}명)</span>
      </div>
    </div>

    <!-- ── [2] 우리 반 명단 섹션 (배정표 아래로 이동) ── -->
    <div class="role-section">
      <div class="role-section-title">우리 반 명단</div>
      <div class="role-student-grid">
        ${students.map(s => `
          <div class="role-student-tile ${assigned.has(s.name) ? 'assigned' : ''} ${s.absent ? 'role-student-absent' : ''}"
            draggable="${assigned.has(s.name) || s.absent ? 'false' : 'true'}"
            ondragstart="${s.absent ? '' : `roleDragStart(event,'student','${s.name}')`}"
            ondragend="${s.absent ? '' : 'roleDragEnd(event)'}">
            ${s.name}${s.absent ? ' <span style="font-size:10px;color:#94a3b8;">(결석)</span>' : ''}
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
  if (currentClassId) localStorage.setItem(`seat_${currentClassId}_role_rows`, JSON.stringify(roleRows));

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
  if (currentClassId) localStorage.removeItem(`seat_${currentClassId}_role_rows`);
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

  /* 전체 학생 목록 셔플 (absent 제외) [v9-J.4-A] */
  const pool = [...students.filter(s => !s.absent).map(s => s.name)];
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
  /* [v9-F.1] 특정 모둠 뽑기 입력값 저장 */
  const elOGN = document.getElementById('pickOneGroupNum');
  const elOGC = document.getElementById('pickOneGroupCount');
  if (elOGN) lastPickOneGroupNum   = parseInt(elOGN.value)   || 1;
  if (elOGC) lastPickOneGroupCount = parseInt(elOGC.value)   || 1;

  if      (currentTab === 'roster')      renderRoster(c);
  else if (currentTab === 'group')       renderGroup(c);
  else if (currentTab === 'seatHistory') renderSeatHistory(c);  /* [v9-C.1] */
  else if (currentTab === 'history')     renderHistory(c);
  else if (currentTab === 'settings')    renderSettings(c);
  else if (currentTab === 'manual')      renderManual(c);
  /* [v9-B.1] picker는 독립 pickerPanel로 분리됨 */
}

/* ══════════════════════════════════
   사용안내 탭 (v9-B.2)
══════════════════════════════════ */
function renderManual(c) {
  /* [v9-G.2] _buildManualHTML() 공통 렌더러 사용 */
  c.innerHTML = _buildManualHTML();
}

/* ══════════════════════════════════
   명단 관리 탭
══════════════════════════════════ */
function renderRoster(c) {
  /* [v9-I.1] 학급 선택 임시 UI */
  let selectorHtml = '';
  if (getClassList().length > 0) {
    selectorHtml = '<div id="classSelector"></div>';
  }
  c.innerHTML = selectorHtml + `
    <div class="flex gap-1 mb-3">
      <button onclick="openRosterInputModal(false)" class="flex-1 py-2 bg-emerald-400 text-white rounded-lg font-bold text-xs hover:bg-emerald-500">명단 등록</button>
      <button onclick="openRosterInputModal(true)"  class="flex-1 py-2 bg-sky-400    text-white rounded-lg font-bold text-xs hover:bg-sky-500">학생 추가</button>
      <button onclick="openRolePopup()"              class="flex-1 py-2 bg-violet-400 text-white rounded-lg font-bold text-xs hover:bg-violet-500">1인1역 등록</button>
      <button onclick="toggleTransferMode()"         class="flex-1 py-2 ${transferMode ? 'bg-orange-500' : 'bg-slate-400'} text-white rounded-lg font-bold text-xs hover:opacity-80">전학</button>
      <button onclick="clearRoster()"                class="flex-1 py-2 bg-rose-400   text-white rounded-lg font-bold text-xs hover:bg-rose-500">명단 초기화</button>
    </div>
    <table class="w-full text-xs border-collapse">
      <tr class="bg-slate-100">
        <th class="p-1 border">#</th>
        <th class="p-1 border">이름</th>
        <th class="p-1 border">성별</th>
        <th class="p-1 border">우유</th>
        <th class="p-1 border">결석</th>
        ${transferMode ? '<th class="p-1 border">삭제</th>' : '<th class="p-1 border"></th>'}
      </tr>
      ${students.map((s, i) => `
        <tr class="hover:bg-slate-50 cursor-grab"
          draggable="true"
          ondragstart="rosterDragStart(${i})"
          ondragover="rosterDragOver(event)"
          ondrop="rosterDrop(event,${i})"
          ondragend="rosterDragEnd()">
          <td class="p-1 border text-center text-slate-400 select-none">${s.number ?? (i + 1)}</td>
          <td class="p-1 border font-medium ${s && s.absent ? 'opacity-50' : ''}">
            <div class="flex items-center justify-between gap-1">
              <span class="${s && s.absent ? 'line-through text-slate-400' : ''}">${s ? s.name : ''}</span>
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
            <button onclick="toggleAbsent(${i})"
              class="text-xs font-bold px-1 py-0.5 rounded ${s && s.absent ? 'bg-slate-200 text-slate-500' : 'bg-sky-100 text-sky-600'}">
              ${s && s.absent ? '결석' : '출석'}
            </button>
          </td>
          <td class="p-1 border text-center">
            ${transferMode
              ? `<button onclick="removeStudent(${i})" class="text-red-400 hover:text-red-600">✕</button>`
              : ''}
          </td>
        </tr>`).join('')}
    </table>`;
  /* [v9-I.1] 학급 선택 UI 렌더링 */
  renderClassSelector();
}

function loadRoster(append) {
  const txt = document.getElementById('rosterInput').value.trim();
  if (!txt) return;
  const lines = txt.split(/[\n,]+/).filter(l => l.trim());  /* [v9-B.3] 쉼표 입력 지원 */
  /* [v9-J.6-A] append 모드: 기존 최대 number 기준으로 연번 부여 */
  const baseNumber = append && students.length > 0
    ? Math.max(...students.map(s => (typeof s.number === 'number' && !isNaN(s.number)) ? s.number : 0))
    : 0;
  const newS = lines.map((l, idx) => {
    const parts = l.split(/\t/);
    /* 우유 기본값: ON(true) — 탭+O 명시 시에도 ON, 미명시 시에도 ON */
    const milkFlag = parts[1] ? parts[1].trim().toUpperCase() === 'O' : true;
    return { number: baseNumber + idx + 1, name: parts[0].trim(), milk: milkFlag, gender: 'M', absent: false };
  });
  if (append) {
    students = [...students, ...newS];
    saveStudentsToStorage();
    /* [9-D.2] 학생 변경 시 RR 자동 초기화 */
    if (roundRobinMode) resetRoundRobinState();
    renderSide();
    renderGrid();
  } else if (students.length > 0) {
    /* [v10-B.2] 기존 명단 존재 시 덮어쓰기 경고 */
    showCustomConfirm(
      '현재 등록된 학생 명단이 모두 삭제되고 새 명단으로 교체됩니다.\n계속하시겠습니까?',
      () => {
        students = newS;
        saveStudentsToStorage();
        if (roundRobinMode) resetRoundRobinState();
        renderSide();
        renderGrid();
      },
      () => { /* NO: 아무것도 하지 않음, 모달 유지 */ }
    );
  } else {
    students = newS;
    saveStudentsToStorage();
    if (roundRobinMode) resetRoundRobinState();
    renderSide();
    renderGrid();
  }
}

/* 명단 초기화 — 확인창 포함 */
function clearRoster() {
  /* [v9-J.1-A] 비밀번호 인증 — 오입력 시 초기화 차단 */
  const input = prompt('명단 초기화를 위해 비밀번호를 입력하세요.');
  if (input === null) return;
  if (input !== getSavedPassword()) {
    alert('비밀번호가 올바르지 않습니다.');
    return;
  }
  students   = [];
  fixedSeats = {};
  saveStudentsToStorage();
  saveSettingsToStorage();
  /* [9-D.2] 명단 초기화 시 RR 자동 초기화 */
  if (roundRobinMode) resetRoundRobinState();
  renderSide();
  renderGrid();
}

/* [v9-J.1-B] 전학모드 토글 */
function toggleTransferMode() {
  transferMode = !transferMode;
  renderSide();
}

function toggleMilk(i)   { if (students[i]) { students[i].milk   = !students[i].milk;   saveStudentsToStorage(); const c=document.getElementById('sideContent'); if(c&&currentTab==='roster'){renderRoster(c);} renderGrid(); } }
function toggleGender(i) { if (students[i]) { students[i].gender = students[i].gender === 'M' ? 'F' : 'M'; saveStudentsToStorage(); const c=document.getElementById('sideContent'); if(c&&currentTab==='roster'){renderRoster(c);} renderGrid(); } }
/* [v9-J.2] 결석(임시제외) 토글 */
/* [v9-J.2] 결석(임시제외) 토글 */
function toggleAbsent(i) {
  if (students[i]) {
    students[i].absent = !students[i].absent;
    saveStudentsToStorage();
    /* [v9-J.4-A] RR 모드 중 결석 변경 시 rrStudentOrder 즉시 재생성 */
    if (roundRobinMode) rrStudentOrder = students.filter(s => !s.absent);
    const c = document.getElementById('sideContent');
    if (c && currentTab === 'roster') { renderRoster(c); }
    renderGrid();
  }
}
/* [v9-J.6-C] 명단 드래그 재정렬 ─────────────────────────────────────────────
   STEP A/B: 이동 전 fixedSeats/banned를 학생 객체 참조 기반으로 스냅샷
   STEP C:   students splice (객체 참조 유지, deep copy 금지)
   STEP D/E: 새 indexOf로 fixedSeats/banned 재매핑
   STEP F:   number 1~N 자동 재부여
   STEP G:   저장
   STEP H:   UI 갱신 */
function rosterDragStart(i) {
  rosterDragFrom = i;
}
function rosterDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
}
function rosterDragEnd() {
  rosterDragFrom = null;
}
function rosterDrop(e, toIndex) {
  e.preventDefault();
  const fromIndex = rosterDragFrom;
  rosterDragFrom = null;
  if (fromIndex === null || fromIndex === toIndex) return;

  /* ── STEP A: fixedSeats → Map<학생객체, 자리인덱스> ── */
  const objToSeat = new Map();
  for (const si in fixedSeats) {
    const obj = students[parseInt(si)];
    if (obj) objToSeat.set(obj, fixedSeats[si]);
  }

  /* ── STEP B: banned → [[학생객체a, 학생객체b], ...] ── */
  const objBanned = banned.map(([a, b]) => [students[a], students[b]]);

  /* ── STEP C: students 배열 이동 (객체 참조 유지) ── */
  const moved = students.splice(fromIndex, 1)[0];
  students.splice(toIndex, 0, moved);

  /* ── STEP D: fixedSeats 재구성 ── */
  Object.keys(fixedSeats).forEach(k => delete fixedSeats[k]);
  objToSeat.forEach((seatIdx, obj) => {
    const newIdx = students.indexOf(obj);
    if (newIdx !== -1) fixedSeats[newIdx] = seatIdx;
  });

  /* ── STEP E: banned 재구성 ── */
  banned.length = 0;
  objBanned.forEach(([objA, objB]) => {
    const newA = students.indexOf(objA);
    const newB = students.indexOf(objB);
    if (newA !== -1 && newB !== -1) banned.push([newA, newB]);
  });

  /* ── STEP F: number 1~N 자동 재부여 ── */
  students.forEach((s, idx) => { s.number = idx + 1; });

  /* ── STEP G: 저장 ── */
  saveStudentsToStorage();
  saveSettingsToStorage();

  /* ── STEP H: UI 갱신 — roster + settings 탭 stale 방지 ── */
  renderSide();
}

/* [v9-F.8] 우유 아이콘 표시 토글 */
function toggleMilkView() {
  showMilkView = !showMilkView;
  updateMilkViewButton();
  renderGrid();
}

function updateMilkViewButton() {
  /* [UI통합] 토글 스위치 active 클래스로 ON/OFF 표현
     showMilkView=true  → 스위치 활성(우측)
     showMilkView=false → 스위치 비활성(좌측) */
  const sw = document.getElementById('milkViewSwitch');
  if (!sw) return;
  sw.classList.toggle('active', showMilkView);
}
function removeStudent(i) {
  students.splice(i, 1);
  delete fixedSeats[i];
  saveStudentsToStorage();
  saveSettingsToStorage();
  /* [9-D.2] 학생 삭제 시 RR 자동 초기화 */
  if (roundRobinMode) resetRoundRobinState();
  renderSide();
  renderGrid();
}

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
    <div class="flex items-center gap-2 mb-3">
      <label class="text-sm font-bold">모둠 수:</label>
      <input type="number" id="groupCount" value="${groups.count}" min="0" max="8"
        class="w-16 border rounded p-1 text-center"
        oninput="previewGroupCount(this.value)">
    </div>
    <div class="flex flex-wrap gap-2 mb-3" id="groupBtns"></div>
    <div class="flex gap-1 mb-2">
      <button onclick="applyGroups()" style="flex:6"
        class="py-1.5 bg-violet-400 text-white rounded-lg text-sm font-bold hover:bg-violet-500 shadow transition">
        💾 저장
      </button>
      <button onclick="resetGroupSettings()" style="flex:4"
        class="py-1.5 bg-rose-400 hover:bg-rose-500 text-white rounded-lg text-xs font-bold shadow transition">
        ❌ 초기화
      </button>
    </div>
    <p class="text-xs text-slate-500">모둠 버튼 선택 후 좌측 자리를 드래그하거나 클릭하여 연속 지정하세요.</p>`;
  renderGroupBtns();
}

function setGroups() {
  /* [v9-F.4] setGroups는 applyGroups의 alias로 축소 — assignments 초기화 제거 */
  applyGroups();
}

/* [v9-F.4] PREVIEW 단계 — 모둠 수 즉시 반영 (assignments 유지, orphan만 정리) */
function previewGroupCount(n) {
  const newCount = Math.min(8, Math.max(0, parseInt(n) || 0));
  groups.count   = newCount;
  /* orphan 정리: 초과 모둠 번호 배정 → 0 */
  for (let i = 0; i < 40; i++) {
    if (groups.assignments[i] > newCount) groups.assignments[i] = 0;
  }
  /* activeGroup orphan 정리 */
  if (activeGroup > newCount) activeGroup = 0;
  renderGroupBtns();
  renderGrid();
}

/* [v9-F.4] APPLY 단계 — 설정 확정 + 편집 상태 종료 */
function applyGroups() {
  saveSettingsToStorage();
  activeGroup = 0;
  renderGroupBtns();
  alert('모둠 설정이 완료되었습니다.');
}

/* [v9-F.4] 배치된 모든 학생이 모둠에 배정되었는지 판별
   true  → 자리에 앉은 모든 학생이 groups.assignments > 0
   false → 미배정 학생 존재 / 모둠 없음 / 자리 배치 전 */
function isAllStudentsAssigned() {
  if (!groups || groups.count === 0) return false;
  const seated = currentSeats
    .map((s, i) => ({ s, i }))
    .filter(x => x.s !== null);
  if (seated.length === 0) return false;
  return seated.every(x => groups.assignments[x.i] > 0);
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

      <!-- [9-D] 계속 새로운 짝 만나기 토글 -->
      <div class="mt-3 border-t border-slate-100 pt-3">
        <label class="flex items-center gap-2 cursor-pointer">
          <button class="toggle-switch ${roundRobinMode ? 'active' : ''}"
            onclick="toggleRoundRobinMode();"></button>
          <span class="text-sm font-bold text-slate-700">계속 새로운 짝 만나기</span>
        </label>
        ${roundRobinMode ? (() => {
          const N       = students.length + (students.length % 2 === 1 ? 1 : 0);
          const maxR    = N > 1 ? N - 1 : 0;
          const remain  = Math.max(0, maxR - currentRoundIndex);
          return `<div class="mt-2 text-xs text-slate-500 space-y-0.5">
            <div>최대 <strong>${maxR}번</strong>까지 바꿀 수 있어요</div>
            <div>앞으로 <strong>${remain}번</strong> 더 바꿀 수 있어요</div>
            ${currentRoundIndex >= maxR
              ? '<div class="text-amber-600 font-bold mt-1">⚠️ 모든 회차가 완료되었습니다. 초기화 후 다시 시작하세요.</div>'
              : ''}
          </div>`;
        })() : ''}
        ${isRoundRobinBlocked() ? `<div class="mt-1 text-xs text-red-500 font-bold leading-snug">자리가 지정되어 있거나, 짝궁 방지가 입력되어 있다면 새로운 짝 계속 만나기 기능을 사용할 수 없습니다.</div>` : ''}
      </div>
    </div>

    <!-- ── 비밀번호 변경 카드 ── -->
    <div class="settings-card">
      <div class="settings-card-title">🔐 비밀번호 변경</div>
      <div class="flex flex-col gap-1 items-start">  <!-- [v9-B.3] gap 축소 -->
        <input type="password" id="pwCurrent" class="pw-input w-48" placeholder="현재 비밀번호 (4자리)" maxlength="4">
        <input type="password" id="pwNew"     class="pw-input w-48" placeholder="새 비밀번호 (4자리)"   maxlength="4">
        <input type="password" id="pwConfirm" class="pw-input w-48" placeholder="새 비밀번호 확인"       maxlength="4">
        <button onclick="changePassword()"
          class="px-4 py-1.5 bg-indigo-400 hover:bg-indigo-500 text-white rounded-lg font-bold text-sm shadow transition">
          🔑 변경
        </button>
        <p class="text-xs text-slate-400">숫자 4자리만 허용됩니다.</p>
      </div>
      <!-- [v9-H.4] 비밀번호 분실 복구 설정 -->
      <div class="mt-3 pt-3" style="border-top:1px solid #e2e8f0;">
        <div class="text-xs font-bold text-slate-600 mb-2">🔓 비밀번호 분실 복구 설정</div>
        <div class="flex flex-col gap-1 items-start">
          <select id="recoveryQuestion" class="pw-input w-48 text-xs">
            <option value="">질문 선택...</option>
            <option value="내가 졸업한 초등학교 이름은?">내가 졸업한 초등학교 이름은?</option>
            <option value="나의 생일은? (MMDD 형식)">나의 생일은? (MMDD 형식)</option>
            <option value="내가 가르치는 학년과 반은? (예: 3학년 2반)">내가 가르치는 학년과 반은?</option>
          </select>
          <input type="text" id="recoveryAnswer" class="pw-input w-48" placeholder="복구 답변 입력">
          <button onclick="saveRecoveryFromUI()"
            class="px-4 py-1.5 bg-teal-400 hover:bg-teal-500 text-white rounded-lg font-bold text-sm shadow transition">
            💾 복구 설정 저장
          </button>
          <p id="recoveryStatus" class="text-xs text-slate-400"></p>
        </div>
      </div>
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

/* [v9-H.4] UI에서 복구 설정 저장 */
function saveRecoveryFromUI() {
  const q = document.getElementById('recoveryQuestion')?.value || '';
  const a = document.getElementById('recoveryAnswer')?.value   || '';
  if (!q) { alert('복구 질문을 선택해주세요.'); return; }
  if (!a.trim()) { alert('복구 답변을 입력해주세요.'); return; }
  saveRecovery(q, a);
  const st = document.getElementById('recoveryStatus');
  if (st) st.textContent = '✅ 저장됨: ' + q;
}

/* [v9-H.4] 커스텀 confirm — 우측하단 비블로킹 알림 카드
   cbYes / cbNo 콜백 양쪽 모두에서 isShuffling=false 처리 필수 */
function showCustomConfirm(message, cbYes, cbNo) {
  const el = document.getElementById('customConfirm');
  if (!el) { /* fallback: 기존 방식 */
    if (confirm(message)) { cbYes(); } else { cbNo(); }
    return;
  }
  document.getElementById('ccMessage').textContent = message;
  el.style.display = 'flex';
  /* 이전 리스너 제거 후 재등록 */
  const yesBtn = document.getElementById('ccYesBtn');
  const noBtn  = document.getElementById('ccNoBtn');
  const yesNew = yesBtn.cloneNode(true);
  const noNew  = noBtn.cloneNode(true);
  yesBtn.parentNode.replaceChild(yesNew, yesBtn);
  noBtn.parentNode.replaceChild(noNew, noBtn);
  yesNew.addEventListener('click', () => { el.style.display = 'none'; cbYes(); });
  noNew.addEventListener('click',  () => { el.style.display = 'none'; cbNo();  });
}

/* [v9-H.3] 자리 지정 모드 공통 종료 함수
   fixModeActive=true 인 경우만 초기화 및 그리드 재렌더링 수행 */
function exitFixMode() {
  if (!fixModeActive) return;
  fixModeActive = false;
  fixModeStudentIdx = null;
  const fms = document.getElementById('fixModeStatus');
  if (fms) fms.style.display = 'none';
  renderGrid();
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
  /* [9-D.2] RR ON 중 짝방지 추가 차단 */
  if (roundRobinMode) {
    alert('계속 새로운 짝 만나기 기능이 활성화되어 있을 때에는 짝 방지 기능을 사용할 수 없습니다.');
    return;
  }
  const a = parseInt(document.getElementById('banA').value);
  const b = parseInt(document.getElementById('banB').value);
  if (!isNaN(a) && !isNaN(b) && a !== b) banned.push([a, b]);
  saveSettingsToStorage();
  renderSide();
}

function removeBan(i) { banned.splice(i, 1); saveSettingsToStorage(); renderSide(); }

/* ══════════════════════════════════
   [v9-C.1] 자리변경 기록 시스템
══════════════════════════════════ */
function saveSeatChangeHistory() {
  /* [v9-C.3] 저장 전 검증 */
  if (!currentSeats || currentSeats.filter(Boolean).length === 0) return;
  if (!gridEnabled || gridEnabled.length === 0) return;

  const now  = new Date();
  const date = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
  const record = {
    id:          Date.now(),
    date,
    seats:       JSON.parse(JSON.stringify(currentSeats)),   /* [v9-C.3] deep copy */
    gridEnabled: [...gridEnabled],
    groups:      JSON.parse(JSON.stringify(groups)),
    fixedSeats:  JSON.parse(JSON.stringify(fixedSeats)),
    banned:      JSON.parse(JSON.stringify(banned)),          /* [v9-C.3] deep copy */
    roundRobinMode,                                           /* [9-D] RR 여부 */
    roundIndex:  roundRobinMode ? currentRoundIndex - 1 : -1 /* [9-D] 저장 시점 회차 */
  };
  seatChangeHistories.unshift(record);
  if (currentClassId) localStorage.setItem(`seat_${currentClassId}_change_histories`, JSON.stringify(seatChangeHistories));
  /* [v10-B.3] 자동 저장 — alert 제거 */
  if (currentTab === 'seatHistory') renderSide();
}

/* [v9-C.2/C.3] 자리변경 기록 복원 */
function loadSeatFromHistory(id) {
  const rec = seatChangeHistories.find(r => r.id === id);
  if (!rec) return;
  if (confirm(`${rec.date}의 자리 배치로 변경하시겠습니까?`)) {
    applySeatHistory(rec);
  }
}

function applySeatHistory(rec) {
  /* [v9-C.3] 복원 순서 고정 + 완전 상태 복원 */
  previousSeats = JSON.parse(JSON.stringify(currentSeats));
  currentSeats  = JSON.parse(JSON.stringify(rec.seats));
  gridEnabled   = [...rec.gridEnabled];
  groups        = JSON.parse(JSON.stringify(rec.groups));
  fixedSeats    = JSON.parse(JSON.stringify(rec.fixedSeats));
  banned        = JSON.parse(JSON.stringify(rec.banned));
  /* UI 동기화 */
  saveSettingsToStorage();
  resetPickerEffects();
  renderGrid();
}

function deleteSeatChangeHistory(id, event) {
  event.stopPropagation();
  if (confirm('삭제하시겠습니까?')) {
    seatChangeHistories = seatChangeHistories.filter(r => r.id !== id);
    if (currentClassId) localStorage.setItem(`seat_${currentClassId}_change_histories`, JSON.stringify(seatChangeHistories));
    renderSide();
  }
}

function renderSeatHistory(c) {
  if (!seatChangeHistories || seatChangeHistories.length === 0) {
    c.innerHTML = `
      <div class="flex flex-col items-center justify-center h-40 text-slate-400 gap-2">
        <span class="text-3xl">🗂️</span>
        <span class="text-sm font-bold">저장된 자리변경 기록이 없습니다</span>
        <span class="text-xs">자리바꾸기 실행 후 기록을 저장해보세요</span>
      </div>`;
    return;
  }
  c.innerHTML = `
    <div class="flex flex-col gap-1 max-h-full overflow-y-auto">
      ${seatChangeHistories.map(rec => `
        <div class="flex items-center justify-between border rounded p-1.5 bg-slate-100 hover:bg-slate-200 transition text-xs cursor-pointer"
             onclick="loadSeatFromHistory(${rec.id})">
          <span class="font-medium text-slate-700 flex-1 truncate mr-2">📅 ${rec.date}</span>
          <button onclick="event.stopPropagation(); deleteSeatChangeHistory(${rec.id}, event)"
                  class="text-rose-400 hover:text-rose-600 font-bold px-1 flex-shrink-0">✕</button>
        </div>`).join('')}
    </div>`;
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
  const maleCount   = students.filter(s => s && !s.absent && s.gender === 'M').length;
  const femaleCount = students.filter(s => s && !s.absent && s.gender === 'F').length;

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

      <!-- 학급 전체 뽑기 -->
      <div class="p-3 bg-slate-100 rounded-xl border border-slate-200 shadow-sm">
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

      <!-- 한번에 다 뽑기 -->
      <div class="p-3 bg-slate-100 rounded-xl border border-slate-200 shadow-sm">
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

      <!-- 모둠별 뽑기 -->
      <div class="p-3 bg-slate-100 rounded-xl border border-slate-200 shadow-sm">
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

      <!-- [v9-F.1] 특정 모둠에서 뽑기 -->
      <div class="p-3 bg-slate-100 rounded-xl border border-slate-200 shadow-sm">
        <h4 class="font-bold text-sm text-slate-800 mb-2">🎯 특정 모둠에서 뽑기</h4>
        ${groups && groups.count > 0 ? `
        <div class="flex items-center gap-2">
          <select id="pickOneGroupNum"
            class="border rounded p-1 text-center font-bold text-sm bg-white"
            style="min-width:72px">
            ${Array.from({length: groups.count}, (_, i) => i + 1)
              .map(n => `<option value="${n}"${lastPickOneGroupNum === n ? ' selected' : ''}>${n} 모둠</option>`)
              .join('')}
          </select>
          <input type="number" id="pickOneGroupCount"
            value="${lastPickOneGroupCount}" min="1" max="${groups.count > 0 ? 40 : 1}"
            class="w-14 border rounded p-1 text-center font-bold">
          <span class="text-xs font-medium text-slate-600">명 추첨</span>
          <button onclick="pickFromOneGroup()"
            class="ml-auto px-3 py-1.5 bg-teal-400 hover:bg-teal-500 text-white font-bold text-xs rounded-lg shadow transition">
            뽑기
          </button>
        </div>` : `
        <p class="text-xs text-slate-400">모둠을 설정하면 사용할 수 있습니다.</p>`}
      </div>

      <!-- 성별 뽑기 -->
      <div class="p-3 bg-slate-100 rounded-xl border border-slate-200 shadow-sm">
        <h4 class="font-bold text-sm text-slate-800 mb-2">🚻 각 성별에서 뽑기</h4>
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

/* [v9-F.2] 뽑기 UI 시각 효과만 제거 — historyPickedNames 데이터 유지
   창 닫힘 시 분홍+회색 강조를 제거하되, 누적 제외 기록은 보존 */
function clearPickerUIEffects() {
  pickedSeatIndexes         = [];
  pickerHighlightSuppressed = true;   /* isPreviousPicked 렌더링 억제 */
  renderGrid();
  renderSide();
}

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
  /* [v9-B.3] 뽑기창 열려 있으면 갱신 (플래그 방식) */
  if (pickerPanelOpen) renderPickerPanel();
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
  const activeNames = currentSeats.filter(s => s && !s.absent).map(s => s.name);  /* [v9-J.4-A] absent 제외 */
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
    if (groups.assignments[i] > 0 && currentSeats[i] && !currentSeats[i].absent) {  /* [v9-J.4-A] absent 제외 */
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

/* [v9-F.1] 특정 모둠에서 뽑기 */
function pickFromOneGroup() {
  if (!groups || groups.count === 0) return alert('모둠이 설정되어 있지 않습니다.');

  lastPickOneGroupNum   = parseInt(document.getElementById('pickOneGroupNum').value)   || 1;
  lastPickOneGroupCount = parseInt(document.getElementById('pickOneGroupCount').value) || 1;
  const gNum  = lastPickOneGroupNum;
  const count = lastPickOneGroupCount;

  if (gNum < 1 || gNum > groups.count) return alert(`${gNum} 모둠은 존재하지 않습니다.`);
  if (count <= 0) return;

  /* 해당 모둠 학생 수집 */
  const groupMembers = [];
  for (let i = 0; i < 40; i++) {
    if (groups.assignments[i] === gNum && currentSeats[i] && !currentSeats[i].absent) {  /* [v9-J.4-A] absent 제외 */
      groupMembers.push(currentSeats[i].name);
    }
  }
  if (groupMembers.length === 0) return alert(`${gNum} 모둠에 배치된 학생이 없습니다.`);

  /* 뽑힌 사람 제외 필터 — 기존 시스템과 동일 */
  const pool = getFilteredPool(groupMembers);
  if (pool.length === 0) return alert(`${gNum} 모둠의 추첨 가능한 학생이 없습니다.`);

  shuffle(pool);
  highlightPickedSeats(pool.slice(0, Math.min(count, pool.length)));
}

function pickFromGender() {
  const activeStudents = currentSeats.filter(s => s && !s.absent);  /* [v9-J.4-A] absent 제외 */
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
  const seated = currentSeats.filter(s => s && !s.absent);  /* [v9-J.5] 결석 학생 제외 */
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
  const seated = currentSeats.filter(s => s && !s.absent);  /* [v9-J.5] 결석 학생 제외 */
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

/* [v10-B.4] 가로 연속 활성칸 3칸 이상 존재 여부 판정 */
function hasHorizontalGroup3Plus() {
  const COLS = 8;
  const ROWS = 5;
  for (let row = 0; row < ROWS; row++) {
    let run = 0;
    for (let col = 0; col < COLS; col++) {
      if (gridEnabled[row * COLS + col]) {
        run++;
        if (run >= 3) return true;
      } else {
        run = 0;
      }
    }
  }
  return false;
}

/* [v10-B.4] 확인 버튼 단일 중앙 알림 (showCustomConfirm 래퍼) */
function showCustomAlert(message) {
  const el     = document.getElementById('customConfirm');
  const noBtn  = document.getElementById('ccNoBtn');
  const yesBtn = document.getElementById('ccYesBtn');
  if (!el || !noBtn || !yesBtn) { alert(message); return; }
  document.getElementById('ccMessage').textContent = message;
  const noNew  = noBtn.cloneNode(true);
  const yesNew = yesBtn.cloneNode(true);
  noBtn.parentNode.replaceChild(noNew,  noBtn);
  yesBtn.parentNode.replaceChild(yesNew, yesBtn);
  noNew.style.display  = 'none';
  yesNew.textContent   = '확인';
  el.style.display     = 'flex';
  yesNew.addEventListener('click', () => { el.style.display = 'none'; });
}

/* 같은 성별끼리 앉기 ON/OFF */
function toggleSameGender() {
  /* [v10-B.4] 가로 3칸 이상 연결 좌석 차단 */
  if (hasHorizontalGroup3Plus()) {
    showCustomAlert('현재 배치에는 가로로 3칸 이상 연결된 좌석이 포함되어 있어 같은 성별 앉기 기능을 사용할 수 없습니다.');
    return;
  }
  sameGenderOn = !sameGenderOn;
  if (currentClassId) localStorage.setItem(`seat_${currentClassId}_same_gender`, JSON.stringify(sameGenderOn));
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
  /* [v9-A.1] 상태 뱃지 시스템 비활성화 — no-op
     statusBadgeArea DOM은 v9-A.2 재사용을 위해 유지 */
}

/* ══════════════════════════════════
   초기화
══════════════════════════════════ */
/* ══════════════════════════════════════════
   [v10-C.2] Analytics — 방문자 집계 (피드백 시스템과 완전 독립)
══════════════════════════════════════════ */
/* [v10-C.3] 앱 버전 — 향후 버전 변경 시 이 한 곳만 수정 */
const APP_VERSION = 'v10-B.6';

const _ANALYTICS_ENDPOINT = 'https://script.google.com/macros/s/AKfycbzenGR8zKR6749wxvvqm9n9cMN00dxzG8gkMSOhNJ91fPgKm61CCwYoNMLpEJqhahtpEA/exec';

/* 클라이언트 식별자 — localStorage에 영구 저장, 없으면 생성 */
function getClientId() {
  let id = localStorage.getItem('seat_client_id');
  if (!id) {
    /* [v10-C.4] crypto.randomUUID() 우선 사용, 미지원 환경은 기존 방식 fallback */
    id = (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
      ? crypto.randomUUID()
      : ('c_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10));
    localStorage.setItem('seat_client_id', id);
  }
  return id;
}

/* 범용 Analytics 전송 함수 — 향후 shuffle/group/lottery 등 이벤트 확장 가능 */
function sendAnalytics(eventName) {
  fetch(_ANALYTICS_ENDPOINT, {
    method: 'POST',
    mode: 'no-cors',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      event: eventName,
      app: 'classtone',
      clientId: getClientId(),
      version: APP_VERSION,
      timestamp: Date.now()
    })
  }).catch(() => {});
}

/* 방문 전송 — 같은 탭(세션)에서는 1회만 전송 */
function sendAnalyticsVisit() {
  if (sessionStorage.getItem('seat_visit_sent')) return;
  sessionStorage.setItem('seat_visit_sent', '1');
  sendAnalytics('visit');
}

window.addEventListener('DOMContentLoaded', () => {
  loadFromStorage();
  renderGrid();
  showTab('roster');
  updateGroupViewButton();
  updateRoleViewButton();
  /* [6-A] 성별 버튼 초기 상태 반영 */
  _updateGenderButtons();

  /* [V10-A] 로고 클릭 → 오늘의 문구 이스터에그 */
  const logoBtn = document.getElementById('logoBtn');
  if (logoBtn) logoBtn.addEventListener('click', openQuotePopup);

  /* [v10-C.2] Analytics 방문 기록 — 모든 초기화 완료 후 호출 */
  sendAnalyticsVisit();

});

/* ══════════════════════════════════════════
   [v6-G] 매뉴얼 모달 시스템
══════════════════════════════════════════ */
const _MANUAL_DATA = [
  /* ── 카테고리 1 ── */
  { title: '📚 학생 등록 및 자리배치', isCategory: true,
    color: { header: '#dbeafe', border: '#93c5fd', text: '#1d4ed8' } },
  { title: '⚠️ 필독! 개인정보 관련', desc: '클래스톤은 사용자의 컴퓨터 브라우저에 모든 정보를 저장합니다. 별도의 서버에 저장하지 않습니다. 따라서 학생 이름 등 개인정보가 유출되는 위험은 없으니 안심하고 사용하실 수 있습니다. 다만 사용하시는 브라우저에서 기록삭제,저장된 데이터 초기화를 진행하시면 클래스톤에 저장된 자리, 기록, 명단 등의 데이터도 모두 초기화됩니다. 주의하세요.<br>다른 컴퓨터에서 접속해도 저장해 놓은 내용들을 읽어올 수 없습니다.' },
  { title: '📝 명단 등록', desc: '[입력방법]<br>- 이름1, 이름2, 이름3 … 입력 후 엔터<br>- 엑셀, 한글 표의 이름 열을 드래그하여 복붙 가능<br>- 명단 속 학생을 클릭 앤 드래그로 번호 변경 가능함<br>- 여러 학급을 등록하여 관리 가능' },
  { title: '🪑 기본 자리 배치', desc: '마우스 클릭, 드래그로 자리 활성화/비활성화 가능합니다.' },
  /* ── 카테고리 2 ── */
  { title: '👥 학급 관리', isCategory: true,
    color: { header: '#bbf7d0', border: '#6ee7b7', text: '#15803d' } },
  { title: '👥 모둠 생성', desc: '원하는 수의 모둠 생성, 자리별로 모둠 지정 가능합니다.<br><br>① 모둠수 지정<br><br>② 각 모둠버튼 클릭<br><br>③ 해당 모둠 소속 학생들 이름 클릭 or 드래그<br><br>④ 모둠별 지정 완료 후 저장' },
  { title: '🏷 1인1역 역할 배정', desc: '[1인1역 등록창이 따로 열림]<br><br>- 역할 예시에서 기본 제공되는 역할 사용 가능<br><br>- 예시에 없는 역할을 직접 입력할 수 있음<br><br>- 역할별로 인원수 조정 가능<br><br>- 드래그 드랍으로 학생을 배치 가능<br><br>- 랜덤배치 기능 있음<br><br>- 저장된 역할의 초기화 가능<br><br>- 저장된 역할표를 프린트 가능' },
  /* ── 카테고리 3 ── */
  { title: '🎲 자리바꾸기', isCategory: true,
    color: { header: '#fef08a', border: '#fde047', text: '#a16207' } },
  { title: '🚻 남녀 자리 지정', desc: '남녀 자리를 지정한 후 자리바꾸기가 가능합니다.<br><br>① 자리바꾸기 옆 활성화버튼 클릭<br><br>② 남녀자리지정 버튼 클릭<br><br>③ 하단부 남/여 버튼 클릭 후 자리를 클릭하여 지정<br><br>④ 지정종료 버튼 클릭<br><br>⑤ 자리바꾸기 시 반영됨' },
  { title: '👫 같은 성별 앉기', desc: '자리 바꾸기 시 최대한 같은 성별끼리 짝으로 매칭해주는 기능입니다.<br><br>① 자리바꾸기 옆 활성화버튼 클릭<br><br>② 같은성별 앉기 ON<br><br> - 이 기능이 활성회되면 활성화버튼에 작은 초록점이 들어옵니다.<br><br> - 이 상태에서 자리바꾸기를 하면 적용됩니다.' },
  { title: '🗂️ 자리 변경 기록', desc: '자리 바꾸기 결과를 저장해놓고 화면에 다시 불러올 수 있습니다.<br><br>- 자리바꾸기 후 알림창으로 기록 저장 여부를 확인<br><br>- 저장된 기록은 설정-자리변경 기록메뉴에서 확인 가능<br><br>- 날짜와 시간으로 기록되며, 클릭하여 불러오기 가능' },
  /* ── 카테고리 4 ── */
  { title: '🧑‍🏫 담임 메뉴', isCategory: true,
    color: { header: '#fed7aa', border: '#fdba74', text: '#c2410c' } },
  { title: '📌 자리 고정', desc: '특정 자리에 특정 학생을 고정시키는 기능입니다.<br><br>- 자리 바꾸기를 시행해도 이 학생은 무조건 이 자리에 배치됩니다.<br><br>- 다른 기능보다 자리고정기능이 우선 적용됩니다.<br><br>(예: 남학생을 각각 전부 떨어뜨려서 고정한 이후, 같은 성별앉기를 해도 떨어져서 지정됨)' },
  { title: '🚫 짝 방지', desc: '지정한 학생끼리는 짝이 안 되게 하는 기능' },
  { title: '↩️ 직전 짝 방지', desc: '직전 짝과 다시 만나는 것을 방지해줍니다. <br><br>예) 2회차에서 짝이었던 학생끼리 3회차에서 만나지 않음. <br>1회차에서 짝이었던 학생끼리는 만날 수 있음.' },
  { title: '🔁 계속 새로운 짝 만나기', desc: '만난 적 없는 새로운 짝으로만 배정되는 기능<br><br>예) 학급에 20명이 있을 경우, 1번 학생은 2번, 3번, 4번 ~ 19번 학생까지 총 19명의 다른 친구를 짝으로 만나게 됨 (순서는 랜덤)' },
  { title: '⚠️ 새짝 만나기 사용 조건', desc: '아래 조건을 만족해야 사용이 가능합니다.<br><br>- 학생 수와 자리 수가 일치할 것<br><br>- 책상 배치가 2인짝이 될 수 있게(홀수학급에서 한 자리 남는 건 ok)<br><br>- 3자리 이상 붙어 있으면 안 됨' },
  { title: '🔢 새짝 만나기 회차 보기', desc: '진행 회차와 남은 횟수 확인 기능<br><br>(짝수반은 총 회차=학급 인원수-1, 홀수반은 총 회차=학급 인원수)<br><br><br>새짝만나기를 이어가던 중 학생명단에 변동(전입, 전출)이 발생하면 자동으로 새짝만나기는 초기화됩니다.' },
  /* ── 카테고리 5 ── */
  { title: '🎯 뽑기', isCategory: true,
    color: { header: '#e9d5ff', border: '#c4b5fd', text: '#7e22ce' } },
  { title: '🎯 학급 전체에서 뽑기', desc: '전체 학생 중 무작위 추첨이며, 뽑는 인원 수 지정이 가능합니다.' },
  { title: '🚫 뽑힌 사람 제외 기능', desc: '이 기능을 비활성화한 상태에서 다른 뽑기 기능들을 사용할 시 뽑힌 학생이 다시 뽑힐 수 있습니다.' },
  { title: '⚡ 한번에 다 뽑기', desc: '학급 전체에서 뽑기 기능과 같지만 결과를 한번에 다 보여주는 기능입니다.<br><br>- 순서를 정할 때 유용합니다.<br><br>- 짝, 모둠을 매칭할 때 유용합니다.' },
  { title: '👥 모둠별 뽑기', desc: '각 모둠에서 발표자를 뽑을 때 유용합니다.' },
  { title: '🚻 성별에서 뽑기', desc: '성별에 따라 뽑을 인원수를 배정하여 뽑을 수 있습니다.' },
  /* ── 카테고리 6 ── */
  { title: '🧰 수업도구', isCategory: true,
    color: { header: '#99f6e4', border: '#5eead4', text: '#0f766e' } },
  { title: '👤 다했어요 (개인)', desc: '전자칠판을 사용하는 교실에서는 학생이 직접 나와 자신을 클릭하면 유용합니다.<br><br>별도 버튼을 통해 기록을 저장할 수 있으며 어떤 순서로 과제를 마쳤는지 확인할 수 있습니다.' },
  { title: '👥 다했어요 (모둠)', desc: '모둠원 한 명을 클릭하면 모둠 전체가 완료처리 됩니다.<br><br>별도 버튼을 통해 기록을 저장할 수 있으며 어떤 순서로 과제를 마쳤는지 확인할 수 있습니다.' },
  /* ── 카테고리 7 ── */
  { title: '⚙️ 설정 및 기타', isCategory: true,
    color: { header: '#e2e8f0', border: '#cbd5e1', text: '#475569' } },
  { title: '🗑️ 데이터 초기화', desc: '모든 데이터가 삭제되므로 주의가 필요합니다.' },
  { title: '💬 피드백 보내기', desc: '개발자에게 메시지를 보내는 기능입니다. <br>고쳐야할 버그, 더 원하시는 기능이 있을 경우 남겨주세요! 감사합니다.' },
];

/* [v9-G.2] 공통 렌더 함수 — _MANUAL_DATA를 카테고리 헤더 + 아코디언으로 렌더링
   accordionIndex: isCategory 항목은 인덱스 소비 없이 건너뜀
   → _toggleManualItem(i) 인덱스와 완전히 일치 */
/* [v9-G.3.5] 공통 렌더 함수 — 카드 그룹 + 카테고리 색상 구조
   ai: isCategory 항목 제외한 아코디언 전용 인덱스 → _toggleManualItem(i) 대응 */
function _buildManualHTML() {
  let ai      = 0;
  let html    = '';
  let inCard  = false;
  const defaultColor = { header: '#e2e8f0', border: '#cbd5e1', text: '#475569' };

  for (const item of _MANUAL_DATA) {
    if (item.isCategory) {
      /* 이전 카드 닫기 (바디 div + wrapper div) */
      if (inCard) html += '</div></div>';
      const c = item.color || defaultColor;
      /* 카드 wrapper 시작 + 카드 헤더 + 카드 바디 시작 */
      html +=
        `<div style="border:1px solid ${c.border};border-radius:10px;margin-bottom:10px;overflow:hidden;background:#ffffff;">` +
          `<div style="background:${c.header};color:${c.text};font-weight:700;font-size:12px;padding:8px 12px;">` +
            item.title +
          `</div>` +
          `<div style="background:#ffffff;padding:4px 0;">`;
      inCard = true;
      continue;
    }
    /* 일반 항목 — 기존 아코디언 구조 완전 유지 */
    const j = ai++;
    html +=
      `<div style="border-bottom:1px solid #f1f5f9;overflow:hidden;">` +
        `<button onclick="_toggleManualItem(${j})"` +
          ` style="width:100%;display:flex;justify-content:space-between;align-items:center;` +
                  `padding:9px 12px;background:#fff;border:none;cursor:pointer;text-align:left;">` +
          `<span style="font-weight:700;font-size:13px;">${item.title}</span>` +
          `<span id="manualArrow${j}" style="font-size:11px;color:#94a3b8;transition:transform 0.2s;">▼</span>` +
        `</button>` +
        `<div id="manualDetail${j}"` +
            ` style="display:none;padding:8px 12px 10px;font-size:12px;color:#475569;line-height:1.6;background:#fff;">` +
          item.desc +
          (item.detail ? '<br><br><span style=\'color:#64748b;\'>' + item.detail + '</span>' : '') +
        `</div>` +
      `</div>`;
  }
  /* 마지막 카드 닫기 */
  if (inCard) html += '</div></div>';
  return html;
}

function openManualModal() {
  /* [v6-H] 아코디언 UX — 클릭 시 상세 설명 펼침 */
  const el = document.getElementById('manualModal');
  if (!el) return;
  el.style.display = 'flex';
  const list = document.getElementById('manualList');
  if (!list) return;
  /* [v9-G.2] _buildManualHTML() 공통 렌더러 사용 */
  list.innerHTML = _buildManualHTML();
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

/* renderSettings에서 호출 — 피드백 UI 렌더 */
function renderSheetsFeedback(container) {
  container.innerHTML = `
    <div style="margin-top:14px;">
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

/* ══════════════════════════════════════════════════════
   [9-D] 계속 새로운 짝 만나기 — Round Robin Engine
   ─────────────────────────────────────────────────────
   독립 모듈. 기존 random shuffle 로직에 일절 영향 없음.
══════════════════════════════════════════════════════ */

/* 비활성화 조건 검사 */
function isRoundRobinBlocked() {
  const hasFixed  = Object.keys(fixedSeats).length > 0;
  const hasBanned = banned.length > 0;
  return hasFixed || hasBanned;
}

/* ── [9-D.2] 자리 구조 검증 ──────────────────────────
   gridEnabled 기준 활성 셀의 연결 구조가 RR 허용 조건인지 판별.
   허용: 2인 페어만 존재, 또는 2인 페어 + 단독 1개
   불허: 3인 이상 연결 / 단독 2개 이상 */
function validateRoundRobinStructure() {
  /* [9-D.4 실험 패치] 구조 검증 우회 — RR 엔진 동작 검증용 임시 브랜치
     실제 배포 전 반드시 제거할 것 */
  return { valid: true, reason: '' };

  /* [9-D.3] desk unit 방식으로 전면 교체
     desk unit = (col%2==0 셀, col%2==1 셀) 쌍 — 5행 × 4유닛 = 20유닛
     count 0: 비활성(무시)  count 1: 단독 자리  count 2: 정상 페어 */
  let totalActive     = 0;
  let singleUnitCount = 0;

  for (let row = 0; row < 5; row++) {
    for (let unit = 0; unit < 4; unit++) {
      const left  = row * 8 + unit * 2;
      const right = left + 1;
      const count = (gridEnabled[left] ? 1 : 0) + (gridEnabled[right] ? 1 : 0);
      totalActive += count;
      if (count === 1) singleUnitCount++;
    }
  }

  if (totalActive === 0) {
    return { valid: false, reason: '활성화된 자리가 없습니다.' };
  }
  if (singleUnitCount >= 2) {
    return { valid: false, reason: '자리가 2인 짝 구조로 구성되어 있지 않습니다.\n(짝이 없는 단독 자리가 2개 이상 존재합니다.)' };
  }
  return { valid: true, reason: '' };
}

/* ── [9-D.2] RR 상태 초기화 ─────────────────────────
   자리 구조 변경 등 외부 요인으로 RR을 조용히 리셋할 때 사용 */
function resetRoundRobinState() {
  if (!roundRobinMode) return;   /* 이미 OFF면 무시 */
  roundRobinMode    = false;
  currentRoundIndex = 0;
  rrStudentOrder    = [];
  renderSide();                  /* 회차 카운터·토글 UI 즉시 갱신 */
}

/* 라운드 로빈 모드 토글 */
function toggleRoundRobinMode() {
  if (!roundRobinMode) {
    /* ON 시도 */
    /* [9-D.2] 1. fixedSeats / banned 차단 */
    if (isRoundRobinBlocked()) {
      alert('자리가 지정되어 있거나, 짝궁 방지가 입력되어 있다면 새로운 짝 계속 만나기 기능을 사용할 수 없습니다.');
      renderSide();
      return;
    }
    /* [v10-B.4] 2. 가로 3칸 이상 연결 좌석 차단 */
    if (hasHorizontalGroup3Plus()) {
      showCustomAlert('현재 배치에는 가로로 3칸 이상 연결된 좌석이 포함되어 있어 계속 새로운 짝 만나기 기능을 사용할 수 없습니다.');
      renderSide();
      return;
    }
    /* [9-D.2] 2. 자리 구조 검증 */
    const structCheck = validateRoundRobinStructure();
    if (!structCheck.valid) {
      alert(structCheck.reason);
      renderSide();
      return;
    }
    if (students.length < 2) {
      alert('학생이 2명 이상 있어야 합니다.');
      renderSide();
      return;
    }
    /* [9-D.2] 3. avoidPrevPair 강제 OFF */
    avoidPrevPair = false;
    /* 학생 순서 초기화 (s0 고정, 나머지 원본 순서 유지) */
    rrStudentOrder    = students.filter(s => !s.absent);  /* [v9-J.2] 결석 학생 제외 */
    currentRoundIndex = 0;
    roundRobinMode    = true;
  } else {
    /* OFF */
    roundRobinMode    = false;
    currentRoundIndex = 0;
    rrStudentOrder    = [];
  }
  renderSide();
}

/* ── 6-3: buildRoundRobinPairs(roundIndex) ──────────
   s0 고정, 나머지 roundIndex만큼 오른쪽 회전
   (i, N-1-i) 쌍 생성, BYE(null) 제거 */
function buildRoundRobinPairs(roundIndex) {
  let arr = [...rrStudentOrder];

  /* 홀수 인원: BYE(null) 삽입 */
  if (arr.length % 2 === 1) arr.push(null);
  const N = arr.length;

  const fixed = arr[0];
  const rest  = arr.slice(1);                          // 회전 대상

  /* 오른쪽 회전: slice + concat */
  const rotAmt = roundIndex % rest.length;
  const rotated = [
    ...rest.slice(rest.length - rotAmt),
    ...rest.slice(0, rest.length - rotAmt)
  ];

  const ordered = [fixed, ...rotated];

  /* (i, N-1-i) 쌍 */
  const pairs = [];
  for (let i = 0; i < N / 2; i++) {
    const a = ordered[i];
    const b = ordered[N - 1 - i];
    if (a !== null && b !== null) pairs.push([a, b]);
    /* BYE 쌍은 제외 — 해당 학생은 단독 배치 */
    else if (a !== null) pairs.push([a, null]);
    else if (b !== null) pairs.push([b, null]);
  }
  return pairs;
}

/* ── 6-4: mapPairsToGrid(pairs) ─────────────────────
   gridEnabled 기준 활성 셀만 사용
   col%2==0 기준 좌우 짝 배치
   부족 시 남은 학생 단독 배치 */
function mapPairsToGrid(pairs) {
  const newSeats = Array(40).fill(null);

  /* 활성 셀 수집 */
  const activeCells = [];
  for (let i = 0; i < 40; i++) {
    if (gridEnabled[i]) activeCells.push(i);
  }

  /* col%2==0 기준 인접쌍 슬롯 수집 */
  const pairSlots  = [];
  const usedInPair = new Set();
  for (let i = 0; i < 40; i++) {
    if (!gridEnabled[i]) continue;
    const col  = i % 8;
    const next = i + 1;
    if (
      col % 2 === 0 &&
      next < 40 &&
      gridEnabled[next] &&
      Math.floor(i / 8) === Math.floor(next / 8)
    ) {
      pairSlots.push([i, next]);
      usedInPair.add(i);
      usedInPair.add(next);
    }
  }

  /* 쌍 배치 */
  let pairIdx = 0;
  const usedSeats = new Set();

  for (const [slotA, slotB] of pairSlots) {
    if (pairIdx >= pairs.length) break;
    const [a, b] = pairs[pairIdx++];
    newSeats[slotA] = a;
    newSeats[slotB] = b;
    usedSeats.add(slotA);
    usedSeats.add(slotB);
  }

  /* 나머지 쌍 / 단독 학생 → 남은 활성 슬롯에 순서대로 */
  const singleStudents = [];
  for (let i = pairIdx; i < pairs.length; i++) {
    const [a, b] = pairs[i];
    if (a) singleStudents.push(a);
    if (b) singleStudents.push(b);
  }

  let si = 0;
  for (const cell of activeCells) {
    if (!usedSeats.has(cell) && si < singleStudents.length) {
      newSeats[cell] = singleStudents[si++];
    }
  }

  return newSeats;
}

/* ── executeRoundRobinShuffle() ─────────────────────
   doShuffle() 내부에서 roundRobinMode=true 시 호출 */
function executeRoundRobinShuffle() {
  const N      = rrStudentOrder.length + (rrStudentOrder.length % 2 === 1 ? 1 : 0);
  const maxR   = N > 1 ? N - 1 : 0;

  if (currentRoundIndex >= maxR) {
    alert(`모든 회차(${maxR}번)가 완료되었습니다.\n설정 탭에서 초기화하거나 모드를 끄고 다시 시작하세요.`);
    /* isShuffling 해제는 startShuffle setTimeout에서 처리 */
    return;
  }

  /* 직전 배치 백업 */
  previousSeats = [...currentSeats];

  /* 짝 생성 → 그리드 매핑 */
  const pairs     = buildRoundRobinPairs(currentRoundIndex);
  currentRoundIndex++;

  /* [9-D.5] 슬롯 위치 랜덤화 — 짝 조합 자체는 유지, 책상 위치·좌우만 랜덤 */
  shuffle(pairs);
  pairs.forEach(pair => {
    if (Math.random() < 0.5) pair.reverse();
  });

  currentSeats = mapPairsToGrid(pairs);

  /* renderGrid + 셀 팝 애니메이션 */
  renderGrid();
  saveCurrentClass();  /* [v10-B.1] 자리배치 결과 즉시 저장 (RR 경로) */
  const cells = document.getElementById('grid').children;
  for (let i = 0; i < 40; i++) {
    if (currentSeats[i] && cells[i]) {
      setTimeout(() => cells[i].classList.add('seat-pop'), i * 30);
    }
  }
}

/* ══════════════════════════════════════════
   [V10-A] 오늘의 문구 이스터에그
   264개 문구 / 264일 순환
══════════════════════════════════════════ */
const _QUOTES = [
  '모든 것은 지나가도록 되어 있다',
  '감정은 이유보다 먼저 도착한다',
  '바다는 아무것도 기억하지 않지만 모든 것을 품고 있다',
  '오늘 하루도 잘 버텨낸 너를 응원해',
  '길을 잃고 나면 새로운 여정이 시작된다.',
  '우리의 삶은 언제나 여행이야. 지금은 무엇이 보여?',
  '우린 참 괜찮은 사람이야',
  '지나간 후회를 조금 내려놓아도 괜찮아',
  '가끔은 계획보다 우연이 더 재미있어',
  '비교하지마. 너의 빛은 사라지지 않아',
  '너무 심각해지기 전에 한 번 웃어 보자',
  '엉뚱한 상상 하나가 하루를 밝게 만들기도 해',
  '새로운 관점은 새로운 가능성을 보여 줘',
  '아직 오지 않았다고 해서 영원히 오지 않는 것은 아니야',
  '밤은 가장 어두울 때 가장 많은 것을 보여준다',
  '익숙한 것에도 새로운 이야기가 숨어 있어',
  '불확실성 속에서 사고는 깊어진다',
  '완벽한 하루보다 즐거운 하루가 더 기억에 남아',
  '익숙한 풍경 속에서 문득 발견한 일상의 작은 반짝임',
  '뜨거웠던 한낮이 지나면 부드러운 노을이 다가와',
  '매일 같은 하늘도 조금씩 다르게 빛나',
  '결정은 언제나 불완전하다',
  '꽃도 서두르지 않고 자신의 계절을 기다려',
  '행복은 의외로 가까운 곳에서 발견되곤 해',
  '어둠 속에서도 이름을 잃지 않는 것들이 있다',
  '스스로를 믿는 한마디가 삶을 바꾸는 가장 큰 마법이 될거야',
  '자신을 이해하는 마음이 회복의 시작이야',
  '기분 좋은 웃음은 최고의 휴식이야',
  '주저앉았던 순간도 성장의 기록이 될 수 있어',
  '세상의 소음에서 멀어져 오직 나만의 고요 속으로 들어오는 순간',
  '나는 나의 슬픔을 끝까지 보려 한다',
  '알고 싶은 마음은 삶을 움직이는 힘이야',
  '후회는 성장의 씨앗이 될 수 있어',
  '보이지 않는 것이 가장 오래 남는다',
  '오늘의 해프닝도 언젠가는 추억이 될 거야',
  '작은 도전도 충분히 자랑할 만한 일이야',
  '침묵도 음악의 일부다',
  '마음속 망설임을 넘는 순간 새로운 길이 열려',
  '모든 것은 이미 변화 중이다',
  '침묵은 사유의 또 다른 형태다',
  '끝난 뒤에도 여운은 이어진다',
  '갈림길은 새로운 가능성을 만나는 장소야',
  '오늘은 애쓰지 않아도 돼, 그냥 이대로 머물러',
  '지친 발걸음을 멈추고 고개를 들어, 하늘은 여전히 넓어',
  '오늘도 세상은 조용히 변하고 있어',
  '모험은 언제나 궁금증에서 출발해',
  '다시 시작할 수 있다는 사실은 큰 축복이야',
  '새로운 시선은 새로운 세상을 보여 줘',
  '틀려도 괜찮아, 세상은 생각보다 관대할 때가 많아',
  '비록 지금은 작아 보일지라도 언젠가 크게 피어날거야',
  '매일은 새로운 것을 찾을 기회를 품고 있어',
  '나는 나를 넘어서는 중이다',
  '한 번 손을 내밀어 보는 것부터 변화는 시작돼',
  '우리는 늘 미완성으로 존재한다',
  '인간은 끊임없이 자신을 갱신한다',
  '자신만의 속도로 방향을 찾아가면 돼',
  '이해는 언제나 늦게 도착한다',
  '계절은 늘 사람보다 먼저 변한다',
  '질문은 답보다 오래 살아남기도 해',
  '의미는 발견되는 것이 아니라 만들어진다',
  '너의 가치는 결과보다 훨씬 깊은 곳에 있어',
  '익숙한 하루도 다시 보면 낯설다',
  '시는 언제나 조용한 쪽에서 먼저 온다',
  '눈물이 흐른 자리에도 새싹은 자라나',
  '오늘의 작은 실수 하나쯤은 내일의 소재가 돼',
  '너를 가장 오래 응원해야 할 사람. 바로 너.',
  '시작할 용기가 있다면 절반은 이미 해낸 거야',
  '계절이 바뀌듯 너의 삶에도 분명 찬란한 봄이 찾아와',
  '긴장을 풀고 평온을 불러',
  '그때의 실수도 지금은 미소가 되곤 해',
  '네가 생각하는 것보다 더 많은 사람이 너를 아끼고 있어',
  '어제의 부족함이 오늘의 가치를 없애진 않아',
  '완벽하지 못했던 날도 너의 일부야',
  '어둠은 사라지는 것이 아니라 자리를 바꾼다',
  '좋은 농담 하나가 긴 하루를 짧게 만들어',
  '예상 밖의 즐거움은 늘 예고 없이 찾아와',
  '나는 나를 넘어서기 위해 오늘을 견딘다',
  '질문하는 사람은 계속 앞으로 나아가',
  '존재는 설명되지 않아도 지속된다',
  '길을 잃어본 사람은 길의 소중함을 더 잘 알아',
  '빛은 금이 가고 깨어진 자리로 들어와',
  '가끔은 이유 없이 웃어도 괜찮아',
  '자유는 가벼움이 아니라 책임이다',
  '흔들림 속에서 진실이 드러난다',
  '무심코 지나치던 계절의 변화가 오늘따라 선명해',
  '세상은 아직 모르는 것들로 가득 차 있어',
  '모든 것은 형태를 바꾸며 존재한다',
  '용서는 앞으로 걸어가기 위한 여유를 만들어 줘',
  '흔들림 속에서 더 선명해지는 것들이 있다',
  '사유는 끝나지 않는다',
  '별을 바라볼 땐 말이 없다',
  '천천히 선택해도 괜찮아, 중요한 건 네 마음이야',
  '그리고 나는 다시 일어선다',
  '때로는 시간이 가장 좋은 답이 되어 줘',
  '모든 순간은 이미 지나가고 있다',
  '바람은 어디에도 속하지 않는다',
  '선택에는 후회보다 배움이 더 많이 남아',
  '고통은 이해되기보다 경험된다',
  '기다림 속에서도 삶은 조용히 자라고 있어',
  '시간은 우리를 조용히 바꾼다',
  '오래 바라본 것들은 천천히 마음이 된다',
  '함께했던 순간들은 오래도록 마음에 머물러',
  '말하지 못한 것들이 가장 오래 남는다',
  '힘들었던 날들도 결국 너의 일부가 돼',
  '정답보다 중요한 건 스스로 납득하는 마음이야',
  '포기하지 않는 마음은 생각보다 작은 곳에서 시작해',
  '우리는 질문 속에 있다',
  '답은 늘 뒤에 있다',
  '생각은 언제나 스스로를 넘어서려 한다',
  '하루는 생각보다 빠르게 형태를 바꿔',
  '조금 늦게 피는 꽃도 충분히 아름다워',
  '존재는 이유보다 먼저 놓여 있다',
  '오늘은 입꼬리가 조금 더 바쁜 날이면 좋겠어',
  '웃으며 끝낼 수 있는 하루라면 충분히 좋은 하루야',
  '한 걸음마다 길은 조금씩 선명해져',
  '마음을 다독이며 기다리는 것도 용기야',
  '소란스러웠던 일들도 결국 차분해지는 시간이 찾아올거야',
  '모든 질문은 이미 답을 품고 있다',
  '삶은 의미를 찾기보다 만들어 가는 과정이다',
  '발견은 준비된 사람에게만 오는 선물이 아니야',
  '그리고 아무도 같은 순간에 머물지 않는다',
  '방향을 고민한다는 건 이미 앞으로 보고 있다는 뜻이야',
  '일상의 틈새로 스며든 다정한 햇살이 우리를 비추는 중',
  '당신은 아직 가고 있다',
  '살아 있는 것은 모두 흔들리며 빛난다',
  '빛은 가장자리부터 번진다',
  '추억은 사라지는 것이 아니라 모양을 바꿔 남아',
  '있는 그대로의 너도 충분히 소중해',
  '지금의 선택이 반드시 완벽할 필요는 없어',
  '좋아하는 노래 한 곡이면 기분이 달라질 수 있어',
  '돌아보면 웃게 되는 날들이 있어',
  '지도에 없는 길도 누군가에게는 첫 길이 돼',
  '방향은 한 번에 정해지는 것이 아니야',
  '천천히 익어가는 열매가 더 깊은 맛을 품어',
  '선택은 정답을 찾는 일이 아니라 만들어 가는 일이야',
  '완벽하지 않아도 사랑받을 이유는 충분하지?',
  '비움은 또 다른 충만이야',
  '여운은 끝난 뒤 시작된다',
  '익숙한 길에도 처음 보는 풍경은 숨어 있어',
  '상처가 있다고 해서 약한 사람은 아니야',
  '나를 넘어서는 순간 나는 나를 이해한다',
  '자신을 믿는 한마디가 큰 용기가 되기도 해',
  '봄은 늦더라도 꼭 찾아올거야',
  '기다림은 멈춤이 아니라 준비의 시간일 수 있어',
  '어둠은 또 다른 형태의 빛이다',
  '사소한 차이가 큰 감동을 만들기도 해',
  '지나간 순간들이 지금의 나를 만들어 줬어',
  '평범한 순간 속에도 특별함은 숨어 있어',
  '구름은 머물지 않는다',
  '별일 없는 하루가 모여 우리의 단단한 일상을 만드는 거야',
  '지난날의 나도 최선을 다하고 있었어',
  '떨리는 마음도 앞으로 나아갈 수 있어',
  '용감한 사람도 사실은 두려움을 느껴',
  '너만의 속도로 걷는 것이 가장 적당한 속도일거야',
  '웃음은 짐을 줄이지 않아도 가볍게 느끼게 해 줘',
  '오늘은 어떤 기쁨을 발견하게 될까',
  '조급함을 내려놓으면 보이는 풍경이 있어',
  '작은 변화도 발견하는 사람에게는 선물이야',
  '마음의 짐을 잠시 내려둬. 창 밖의 풍경이 기다려.',
  '해보지 않은 일은 생각보다 덜 무서울 수 있어',
  '모든 것은 흐른다. 그리고 멈춘다. 그리고 다시 흐른다. 끝없이.',
  '모든 경험은 결국 네 길의 일부가 돼',
  '시간이 지나서야 보이는 소중함이 있어',
  '실수도 나중에는 재미있는 이야기가 되곤 해',
  '고요는 가장 큰 소리다',
  '스스로에게 너무 엄격하지 않아도 돼',
  '바람은 늘 보이지 않는 곳에서 시작된다',
  '감정은 설명되지 않고 남는다',
  '우리는 늘 다른 나이다',
  '지금 이 순간은 찾아온 것만으로 의미를 가져',
  '길을 잃어도 괜찮아, 그 모든 방향이 곧 너의 새로운 발자취니까',
  '존재는 설명되지 않는다 그리고 설명될 필요도 없다',
  '비바람을 견딘 나무는 더 깊게 뿌리내려',
  '넘어졌던 자리가 다시 일어서는 법을 가르쳐 줘',
  '노력하고, 찾고, 발견하라 그리고 결코 멈추지 말라',
  '길은 항상 걸어가는 사람에게 열린다',
  '사라진 것이 아니라 멀어진 것뿐이다',
  '가끔은 자신을 용서하는 일도 필요해',
  '나는 내가 모르는 나이다',
  '작은 에너지도 소중히 여겨 봐',
  '바람이 지나간 자리에도 나는 남아 있다',
  '너는 누군가를 닮을 필요가 없는 사람이야',
  '기억은 시간을 건너 마음을 찾아와',
  '무너지지 않는 사람보다 다시 일어나는 사람이 강해',
  '웃을 일이 없다면 웃길 일을 만들어도 돼',
  '바람은 말한다, 모든 것은 지나간다고',
  '네 안에는 아직 발견되지 않은 장점들이 많아',
  '작은 성공도 당당하게 기뻐합시다!',
  '그때는 평범했던 순간이 지금은 반짝여 보여',
  '유심히 바라보면 세상은 더 재미있어져',
  '잠시 헤매는 시간도 방향을 배우는 과정이야',
  '길고 긴 시간을 달려와 오늘의 밤을 비추는 별빛',
  '우리는 언제나 선택 속에서 자신이 된다',
  '슬픔은 결국 형태를 바꾼다.',
  '깊은 어둠 속에서만 사람은 자신을 본다',
  '사라지는 것은 사라지지 않는다',
  '오늘의 너도 누군가에게는 큰 힘이 될 수 있어',
  '주저하는 시간도 결국 용기를 준비하는 과정이야',
  '침묵은 비어 있음이 아니라 채워짐이다',
  '나는 나를 통해서만 나를 안다',
  '누구나 다시 시작할 기회를 가질 자격이 있어',
  '우리는 의미를 만들어낸다',
  '실수는 누구에게나 찾아오는 손님이야',
  '놓아둠은 사라짐이 아니야',
  '어둠 속에서도 별은 길을 잃지 않는다',
  '오늘의 시도가 내일의 자신감을 만든다',
  '나는 나를 다시 쓴다',
  '웃음은 생각보다 많은 문제를 가볍게 만들어',
  '기대는 기다림을 견디게 하는 힘이야',
  '의미는 발견되는 것이 아니라 구성된다',
  '침묵 속에서도 감정은 움직인다',
  '놓쳤던 것들을 다시 보는 것도 발견이야',
  '기억하라, 너는 이미 걸어왔다',
  '우리는 감정을 따라간다',
  '오늘은 있는 그대로 즐겨봐',
  '지나간 자리에도 온기가 남아 있다',
  '누군가는 여전히 기다리고 있다',
  '차가운 겨울을 견뎌낸 씨앗처럼 이제 시작할 시간이야',
  '자신을 좋아하는 일은 이기적인 일이 아니야',
  '서두르지 않아도 너의 때는 찾아올 거야',
  '하루에 한 번쯤은 쓸데없는 상상도 필요해',
  '사라짐은 또 다른 출현이다',
  '인간은 스스로를 해석하는 존재다',
  '실수는 가능성을 열어줘',
  '오래된 사진 한 장이 하루를 따뜻하게 만들기도 해',
  '조용한 순간이 가장 선명하게 기억된다',
  '기다리는 동안 너도 함께 성장하고 있어',
  '걱정보다 호기심이 조금 더 크면 출발할 수 있어',
  '모든 길은 처음에는 보이지 않는다',
  '너의 존재 자체가 이미 특별한 이유가 돼',
  '슬픔도 어느 날엔 빛처럼 느껴진다',
  '실수는 사람을 정의하지 못해',
  '흔들리는 것은 살아 있다는 증거다',
  '더 넓은 세상을 향해 나아갈 용기로 너의 마음을 채워봐',
  '말하지 않은 것들이 가장 깊다',
  '추억은 때때로 가장 다정한 위로가 돼',
  '지나간 시간은 늘 다른 얼굴로 돌아온다',
  '묵묵히 걸어온 시간들이 모여 비로소 너만의 지도를 그려내',
  '가까운 곳에서 특별한 아름다움을 찾아볼까?',
  '오래된 노래는 잊고 있던 풍경을 데려와',
  '지나간 계절은 추억이 되어 다시 찾아와',
  '끝은 항상 다른 시작을 품는다',
  '우리는 늘 부분적으로만 이해한다',
  '희망은 멀리 있는 게 아니라, 오늘 마음이 향하는 그곳에 있어',
  '흔들리며 피어나는 꽃이 더 단단한 향기를 품는 법이래',
  '어떤 길을 가든 결국 너만의 이야기가 만들어져',
  '너는 아직 너의 전부를 만나지 못했어',
  '남과 다른 점은 약점이 아니라 개성이야',
  '작은 반짝임도 발견하는 사람이 행복해',
  '두려움이 사라진 뒤가 아니라 두려운 채로 내딛는 것이 용기야',
  '이제껏 보지 못한 풍경이 내일의 입구에서 기다리고 있어',
  '네가 걸어온 길도 충분히 자랑스러워',
  '모든 길에는 나름의 풍경이 있어',
  '실수는 계속 일어날거야. 뭐 어때.',
  '어떤 순간은 멜로디처럼 남는다',
  '무거운 하루 끝에 나에게 건네는 따뜻한 차 한 잔의 위로',
  '천천히 걸을수록 더 많은 것을 보게 돼',
  '한 걸음의 용기가 열 걸음의 후회를 막아 줘',
  '아픈 경험도 언젠가는 힘이 되어 돌아와',
  '시도해 본 사람만이 다음 풍경을 만날 수 있어',
  '돌아가는 길도 길이라는 사실을 잊지 마',
  '고민 끝에 내린 선택은 너를 성장시켜',
  '마음을 열면 보이는 것들이 있어',
  '클래스톤을 이용해주셔서 감사합니다. 도움이 되셨다면 좋겠습니다!'
];

function _getTodayQuote() {
  const today = new Date();
  const start = new Date(today.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((today - start) / 86400000);
  const index = (dayOfYear - 1) % _QUOTES.length;
  return _QUOTES[index < 0 ? 0 : index];
}

function _getTodayStr() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}

function openQuotePopup() {
  const todayStr = _getTodayStr();
  const seen = localStorage.getItem('classton_quote_date');
  const ov = document.getElementById('quoteOverlay');
  const txt = document.getElementById('quoteText');
  if (!ov || !txt) return;
  txt.textContent = (seen === todayStr) ? '오늘은 이미 확인했습니다!' : _getTodayQuote();
  if (seen !== todayStr) localStorage.setItem('classton_quote_date', todayStr);
  ov.style.display = 'flex';
}

function closeQuotePopup() {
  const ov = document.getElementById('quoteOverlay');
  if (ov) ov.style.display = 'none';
}
