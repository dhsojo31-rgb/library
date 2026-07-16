/* ============================================================
   app.js — 화면 전환과 모든 동작
   ------------------------------------------------------------
   구성:
     1) 공용 도구        — $, esc, toast, speak, shuffle
     2) 라우터           — 주소(#/home)에 따라 화면 바꾸기
     3) 홈 대시보드
     4) 가이드 뷰어      — F-01 / F-03 / F-05 를 이거 하나로! ⭐
     5) 도서관 사전      — F-02
     6) YES/NO 게임      — F-04
     7) 퀴즈             — F-06
     8) 보관함 (배지/쿠폰)
     9) 관리자
    10) 모달 · 시작
   ============================================================ */

/* ══════════ 1) 공용 도구 ══════════ */

const $ = sel => document.querySelector(sel);

/* 사용자가 입력한 글자(이름, 책 제목)를 HTML에 넣을 때 안전하게 바꿔줘요.
   이걸 안 하면 제목에 < 같은 걸 넣었을 때 화면이 깨져요. */
function esc(s) {
  return String(s).replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

/* 화면 아래에 잠깐 떴다 사라지는 알림 */
let toastTimer;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 2600);
}

/* 읽어주기 (TTS) — 저학년 배려. 브라우저에 내장된 기능이라 이게 전부예요! */
function speak(text) {
  if (!('speechSynthesis' in window)) {
    toast('이 브라우저는 읽어주기를 지원하지 않아요.');
    return;
  }
  speechSynthesis.cancel();                       // 이전에 읽던 것 중단
  const u = new SpeechSynthesisUtterance(
    String(text).replace(/<[^>]+>/g, '')          // HTML 태그는 빼고 읽기
  );
  u.lang = 'ko-KR';
  u.rate = 0.9;                                   // 저학년을 위해 조금 느리게
  speechSynthesis.speak(u);
}

/* 순서 섞기 (퀴즈·카드용) */
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ══════════ 2) 라우터 ══════════ */

/* 탐험 코스 목록 — 홈 화면 메뉴이자 라우팅 정보 */
const MENU = [
  { key: 'f01', route: '#/guide/f01', emoji: GUIDES.f01.emoji,
    title: GUIDES.f01.title, sub: GUIDES.f01.subtitle },
  { key: 'f02', route: '#/dict', emoji: '📕',
    title: '2단계: 도서관 사전', sub: '꼭 알아야 할 낱말 7개' },
  { key: 'f03', route: '#/guide/f03', emoji: GUIDES.f03.emoji,
    title: GUIDES.f03.title, sub: GUIDES.f03.subtitle },
  { key: 'f04', route: '#/swipe', emoji: '🤫',
    title: '4단계: 도서관 약속', sub: 'YES / NO 카드 게임' },
  { key: 'f05', route: '#/guide/f05', emoji: GUIDES.f05.emoji,
    title: GUIDES.f05.title, sub: GUIDES.f05.subtitle }
];

/* 화면 하나만 보여주고 나머지는 숨기기.
   React 같은 도구가 하는 일의 대부분이 사실 이 4줄이에요. */
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(el => { el.hidden = true; });
  $('#' + id).hidden = false;
  window.scrollTo(0, 0);
  const scroll = $('#' + id).querySelector('.scroll');
  if (scroll) scroll.scrollTop = 0;
  speechSynthesis?.cancel();     // 화면을 옮기면 읽던 것 멈추기
}

function go(hash) {
  if (location.hash === hash) route();   // 같은 주소면 새로고침
  else location.hash = hash;
}

function route() {
  // 아직 등록 안 한 학생은 무조건 온보딩으로
  if (!state.student) { showScreen('screen-onboard'); return; }

  const hash = location.hash || '#/home';
  const parts = hash.replace('#/', '').split('/');

  switch (parts[0]) {
    case 'guide':  renderGuide(parts[1]); break;
    case 'dict':   renderDict();   break;
    case 'swipe':  startSwipe();   break;
    case 'quiz':   startQuiz();    break;
    case 'reward': renderReward(); break;
    case 'admin':  renderAdmin();  break;
    default:       renderHome();
  }
}

window.addEventListener('hashchange', route);

/* 모든 화면의 '‹' 뒤로 버튼 */
document.addEventListener('click', e => {
  if (e.target.closest('[data-back]')) go('#/home');
});

/* ══════════ 3) 홈 대시보드 ══════════ */

