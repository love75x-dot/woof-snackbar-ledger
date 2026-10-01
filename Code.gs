/**
 * 식대 장부 - Google Apps Script 백엔드
 *
 * 설치 방법
 * 1) 새 구글 시트를 만들고 [확장 프로그램 > Apps Script]에 이 코드를 붙여넣기
 * 2) 시트에 '부서마스터' 탭을 만들고 부서마스터.csv 내용을 붙여넣기 (첫 행은 헤더)
 * 2-1) 시트를 새로고침 → [장부 관리 > 설정 탭 만들기] 실행 후 '설정' 탭에 장부 이름·매장 정보를 입력
 *      (장부 이름, 매장명, 사업자번호, 대표자, 연락처, 주소, 1끼 한도를 사장님이 직접 수정)
 * 2-2) [장부 관리 > 메뉴판 탭 만들기] 실행 → 메뉴/가격은 '메뉴판' 탭에서 직접 수정
 *      (분류 순서대로 화면 탭이 만들어지고, 사용 칸을 N으로 바꾸면 화면에서 숨겨져요)
 * 2-3) '설정' 탭의 '사장님 PIN'에 숫자 4자리를 입력 → 주소?mode=kitchen 으로 접속하는 사장님 전용 주문 확인 화면용
 * 2-4) '설정' 탭에 영업시간·공지사항·개인정보 보관기간(예: 5년)도 입력하면 화면에 표시돼요
 * 2-5) 정산서 조회용 4자리 PIN: '설정' 탭 '정산서 PIN (공통)'에 한 번 적거나(예: 2609), 부서마스터 G열(정산서PIN)에 부서별로 적기
 *      (부서별 값이 있으면 그것이 우선. 년월 패턴 YYMM 등 원하는 방식으로 사장님이 직접 정해요)
 * 3) 시트를 새로고침하면 상단에 [장부 관리] 메뉴가 생겨요 → 'PIN 자동 생성' 실행
 * 4) [배포 > 새 배포 > 웹 앱] 실행 계정: 나, 액세스 권한: 모든 사용자 → URL 복사
 * 5) index.html 안의 CONFIG.SCRIPT_URL 에 그 URL을 붙여넣기
 */

const DEFAULT_LIMIT = 9000;
const SHEET_MASTER = '부서마스터';
const SHEET_LOG = '거래내역';
const SHEET_SETTINGS = '설정';
const SHEET_MENU = '메뉴판';
const SHEET_SETTLE = '정산현황';
const SHEET_PREPAID = '선결제';
const MAX_FAILS = 5;          // PIN 연속 실패 허용 횟수
const LOCK_SECONDS = 600;     // 초과 시 10분 잠금

function onOpen() {
  SpreadsheetApp.getUi().createMenu('장부 관리')
    .addItem('PIN 자동 생성 (빈 칸만, 3자리)', 'generatePins')
    .addItem('오늘의 번호 확인', 'showDailyNumber')
    .addItem('메뉴 통계 갱신 (지난주·지난달)', 'refreshStats')
    .addItem('매월 1일 자동 정산 켜기', 'setupMonthlyTrigger')
    .addItem('개인정보 파기 (이름 삭제)', 'purgeOldNames')
    .addSeparator()
    .addItem('선결제 충전 등록', 'chargePrepaid_')
    .addItem('부서별 선결제 잔액 확인', 'checkPrepaidBalances_')
    .addItem('부서 서류 이메일 권한 확인', 'authorizeDepartmentMail_')
    .addSeparator()
    .addItem('실수 방지 설정 켜기 (경고+자동 백업)', 'setupSafety')
    .addItem('지금 바로 백업 1번 실행', 'backupNow')
    .addItem('백업 목록 열기', 'openBackupFolder')
    .addItem('설정 탭 만들기', 'setupSettings')
    .addItem('메뉴판 탭 만들기', 'setupMenu')
    .addItem('거래내역 탭 헤더 만들기', 'setupLog')
    .addItem('정산현황 만들기/갱신', 'refreshSettlement')
    .addToUi();
}

function authorizeDepartmentMail_() {
  const remaining = MailApp.getRemainingDailyQuota();
  SpreadsheetApp.getUi().alert('부서 서류 이메일 발송 권한이 준비됐어요. 오늘 남은 수신자 발송 가능 수: ' + remaining);
}

// 거래내역 열 순서 (입력일시가 맨 오른쪽)
// A기관 B부서 C날짜 D메뉴 E금액(청구) F이름 G인원 H한도초과 I현장결제액 J기관코드 K부서코드 L날짜확인 M포장완료 N입력일시
const TZ = 'Asia/Seoul';
const LOG_COLS = 17;  // 15번째 '구분', 16번째 '결제방식', 17번째 '선결제 사용액'

function setupLog() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_LOG) || ss.insertSheet(SHEET_LOG);
  if (sh.getLastRow() === 0) {
    sh.appendRow(['기관', '부서', '날짜', '메뉴', '금액(청구)', '이름', '인원', '한도초과', '현장결제액', '기관코드', '부서코드', '날짜확인', '포장완료', '입력일시', '구분', '결제방식', '선결제 사용액']);
    sh.getRange('C:C').setNumberFormat('@');
    sh.getRange('N:N').setNumberFormat('yyyy-mm-dd hh:mm');
    sh.getRange('O:O').setNumberFormat('@');
    sh.getRange('P:P').setNumberFormat('@');
    sh.setFrozenRows(1);
    // 장부 날짜와 입력일이 다른 행은 붉게 표시 (날짜확인 칸에 내용이 있으면)
    const rule = SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied('=$L2<>""').setBackground('#FCE4E0').setRanges([sh.getRange('A2:N')]).build();
    sh.setConditionalFormatRules([rule]);
  }
  if (String(sh.getRange(1, 17).getValue()).trim() !== '선결제 사용액') {
    sh.getRange(1, 17).setValue('선결제 사용액');
  }
  sh.getRange(1, 9).setValue('현장결제액');
  sh.getRange('Q:Q').setNumberFormat('#,##0');
}

// 장부 날짜와 실제 입력일 비교 → 어제/그제 날짜로 적은 경우 표시
function dateFlag_(dateStr) {
  const today = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
  const ms = s => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
  const diff = Math.round((ms(today) - ms(dateStr)) / 86400000);
  if (diff === 0) return '';
  if (diff < 0) return '⚠ 미래 날짜 (' + (-diff) + '일 뒤)';
  return '⚠ ' + diff + '일 전 날짜';
}

// ---------- 설정 (장부 이름, 매장 정보, 한도) ----------
const SETTING_KEYS = [['장부 이름', '우프스낵바 식대 장부'], ['매장명', '우프스낵바'], ['사업자번호', ''], ['대표자', ''],
                      ['연락처', ''], ['주소', ''], ['계좌번호(은행)', ''], ['1끼 한도', DEFAULT_LIMIT], ['사장님 PIN', ''],
                      ['영업시간', '월~토 11:00~20:30 (브레이크타임 15:30~17:00, 라스트오더 20:00)\n일 11:00~15:00 (라스트오더 14:30)'],
                      ['공지사항', ''], ['개인정보 보관기간', ''], ['정산서 PIN (공통)', ''],
                      ['강조색(버튼, #RRGGBB)', ''], ['글자색(매장정보, #RRGGBB)', '']];

function setupSettings() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(SHEET_SETTINGS) || ss.insertSheet(SHEET_SETTINGS);
  if (sh.getLastRow() === 0) {
    sh.appendRow(['항목', '값 (여기를 수정하세요)']);
    sh.setFrozenRows(1);
    sh.setColumnWidth(1, 120); sh.setColumnWidth(2, 320);
  }
  // 없는 항목만 추가 (이미 쓰던 설정 탭도 안전하게 업데이트)
  const have = sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues().map(r => String(r[0]).trim()) : [];
  SETTING_KEYS.forEach(k => {
    if (have.indexOf(k[0]) >= 0) return;
    const row = sh.getLastRow() + 1;
    sh.getRange(row, 1, 1, 2).setNumberFormat('@').setValues([[k[0], String(k[1])]]);
  });
}

// 사장님 주문 확인 화면용 PIN (설정 탭 '사장님 PIN', 숫자 4자리). 화면으로는 절대 내려보내지 않아요.
function getOwnerPin_() {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_SETTINGS);
  if (!sh || sh.getLastRow() < 2) return '';
  const rows = sh.getRange(2, 1, sh.getLastRow() - 1, 2).getValues();
  for (const r of rows) if (String(r[0]).trim() === '사장님 PIN') return String(r[1]).trim();
  return '';
}

function checkOwner_(pin) {
  const own = getOwnerPin_();
  if (!own) return { ok: false, message: '설정 탭에 사장님 PIN(숫자 4자리)을 먼저 입력해 주세요.' };
  const cache = CacheService.getScriptCache();
  const key = 'fail:owner';
  const fails = Number(cache.get(key) || 0);
  if (fails >= MAX_FAILS) return { ok: false, message: 'PIN을 여러 번 틀려 잠시 잠겼어요. 10분 뒤 다시 시도해 주세요.' };
  if (String(pin) !== own) {
    cache.put(key, String(fails + 1), LOCK_SECONDS);
    return { ok: false, message: 'PIN이 맞지 않아요.' };
  }
  cache.remove(key);
  return { ok: true };
}

