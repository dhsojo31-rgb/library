/* ============================================================
   storage.js — 진행률/배지/쿠폰을 브라우저에 저장하고 불러오기
   ------------------------------------------------------------
   localStorage 는 브라우저에 있는 작은 저장 상자예요.
   앱을 껐다 켜도, 폰을 재부팅해도 내용이 남아있어요.
   단, 글자(문자열)만 넣을 수 있어서 JSON 으로 바꿔서 넣습니다.
   ============================================================ */

/* 저장 형식이 바뀌면 뒤의 숫자를 올려요.
   v2: 학번을 없애고 반(classNo)을 받도록 변경 — 옛 저장본은 무시하고 다시 등록받습니다. */
const SAVE_KEY = 'library_explorer_v2';

/* 처음 시작할 때의 빈 상태 */
function emptyState() {
  return {
    student: null,                 // { name, grade, classNo }
    progress: { f01: false, f02: false, f03: false, f04: false, f05: false },
    quiz: { passed: false, bestScore: 0, attemptCount: 0 },
    badges: [],
    coupons: []
  };
}

let state = load();

/* ---------- 불러오기 ---------- */
function load() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return emptyState();
    // 저장된 값과 기본값을 합쳐요.
    // (나중에 항목을 새로 추가해도 옛날 저장본이 깨지지 않게 하려고)
    return Object.assign(emptyState(), JSON.parse(raw));
  } catch (e) {
    // 저장본이 망가졌으면 그냥 새로 시작 (앱이 멈추는 것보다 나아요)
    console.warn('저장된 데이터를 읽지 못했습니다. 새로 시작합니다.', e);
    return emptyState();
  }
}

/* ---------- 저장하기 ---------- */
function save() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('저장에 실패했습니다.', e);
  }
}

/* ---------- 학생 등록 ---------- */
function registerStudent(name, grade, classNo) {
  state.student = { name, grade: Number(grade), classNo: Number(classNo) };
  save();
}

/* ---------- 단계 완료 표시 ---------- */
function markDone(key) {
  if (!(key in state.progress)) return false;
  const wasNew = !state.progress[key];
  state.progress[key] = true;
  save();
  return wasNew;              // 처음 완료한 거면 true (축하 메시지용)
}

/* ---------- 진행률 계산 ---------- */
function doneCount() {
  return Object.values(state.progress).filter(Boolean).length;
}
function totalSteps() {
  return Object.keys(state.progress).length;
}
function progressPct() {
  return Math.round(doneCount() / totalSteps() * 100);
}
function allDone() {
  return doneCount() === totalSteps();
}

/* ---------- 퀴즈 결과 기록 ---------- */
function recordQuiz(score) {
  state.quiz.attemptCount += 1;
  if (score > state.quiz.bestScore) state.quiz.bestScore = score;

  const passed = score >= QUIZ_RULE.passScore;
  const firstPass = passed && !state.quiz.passed;
  if (passed) state.quiz.passed = true;

  // 배지는 처음 통과할 때 한 번만
  if (firstPass && !state.badges.includes(BADGE.id)) {
    state.badges.push(BADGE.id);
  }
  save();
  return { passed, firstPass };
}

/* ---------- 쿠폰 발급 ---------- */
function issueCoupon(type) {
  const info = COUPON_TYPES.find(c => c.type === type);
  if (!info) return null;

  const coupon = {
    id: 'C' + Date.now(),
    type: type,
    code: makeCouponCode(),
    issuedAt: todayISO(),
    usedAt: null
  };
  state.coupons.push(coupon);
  save();
  return coupon;
}

/* 쿠폰 번호 만들기 — 학년·반 + 무작위 4글자 (예: 3-1반 → "31" + "KT65")
   학년·반을 앞에 붙여두면 선생님이 어느 반 학생 쿠폰인지 바로 알 수 있어요.
   ⚠️ 바코드(CODE39)로 그릴 거라서 숫자·영대문자만 씁니다. */
function makeCouponCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 헷갈리는 O,0,I,1 은 뺐어요
  let rnd = '';
  for (let i = 0; i < 4; i++) {
    rnd += chars[Math.floor(Math.random() * chars.length)];
  }
  const s = state.student;
  const head = s ? `${s.grade}${s.classNo}` : '00';
  return head + rnd;
}

/* ---------- 쿠폰 사용 처리 (사서 선생님용) ---------- */
function useCoupon(id) {
  const c = state.coupons.find(x => x.id === id);
  if (!c || c.usedAt) return false;   // 없거나 이미 쓴 쿠폰이면 실패
  c.usedAt = todayISO();
  save();
  return true;
}

/* 날짜를 'YYYY-MM-DD' 로 바꿔요. 넣지 않으면 오늘 날짜.
   ⚠️ toISOString() 을 쓰면 안 돼요! 그건 세계표준시(UTC) 기준이라
      한국 시간 오전 9시 이전에는 날짜가 하루 당겨져 버립니다. */
function todayISO(date) {
  const d = date || new Date();
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/* ---------- 전체 초기화 (관리자용) ---------- */
function resetAll() {
  localStorage.removeItem(SAVE_KEY);
  state = emptyState();
}
