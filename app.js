/* ============================================================
   app.js — 화면 전환과 모든 동작
   ------------------------------------------------------------
   구성:
     1) 공용 도구        — $, esc, toast, speak, shuffle
     2) 라우터           — 주소(#/home)에 따라 화면 바꾸기
     3) 홈 대시보드
     4) 가이드 뷰어      — F-01 / F-03 / F-05 를 이거 하나로! ⭐
     5) 도서관 용어      — F-02
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

/* 큰 그림 자리 — data.js 에 img 가 있으면 사진, 없으면 이모지를 보여줘요.
   사진을 못 불러오면(파일이 없거나 오타) 자동으로 이모지로 돌아갑니다.
   그래서 사진이 없어도 앱이 절대 깨지지 않아요. */
function bigPic(item) {
  if (!item.img) return `<span class="swipe-emoji">${item.emoji}</span>`;
  return `<img class="big-pic" src="${esc(item.img)}" alt=""
            onerror="this.outerHTML='<span class=\\'swipe-emoji\\'>${item.emoji}</span>'">`;
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
/* 제목·아이콘·설명은 전부 data.js 에서 가져옵니다.
   이름을 바꾸고 싶으면 data.js 만 고치면 돼요. */
const MENU = [
  { key: 'f01', route: '#/guide/f01', emoji: GUIDES.f01.emoji,
    title: GUIDES.f01.title, sub: GUIDES.f01.subtitle },
  { key: 'f02', route: '#/dict', emoji: DICT_PAGE.emoji,
    title: DICT_PAGE.title, sub: DICT_PAGE.subtitle },
  { key: 'f03', route: '#/guide/f03', emoji: GUIDES.f03.emoji,
    title: GUIDES.f03.title, sub: GUIDES.f03.subtitle },
  { key: 'f04', route: '#/swipe', emoji: SWIPE_PAGE.emoji,
    title: SWIPE_PAGE.title, sub: SWIPE_PAGE.subtitle },
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


/* ══════════ 4) 가이드 뷰어 ⭐ F-01 / F-03 / F-05 공용 ══════════
   이 화면 하나가 가이드 3개를 전부 담당합니다.
   새 가이드를 추가하고 싶으면? data.js 의 GUIDES 에 넣기만 하면 끝!
   ============================================================ */

let guideKey = null;
let guideIdx = 0;
/* 문제를 맞힌 카드들을 기억해요. ('f01:0' 같은 형태)
   문제 카드는 정답을 맞혀야 '다음'으로 넘어갈 수 있습니다. */
const guideSolved = new Set();

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

  const alreadySolved = guideSolved.has(`${guideKey}:${guideIdx}`);

  $('#guide-body').innerHTML = `
    <article class="card step-card">
      <div class="step-icon">${step.icon}</div>
      <h2 class="step-heading">${esc(step.heading)}</h2>
      <p class="step-body">${esc(step.body)}</p>
      ${step.custom ? renderCustom(step.custom) : ''}
      ${step.quiz ? renderStepQuiz(step.quiz, alreadySolved) : ''}
    </article>
    <div id="step-feedback"></div>`;

  $('#guide-prev').disabled = guideIdx === 0;
  $('#guide-next').textContent = last ? '다 배웠어요! ✓' : '다음';
  $('#guide-next').classList.toggle('btn-done', last);

  // 문제 카드는 정답을 맞혀야 '다음'이 눌립니다
  $('#guide-next').disabled = step.quiz && !guideSolved.has(`${guideKey}:${guideIdx}`);
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
  let text = step.heading + '. ' + step.body;
  // 문제 카드면 보기도 읽어줘요 (글을 읽기 힘든 저학년 배려)
  if (step.quiz) {
    text += ' ' + step.quiz.choices.map((c, i) => `${i + 1}번, ${c}.`).join(' ');
  }
  speak(text);
});

/* ---------- 가이드 안의 문제 카드 ---------- */
/* data.js 의 step 에 quiz 를 넣으면 어느 가이드에서든 문제를 낼 수 있어요. */
function renderStepQuiz(q, solved) {
  return `<div class="mc step-quiz">
    ${q.choices.map((c, i) => `
      <button class="mc-btn ${solved && i === q.answer ? 'is-correct' : ''}"
              data-gpick="${i}" ${solved ? 'disabled' : ''}>
        <span class="mc-num">${i + 1}</span>${esc(c)}
      </button>`).join('')}
  </div>
  ${solved ? '' : '<p class="quiz-lock" id="quiz-lock">정답을 맞혀야 다음으로 넘어갈 수 있어요 🔒</p>'}`;
}