function renderHome() {
  showScreen('screen-home');

  const s = state.student;
  $('#home-hello').textContent = `안녕하세요, ${s.grade}학년 ${s.classNo}반 ${s.name} 탐험대원!`;

  // 진행률
  const pct = progressPct();
  $('#progress-pct').textContent = pct + '%';
  $('#progress-bar').style.width = pct + '%';
  $('#progress-note').textContent =
    allDone()
      ? (state.quiz.passed ? '모든 탐험을 마쳤어요! 정말 대단해요 🎉'
                           : '5단계 완료! 이제 퀴즈에 도전할 수 있어요 🏅')
      : `${totalSteps()}단계 중 ${doneCount()}단계 완료했어요.`;

  // 탐험 코스 카드
  $('#menu-grid').innerHTML = MENU.map(m => {
    const done = state.progress[m.key];
    return `
      <button class="menu-card ${done ? 'is-done' : ''}" data-route="${m.route}">
        <span class="menu-emoji">${m.emoji}</span>
        <span class="menu-title">${esc(m.title)}</span>
        <span class="menu-sub">${esc(m.sub)}</span>
        <span class="menu-badge">${done ? '완료 ✓' : ''}</span>
      </button>`;
  }).join('');

  // 퀴즈 버튼 상태
  const sub = $('#quiz-cta-sub');
  if (state.quiz.passed) {
    sub.textContent = '수료 완료! 🎉 보관함에서 배지와 쿠폰을 확인하세요';
  } else if (allDone()) {
    sub.textContent = '준비 끝! 지금 도전하세요';
  } else {
    sub.textContent = `5문제 중 ${QUIZ_RULE.passScore}문제를 맞히면 수료 배지!`;
  }

  renderLoans();
  renderNotices();
}

/* 메뉴 카드 클릭 */
$('#menu-grid').addEventListener('click', e => {
  const btn = e.target.closest('[data-route]');
  if (btn) go(btn.dataset.route);
});

$('#btn-quiz-cta').addEventListener('click', () => {
  if (state.quiz.passed) go('#/reward');
  else go('#/quiz');
});

$('#btn-admin').addEventListener('click', () => go('#/admin'));

/* ---------- 빌린 책 D-Day ---------- */
function renderLoans() {
  const box = $('#loan-list');
  if (state.loans.length === 0) {
    box.innerHTML = `<p class="empty">아직 빌린 책이 없어요.
      책을 빌리면 <b>+ 추가</b>를 눌러서 반납일을 기억해 두세요!</p>`;
    return;
  }
  box.innerHTML = state.loans.map(l => {
    const d = daysLeft(l.dueDate);
    let label, tone;
    if (d < 0)       { label = `${-d}일 연체`;  tone = 'late'; }
    else if (d === 0){ label = '오늘까지!';     tone = 'today'; }
    else if (d <= 2) { label = `D-${d}`;        tone = 'soon'; }
    else             { label = `D-${d}`;        tone = 'ok'; }
    return `
      <div class="loan ${tone}">
        <div class="loan-info">
          <strong>${esc(l.title)}</strong>
          <small>${esc(l.dueDate)}까지</small>
        </div>
        <span class="dday">${label}</span>
        <button class="icon-btn small" data-del="${l.id}" aria-label="삭제">🗑️</button>
      </div>`;
  }).join('');
}

$('#loan-list').addEventListener('click', e => {
  const btn = e.target.closest('[data-del]');
  if (!btn) return;
  removeLoan(btn.dataset.del);
  renderLoans();
});

function renderNotices() {
  $('#notice-list').innerHTML = NOTICES.map(n => `
    <div class="notice">
      <span class="notice-emoji">${n.emoji}</span>
      <p>${esc(n.text)}</p>
    </div>`).join('');
}

/* ══════════ 4) 가이드 뷰어 ⭐ F-01 / F-03 / F-05 공용 ══════════
   이 화면 하나가 가이드 3개를 전부 담당합니다.
   새 가이드를 추가하고 싶으면? data.js 의 GUIDES 에 넣기만 하면 끝!
   ============================================================ */

let guideKey = null;
let guideIdx = 0;

function renderGuide(key) {
  if (!GUIDES[key]) { go('#/home'); return; }
  if (guideKey !== key) { guideKey = key; guideIdx = 0; }   // 다른 가이드면 처음부터
  showScreen('screen-guide');
  paintGuide();
}