// 오늘 입력된 주문 (입력일시 기준 - 장부 날짜를 어제로 적어도 지금 들어온 주문은 보여야 하니까요)
// 지정한 날짜(장부 날짜 기준)의 매출: 청구금액 합계, 건수, 현장결제(초과) 합계, 메뉴별 판매 수량·금액
// 지정한 날짜(장부 날짜 기준)의 매출: 청구금액 합계, 건수, 현장결제(초과) 합계, 건별 내역(기관·부서·이름·금액)
function salesForDate_(dateStr) {
  const log = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_LOG);
  const inputDate = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
  if (!log || log.getLastRow() < 2) return { count: 0, total: 0, over: 0, prepaid: 0, gross: 0, rows: [], inputDate: inputDate,
    enteredToday: { count: 0, total: 0, over: 0, prepaid: 0, gross: 0, rows: [] } };
  let count = 0, total = 0, over = 0, prepaid = 0, gross = 0;
  let enteredTodayCount = 0, enteredTodayTotal = 0, enteredTodayOver = 0, enteredTodayPrepaid = 0, enteredTodayGross = 0;
  const rows = [], enteredTodayRows = [];
  log.getRange(2, 1, log.getLastRow() - 1, LOG_COLS).getValues().forEach(r => {
    const date = r[2] instanceof Date ? Utilities.formatDate(r[2], TZ, 'yyyy-MM-dd') : String(r[2]);
    const paymentMethod = String(r[15] || '');
    const ts = r[13];
    const enteredDate = ts instanceof Date ? Utilities.formatDate(ts, TZ, 'yyyy-MM-dd') : '';
    const amount = Number(r[4]) || 0, extra = Number(r[8]) || 0;
    const prepaidAmount = Number(r[16]) || (paymentMethod === '선결제차감' ? amount : 0);
    const billableAmount = paymentMethod.indexOf('선결제') === 0 ? 0 : amount;
    const saleAmount = billableAmount + extra + prepaidAmount;
    const item = {
      time: ts instanceof Date ? Utilities.formatDate(ts, TZ, 'HH:mm') : '',
      enteredDate: enteredDate,
      date: date,
      org: String(r[0]), dept: String(r[1]), names: String(r[5]), people: Number(r[6]) || 1,
      amount: billableAmount, over: extra, prepaid: prepaidAmount, gross: saleAmount
    };
    if (enteredDate === inputDate) {
      enteredTodayCount++; enteredTodayTotal += billableAmount; enteredTodayOver += extra;
      enteredTodayPrepaid += prepaidAmount; enteredTodayGross += saleAmount;
      enteredTodayRows.push(item);
    }
    if (date !== dateStr) return;
    count++; total += billableAmount; over += extra; prepaid += prepaidAmount; gross += saleAmount;
    rows.push(item);
  });
  rows.sort((a, b) => a.time < b.time ? -1 : a.time > b.time ? 1 : 0);
  enteredTodayRows.sort((a, b) => a.time < b.time ? -1 : a.time > b.time ? 1 : 0);
  return { count: count, total: total, over: over, prepaid: prepaid, gross: gross, rows: rows, inputDate: inputDate,
    enteredToday: { count: enteredTodayCount, total: enteredTodayTotal, over: enteredTodayOver,
      prepaid: enteredTodayPrepaid, gross: enteredTodayGross, rows: enteredTodayRows } };
}

function ordersToday_() {
  const log = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_LOG);
  if (!log || log.getLastRow() < 2) return [];
  const today = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
  const out = [];
  log.getRange(2, 1, log.getLastRow() - 1, LOG_COLS).getValues().forEach((r, i) => {
    const ts = r[13];
    if (!(ts instanceof Date) || Utilities.formatDate(ts, TZ, 'yyyy-MM-dd') !== today) return;
    const sec = Math.floor(ts.getTime() / 1000);
    const date = r[2] instanceof Date ? Utilities.formatDate(r[2], TZ, 'yyyy-MM-dd') : String(r[2]);
    out.push({ id: (i + 2) + ':' + sec, row: i + 2, key: sec, time: Utilities.formatDate(ts, TZ, 'HH:mm'),
      org: String(r[0]), dept: String(r[1]), date: date, menu: String(r[3]), names: String(r[5]),
      people: Number(r[6]) || 1, over: Number(r[8]) || 0, flag: String(r[11]), packed: String(r[12]).trim() !== '' });
  });
  return out;
}

function packOrder_(b) {
  const chk = checkOwner_(b.pin);
  if (!chk.ok) return json_(chk);
  const log = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_LOG);
  const row = Number(b.row);
  if (!log || !(row >= 2 && row <= log.getLastRow())) return json_({ ok: false, message: '해당 행을 찾을 수 없어요.' });
  const ts = log.getRange(row, 14).getValue();
  if (!(ts instanceof Date) || String(Math.floor(ts.getTime() / 1000)) !== String(b.key)) {
    return json_({ ok: false, message: '시트가 바뀌었어요. 화면을 새로고침해 주세요.' });
  }
  const cell = log.getRange(row, 13);
  if (b.undo) cell.clearContent();
  else cell.setNumberFormat('@').setValue('✔ ' + Utilities.formatDate(new Date(), TZ, 'HH:mm'));
  return json_({ ok: true });
}

function getSettings_() {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_SETTINGS);
  const m = {};
  if (sh && sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, 2).getValues().forEach(r => { m[String(r[0]).trim()] = String(r[1]).trim(); });
  return {
    appName: m['장부 이름'] || '식대 장부', storeName: m['매장명'] || '', bizNo: m['사업자번호'] || '',
    owner: m['대표자'] || '', phone: m['연락처'] || '', address: m['주소'] || '',
    limit: Number(String(m['1끼 한도'] || '').replace(/[^0-9]/g, '')) || DEFAULT_LIMIT,
    hours: m['영업시간'] || '', notice: m['공지사항'] || '', retention: m['개인정보 보관기간'] || '',
    account: m['계좌번호(은행)'] || '',
    accent: m['강조색(버튼, #RRGGBB)'] || '', textColor: m['글자색(매장정보, #RRGGBB)'] || ''
  };
}

// ---------- 메뉴판 ----------
// 열: A분류 B메뉴명 C가격 D설명 E사용(Y/N). 분류가 화면 탭 이름이 되고, 처음 나온 순서대로 배치돼요.
function setupMenu() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(SHEET_MENU) || ss.insertSheet(SHEET_MENU);
  if (sh.getLastRow() > 0) return;
  const burgers = ['치즈버거', '불고기버거', '스낵버거', '머쉬룸버거', '쉬림프버거', 'PBJ버거', '텐더버거'];
  const rows = [['분류', '메뉴명', '가격', '설명', '사용']];
  burgers.forEach(b => rows.push(['세트', b + ' 세트', 9000, '버거+음료', 'Y']));
  burgers.forEach(b => rows.push(['버거 단품', b + ' 단품', 8400, '', 'Y']));
  rows.push(['사이드 세트', '버팔로윙(7개) 세트', 9000, '사이드+음료', 'Y']);
  rows.push(['사이드 세트', '텐더치킨(8조각) 세트', 9000, '사이드+음료', 'Y']);
  rows.push(['사이드', '버팔로윙(7개)', 8000, '', 'Y']);
  rows.push(['사이드', '어니언링(10개)', 7000, '', 'Y']);
  rows.push(['사이드', '텐더치킨(5조각)', 6000, '', 'Y']);
  rows.push(['사이드', '감자튀김', 5000, '', 'Y']);
  rows.push(['사이드', '콘샐러드', 2500, '', 'Y']);
  rows.push(['사이드', '음료 추가', 1000, '사이드에 음료를 붙일 때', 'Y']);
  sh.getRange(1, 1, rows.length, 5).setValues(rows);
  sh.getRange('C:C').setNumberFormat('#,##0');
  sh.setFrozenRows(1);
  sh.setColumnWidth(2, 200); sh.setColumnWidth(4, 220);
}

function getMenu_() {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_MENU);
  if (!sh || sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, 5).getValues()
    .filter(r => String(r[1]).trim() && String(r[4]).trim().toUpperCase() !== 'N' && Number(r[2]) > 0)
    .map(r => ({ category: String(r[0]).trim(), name: String(r[1]).trim(), price: Number(r[2]), desc: String(r[3]).trim() }));
}

// ---------- 정산현황 (정산완료 / 영수증 발행일 / 입금일) ----------
// 열: A정산월 B기관 C부서 D부서코드 E건수 F청구합계 G정산완료(체크) H영수증발행일 I입금일 J메모
function refreshSettlement() {
  const ui = SpreadsheetApp.getUi();
  const def = prevMonth_();
  const res = ui.prompt('정산현황 갱신', '정산할 월을 입력하세요 (예: ' + def + ')', ui.ButtonSet.OK_CANCEL);
  if (res.getSelectedButton() !== ui.Button.OK) return;
  const month = res.getResponseText().trim() || def;
  ui.alert(month + ' 정산현황을 갱신했어요. (' + refreshSettlementFor_(month) + '개 부서)');
}

function prevMonth_() {
  const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1);
  return Utilities.formatDate(d, TZ, 'yyyy-MM');
}

// 매월 1일 아침 자동 실행용 (사람이 누를 필요 없음)
function monthlyAuto() {
  refreshSettlementFor_(prevMonth_());
  refreshStats();
}

function setupMonthlyTrigger() {
  ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'monthlyAuto').forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('monthlyAuto').timeBased().onMonthDay(1).atHour(6).create();
  SpreadsheetApp.getUi().alert('매월 1일 오전 6시에 지난달 정산현황과 통계가 자동으로 만들어져요.');
}