$('#guide-body').addEventListener('click', e => {
  const btn = e.target.closest('[data-gpick]');
  if (!btn) return;

  const step = GUIDES[guideKey].steps[guideIdx];
  if (!step.quiz) return;

  const picked = Number(btn.dataset.gpick);
  const correct = picked === step.quiz.answer;

  if (!correct) {
    // ⚠️ 오답이라고 보기를 잠그면 안 돼요.
    //    정답을 맞혀야 넘어갈 수 있으니, 잠그면 영영 못 나갑니다.
    // ⚠️ 정답도 알려주지 않아요. 알려주면 그냥 눌러버려서 생각할 기회가 없어져요.
    //    대신 힌트를 줍니다. (data.js 의 quiz.hint)
    btn.classList.add('is-wrong');
    $('#step-feedback').innerHTML = `
      <div class="feedback bad">
        <strong>🤔 다시 생각해볼까요?</strong>
        <p>${esc(step.quiz.hint || '위 설명을 한 번 더 읽어보면 힌트가 숨어 있어요!')}</p>
      </div>`;
    return;
  }

  // 정답 — 이제 보기를 잠그고 '다음'을 열어줍니다
  guideSolved.add(`${guideKey}:${guideIdx}`);
  document.querySelectorAll('[data-gpick]').forEach(b => {
    b.disabled = true;
    if (Number(b.dataset.gpick) === step.quiz.answer) b.classList.add('is-correct');
  });
  $('#guide-next').disabled = false;
  $('#quiz-lock')?.remove();     // '맞혀야 넘어갈 수 있어요' 안내는 이제 필요 없어요

  $('#step-feedback').innerHTML = `
    <div class="feedback good">
      <strong>⭕ 정답!</strong>
      <p>${esc(step.quiz.explain)}</p>
      ${step.quiz.showAfter ? renderCustom(step.quiz.showAfter) : ''}
    </div>`;
  $('#step-feedback').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
});