function paintGuide() {
  const g = GUIDES[guideKey];
  const step = g.steps[guideIdx];
  const last = guideIdx === g.steps.length - 1;

  $('#guide-title').textContent = g.title;

  $('#guide-dots').innerHTML = g.steps.map((_, i) =>
    `<span class="dot ${i === guideIdx ? 'on' : ''} ${i < guideIdx ? 'past' : ''}"></span>`
  ).join('');

  $('#guide-body').innerHTML = `
    <article class="card step-card">
      <div class="step-icon">${step.icon}</div>
      <h2 class="step-heading">${esc(step.heading)}</h2>
      <p class="step-body">${esc(step.body)}</p>
      ${step.custom ? renderCustom(step.custom) : ''}
    </article>`;

  $('#guide-prev').disabled = guideIdx === 0;
  $('#guide-next').textContent = last ? '다 배웠어요! ✓' : '다음';
  $('#guide-next').classList.toggle('btn-done', last);
}

$('#guide-prev').addEventListener('click', () => {
  if (guideIdx > 0) { guideIdx--; paintGuide(); }
});

$('#guide-next').addEventListener('click', () => {
  const g = GUIDES[guideKey];
  if (guideIdx < g.steps.length - 1) {
    guideIdx++;
    paintGuide();
  } else {
    const wasNew = markDone(guideKey);
    guideIdx = 0;
    go('#/home');
    toast(wasNew ? `${g.title} 완료! 진행률 ${progressPct()}% 🎉`
                 : '다시 복습했어요! 👍');
  }
});

$('#guide-tts').addEventListener('click', () => {
  const step = GUIDES[guideKey].steps[guideIdx];
  speak(step.heading + '. ' + step.body);
});

/* ---------- 가이드 안에 들어가는 특별한 그림들 ---------- */
function renderCustom(type) {
  if (type === 'map') {
    return `<div class="map-grid">` + LIBRARY_MAP.map(m => `
      <div class="map-cell tone-${m.tone}">
        <span class="map-emoji">${m.emoji}</span>
        <span class="map-name">${esc(m.name)}</span>
      </div>`).join('') + `</div>`;
  }

  if (type === 'hours') {
    return `<div class="hours">` + HOURS.map(h => `
      <div class="hour-row ${h.ok ? '' : 'closed'}">
        <span class="hour-when">${esc(h.when)}</span>
        <span class="hour-time">${esc(h.time)}</span>
      </div>`).join('') + `</div>`;
  }

  if (type === 'kiosk') {
    const col = (title, tone, steps) => `
      <div class="kiosk-col">
        <h3 class="kiosk-head tone-${tone}">${title}</h3>
        <ol class="kiosk-steps">
          ${steps.map(s => `<li>${esc(s)}</li>`).join('')}
        </ol>
      </div>`;
    return `<div class="kiosk">
      ${col('🟢 빌리기', 'green', KIOSK.borrow)}
      ${col('🔵 돌려주기', 'blue', KIOSK.giveback)}
    </div>`;
  }

  if (type === 'callno') {
    return `
      <div class="callno">
        <div class="callno-sticker">
          <span class="cn-num">${CALL_NUMBER.sample}</span>
          <span class="cn-au">${CALL_NUMBER.sampleAuthor}</span>
        </div>
        <p class="callno-hint">↓ 스티커의 비밀 ↓</p>
        ${CALL_NUMBER.parts.map(p => `
          <div class="callno-row">
            <span class="cn-chip tone-${p.tone}">${esc(p.label)}</span>
            <p>${esc(p.desc)}</p>
          </div>`).join('')}
      </div>`;
  }

  if (type === 'kdc') {
    return `<div class="kdc">` + KDC.map(k => `
      <div class="kdc-row" style="--c:${k.color}">
        <span class="kdc-code">${k.code}</span>
        <span class="kdc-emoji">${k.emoji}</span>
        <span class="kdc-name">${esc(k.name)}</span>
        <span class="kdc-ex">${esc(k.ex)}</span>
      </div>`).join('') + `</div>`;
  }

  return '';
}

/* ══════════ 5) 도서관 사전 (F-02) ══════════ */

let dictIdx = 0;
let dictFlipped = false;
const dictSeen = new Set();

function renderDict() {
  showScreen('screen-dict');
  paintDict();
}