function refreshSettlementFor_(month) {
  const tz = Session.getScriptTimeZone();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_SETTLE) || ss.insertSheet(SHEET_SETTLE);
  if (sh.getLastRow() === 0) {
    sh.appendRow(['정산월', '기관', '부서', '부서코드', '건수', '청구합계', '정산완료', '영수증 발행일', '입금일', '메모']);
    sh.setFrozenRows(1);
    sh.getRange('A:A').setNumberFormat('@'); sh.getRange('D:D').setNumberFormat('@');
    sh.getRange('F:F').setNumberFormat('#,##0'); sh.getRange('H:I').setNumberFormat('yyyy-mm-dd');
  }
  // 거래내역에서 부서별 집계
  const agg = {};
  const log = ss.getSheetByName(SHEET_LOG);
  if (log && log.getLastRow() > 1) {
    log.getRange(2, 1, log.getLastRow() - 1, LOG_COLS).getValues().forEach(r => {
      const date = r[2] instanceof Date ? Utilities.formatDate(r[2], tz, 'yyyy-MM-dd') : String(r[2]);
      if (date.indexOf(month) !== 0) return;
      if (String(r[15] || '').indexOf('선결제') === 0) return; // 선결제 처리된 건은 청구합계에서 제외
      const code = String(r[10]);
      if (!agg[code]) agg[code] = { org: r[0], dept: r[1], n: 0, sum: 0 };
      agg[code].n++; agg[code].sum += Number(r[4]) || 0;
    });
  }
  // 이미 있는 행은 건수·합계만 갱신(체크/날짜는 유지), 없는 부서는 새로 추가
  const last = sh.getLastRow();
  const existing = last > 1 ? sh.getRange(2, 1, last - 1, 4).getValues() : [];
  Object.keys(agg).forEach(code => {
    const a = agg[code];
    const idx = existing.findIndex(r => String(r[0]) === month && String(r[3]) === code);
    if (idx >= 0) {
      sh.getRange(idx + 2, 5, 1, 2).setValues([[a.n, a.sum]]);
    } else {
      const row = sh.getLastRow() + 1;
      sh.getRange(row, 1, 1, 10).setValues([[month, a.org, a.dept, code, a.n, a.sum, false, '', '', '']]);
      sh.getRange(row, 7).insertCheckboxes();
      sh.getRange(row, 1).setNumberFormat('@').setValue(month);
      sh.getRange(row, 4).setNumberFormat('@').setValue(code);
      sh.getRange(row, 8, 1, 2).setNumberFormat('yyyy-mm-dd');
    }
  });
  return Object.keys(agg).length;
}

function settleInfo_(deptCode, month) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_SETTLE);
  if (!sh || sh.getLastRow() < 2) return null;
  const tz = Session.getScriptTimeZone();
  const fmt = v => v instanceof Date ? Utilities.formatDate(v, tz, 'yyyy-MM-dd') : (v ? String(v) : '');
  const rows = sh.getRange(2, 1, sh.getLastRow() - 1, 9).getValues();
  for (const r of rows) {
    if (String(r[0]) === month && String(r[3]) === deptCode) return { done: r[6] === true, receiptDate: fmt(r[7]), paidDate: fmt(r[8]) };
  }
  return null;
}

// ---------- 정산현황 확장 칸: 다운로드횟수 / 승인대기 / 수정요청JSON / 마지막처리일시 ----------
const SETTLE_EXTRA_HEADERS = ['다운로드횟수', '승인대기', '수정요청JSON', '마지막처리일시'];
const MAX_DOWNLOADS = 3;

function ensureSettleRow_(month, deptCode) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_SETTLE) || ss.insertSheet(SHEET_SETTLE);
  if (sh.getLastRow() === 0) {
    sh.appendRow(['정산월', '기관', '부서', '부서코드', '건수', '청구합계', '정산완료', '영수증 발행일', '입금일', '메모']);
    sh.setFrozenRows(1);
    sh.getRange('A:A').setNumberFormat('@'); sh.getRange('D:D').setNumberFormat('@');
    sh.getRange('F:F').setNumberFormat('#,##0'); sh.getRange('H:I').setNumberFormat('yyyy-mm-dd');
  }
  if (sh.getLastColumn() < 14) {
    sh.getRange(1, 11, 1, 4).setValues([SETTLE_EXTRA_HEADERS]);
    sh.getRange('K:K').setNumberFormat('0'); sh.getRange('N:N').setNumberFormat('yyyy-mm-dd hh:mm');
  }
  const last = sh.getLastRow();
  if (last > 1) {
    const vals = sh.getRange(2, 1, last - 1, 4).getValues();
    for (let i = 0; i < vals.length; i++) {
      if (String(vals[i][0]) === month && String(vals[i][3]) === deptCode) return i + 2;
    }
  }
  const dept = readMaster_().filter(d => d.code === deptCode)[0];
  const row = sh.getLastRow() + 1;
  sh.getRange(row, 1, 1, 14).setValues([[month, dept ? dept.orgName : '', dept ? dept.name : '', deptCode,
    0, 0, false, '', '', '', 0, false, '', '']]);
  sh.getRange(row, 7).insertCheckboxes();
  sh.getRange(row, 1).setNumberFormat('@').setValue(month);
  sh.getRange(row, 4).setNumberFormat('@').setValue(deptCode);
  sh.getRange(row, 8, 1, 2).setNumberFormat('yyyy-mm-dd');
  sh.getRange(row, 11).setNumberFormat('0');
  sh.getRange(row, 14).setNumberFormat('yyyy-mm-dd hh:mm');
  return row;
}

function settleExtra_(row) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_SETTLE);
  const v = sh.getRange(row, 11, 1, 4).getValues()[0];
  return { downloads: Number(v[0]) || 0, pending: v[1] === true, json: String(v[2] || ''), lastAt: v[3] };
}

function setSettleExtra_(row, obj) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_SETTLE);
  sh.getRange(row, 11, 1, 4).setValues([[obj.downloads, obj.pending, obj.json, new Date()]]);
}


// ---------- 메뉴 통계 (지난주 인기 메뉴 TOP3 등) ----------
// 거래내역의 '메뉴' 칸(예: '치즈버거 세트×2, 감자튀김×1')을 풀어서 메뉴별 판매 수량을 셉니다. 기준은 입력일시(실제 주문일).
function countMenus_(fromStr, toStr) {
  const log = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_LOG);
  const cnt = {};
  if (!log || log.getLastRow() < 2) return cnt;
  log.getRange(2, 1, log.getLastRow() - 1, LOG_COLS).getValues().forEach(r => {
    const ts = r[13];
    if (!(ts instanceof Date)) return;
    const day = Utilities.formatDate(ts, TZ, 'yyyy-MM-dd');
    if (day < fromStr || day > toStr) return;
    String(r[3]).split(', ').forEach(part => {
      const m = part.match(/^(.*)×(\d+)$/);
      const name = (m ? m[1] : part).trim(), q = m ? Number(m[2]) : 1;
      if (name) cnt[name] = (cnt[name] || 0) + q;
    });
  });
  return cnt;
}

function rank_(cnt) {
  return Object.keys(cnt).map(k => [k, cnt[k]]).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
}

// 지난주 = 지난 월요일 ~ 일요일
function lastWeekRange_() {
  const now = new Date();
  const dow = Number(Utilities.formatDate(now, TZ, 'u')); // 월=1 ... 일=7
  const mon = new Date(now.getTime() - (dow - 1 + 7) * 86400000);
  const sun = new Date(mon.getTime() + 6 * 86400000);
  return [Utilities.formatDate(mon, TZ, 'yyyy-MM-dd'), Utilities.formatDate(sun, TZ, 'yyyy-MM-dd')];
}

function popularTop3_() {
  const cache = CacheService.getScriptCache();
  const hit = cache.get('popular');
  if (hit) return JSON.parse(hit);
  const rg = lastWeekRange_();
  const top = rank_(countMenus_(rg[0], rg[1])).slice(0, 3).map(x => x[0]);
  cache.put('popular', JSON.stringify(top), 3600);
  return top;
}

function refreshStats() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName('통계') || ss.insertSheet('통계');
  sh.clear();
  const rg = lastWeekRange_();
  const mFrom = prevMonth_() + '-01';
  const mTo = Utilities.formatDate(new Date(new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime() - 86400000), TZ, 'yyyy-MM-dd');
  const week = rank_(countMenus_(rg[0], rg[1])).slice(0, 10);
  const month = rank_(countMenus_(mFrom, mTo)).slice(0, 10);
  const rows = [['지난주 인기 메뉴 (' + rg[0] + ' ~ ' + rg[1] + ')', '', '', '지난달 인기 메뉴 (' + mFrom.slice(0, 7) + ')', '', ''],
                ['순위', '메뉴', '판매 수량', '순위', '메뉴', '판매 수량']];
  for (let i = 0; i < 10; i++) rows.push([week[i] ? i + 1 : '', week[i] ? week[i][0] : '', week[i] ? week[i][1] : '',
                                          month[i] ? i + 1 : '', month[i] ? month[i][0] : '', month[i] ? month[i][1] : '']);
  sh.getRange(1, 1, rows.length, 6).setValues(rows);
  sh.getRange('A1:F1').setFontWeight('bold'); sh.getRange('A2:F2').setFontWeight('bold').setBackground('#2B2118').setFontColor('#FFFFFF');
  sh.setColumnWidth(2, 220); sh.setColumnWidth(5, 220);
  CacheService.getScriptCache().remove('popular');
}

// ---------- 개인정보 파기 (보관기간 지난 이름 삭제) ----------
function purgeOldNames() {
  const ui = SpreadsheetApp.getUi();
  const res = ui.prompt('개인정보 파기', '이 날짜(포함) 이전 거래의 이름을 "(파기)"로 바꿉니다.\n예: 2021-12-31  (되돌릴 수 없어요. 먼저 시트를 복사해 두세요)', ui.ButtonSet.OK_CANCEL);
  if (res.getSelectedButton() !== ui.Button.OK) return;
  const cutoff = res.getResponseText().trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(cutoff)) { ui.alert('날짜 형식이 올바르지 않아요. (예: 2021-12-31)'); return; }
  const log = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_LOG);
  if (!log || log.getLastRow() < 2) return;
  const n = log.getLastRow() - 1;
  const dates = log.getRange(2, 3, n, 1).getValues(), names = log.getRange(2, 6, n, 1).getValues();
  let c = 0;
  dates.forEach((r, i) => {
    const d = r[0] instanceof Date ? Utilities.formatDate(r[0], TZ, 'yyyy-MM-dd') : String(r[0]);
    if (d <= cutoff && names[i][0] !== '(파기)') { names[i][0] = '(파기)'; c++; }
  });
  log.getRange(2, 6, n, 1).setValues(names);
  ui.alert(c + '건의 이름을 파기했어요.');
}