/* ---------- 가이드 안에 들어가는 특별한 그림들 ---------- */
function renderCustom(type) {
  // 대출·반납 순서 (data.js 의 FLOWS)
  if (FLOWS[type]) {
    return `<ol class="flow">
      ${FLOWS[type].map(s => `<li>${esc(s)}</li>`).join('')}
    </ol>`;
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

/* ══════════ 5) 도서관 용어 (F-02) ══════════ */

/* 짝 맞추기 게임 — 설명을 보여주고 알맞은 낱말을 찾게 합니다.
     matchQueue : 아직 못 맞춘 설명들 (섞은 순서)
     matchPool  : 아래에 보기로 깔리는 낱말들 (맞히면 하나씩 사라짐)      */
let matchQueue = [];
let matchPool = [];
let matchLocked = false;   // 정답을 맞힌 뒤 또 누르는 것 방지

function renderDict() {
  showScreen('screen-dict');
  $('#dict-title').textContent = DICT_PAGE.short;
  startMatch();
}

function startMatch() {
  matchQueue = shuffle(DICTIONARY);
  matchPool = shuffle(DICTIONARY);
  matchLocked = false;
  paintMatch();
}

function paintMatch() {
  if (matchQueue.length === 0) { finishMatch(); return; }

  const cur = matchQueue[0];
  const done = DICTIONARY.length - matchQueue.length;

  $('#dict-body').innerHTML = `
    <div class="card match-card">
      <p class="match-progress">
        <span>맞힌 낱말</span>
        <b>${done} / ${DICTIONARY.length}</b>
      </p>
      <div class="bar"><div class="bar-fill" style="width:${done / DICTIONARY.length * 100}%"></div></div>
      <p class="match-meaning">${cur.meaning}</p>
    </div>
    <p class="match-ask">👇 이건 무슨 낱말일까요?</p>
    <div class="chips">
      ${matchPool.map(d => `
        <button class="chip" data-word="${esc(d.word)}">
          <span class="chip-emoji">${d.emoji}</span>${esc(d.word)}
        </button>`).join('')}
    </div>
    <div id="dict-feedback"></div>`;
}

$('#dict-body').addEventListener('click', e => {
  const btn = e.target.closest('[data-word]');
  if (!btn || matchLocked) return;

  const cur = matchQueue[0];
  if (btn.dataset.word !== cur.word) {
    // 틀렸으면 잠깐 흔들고 다시 고르게 해요 (못 고르게 막지 않아요)
    btn.classList.add('chip-wrong');
    setTimeout(() => btn.classList.remove('chip-wrong'), 600);
    toast('아니에요. 설명을 한 번 더 읽어볼까요? 🤔');
    return;
  }

  matchLocked = true;
  btn.classList.add('chip-right');

  $('#dict-feedback').innerHTML = `
    <div class="feedback good">
      <strong>⭕ 정답! ${cur.emoji} ${esc(cur.word)}</strong>
      ${cur.img ? `<img class="word-pic" src="${esc(cur.img)}" alt=""
                     onerror="this.remove()">` : ''}
      <p>${cur.meaning}</p>
      ${cur.tip ? `<p class="match-tip">💡 ${esc(cur.tip)}</p>` : ''}
      <button class="btn btn-primary btn-lg" id="match-next">
        ${matchQueue.length === 1 ? '다 맞혔어요! ✓' : '다음 낱말 →'}
      </button>
    </div>`;
  $('#dict-feedback').scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  $('#match-next').addEventListener('click', () => {
    // 맞힌 낱말은 문제와 보기 양쪽에서 빼요
    matchQueue.shift();
    matchPool = matchPool.filter(d => d.word !== cur.word);
    matchLocked = false;
    paintMatch();
  });
});

function finishMatch() {
  const wasNew = markDone('f02');
  $('#dict-body').innerHTML = `
    <div class="verdict good">
      <span class="verdict-emoji">🏆</span>
      <h2>${esc(DICT_PAGE.short)} 끝!</h2>
      <p class="verdict-answer">${DICTIONARY.length}개 낱말을 모두 찾았어요.</p>
      <p class="verdict-explain">이제 도서관에서 이 말들이 나와도 무슨 뜻인지 알 수 있어요!</p>
      <button class="btn btn-primary btn-lg" id="match-home">홈으로</button>
      <button class="btn" id="match-again">한 번 더 하기</button>
    </div>`;
  $('#match-home').addEventListener('click', () => {
    go('#/home');
    toast(wasNew ? `${DICT_PAGE.short} 완료! 진행률 ${progressPct()}% 🎉` : '다시 복습했어요! 👍');
  });
  $('#match-again').addEventListener('click', startMatch);
}

$('#dict-tts').addEventListener('click', () => {
  const cur = matchQueue[0];
  if (cur) speak(cur.meaning.replace(/<[^>]+>/g, ''));
});

/* ══════════ 6) YES / NO 게임 (F-04) ══════════
   YES · NO 버튼으로만 고릅니다. (드래그는 저학년에게 어려워서 뺐어요)
   정답을 맞혀야 다음 카드로 넘어갈 수 있습니다.
   ============================================================ */

let deck = [];
let swipeIdx = 0;
let swipeRight = 0;        // 한 번에 맞힌 개수
let swipeSolved = false;   // 지금 카드를 맞혔는지
let swipeFirstTry = true;  // 아직 안 틀렸는지

function startSwipe() {
  showScreen('screen-swipe');
  $('#swipe-title').textContent = SWIPE_PAGE.short;
  deck = shuffle(SWIPE_CARDS);
  swipeIdx = 0;
  swipeRight = 0;
  paintSwipe();
}

function paintSwipe() {
  if (swipeIdx >= deck.length) { finishSwipe(); return; }

  swipeSolved = false;
  swipeFirstTry = true;

  const c = deck[swipeIdx];
  $('#swipe-count').textContent = `${swipeIdx + 1} / ${deck.length}`;
  // swipe-wrap 의 margin:auto 가 카드를 화면 가운데로 올려요.
  // (내용이 길어지면 auto 여백이 0이 되어 자연스럽게 스크롤됩니다)
  $('#swipe-body').innerHTML = `
    <div class="swipe-wrap">
      <div class="swipe-card">
        ${bigPic(c)}
        <p class="swipe-text">${esc(c.situation)}</p>
      </div>
      <div id="swipe-feedback"></div>
    </div>`;

  // YES/NO 를 다시 켜고, '다음 카드' 는 숨겨요
  $('#btn-yes').hidden = false;
  $('#btn-no').hidden = false;
  $('#btn-yes').disabled = false;
  $('#btn-no').disabled = false;
  $('#btn-swipe-next').hidden = true;
}

function answerSwipe(choice) {
  if (swipeSolved) return;

  const c = deck[swipeIdx];
  const correct = c.answer === choice;

  if (!correct) {
    // ⚠️ 틀려도 버튼을 잠그면 안 돼요. 맞혀야 넘어갈 수 있으니 잠그면 못 나갑니다.
    swipeFirstTry = false;
    $('#swipe-feedback').innerHTML = `
      <div class="feedback bad">
        <strong>🤔 다시 생각해볼까요?</strong>
        <p>도서관에서 이렇게 하면 어떨지 그림을 한 번 더 보고 골라보세요!</p>
      </div>`;
    return;
  }

  swipeSolved = true;
  if (swipeFirstTry) swipeRight++;

  $('#btn-yes').disabled = true;
  $('#btn-no').disabled = true;

  const last = swipeIdx === deck.length - 1;
  $('#swipe-feedback').innerHTML = `
    <div class="feedback good">
      <strong>⭕ 정답! 이 행동은 ${c.answer} 예요</strong>
      <p>${esc(c.explain)}</p>
    </div>`;
  $('#swipe-feedback').scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  // 아래 버튼을 '다음 카드' 로 바꿔줘요
  $('#btn-yes').hidden = true;
  $('#btn-no').hidden = true;
  $('#btn-swipe-next').hidden = false;
  $('#btn-swipe-next').textContent = last ? '다 했어요! ✓' : '다음 카드 →';
  $('#btn-swipe-next').classList.toggle('btn-done', last);
}

$('#btn-yes').addEventListener('click', () => answerSwipe('YES'));
$('#btn-no').addEventListener('click', () => answerSwipe('NO'));
$('#btn-swipe-next').addEventListener('click', () => {
  swipeIdx++;
  paintSwipe();
});

function finishSwipe() {
  const wasNew = markDone('f04');
  $('#swipe-count').textContent = '';
  $('#btn-yes').hidden = true;
  $('#btn-no').hidden = true;
  $('#btn-swipe-next').hidden = true;
  $('#swipe-body').innerHTML = `
    <div class="swipe-wrap">
    <div class="verdict good">
      <span class="verdict-emoji">🏆</span>
      <h2>${esc(SWIPE_PAGE.short)} 끝!</h2>
      <p class="verdict-answer">${deck.length}개 중 <b>${swipeRight}개</b>를 한 번에 맞혔어요.</p>
      <p class="verdict-explain">${
        swipeRight === deck.length ? '완벽해요! 약속을 아주 잘 알고 있네요 👏'
                                   : '다시 골라서 맞힌 것도 괜찮아요. 이제 알았으니까요!'}</p>
      <button class="btn btn-primary btn-lg" id="swipe-home">홈으로</button>
      <button class="btn" id="swipe-again">한 번 더 하기</button>
    </div>
    </div>`;
  $('#swipe-home').addEventListener('click', () => {
    go('#/home');
    toast(wasNew ? `${SWIPE_PAGE.short} 완료! 진행률 ${progressPct()}% 🎉` : '다시 복습했어요! 👍');
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

  // 틀렸을 때 정답이 무엇인지 글로도 알려줘요.
  // (색깔 표시만으로는 저학년이 못 알아볼 수 있어요)
  const answerLabel = q.type === 'OX'
    ? (q.answer ? '⭕ 맞아요' : '❌ 아니에요')
    : `${q.answer + 1}번 · ${esc(q.choices[q.answer])}`;

  const last = qIdx === qList.length - 1;
  $('#quiz-feedback').innerHTML = `
    <div class="feedback ${correct ? 'good' : 'bad'}">
      <strong>${correct ? '⭕ 정답!' : '❌ 아쉬워요'}</strong>
      ${correct ? '' : `<p class="answer-line">정답은 <b>${answerLabel}</b></p>`}
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