function paintDict() {
  const d = DICTIONARY[dictIdx];
  const last = dictIdx === DICTIONARY.length - 1;

  $('#dict-dots').innerHTML = DICTIONARY.map((_, i) =>
    `<span class="dot ${i === dictIdx ? 'on' : ''} ${dictSeen.has(i) ? 'past' : ''}"></span>`
  ).join('');

  // 카드 뒤집기는 CSS 의 rotateY 로 처리해요. (flip 클래스가 붙으면 뒤집힘)
  $('#dict-stage').innerHTML = `
    <div class="flip ${dictFlipped ? 'flipped' : ''}" id="flip-card">
      <div class="flip-inner">
        <div class="flip-face flip-front">
          <span class="flip-emoji">${d.emoji}</span>
          <h2 class="flip-word">${esc(d.word)}</h2>
          <span class="flip-hint">눌러서 뜻 보기 👆</span>
        </div>
        <div class="flip-face flip-back">
          <h3 class="flip-back-word">${esc(d.word)}</h3>
          <p class="flip-meaning">${d.meaning}</p>
          ${d.tip ? `<p class="flip-tip">💡 ${esc(d.tip)}</p>` : ''}
        </div>
      </div>
    </div>`;

  $('#dict-prev').disabled = dictIdx === 0;
  $('#dict-next').textContent = last ? '다 배웠어요! ✓' : '다음';
  $('#dict-next').classList.toggle('btn-done', last);
}

$('#dict-stage').addEventListener('click', () => {
  dictFlipped = !dictFlipped;
  if (dictFlipped) dictSeen.add(dictIdx);        // 뒤집어 본 카드 기억
  $('#flip-card').classList.toggle('flipped', dictFlipped);
  $('#dict-dots').children[dictIdx]?.classList.add('past');
});

$('#dict-prev').addEventListener('click', () => {
  if (dictIdx > 0) { dictIdx--; dictFlipped = false; paintDict(); }
});

$('#dict-next').addEventListener('click', () => {
  if (dictIdx < DICTIONARY.length - 1) {
    dictIdx++; dictFlipped = false; paintDict();
  } else {
    const wasNew = markDone('f02');
    dictIdx = 0; dictFlipped = false;
    go('#/home');
    toast(wasNew ? `도서관 사전 완료! 진행률 ${progressPct()}% 🎉` : '다시 복습했어요! 👍');
  }
});

$('#dict-tts').addEventListener('click', () => {
  const d = DICTIONARY[dictIdx];
  speak(`${d.word}. ${d.meaning.replace(/<[^>]+>/g, '')}`);
});

/* ══════════ 6) YES / NO 게임 (F-04) ══════════
   드래그(스와이프)와 버튼 둘 다 됩니다.
   저학년은 버튼이 더 쉬울 수 있어서 두 방법을 모두 열어뒀어요.
   ============================================================ */

let deck = [];
let swipeIdx = 0;
let swipeRight = 0;
let swipeLocked = false;    // 판정 중에 또 누르는 것 방지

function startSwipe() {
  showScreen('screen-swipe');
  deck = shuffle(SWIPE_CARDS);
  swipeIdx = 0;
  swipeRight = 0;
  swipeLocked = false;
  paintSwipe();
}

function paintSwipe() {
  if (swipeIdx >= deck.length) { finishSwipe(); return; }

  const c = deck[swipeIdx];
  $('#swipe-count').textContent = `${swipeIdx + 1} / ${deck.length}`;
  $('#swipe-stage').innerHTML = `
    <div class="swipe-card" id="swipe-card">
      <span class="swipe-tag tag-yes">⭕ YES</span>
      <span class="swipe-tag tag-no">❌ NO</span>
      <span class="swipe-emoji">${c.emoji}</span>
      <p class="swipe-text">${esc(c.situation)}</p>
      <span class="swipe-hint">좌우로 밀거나 아래 버튼을 누르세요</span>
    </div>`;
  enableDrag($('#swipe-card'));
  $('#btn-yes').disabled = false;
  $('#btn-no').disabled = false;
}

/* 카드를 손가락/마우스로 끌기 */
function enableDrag(card) {
  let startX = 0, dx = 0, dragging = false;

  card.addEventListener('pointerdown', e => {
    if (swipeLocked) return;
    dragging = true;
    startX = e.clientX;
    card.setPointerCapture(e.pointerId);
    card.style.transition = 'none';
  });

  card.addEventListener('pointermove', e => {
    if (!dragging) return;
    dx = e.clientX - startX;
    card.style.transform = `translateX(${dx}px) rotate(${dx / 22}deg)`;
    // 어느 쪽으로 미는지에 따라 YES/NO 도장이 진해져요
    card.classList.toggle('lean-yes', dx > 40);
    card.classList.toggle('lean-no', dx < -40);
  });

  const end = () => {
    if (!dragging) return;
    dragging = false;
    card.style.transition = '';
    if (Math.abs(dx) > 90) {
      answerSwipe(dx > 0 ? 'YES' : 'NO');
    } else {
      card.style.transform = '';                     // 덜 밀었으면 제자리로
      card.classList.remove('lean-yes', 'lean-no');
    }
    dx = 0;
  };
  card.addEventListener('pointerup', end);
  card.addEventListener('pointercancel', end);
}