// ---------- 시트에서 날짜를 고치면 '날짜확인'을 자동으로 다시 계산 ----------
function onEdit(e) {
  try {
    const sh = e.range.getSheet();
    if (sh.getName() !== SHEET_LOG || e.range.getColumn() !== 3 || e.range.getRow() < 2) return;
    const row = e.range.getRow();
    const ts = sh.getRange(row, 14).getValue();
    const val = e.range.getValue();
    const dateStr = val instanceof Date ? Utilities.formatDate(val, TZ, 'yyyy-MM-dd') : String(val).trim();
    if (!(ts instanceof Date) || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return;
    const input = Utilities.formatDate(ts, TZ, 'yyyy-MM-dd');
    const ms = s => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
    const diff = Math.round((ms(input) - ms(dateStr)) / 86400000);
    sh.getRange(row, 12).setValue(diff === 0 ? '' : diff < 0 ? '⚠ 미래 날짜 (' + (-diff) + '일 뒤)' : '⚠ ' + diff + '일 전 날짜');
  } catch (err) {}
}

// ---------- 실수 방지: 경고형 보호 + 자동 백업 ----------
// '경고형 보호'는 수정을 막지 않아요. 대신 범위를 고치거나 지우려 할 때
// 구글 시트가 "이 범위는 보호되어 있습니다. 계속하시겠습니까?"라고 한 번 물어봐서,
// 드래그하다 실수로 delete를 누르는 사고를 막아 줘요. 사장님은 '예'만 누르면 평소처럼 계속 쓸 수 있어요.
const PROTECT_SHEETS = [SHEET_LOG, '부서마스터', SHEET_SETTINGS, '메뉴판', SHEET_SETTLE, SHEET_PREPAID];
const BACKUP_FOLDER_NAME = '식대장부 자동백업';
const BACKUP_KEEP_DAYS = 30;

function setupSafety() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let n = 0;
  PROTECT_SHEETS.forEach(name => {
    const sh = ss.getSheetByName(name);
    if (!sh) return;
    // 기존에 걸어 둔 경고형 보호가 있으면 먼저 지우고 새로 겁니다 (중복 방지)
    sh.getProtections(SpreadsheetApp.ProtectionType.RANGE).forEach(p => { if (p.isWarningOnly()) p.remove(); });
    // 데이터 범위만 잡으면 나중에 새로 추가되는 행은 보호가 안 걸려요.
    // 그래서 앞으로 많이 늘어나도 안전하도록 아주 넉넉한 고정 범위(1~10,000행)를 보호해요.
    const lastCol = Math.max(sh.getLastColumn(), 15);
    const rng = sh.getRange(1, 1, 10000, lastCol);
    const p = rng.protect().setWarningOnly(true);
    n++;
  });
  setupBackupTrigger();
  backupNow();
  SpreadsheetApp.getUi().alert(
    '실수 방지 설정을 켰어요.\n\n' +
    '① 주요 탭(' + n + '개)에 경고형 보호를 걸었어요. 이제 범위를 지우거나 고치면 "계속하시겠습니까?" 확인창이 한 번 떠요.\n' +
    '② 매일 밤 3시에 전체 시트가 구글 드라이브의 "' + BACKUP_FOLDER_NAME + '" 폴더에 자동으로 복사돼요. (최근 ' + BACKUP_KEEP_DAYS + '일치 보관)\n' +
    '③ 방금 바로 백업을 1번 만들어 뒀어요.'
  );
}

function getBackupFolder_() {
  const it = DriveApp.getFoldersByName(BACKUP_FOLDER_NAME);
  return it.hasNext() ? it.next() : DriveApp.createFolder(BACKUP_FOLDER_NAME);
}

function backupNow() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const file = DriveApp.getFileById(ss.getId());
  const stamp = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd_HH:mm');
  file.makeCopy(ss.getName() + ' - 백업 ' + stamp, getBackupFolder_());
  // 오래된 백업 정리
  const cutoff = new Date(Date.now() - BACKUP_KEEP_DAYS * 86400000);
  const files = getBackupFolder_().getFiles();
  while (files.hasNext()) {
    const f = files.next();
    if (f.getDateCreated() < cutoff) f.setTrashed(true);
  }
}

function setupBackupTrigger() {
  ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'backupNow').forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('backupNow').timeBased().everyDays(1).atHour(3).create();
}

function openBackupFolder() {
  const folder = getBackupFolder_();
  SpreadsheetApp.getUi().alert(
    '백업 폴더 링크를 아래에 복사했어요. 구글 드라이브에서 "' + BACKUP_FOLDER_NAME + '" 폴더를 찾아도 됩니다.\n\n' + folder.getUrl()
  );
}

// 빈 칸(신규 등록된 부서)에만 PIN을 새로 만들어요. 이미 PIN이 있는 부서는 절대 건드리지 않고,
// 새로 만드는 PIN은 기존에 쓰이고 있는 PIN과 겹치지 않도록 확인하면서 만들어요.
function generatePins() {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_MASTER);
  const last = sh.getLastRow();
  if (last < 2) return;
  const range = sh.getRange(2, 5, last - 1, 1); // E열: PIN
  const vals = range.getValues();

  const used = new Set();
  vals.forEach(r => { if (r[0] !== '') used.add(String(r[0]).padStart(3, '0')); });

  let made = 0;
  const out = vals.map(r => {
    if (r[0] !== '') return [r[0]];
    let pin;
    do { pin = String(Math.floor(Math.random() * 1000)).padStart(3, '0'); } while (used.has(pin));
    used.add(pin);
    made++;
    return [pin];
  });

  range.setNumberFormat('@').setValues(out);
  if (made > 0) SpreadsheetApp.getUi().alert(made + '개 부서에 새 PIN을 만들었어요. 기존 부서의 PIN은 그대로 유지했고, 새로 만든 PIN은 기존 PIN과 겹치지 않아요.');
}

// 정산서 PIN: 숫자 4자리 (예: 2609 = 26년 9월). 부서마스터 G열에 부서별로 적거나, 설정 탭 '정산서 PIN (공통)'에 한 번만 적어도 돼요.
function normSpin_(v) {
  const s = String(v === null || v === undefined ? '' : v).replace(/\D/g, '');
  return s ? s.padStart(4, '0').slice(-4) : '';
}

function commonSpin_() {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_SETTINGS);
  if (!sh || sh.getLastRow() < 2) return '';
  const rows = sh.getRange(2, 1, sh.getLastRow() - 1, 2).getValues();
  for (const r of rows) if (String(r[0]).trim() === '정산서 PIN (공통)') return normSpin_(r[1]);
  return '';
}

// 정산서 조회용 2차 PIN 확인 (부서별 값이 있으면 그것, 없으면 공통 값)
function checkSpin_(dept, spin) {
  const own = dept.spin || commonSpin_();
  if (!own) return { ok: false, message: '정산서 PIN이 아직 설정되지 않았어요. 매장에 문의해 주세요.' };
  const cache = CacheService.getScriptCache();
  const key = 'sfail:' + dept.code;
  const fails = Number(cache.get(key) || 0);
  if (fails >= MAX_FAILS) return { ok: false, message: '정산서 PIN을 여러 번 틀려 잠시 잠겼어요. 10분 뒤 다시 시도해 주세요.' };
  if (String(spin) !== own) {
    cache.put(key, String(fails + 1), LOCK_SECONDS);
    return { ok: false, message: '정산서 PIN이 맞지 않아요.' };
  }
  cache.remove(key);
  return { ok: true };
}

function readMaster_() {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_MASTER);
  const rows = sh.getDataRange().getValues().slice(1);
  return rows.filter(r => r[2]).map(r => ({
    orgCode: String(r[0]), orgName: String(r[1]), code: String(r[2]), name: String(r[3]),
    pin: String(r[4]).padStart(3, '0'), active: String(r[5]).toUpperCase() !== 'N',
    spin: normSpin_(r[6]), contactName: String(r[7] || ''), email: String(r[8] || ''),
    phone: String(r[9] || ''), memo: String(r[10] || '')
  }));
}

const DEPT_META_HEADERS = ['담당자 이름', '담당자 이메일', '담당자 연락처', '메모'];
const DEPT_DOC_MAX_BYTES = 5 * 1024 * 1024;

function ensureDeptMetaColumns_(sh) {
  const existing = sh.getRange(1, 8, 1, 4).getDisplayValues()[0].map(v => String(v).trim());
  for (let i = 0; i < existing.length; i++) {
    if (existing[i] && existing[i] !== DEPT_META_HEADERS[i]) {
      return { ok: false, message: '부서마스터 H~K열에 다른 정보가 있어 담당자 열을 추가할 수 없어요.' };
    }
  }
  sh.getRange(1, 8, 1, 4).setValues([DEPT_META_HEADERS]);
  return { ok: true };
}

function departmentDocsStatus_() {
  const props = PropertiesService.getScriptProperties();
  const businessId = props.getProperty('DEPT_BUSINESS_FILE_ID') || '';
  const bankbookId = props.getProperty('DEPT_BANKBOOK_FILE_ID') || '';
  if (!businessId || !bankbookId) return { configured: false };
  try {
    return { configured: true, businessName: DriveApp.getFileById(businessId).getName(), bankbookName: DriveApp.getFileById(bankbookId).getName() };
  } catch (err) {
    return { configured: false };
  }
}

