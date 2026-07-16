/* ============================================================
   barcode.js — 바코드 그리기 (CODE 39 방식)
   ------------------------------------------------------------
   원래 계획은 JsBarcode 라이브러리를 받아 쓰는 것이었지만,
   직접 만들면 40줄이면 되고 외부 파일이 없어져서
   오프라인에서 더 확실하게 동작합니다.

   CODE 39 는 마트 바코드보다 단순한 방식이에요.
   글자 하나 = 막대 5개 + 틈 4개 = 총 9칸.
   그중 3칸만 "굵게(w)" 그리면 됩니다. 나머지 6칸은 "가늘게(n)".
   ============================================================ */

/* 글자별 굵기 설계도. n=narrow(가늘게), w=wide(굵게)
   순서: 막대,틈,막대,틈,막대,틈,막대,틈,막대 (홀수번째가 막대) */
const CODE39_TABLE = {
  '0': 'nnnwwnwnn', '1': 'wnnwnnnnw', '2': 'nnwwnnnnw', '3': 'wnwwnnnnn',
  '4': 'nnnwwnnnw', '5': 'wnnwwnnnn', '6': 'nnwwwnnnn', '7': 'nnnwnnwnw',
  '8': 'wnnwnnwnn', '9': 'nnwwnnwnn',
  'A': 'wnnnnwnnw', 'B': 'nnwnnwnnw', 'C': 'wnwnnwnnn', 'D': 'nnnnwwnnw',
  'E': 'wnnnwwnnn', 'F': 'nnwnwwnnn', 'G': 'nnnnnwwnw', 'H': 'wnnnnwwnn',
  'I': 'nnwnnwwnn', 'J': 'nnnnwwwnn', 'K': 'wnnnnnnww', 'L': 'nnwnnnnww',
  'M': 'wnwnnnnwn', 'N': 'nnnnwnnww', 'O': 'wnnnwnnwn', 'P': 'nnwnwnnwn',
  'Q': 'nnnnnnwww', 'R': 'wnnnnnwwn', 'S': 'nnwnnnwwn', 'T': 'nnnnwnwwn',
  'U': 'wwnnnnnnw', 'V': 'nwwnnnnnw', 'W': 'wwwnnnnnn', 'X': 'nwnnwnnnw',
  'Y': 'wwnnwnnnn', 'Z': 'nwwnwnnnn',
  '-': 'nwnnnnwnw', '.': 'wwnnnnwnn', ' ': 'nwwnnnwnn',
  '*': 'nwnnwnwnn'   // 시작/끝 표시. 바코드 앞뒤에 꼭 붙여야 해요.
};

const WIDE_RATIO = 2.5;   // 굵은 칸이 가는 칸의 몇 배인지

/**
 * 캔버스에 바코드를 그립니다.
 * @param {HTMLCanvasElement} canvas  그릴 캔버스
 * @param {string} text  바코드로 만들 글자 (숫자/영대문자/-/./공백만 가능)
 * @param {number} height  바코드 높이 (기본 70px)
 */
function drawBarcode(canvas, text, height = 70) {
  const clean = String(text).toUpperCase()
    .split('')
    .filter(ch => CODE39_TABLE[ch] && ch !== '*')   // 못 그리는 글자는 버림
    .join('');

  const data = '*' + clean + '*';

  // 전체가 "가는 칸" 몇 개 분량인지 미리 계산
  // 글자 1개 = 가는 칸 6개 + 굵은 칸 3개, 글자 사이 틈 = 가는 칸 1개
  const unitsPerChar = 6 + 3 * WIDE_RATIO;
  const totalUnits = data.length * unitsPerChar + (data.length - 1);

  // 화면 크기와 실제 그리는 크기 (레티나 화면에서도 선명하게)
  const cssWidth = canvas.clientWidth || 260;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.floor(cssWidth * dpr);
  canvas.height = Math.floor(height * dpr);
  canvas.style.height = height + 'px';

  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, cssWidth, height);
  ctx.fillStyle = '#000';

  const unit = cssWidth / totalUnits;   // 가는 칸 하나의 실제 픽셀 너비
  let x = 0;

  for (let i = 0; i < data.length; i++) {
    const pattern = CODE39_TABLE[data[i]];
    for (let j = 0; j < 9; j++) {
      const w = (pattern[j] === 'w' ? WIDE_RATIO : 1) * unit;
      if (j % 2 === 0) ctx.fillRect(x, 0, w, height);   // 짝수번째 = 검은 막대
      x += w;                                            // 홀수번째 = 흰 틈
    }
    x += unit;   // 글자 사이 틈
  }
}