function answerSwipe(choice) {
  if (swipeLocked) return;
  swipeLocked = true;
  $('#btn-yes').disabled = true;
  $('#btn-no').disabled = true;

  const c = deck[swipeIdx];
  const correct = c.answer === choice;
  if (correct) swipeRight++;

  // 카드를 고른 방향으로 날려보내기
  const card = $('#swipe-card');
  if (card) {
    card.style.transform =
      `translateX(${choice === 'YES' ? 500 : -500}px) rotate(${choice === 'YES' ? 25 : -25}deg)`;
    card.style.opacity = '0';
  }

  setTimeout(() => {
    $('#swipe-stage').innerHTML = `
      <div class="verdict ${correct ? 'good' : 'bad'}">
        <span class="verdict-emoji">${correct ? '🎉' : '🤔'}</span>
        <h2>${correct ? '정답이에요!' : '다시 생각해봐요'}</h2>
        <p class="verdict-answer">이 행동은 <b>${c.answer}</b> 예요.</p>
        <p class="verdict-explain">${esc(c.explain)}</p>
        <button class="btn btn-primary btn-lg" id="verdict-next">다음 카드 →</button>
      </div>`;
    $('#verdict-next').addEventListener('click', () => {
      swipeIdx++;
      swipeLocked = false;
      paintSwipe();
    });
  }, 260);
}

$('#btn-yes').addEventListener('click', () => answerSwipe('YES'));
$('#btn-no').addEventListener('click', () => answerSwipe('NO'));

function finishSwipe() {
  const wasNew = markDone('f04');
  $('#swipe-count').textContent = '';
  $('#swipe-stage').innerHTML = `
    <div class="verdict good">
      <span class="verdict-emoji">🏆</span>
      <h2>도서관 약속 끝!</h2>
      <p class="verdict-answer">${deck.length}개 중 <b>${swipeRight}개</b> 맞혔어요.</p>
      <p class="verdict-explain">${
        swipeRight === deck.length ? '완벽해요! 약속을 아주 잘 알고 있네요 👏'
                                   : '틀린 것도 괜찮아요. 이제 알았으니까요!'}</p>
      <button class="btn btn-primary btn-lg" id="swipe-home">홈으로</button>
      <button class="btn" id="swipe-again">한 번 더 하기</button>
    </div>`;
  $('#swipe-home').addEventListener('click', () => {
    go('#/home');
    toast(wasNew ? `도서관 약속 완료! 진행률 ${progressPct()}% 🎉` : '다시 복습했어요! 👍');
  });
  $('#swipe-again').addEventListener('click', startSwipe);
}

/* ══════════ 7) 퀴즈 (F-06) ══════════ */

let qList = [];
let qIdx = 0;
let qScore = 0;
let qAnswered = false;

function startQuiz() {
  showScreen('screen-quiz');

  // 5단계를 다 안 끝냈으면 아직 퀴즈를 볼 수 없어요
  if (!allDone()) {
    $('#quiz-count').textContent = '';
    $('#quiz-bar').style.width = '0%';
    $('#quiz-body').innerHTML = `
      <div class="card locked">
        <span class="locked-emoji">🔒</span>
        <h2>아직 잠겨 있어요</h2>
        <p>탐험 코스 5단계를 모두 마치면 퀴즈에 도전할 수 있어요.<br>
           지금은 <b>${doneCount()} / ${totalSteps()}</b> 단계를 마쳤어요.</p>
        <button class="btn btn-primary btn-lg" data-back>탐험하러 가기</button>
      </div>`;
    return;
  }

  qList = shuffle(QUIZ_POOL).slice(0, QUIZ_RULE.count);
  qIdx = 0;
  qScore = 0;
  qAnswered = false;
  paintQuiz();
}

function paintQuiz() {
  const q = qList[qIdx];
  qAnswered = false;

  $('#quiz-count').textContent = `${qIdx + 1} / ${qList.length}`;
  $('#quiz-bar').style.width = (qIdx / qList.length * 100) + '%';

  const choices = q.type === 'OX'
    ? `<div class="ox">
         <button class="ox-btn ox-o" data-pick="true">⭕</button>
         <button class="ox-btn ox-x" data-pick="false">❌</button>
       </div>`
    : `<div class="mc">
         ${q.choices.map((c, i) =>
           `<button class="mc-btn" data-pick="${i}">
              <span class="mc-num">${i + 1}</span>${esc(c)}
            </button>`).join('')}
       </div>`;

  $('#quiz-body').innerHTML = `
    <article class="card quiz-card">
      <span class="quiz-type">${q.type === 'OX' ? 'O / X 문제' : '객관식'}</span>
      <h2 class="quiz-q">${esc(q.q)}</h2>
      ${choices}
    </article>
    <div id="quiz-feedback"></div>`;
}