function uploadDepartmentDocsOwner_(b) {
  const chk = checkOwner_(b.pin);
  if (!chk.ok) return json_(chk);
  const files = [b.businessLicense, b.bankbook];
  const types = ['application/pdf', 'image/jpeg', 'image/png'];
  for (const file of files) {
    if (!file || !file.name || !file.data || types.indexOf(String(file.mimeType)) < 0) {
      return json_({ ok: false, message: '사업자등록증과 통장사본을 PDF, JPG, PNG 중 하나로 선택해 주세요.' });
    }
    if (String(file.data).length > Math.ceil(DEPT_DOC_MAX_BYTES * 4 / 3) + 8) {
      return json_({ ok: false, message: '파일 하나당 5MB 이하로 선택해 주세요.' });
    }
  }
  const props = PropertiesService.getScriptProperties();
  let folder;
  try { folder = DriveApp.getFolderById(props.getProperty('DEPT_DOC_FOLDER_ID')); }
  catch (err) {
    folder = DriveApp.createFolder('우프스낵바 부서 안내 서류');
    props.setProperty('DEPT_DOC_FOLDER_ID', folder.getId());
  }
  const store = (file, fallback) => {
    const bytes = Utilities.base64Decode(String(file.data));
    if (bytes.length > DEPT_DOC_MAX_BYTES) throw new Error('파일 하나당 5MB 이하로 선택해 주세요.');
    const safeName = String(file.name).replace(/[\\/:*?"<>|]/g, '_').slice(0, 100) || fallback;
    return folder.createFile(Utilities.newBlob(bytes, String(file.mimeType), safeName));
  };
  try {
    const businessFile = store(b.businessLicense, '사업자등록증');
    const bankbookFile = store(b.bankbook, '통장사본');
    props.setProperties({ DEPT_BUSINESS_FILE_ID: businessFile.getId(), DEPT_BANKBOOK_FILE_ID: bankbookFile.getId() });
    return json_({ ok: true, documents: departmentDocsStatus_() });
  } catch (err) {
    return json_({ ok: false, message: err.message || '문서 저장에 실패했어요.' });
  }
}

function nextDepartmentCode_(orgCode, departments) {
  let max = 0;
  const prefix = orgCode + '-';
  departments.forEach(d => {
    if (d.orgCode !== orgCode || d.code.indexOf(prefix) !== 0) return;
    const suffix = d.code.slice(prefix.length);
    if (/^\d{3}$/.test(suffix)) max = Math.max(max, Number(suffix));
  });
  if (max >= 999) return '';
  return prefix + String(max + 1).padStart(3, '0');
}

function nextDepartmentPin_(departments) {
  const used = new Set(departments.map(d => d.pin));
  if (used.size >= 1000) return '';
  let pin;
  do { pin = String(Math.floor(Math.random() * 1000)).padStart(3, '0'); } while (used.has(pin));
  return pin;
}

function emailDepartmentDocs_(dept) {
  const props = PropertiesService.getScriptProperties();
  const businessId = props.getProperty('DEPT_BUSINESS_FILE_ID');
  const bankbookId = props.getProperty('DEPT_BANKBOOK_FILE_ID');
  if (!businessId || !bankbookId) throw new Error('발송할 사업자등록증과 통장사본을 먼저 등록해 주세요.');
  MailApp.sendEmail({
    to: dept.email,
    subject: '[우프스낵바] ' + dept.orgName + ' ' + dept.name + ' 안내 서류',
    body: dept.contactName + ' 담당자님, 안녕하세요.\n\n사업자등록증과 통장사본을 첨부해 드립니다.\n\n우프스낵바',
    name: '우프스낵바',
    attachments: [DriveApp.getFileById(businessId).getBlob(), DriveApp.getFileById(bankbookId).getBlob()]
  });
}

function registerDepartmentOwner_(b) {
  const chk = checkOwner_(b.pin);
  if (!chk.ok) return json_(chk);
  const sendDocs = b.sendDocs === true;
  if (sendDocs && !departmentDocsStatus_().configured) return json_({ ok: false, message: '서류를 메일로 보내려면 사업자등록증과 통장사본을 먼저 올려 주세요.' });
  const orgCode = String(b.orgCode || '').trim();
  const name = String(b.name || '').trim().slice(0, 100);
  const contactName = String(b.contactName || '').trim().slice(0, 100);
  const email = String(b.email || '').trim().slice(0, 200);
  const phone = String(b.phone || '').trim().slice(0, 50);
  const memo = String(b.memo || '').trim().slice(0, 500);
  if (!name || (sendDocs && (!contactName || !email))) {
    return json_({ ok: false, message: '부서명과 서류 수신 담당자 정보를 입력해 주세요.' });
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json_({ ok: false, message: '담당자 이메일 주소를 확인해 주세요.' });
  }
  const departments = readMaster_();
  const org = departments.filter(d => d.orgCode === orgCode)[0];
  if (!org) return json_({ ok: false, message: '기관을 찾을 수 없어요.' });
  if (departments.some(d => d.orgCode === orgCode && d.name.toLowerCase() === name.toLowerCase())) {
    return json_({ ok: false, message: '같은 기관에 동일한 부서명이 이미 등록되어 있어요.' });
  }
  const code = nextDepartmentCode_(orgCode, departments);
  const pin = nextDepartmentPin_(departments);
  if (!code || !pin) return json_({ ok: false, message: '부서코드 또는 PIN을 더 만들 수 없어요. 관리자에게 문의해 주세요.' });
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_MASTER);
  const headers = ensureDeptMetaColumns_(sh);
  if (!headers.ok) return json_(headers);
  const row = sh.getLastRow() + 1;
  sh.getRange(row, 1, 1, 11).setNumberFormat('@').setValues([[
    orgCode, org.orgName, code, name, pin, 'Y', '', contactName, email, phone, memo
  ]]);
  const dept = { orgCode: orgCode, orgName: org.orgName, code: code, name: name, pin: pin, contactName: contactName, email: email };
  if (!sendDocs) return json_({ ok: true, code: code, pin: pin, sendDocs: false, emailSent: false });
  try {
    emailDepartmentDocs_(dept);
    return json_({ ok: true, code: code, pin: pin, sendDocs: true, emailSent: true });
  } catch (err) {
    return json_({ ok: true, code: code, pin: pin, sendDocs: true, emailSent: false, emailMessage: err.message || '이메일 전송에 실패했어요.' });
  }
}

function resendDepartmentDocsOwner_(b) {
  const chk = checkOwner_(b.pin);
  if (!chk.ok) return json_(chk);
  const dept = readMaster_().filter(d => d.code === String(b.deptCode || ''))[0];
  if (!dept || !dept.email) return json_({ ok: false, message: '담당자 이메일이 등록되어 있지 않아요.' });
  try {
    emailDepartmentDocs_(dept);
    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, message: err.message || '이메일 전송에 실패했어요.' });
  }
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

// ---------- 오늘의 번호 (매일 자동으로 바뀌는 1자리) ----------
// 날짜(서울 기준)와 비밀 값으로 계산해요. 시트를 손댈 필요가 없고, 비밀 값은 스크립트 속성에 저장돼요.
function dailyDigit_(dateStr) {
  const props = PropertiesService.getScriptProperties();
  let secret = props.getProperty('DAILY_SECRET');
  if (!secret) { secret = Utilities.getUuid(); props.setProperty('DAILY_SECRET', secret); }
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, secret + '|' + dateStr);
  return String((bytes[0] & 0xff) % 10);
}

function todayDigit_() {
  return dailyDigit_(Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd'));
}

// 자정 직후 30분 동안은 전날 번호도 허용 (자정 전에 열어 둔 화면이 저장 실패하지 않게)
function validDigits_() {
  const now = new Date();
  const out = [todayDigit_()];
  const mins = Number(Utilities.formatDate(now, TZ, 'H')) * 60 + Number(Utilities.formatDate(now, TZ, 'm'));
  if (mins < 30) out.push(dailyDigit_(Utilities.formatDate(new Date(now.getTime() - 86400000), TZ, 'yyyy-MM-dd')));
  return out;
}

function showDailyNumber() {
  SpreadsheetApp.getUi().alert('오늘의 번호는 ' + todayDigit_() + ' 입니다.\n(공무원 입력 시 부서 PIN 3자리 뒤에 붙여요)');
}

function checkPin_(dept, pin) {
  const cache = CacheService.getScriptCache();
  const key = 'fail:' + dept.code;
  const fails = Number(cache.get(key) || 0);
  if (fails >= MAX_FAILS) return { ok: false, message: 'PIN을 여러 번 틀려 잠시 잠겼어요. 10분 뒤 다시 시도하거나 사장님께 문의해 주세요.' };
  if (!dept.active) return { ok: false, message: '사용이 중지된 부서예요. 사장님께 문의해 주세요.' };
  // 입력값 = 부서 PIN(3자리) + 오늘의 번호(1자리)
  if (!validDigits_().some(d => String(pin) === dept.pin + d)) {
    cache.put(key, String(fails + 1), LOCK_SECONDS);
    return { ok: false, message: 'PIN 또는 오늘의 번호가 맞지 않아요. 매장에서 알려 주는 오늘의 번호를 확인해 주세요.' };
  }
  cache.remove(key);
  return { ok: true };
}

// PIN 확인 (부서 선택 후 입력창을 열기 전에 호출)
function doGet(e) {
  const p = e.parameter || {};
  if (p.action === 'verifyspin') {
    const dept = readMaster_().filter(d => d.code === p.dept)[0];
    if (!dept) return json_({ ok: false, message: '부서를 찾을 수 없어요.' });
    const chk = checkPin_(dept, p.pin);
    if (!chk.ok) return json_(chk);
    return json_(checkSpin_(dept, p.spin));
  }
  if (p.action === 'statement') {
    const dept = readMaster_().filter(d => d.code === p.dept)[0];
    if (!dept) return json_({ ok: false, message: '부서를 찾을 수 없어요.' });
    const chk = checkPin_(dept, p.pin);
    if (!chk.ok) return json_(chk);
    const chk2 = checkSpin_(dept, p.spin);
    if (!chk2.ok) return json_(chk2);
    const month = String(p.month || '');
    const srow = ensureSettleRow_(month, dept.code);
    const extra = settleExtra_(srow);
    const editStatus = { locked: extra.downloads > 0, pending: extra.pending, downloadsLeft: Math.max(0, MAX_DOWNLOADS - extra.downloads) };
    return json_({ ok: true, rows: statementRows_(dept.code, month), settle: settleInfo_(dept.code, month), editStatus: editStatus });
  }
  if (p.action === 'pendingEdits') {
    const chk = checkOwner_(p.pin);
    if (!chk.ok) return json_(chk);
    return json_({ ok: true, batches: pendingEditBatches_() });
  }
  if (p.action === 'prepaidBalance') {
    const chk = checkOwner_(p.pin);
    if (!chk.ok) return json_(chk);
    return json_({ ok: true, balance: prepaidBalance_(String(p.dept || '')) });
  }
  if (p.action === 'deptPrepaidBalance') {
    const dept = readMaster_().filter(d => d.code === p.dept)[0];
    if (!dept) return json_({ ok: false, message: '부서를 찾을 수 없어요.' });
    const chk = checkPin_(dept, p.pin);
    if (!chk.ok) return json_(chk);
    return json_({ ok: true, balance: prepaidBalance_(dept.code) });
  }
  if (p.action === 'deptDocsStatus') {
    const chk = checkOwner_(p.pin);
    if (!chk.ok) return json_(chk);
    return json_(Object.assign({ ok: true }, departmentDocsStatus_()));
  }
  if (p.action === 'prepaidBalances') {
    const chk = checkOwner_(p.pin);
    if (!chk.ok) return json_(chk);
    return json_({ ok: true, list: prepaidBalancesList_() });
  }
  if (p.action === 'sales') {
    const chk = checkOwner_(p.pin);
    if (!chk.ok) return json_(chk);
    const d = String(p.date || '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return json_({ ok: false, message: '날짜 형식이 올바르지 않아요.' });
    return json_(Object.assign({ ok: true }, salesForDate_(d)));
  }
  if (p.action === 'orders') {
    const chk = checkOwner_(p.pin);
    if (!chk.ok) return json_(chk);
    return json_({ ok: true, orders: ordersToday_(), dailyDigit: todayDigit_() });
  }
  if (p.action === 'depts') {
    // 부서마스터의 '사용여부'가 N이 아닌 부서만, 시트 순서대로 기관별로 묶어서 전달 (PIN은 보내지 않음)
    const orgs = {};
    readMaster_().filter(d => d.active).forEach(d => {
      if (!orgs[d.orgCode]) orgs[d.orgCode] = { name: d.orgName, depts: [] };
      orgs[d.orgCode].depts.push({ code: d.code, name: d.name });
    });
    return json_({ ok: true, orgs: orgs });
  }
  if (p.action === 'popular') return json_({ ok: true, top: popularTop3_() });
  if (p.action === 'menu') return json_({ ok: true, menu: getMenu_() });
  if (p.action === 'config') return json_({ ok: true, cfg: getSettings_() });
  if (p.action === 'boot') {
    // 접속 시작 화면에 필요한 설정/부서/인기메뉴/메뉴를 한 번의 요청으로 모아서 전달 (왕복 4회 -> 1회로 단축)
    const orgs = {};
    readMaster_().filter(d => d.active).forEach(d => {
      if (!orgs[d.orgCode]) orgs[d.orgCode] = { name: d.orgName, depts: [] };
      orgs[d.orgCode].depts.push({ code: d.code, name: d.name });
    });
    return json_({ ok: true, cfg: getSettings_(), orgs: orgs, top: popularTop3_(), menu: getMenu_() });
  }
  if (p.action === 'verify') {
    const dept = readMaster_().filter(d => d.code === p.dept)[0];
    if (!dept) return json_({ ok: false, message: '부서를 찾을 수 없어요.' });
    return json_(checkPin_(dept, p.pin));
  }
  return json_({ ok: true, message: 'running' });
}

// 해당 부서의 월별 내역 (자기 부서 코드로만 필터링)
function statementRows_(deptCode, month) {
  const log = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_LOG);
  if (!log || log.getLastRow() < 2) return [];
  const tz = Session.getScriptTimeZone();
  const out = [];
  log.getRange(2, 1, log.getLastRow() - 1, LOG_COLS).getValues().forEach((r, i) => {
    if (String(r[10]) !== deptCode) return;
    if (String(r[15] || '').indexOf('선결제') === 0) return; // 선결제 처리된 건은 정산서(청구)에서 제외
    const date = r[2] instanceof Date ? Utilities.formatDate(r[2], tz, 'yyyy-MM-dd') : String(r[2]);
    if (date.indexOf(month) !== 0) return;
    const ts = r[13];
    out.push({
      row: i + 2, key: ts instanceof Date ? Math.floor(ts.getTime() / 1000) : 0,
      date: date, menu: String(r[3]), amount: Number(r[4]), name: String(r[5]), people: Number(r[6]) || 1
    });
  });
  return out.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
}

// ---------- 정산서 수정 요청 / 승인 / 다운로드 제한 ----------
// 담당자가 날짜·이름 수정을 요청하면 즉시 반영하지 않고 대기 상태로 저장해요. 금액은 절대 바꾸지 않아요.
function requestEdit_(b) {
  const dept = readMaster_().filter(d => d.code === b.deptCode)[0];
  if (!dept) return json_({ ok: false, message: '부서를 찾을 수 없어요.' });
  const chk = checkPin_(dept, b.pin);
  if (!chk.ok) return json_(chk);
  const chk2 = checkSpin_(dept, b.spin);
  if (!chk2.ok) return json_(chk2);
  const month = String(b.month || '');
  if (!/^\d{4}-\d{2}$/.test(month)) return json_({ ok: false, message: '정산월이 올바르지 않아요.' });
  const srow = ensureSettleRow_(month, dept.code);
  const extra = settleExtra_(srow);
  if (extra.downloads > 0) return json_({ ok: false, message: '이미 다운로드된 정산서는 더 이상 수정할 수 없어요. 매장에 문의해 주세요.' });
  if (extra.pending) return json_({ ok: false, message: '이미 승인 대기 중인 수정 요청이 있어요. 매장의 확인을 기다려 주세요.' });

  const edits = Array.isArray(b.edits) ? b.edits : [];
  if (!edits.length || edits.length > 50) return json_({ ok: false, message: '수정할 내용이 없어요.' });

  const log = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_LOG);
  const clean = [];
  for (const e of edits) {
    const row = Number(e.row);
    if (!(row >= 2 && row <= log.getLastRow())) return json_({ ok: false, message: '해당 내역을 찾을 수 없어요. 새로고침 후 다시 시도해 주세요.' });
    const r = log.getRange(row, 1, 1, LOG_COLS).getValues()[0];
    const ts = r[13];
    const curKey = ts instanceof Date ? Math.floor(ts.getTime() / 1000) : 0;
    if (String(curKey) !== String(e.key)) return json_({ ok: false, message: '내역이 그 사이 바뀌었어요. 새로고침 후 다시 시도해 주세요.' });
    if (String(r[10]) !== dept.code) return json_({ ok: false, message: '우리 부서 내역만 수정할 수 있어요.' });
    const date = String(e.date || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return json_({ ok: false, message: '날짜 형식이 올바르지 않아요.' });
    const names = (e.names || []).map(n => String(n).trim()).filter(n => n);
    const origCount = Number(r[6]) || 1;
    if (names.length !== origCount) return json_({ ok: false, message: '인원 수는 바꿀 수 없어요. 이름만 고쳐 주세요.' });
    if (new Set(names).size !== names.length) return json_({ ok: false, message: '같은 이름이 중복됐어요.' });
    clean.push({ row: row, key: curKey, date: date, names: names, oldDate: r[2] instanceof Date ? Utilities.formatDate(r[2], TZ, 'yyyy-MM-dd') : String(r[2]), oldNames: String(r[5]) });
  }

  setSettleExtra_(srow, { downloads: extra.downloads, pending: true, json: JSON.stringify(clean) });
  return json_({ ok: true, message: '수정 요청을 보냈어요. 매장의 승인을 기다려 주세요.' });
}

// 사장님 화면: 대기 중인 수정 요청 전체 목록
function pendingEditBatches_() {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_SETTLE);
  if (!sh || sh.getLastRow() < 2) return [];
  const rows = sh.getRange(2, 1, sh.getLastRow() - 1, 14).getValues();
  const out = [];
  rows.forEach(r => {
    if (r[11] !== true) return;
    let items = [];
    try { items = JSON.parse(r[12] || '[]'); } catch (e) { items = []; }
    out.push({ month: String(r[0]), org: String(r[1]), dept: String(r[2]), deptCode: String(r[3]), items: items });
  });
  return out;
}

// 사장님이 수정 요청을 승인/거부
function resolveEdit_(b) {
  const chk = checkOwner_(b.pin);
  if (!chk.ok) return json_(chk);
  const month = String(b.month || ''), deptCode = String(b.deptCode || '');
  const srow = ensureSettleRow_(month, deptCode);
  const extra = settleExtra_(srow);
  if (!extra.pending) return json_({ ok: false, message: '대기 중인 수정 요청이 없어요.' });
  let items = [];
  try { items = JSON.parse(extra.json || '[]'); } catch (e) { items = []; }

  if (b.approve) {
    const log = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_LOG);
    items.forEach(it => {
      const r = log.getRange(it.row, 1, 1, LOG_COLS).getValues()[0];
      const ts = r[13];
      const curKey = ts instanceof Date ? Math.floor(ts.getTime() / 1000) : 0;
      if (String(curKey) !== String(it.key)) return; // 그 사이 다른 방식으로 바뀐 행은 건너뜀
      log.getRange(it.row, 3).setNumberFormat('@').setValue(it.date);
      log.getRange(it.row, 6).setNumberFormat('@').setValue(it.names.join(', '));
      log.getRange(it.row, 12).setValue(dateFlag_(it.date));
    });
  }
  setSettleExtra_(srow, { downloads: extra.downloads, pending: false, json: '' });
  return json_({ ok: true, message: b.approve ? '승인하고 반영했어요.' : '요청을 거부했어요.' });
}