/* 답 고르기 */
$('#quiz-body').addEventListener('click', e => {
  const btn = e.target.closest('[data-pick]');
  if (!btn || qAnswered) return;
  qAnswered = true;

  const q = qList[qIdx];
  const picked = q.type === 'OX' ? (btn.dataset.pick === 'true') : Number(btn.dataset.pick);
  const correct = picked === q.answer;
  if (correct) qScore++;

  // 고른 버튼과 정답 버튼에 색칠하기
  document.querySelectorAll('[data-pick]').forEach(b => {
    const v = q.type === 'OX' ? (b.dataset.pick === 'true') : Number(b.dataset.pick);
    b.disabled = true;
    if (v === q.answer) b.classList.add('is-correct');
    else if (v === picked) b.classList.add('is-wrong');
  });

  const last = qIdx === qList.length - 1;
  $('#quiz-feedback').innerHTML = `
    <div class="feedback ${correct ? 'good' : 'bad'}">
      <strong>${correct ? '⭕ 정답!' : '❌ 아쉬워요'}</strong>
      <p>${esc(q.explain)}</p>
      <button class="btn btn-primary btn-lg" id="quiz-next">
        ${last ? '결과 보기' : '다음 문제 →'}
      </button>
    </div>`;
  $('#quiz-feedback').scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  $('#quiz-next').addEventListener('click', () => {
    if (last) finishQuiz();
    else { qIdx++; paintQuiz(); }
  });
});

function finishQuiz() {
  const { passed, firstPass } = recordQuiz(qScore);
  $('#quiz-count').textContent = '';
  $('#quiz-bar').style.width = '100%';

  // 통과했는데 아직 쿠폰을 안 받았으면 쿠폰 고르기 화면
  const needCoupon = passed && state.coupons.length === 0;

  $('#quiz-body').innerHTML = `
    <div class="card result ${passed ? 'pass' : 'fail'}">
      <span class="result-emoji">${passed ? '🎉' : '💪'}</span>
      <h2>${passed ? '통과!' : '조금만 더!'}</h2>
      <p class="result-score">${qList.length}문제 중 <b>${qScore}문제</b> 정답</p>
      <p class="result-msg">${
        passed
          ? (firstPass ? '축하해요! 도서관 탐험대 수료 배지를 받았어요 🏅'
                       : '역시 잘하는군요! 배지는 이미 갖고 있어요.')
          : `${QUIZ_RULE.passScore}문제 이상 맞혀야 통과예요. 다시 도전해볼까요?`
      }</p>
      ${needCoupon ? `
        <div class="coupon-pick">
          <h3>🎁 쿠폰을 하나 고르세요!</h3>
          <p class="coupon-pick-sub">도서관에서 사서 선생님께 보여주면 돼요.</p>
          ${COUPON_TYPES.map(c => `
            <button class="coupon-opt" data-coupon="${c.type}">
              <span class="coupon-opt-emoji">${c.emoji}</span>
              <span class="coupon-opt-text">
                <strong>${esc(c.name)}</strong>
                <small>${esc(c.desc)}</small>
              </span>
            </button>`).join('')}
        </div>` : `
        <div class="result-actions">
          <button class="btn btn-primary btn-lg" id="quiz-retry">다시 도전</button>
          ${passed ? `<button class="btn" id="quiz-reward">보관함 보기</button>` : ''}
          <button class="btn" data-back>홈으로</button>
        </div>`}
    </div>`;

  $('#quiz-retry')?.addEventListener('click', startQuiz);
  $('#quiz-reward')?.addEventListener('click', () => go('#/reward'));

  document.querySelectorAll('[data-coupon]').forEach(b => {
    b.addEventListener('click', () => {
      issueCoupon(b.dataset.coupon);
      go('#/reward');
      toast('쿠폰이 발급되었어요! 🎁');
    });
  });
}

/* ══════════ 8) 보관함 (배지 + 쿠폰) ══════════ */