// 다운로드 전 서버 확인: 승인 대기 중이면 막고, 월 3회 제한을 넘으면 막아요. 통과하면 횟수를 1 늘려요.
function checkDownload_(b) {
  const dept = readMaster_().filter(d => d.code === b.deptCode)[0];
  if (!dept) return json_({ ok: false, message: '부서를 찾을 수 없어요.' });
  const chk = checkPin_(dept, b.pin);
  if (!chk.ok) return json_(chk);
  const chk2 = checkSpin_(dept, b.spin);
  if (!chk2.ok) return json_(chk2);
  const month = String(b.month || '');
  const srow = ensureSettleRow_(month, dept.code);
  const extra = settleExtra_(srow);
  if (extra.pending) return json_({ ok: false, message: '수정 승인 대기 중이라 다운로드할 수 없어요.' });
  if (extra.downloads >= MAX_DOWNLOADS) return json_({ ok: false, message: '이번 달 다운로드 가능 횟수(' + MAX_DOWNLOADS + '회)를 모두 사용했어요. 매장에 문의해 주세요.' });
  const next = extra.downloads + 1;
  setSettleExtra_(srow, { downloads: next, pending: false, json: extra.json });
  return json_({ ok: true, downloadsLeft: MAX_DOWNLOADS - next });
}

// 주문 저장
// 주문 한 건을 실제로 거래내역에 기록하는 공용 함수.
// tag가 비어있으면 담당자 입력, '사장님 대리입력'이면 사장님 입력이며 둘 다 일자별 매출에 포함돼요.
// ---------- 선결제(연말 충전) 잔액 ----------
// '선결제' 시트는 통장 거래내역처럼, 충전(+)과 차감(-)이 한 줄씩 쌓이는 원장이에요.
// 잔액 = 그 부서의 충전 합계 - 차감 합계. 시트에 직접 행을 추가하지 않아도,
// 아래 메뉴로 등록하면 오타 없이 안전하게 쌓여요.

function setupPrepaid_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_PREPAID) || ss.insertSheet(SHEET_PREPAID);
  if (sh.getLastRow() === 0) {
    sh.appendRow(['일시', '기관', '부서', '부서코드', '구분', '금액', '메모']);
    sh.setFrozenRows(1);
    sh.getRange('A:A').setNumberFormat('yyyy-mm-dd hh:mm');
    sh.getRange('D:D').setNumberFormat('@');
    sh.getRange('F:F').setNumberFormat('#,##0');
  }
  return sh;
}

function prepaidBalance_(deptCode) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_PREPAID);
  if (!sh || sh.getLastRow() < 2) return 0;
  let bal = 0;
  sh.getRange(2, 1, sh.getLastRow() - 1, 6).getValues().forEach(r => {
    if (String(r[3]) !== deptCode) return;
    const amt = Number(r[5]) || 0;
    bal += (String(r[4]) === '차감') ? -amt : amt;
  });
  return bal;
}

function addPrepaidCharge_(dept, amount, memo) {
  setupPrepaid_().appendRow([new Date(), dept.orgName, dept.name, dept.code, '충전', amount, memo || '']);
  return prepaidBalance_(dept.code);
}

function prepaidChargeOwner_(b) {
  const chk = checkOwner_(b.pin);
  if (!chk.ok) return json_(chk);
  const dept = readMaster_().filter(d => d.code === String(b.deptCode || ''))[0];
  if (!dept) return json_({ ok: false, message: '부서를 찾을 수 없어요.' });
  const amount = Math.max(0, Math.round(Number(b.amount) || 0));
  if (amount <= 0) return json_({ ok: false, message: '충전 금액을 입력해 주세요.' });
  const balance = addPrepaidCharge_(dept, amount, String(b.memo || '').trim().slice(0, 100));
  return json_({ ok: true, amount: amount, balance: balance });
}

function deductPrepaid_(dept, amount, memo) {
  const sh = setupPrepaid_();
  sh.appendRow([new Date(), dept.orgName, dept.name, dept.code, '차감', amount, memo || '']);
}

// 사장님 화면의 '선결제 차감 처리' 전용 기능. 단체 주문처럼 참석자 이름을 일일이 적기 어려운 경우,
// 금액만 입력하면 잔액에서 바로 차감돼요. 이름 목록 대신 메모 한 줄과 인원수만 받아요.
// 거래내역에 기록하며, 차감한 선결제 금액은 주문일 매출에 포함하고 월 정산서에서는 제외해요.
function prepaidDeductSimple_(b) {
  const chk = checkOwner_(b.pin);
  if (!chk.ok) return json_(chk);
  const dept = readMaster_().filter(d => d.code === b.deptCode)[0];
  if (!dept) return json_({ ok: false, message: '부서를 찾을 수 없어요.' });
  return prepaidDeductForDept_(dept, b);
}

function prepaidDeductDept_(b) {
  const dept = readMaster_().filter(d => d.code === String(b.deptCode || ''))[0];
  if (!dept) return json_({ ok: false, message: '부서를 찾을 수 없어요.' });
  const chk = checkPin_(dept, b.pin);
  if (!chk.ok) return json_(chk);
  return prepaidDeductForDept_(dept, b);
}

function prepaidDeductForDept_(dept, b) {
  const amount = Math.max(0, Math.round(Number(b.amount) || 0));
  if (amount <= 0) return json_({ ok: false, message: '금액을 입력해 주세요.' });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(b.date))) return json_({ ok: false, message: '날짜 형식이 올바르지 않아요.' });
  const balance = prepaidBalance_(dept.code);
  if (balance < amount) return json_({ ok: false, message: '선결제 잔액(' + balance.toLocaleString('ko-KR') + '원)이 부족해요.' });
  const people = Math.max(1, Math.min(500, Number(b.people) || 1));
  const memo = String(b.memo || '').trim().slice(0, 100);

  deductPrepaid_(dept, amount, String(b.date) + ' 단체 차감' + (memo ? ' - ' + memo : ''));

  setupLog();
  const log = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_LOG);
  const row = log.getLastRow() + 1;
  const rng = log.getRange(row, 1, 1, LOG_COLS);
  rng.setNumberFormats([['@', '@', '@', '@', '#,##0', '@', '0', '@', '#,##0', '@', '@', '@', '@', 'yyyy-mm-dd hh:mm', '@', '@', '#,##0']]);
  rng.setValues([[dept.orgName, dept.name, String(b.date), memo || '선결제 단체 차감',
    0, '선결제 단체(' + people + '명)' + (memo ? ' - ' + memo : ''), people, '', '',
    dept.orgCode, dept.code, dateFlag_(String(b.date)), '', new Date(), '선결제 대리입력', '선결제차감', amount]]);

  const newBalance = prepaidBalance_(dept.code);
  return json_({ ok: true, amount: amount, balance: newBalance });
}

// 부서별 선결제 잔액 목록 (화면에서 바로 보기용 — 시트 메뉴의 [부서별 선결제 잔액 확인]과 같은 내용)
function prepaidBalancesList_() {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_PREPAID);
  if (!sh || sh.getLastRow() < 2) return [];
  const byDept = {};
  sh.getRange(2, 1, sh.getLastRow() - 1, 6).getValues().forEach(r => {
    const code = String(r[3]);
    if (!byDept[code]) byDept[code] = { code: code, org: String(r[1]), dept: String(r[2]), balance: 0 };
    const amt = Number(r[5]) || 0;
    byDept[code].balance += (String(r[4]) === '차감') ? -amt : amt;
  });
  return Object.values(byDept).filter(d => d.balance !== 0).sort((a, b) => b.balance - a.balance);
}

// 시트 메뉴: 선결제 충전 등록 (사장님이 실제로 입금받았을 때 이걸로 등록)
function chargePrepaid_() {
  const ui = SpreadsheetApp.getUi();
  const res1 = ui.prompt('선결제 충전 등록', '부서코드를 입력하세요 (예: CITY-031).\n부서마스터 탭의 C열에서 확인할 수 있어요.', ui.ButtonSet.OK_CANCEL);
  if (res1.getSelectedButton() !== ui.Button.OK) return;
  const code = res1.getResponseText().trim();
  const dept = readMaster_().filter(d => d.code === code)[0];
  if (!dept) { ui.alert('그 부서코드를 찾을 수 없어요. 부서마스터 탭을 다시 확인해 주세요.'); return; }

  const res2 = ui.prompt('선결제 충전 등록', dept.orgName + ' ' + dept.name + '\n충전할 금액을 숫자만 입력하세요 (예: 1000000).', ui.ButtonSet.OK_CANCEL);
  if (res2.getSelectedButton() !== ui.Button.OK) return;
  const amount = Number(String(res2.getResponseText()).replace(/[^0-9]/g, ''));
  if (!amount || amount <= 0) { ui.alert('금액이 올바르지 않아요.'); return; }

  const res3 = ui.prompt('선결제 충전 등록', '메모를 입력하세요 (예: 2026년 연말 선결제). 없으면 비워 두고 확인을 누르세요.', ui.ButtonSet.OK_CANCEL);
  if (res3.getSelectedButton() !== ui.Button.OK) return;
  const memo = res3.getResponseText().trim();

  const sh = setupPrepaid_();
  sh.appendRow([new Date(), dept.orgName, dept.name, dept.code, '충전', amount, memo]);
  const bal = prepaidBalance_(dept.code);
  ui.alert('등록했어요.\n\n' + dept.orgName + ' ' + dept.name + '\n이번 충전: ' + amount.toLocaleString('ko-KR') + '원\n현재 잔액: ' + bal.toLocaleString('ko-KR') + '원\n\n앞으로 이 부서가 주문하면, 청구금액이 잔액을 넘지 않는 한 자동으로 잔액에서 차감되고 그 달 정산서에는 청구되지 않아요.');
}