function renderReward() {
  showScreen('screen-reward');

  const badgeHtml = state.badges.includes(BADGE.id) ? `
    <div class="badge-card">
      <span class="badge-emoji">${BADGE.emoji}</span>
      <h3>${esc(BADGE.name)}</h3>
      <p>${esc(BADGE.desc)}</p>
      <small>최고 점수 ${state.quiz.bestScore} / ${QUIZ_RULE.count}</small>
    </div>` : `
    <p class="empty">아직 배지가 없어요.<br>퀴즈를 통과하면 수료 배지를 받을 수 있어요! 🏅</p>`;

  const couponHtml = state.coupons.length ? state.coupons.map(c => {
    const info = COUPON_TYPES.find(t => t.type === c.type);
    const used = !!c.usedAt;
    return `
      <div class="coupon ${used ? 'used' : ''}">
        ${used ? '<span class="stamp">사용 완료</span>' : ''}
        <div class="coupon-head">
          <span class="coupon-emoji">${info.emoji}</span>
          <div>
            <strong>${esc(info.name)}</strong>
            <small>${esc(info.desc)}</small>
          </div>
        </div>
        <canvas class="barcode" data-code="${esc(c.code)}"></canvas>
        <p class="coupon-code">${esc(c.code)}</p>
        <small class="coupon-date">
          ${esc(c.issuedAt)} 발급${used ? ` · ${esc(c.usedAt)} 사용` : ''}
        </small>
      </div>`;
  }).join('') : `<p class="empty">아직 쿠폰이 없어요.</p>`;

  $('#reward-body').innerHTML = `
    <h2 class="section-title">내 배지</h2>
    ${badgeHtml}
    <h2 class="section-title">내 쿠폰</h2>
    ${couponHtml}
    ${state.coupons.length ? `
      <p class="hint-box">💡 도서관에서 사서 선생님께 이 화면을 보여주세요.
         선생님이 확인하고 사용 처리를 해주실 거예요.</p>` : ''}`;

  // 쿠폰마다 바코드 그리기 (화면에 붙은 뒤에 그려야 크기를 알 수 있어요)
  requestAnimationFrame(() => {
    document.querySelectorAll('#reward-body canvas[data-code]').forEach(cv => {
      drawBarcode(cv, cv.dataset.code, 56);
    });
  });
}

/* ══════════ 9) 관리자 (사서 선생님용) ══════════
   ⚠️ 서버가 없어서 "이 기기에 저장된 데이터"만 보입니다.
      실제 용도: 학생이 폰을 보여주면 쿠폰을 사용 처리하는 검수 도구.
   ============================================================ */

let adminUnlocked = false;

function renderAdmin() {
  showScreen('screen-admin');
  if (!adminUnlocked) { paintAdminLock(); return; }
  paintAdminPanel();
}

function paintAdminLock() {
  $('#admin-body').innerHTML = `
    <div class="card lock">
      <span class="locked-emoji">🔐</span>
      <h2>사서 선생님 확인</h2>
      <p>PIN 번호를 입력해주세요.</p>
      <form id="pin-form">
        <input id="pin-input" type="password" inputmode="numeric" maxlength="8"
               placeholder="••••" autocomplete="off">
        <button class="btn btn-primary btn-lg" type="submit">확인</button>
      </form>
      <p class="warn">⚠️ 학생용 화면이 아니에요!</p>
    </div>`;

  $('#pin-form').addEventListener('submit', e => {
    e.preventDefault();
    if ($('#pin-input').value === ADMIN_PIN) {
      adminUnlocked = true;
      paintAdminPanel();
    } else {
      toast('PIN이 맞지 않아요.');
      $('#pin-input').value = '';
    }
  });
}