// 시트 메뉴: 부서별 선결제 잔액이 남아있는 곳을 한눈에 확인
function checkPrepaidBalances_() {
  const ui = SpreadsheetApp.getUi();
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_PREPAID);
  if (!sh || sh.getLastRow() < 2) { ui.alert('아직 등록된 선결제 내역이 없어요. [선결제 충전 등록]으로 먼저 등록해 주세요.'); return; }
  const byDept = {};
  sh.getRange(2, 1, sh.getLastRow() - 1, 6).getValues().forEach(r => {
    const code = String(r[3]);
    if (!byDept[code]) byDept[code] = { name: r[1] + ' ' + r[2], bal: 0 };
    const amt = Number(r[5]) || 0;
    byDept[code].bal += (String(r[4]) === '차감') ? -amt : amt;
  });
  const lines = Object.values(byDept).filter(d => d.bal !== 0)
    .sort((a, b) => b.bal - a.bal)
    .map(d => d.name + ' : ' + d.bal.toLocaleString('ko-KR') + '원');
  ui.alert('부서별 선결제 잔액', lines.length ? lines.join('\n') : '잔액이 남아있는 부서가 없어요.', ui.ButtonSet.OK);
}

function insertOrderRow_(dept, dateStr, names, items, tag) {
  let total = 0;
  const menus = [];
  const priceOf = {};
  getMenu_().forEach(m => { priceOf[m.name] = m.price; });   // 메뉴판 탭 기준 가격
  for (const it of items || []) {
    const price = priceOf[String(it.name)];
    const qty = Math.max(1, Math.min(20, Number(it.qty) || 0));
    if (price === undefined) return json_({ ok: false, message: '메뉴가 변경되었어요. 화면을 새로고침한 뒤 다시 입력해 주세요.' });
    total += price * qty;
    menus.push(String(it.name) + '×' + qty);
  }
  if (total === 0) return json_({ ok: false, message: '메뉴가 비어 있어요.' });
  const persons = (names || []).map(n => String(n).trim().slice(0, 30));
  if (persons.length < 1 || persons.length > 30 || persons.some(n => !n)) return json_({ ok: false, message: '이름을 모두 입력해 주세요.' });
  if (new Set(persons).size !== persons.length) return json_({ ok: false, message: '같은 이름이 중복되었어요. 동명이인은 이름 뒤에 구분을 붙여 주세요.' });
  const people = persons.length;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateStr))) return json_({ ok: false, message: '날짜 형식이 올바르지 않아요.' });
  const over = Math.max(0, total - getSettings_().limit * people);
  const billed = total - over;

  // 선결제 잔액을 먼저 사용하고, 부족한 청구 차액은 현장결제로 기록해요.
  let paymentMethod = '';
  let prepaidUsed = 0;
  const balance = prepaidBalance_(dept.code);
  if (balance > 0 && billed > 0) {
    prepaidUsed = Math.min(balance, billed);
    deductPrepaid_(dept, prepaidUsed, String(dateStr) + ' 주문 자동차감 (' + menus.join(', ') + ')');
    paymentMethod = '선결제주문';
  }

  setupLog();
  const log = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_LOG);
  const row = log.getLastRow() + 1;
  const rng = log.getRange(row, 1, 1, LOG_COLS);
  rng.setNumberFormats([['@', '@', '@', '@', '#,##0', '@', '0', '@', '#,##0', '@', '@', '@', '@', 'yyyy-mm-dd hh:mm', '@', '@', '#,##0']]);
  const statementAmount = prepaidUsed > 0 ? 0 : billed;
  const onsite = over + (prepaidUsed > 0 ? billed - prepaidUsed : 0);
  rng.setValues([[dept.orgName, dept.name, String(dateStr), menus.join(', '),
    statementAmount, persons.join(', '), people, over > 0 ? '초과' : '', onsite || '',
    dept.orgCode, dept.code, dateFlag_(String(dateStr)), '', new Date(), tag || '', paymentMethod, prepaidUsed || '']]);
  return json_({ ok: true, total: total, over: over, onsite: onsite, prepaidUsed: prepaidUsed,
    balance: prepaidBalance_(dept.code), paymentMethod: paymentMethod });
}

// 사장님이 담당자를 대신해 과거 날짜 주문을 몰아서 입력할 때 씀. PIN·오늘의 번호 없이 사장님 PIN만 확인.
// '사장님 대리입력'으로 표시해도 일자별 매출에는 포함하고, 정산서·정산현황에도 주문 날짜 기준으로 포함해요.
function ownerAddOrder_(b) {
  const chk = checkOwner_(b.pin);
  if (!chk.ok) return json_(chk);
  const dept = readMaster_().filter(d => d.code === b.deptCode)[0];
  if (!dept) return json_({ ok: false, message: '부서를 찾을 수 없어요.' });
  return insertOrderRow_(dept, b.date, b.names, b.items, '사장님 대리입력');
}

// 한 달치 누락분처럼 여러 건을 한 번에 모아서 보낼 때 씀. 요청을 여러 번 왕복하지 않고
// 한 번의 호출 안에서 순서대로 전부 저장해요. 항목마다 성공/실패를 따로 알려줘서,
// 실패한 것만 다시 시도할 수 있어요. (예: 메뉴가 그 사이 바뀐 경우)
function ownerAddOrdersBatch_(b) {
  const chk = checkOwner_(b.pin);
  if (!chk.ok) return json_(chk);
  const dept = readMaster_().filter(d => d.code === b.deptCode)[0];
  if (!dept) return json_({ ok: false, message: '부서를 찾을 수 없어요.' });
  const entries = Array.isArray(b.entries) ? b.entries : [];
  if (!entries.length) return json_({ ok: false, message: '입력할 내용이 없어요.' });
  if (entries.length > 150) return json_({ ok: false, message: '한 번에 최대 150건까지만 넣을 수 있어요. 나눠서 보내 주세요.' });

  const results = [];
  let okCount = 0;
  entries.forEach((e, idx) => {
    let parsed;
    try {
      const out = insertOrderRow_(dept, e.date, e.names, e.items, '사장님 대리입력');
      parsed = JSON.parse(out.getContent());
    } catch (err) {
      parsed = { ok: false, message: '처리 중 오류가 발생했어요.' };
    }
    if (parsed.ok) okCount++;
    results.push({ idx: idx, ok: parsed.ok, message: parsed.message || '', total: parsed.total, over: parsed.over });
  });
  return json_({ ok: true, okCount: okCount, total: entries.length, results: results });
}

// 화면이 보낸 요청마다 붙는 reqId로 "같은 요청을 두 번 처리하지 않기"를 보장해요.
// 네트워크가 불안정해서 응답만 유실되고 화면이 자동으로 한 번 더 보내는 경우, 이게 없으면
// 실제로는 성공한 주문이 시트에 두 번 찍힐 수 있어요. 같은 reqId가 다시 오면 새로 쓰지 않고
// 저번에 만든 결과를 그대로 돌려줘요.
function withIdempotency_(reqId, fn) {
  const cache = CacheService.getScriptCache();
  const key = reqId ? 'req:' + String(reqId).slice(0, 100) : '';
  if (key) {
    const hit = cache.get(key);
    if (hit) return ContentService.createTextOutput(hit).setMimeType(ContentService.MimeType.JSON);
  }
  const result = fn();
  if (key) { try { cache.put(key, result.getContent(), 600); } catch (e) {} }
  return result;
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const b = JSON.parse(e.postData.contents);
    return withIdempotency_(b.reqId, () => {
      if (b.action === 'pack') return packOrder_(b);          // 사장님 화면: 포장 완료 체크
      if (b.action === 'requestEdit') return requestEdit_(b); // 담당자: 날짜·이름 수정 요청
      if (b.action === 'resolveEdit') return resolveEdit_(b); // 사장님: 수정 요청 승인/거부
      if (b.action === 'download') return checkDownload_(b);  // 다운로드 전 서버 확인(승인대기/월 3회 제한)
      if (b.action === 'ownerAdd') return ownerAddOrder_(b);        // 사장님: 과거 날짜 주문 대리 입력
      if (b.action === 'ownerAddBatch') return ownerAddOrdersBatch_(b); // 사장님: 여러 건 한 번에 대리 입력
      if (b.action === 'prepaidDeduct') return prepaidDeductSimple_(b); // 사장님: 선결제 잔액에서 금액만 바로 차감
      if (b.action === 'prepaidDeptDeduct') return prepaidDeductDept_(b);
      if (b.action === 'prepaidCharge') return prepaidChargeOwner_(b);
      if (b.action === 'deptDocsUpload') return uploadDepartmentDocsOwner_(b);
      if (b.action === 'registerDepartment') return registerDepartmentOwner_(b);
      if (b.action === 'deptDocsResend') return resendDepartmentDocsOwner_(b);
      const dept = readMaster_().filter(d => d.code === b.deptCode)[0];
      if (!dept) return json_({ ok: false, message: '부서를 찾을 수 없어요.' });
      const chk = checkPin_(dept, b.pin);
      if (!chk.ok) return json_(chk);
      return insertOrderRow_(dept, b.date, b.names, b.items, '');
    });
  } catch (err) {
    return json_({ ok: false, message: '저장 중 오류가 발생했어요.' });
  } finally {
    lock.releaseLock();
  }
}