function paintAdminPanel() {
  const s = state.student;

  const rows = MENU.map(m =>
    `<div class="admin-row">
       <span>${esc(m.title)}</span>
       <b class="${state.progress[m.key] ? 'yes' : 'no'}">
         ${state.progress[m.key] ? '완료' : '미완료'}
       </b>
     </div>`).join('');

  const coupons = state.coupons.length ? state.coupons.map(c => {
    const info = COUPON_TYPES.find(t => t.type === c.type);
    const used = !!c.usedAt;
    return `
      <div class="admin-coupon ${used ? 'used' : ''}">
        <div>
          <strong>${info.emoji} ${esc(info.name)}</strong>
          <small>번호 ${esc(c.code)} · ${esc(c.issuedAt)} 발급</small>
        </div>
        ${used
          ? `<span class="admin-used">✓ ${esc(c.usedAt)} 사용됨</span>`
          : `<button class="btn btn-primary" data-use="${c.id}">사용 처리</button>`}
      </div>`;
  }).join('') : `<p class="empty">발급된 쿠폰이 없습니다.</p>`;

  $('#admin-body').innerHTML = `
    <div class="notice-box">
      ⚠️ <b>이 화면은 이 기기에 저장된 데이터만 보여줍니다.</b><br>
      학생 폰에서 열어야 그 학생의 쿠폰이 보입니다. 전교생 현황 조회는
      서버 연동이 필요하며 현재 버전에는 없습니다.
    </div>

    <h2 class="section-title">학생 정보</h2>
    <div class="card">
      <div class="admin-row"><span>이름</span><b>${esc(s.name)}</b></div>
      <div class="admin-row"><span>학년</span><b>${s.grade}학년</b></div>
      <div class="admin-row"><span>반</span><b>${s.classNo}반</b></div>
    </div>

    <h2 class="section-title">학습 진행 현황 · ${progressPct()}%</h2>
    <div class="card">
      ${rows}
      <div class="admin-row">
        <span>퀴즈</span>
        <b class="${state.quiz.passed ? 'yes' : 'no'}">
          ${state.quiz.passed ? '통과' : '미통과'}
          (최고 ${state.quiz.bestScore}/${QUIZ_RULE.count} · ${state.quiz.attemptCount}회 시도)
        </b>
      </div>
    </div>

    <h2 class="section-title">쿠폰 검수</h2>
    ${coupons}

    <h2 class="section-title">관리</h2>
    <button class="btn btn-danger btn-lg" id="btn-reset">이 기기의 학습 기록 전체 삭제</button>
    <p class="hint-box">되돌릴 수 없습니다. 기기를 다른 학생에게 넘길 때만 사용하세요.</p>`;

  // 쿠폰 사용 처리
  document.querySelectorAll('[data-use]').forEach(b => {
    b.addEventListener('click', () => {
      const info = state.coupons.find(c => c.id === b.dataset.use);
      if (!confirm(`쿠폰 ${info.code} 을(를) 사용 처리할까요?\n되돌릴 수 없습니다.`)) return;
      if (useCoupon(b.dataset.use)) { paintAdminPanel(); toast('사용 처리했습니다.'); }
    });
  });

  $('#btn-reset').addEventListener('click', () => {
    if (!confirm('이 기기의 모든 학습 기록을 지웁니다.\n정말 삭제할까요?')) return;
    resetAll();
    adminUnlocked = false;
    location.hash = '';
    route();
    toast('초기화했습니다.');
  });
}

/* ══════════ 10) 모달 · 시작 ══════════ */

/* 모달 닫기 — [data-close] 버튼이나 바깥 어두운 곳을 누르면 닫힘 */
document.addEventListener('click', e => {
  if (e.target.closest('[data-close]')) e.target.closest('.modal').hidden = true;
  else if (e.target.classList.contains('modal')) e.target.hidden = true;
});

/* ---------- 빌린 책 추가 ---------- */
$('#btn-add-loan').addEventListener('click', () => {
  const f = $('#loan-form');
  f.reset();
  // 반납일 기본값 — 대출 기간은 data.js 의 LOAN_RULE 에서 바꾸세요
  const d = new Date();
  d.setDate(d.getDate() + LOAN_RULE.days);
  f.dueDate.value = todayISO(d);
  $('#modal-loan').hidden = false;
});

$('#loan-form').addEventListener('submit', e => {
  e.preventDefault();
  const f = e.target;
  addLoan(f.title.value.trim(), f.dueDate.value);
  $('#modal-loan').hidden = true;
  renderLoans();
  toast('책을 추가했어요! 반납일을 잊지 마세요 📅');
});

/* ---------- 온보딩 ---------- */
/* 학년·반 선택지는 data.js 의 SCHOOL_SIZE 로 만들어요 */
function fillSelect(el, max, suffix, selected) {
  el.innerHTML = '';
  for (let i = 1; i <= max; i++) {
    const o = document.createElement('option');
    o.value = i;
    o.textContent = i + suffix;
    if (i === selected) o.selected = true;
    el.appendChild(o);
  }
}
fillSelect($('#sel-grade'), SCHOOL_SIZE.maxGrade, '학년', 3);
fillSelect($('#sel-class'), SCHOOL_SIZE.maxClass, '반', 1);

$('#onboard-form').addEventListener('submit', e => {
  e.preventDefault();
  const f = e.target;
  registerStudent(f.name.value.trim(), f.grade.value, f.classNo.value);
  location.hash = '#/home';
  route();
  toast(`환영해요, ${state.student.name} 탐험대원! 🎉`);
});

/* ---------- 앱 시작 ---------- */
route();

/* ---------- 오프라인 지원 (Service Worker) ---------- */
/* file:// 로 열면 동작하지 않아요. Live Server 나 배포된 주소에서만 켜집니다. */
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(err =>
      console.warn('오프라인 기능을 켜지 못했습니다.', err));
  });
}
