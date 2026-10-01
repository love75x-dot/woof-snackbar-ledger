# HANDOFF.md — 우프스낵바 디지털 식대 장부 시스템

> 이 문서 하나만 읽으면 프로젝트를 처음부터 100% 동일하게 이어받을 수 있도록 작성했습니다.
> 작성일: 2026-10-01 (Asia/Seoul) / 작성 도구: Claude (claude.ai, 이 대화 세션)
> 확실하지 않은 부분은 추측하지 않고 **"확인 필요"**로 명시했습니다.

---

## 1. 프로젝트 개요

### 1-1. 목적
인천 소재 햄버거/스낵 전문점 **"우프스낵바"** 사장님이, 공공기관(인천시청·인천시의회·인천시교육청) 77개 부서 직원들이 매장에서 식사 후 **월 단위로 부서에 청구되는 "식대"를 수기 장부 대신 디지털로 기록·정산**하기 위해 만든 주문/정산 웹앱입니다.

- 기존 방식: 손글씨 장부에 기관/부서/이름/메뉴/금액을 매번 수기로 기록 → 월말 수작업 합산 → 정산서 작성.
- 새 방식: 직원이 매장에서 태블릿/키오스크(또는 본인 휴대폰)로 웹앱에 접속해 본인 이름·메뉴를 직접 입력 → 구글 스프레드시트에 실시간 기록 → 월별 정산서를 워터마크 JPG로 다운로드 가능.

### 1-2. 타깃 사용자
1. **공무원 이용자(직원)**: 회원가입 없음. 소속 기관 → 부서 → (부서 PIN 3자리 + 매장에서 매일 알려주는 회전 숫자 1자리) 조합으로 인증 후 본인 이름을 적어 주문 입력. 별도의 "정산서 PIN"으로 월별 청구 내역 조회·다운로드도 가능.
2. **사장님(매장 운영자, owner)**: 별도 사장님 PIN으로 로그인. 실시간 주문 현황(주방 화면), 일자별 매출 조회, 정산서 수정요청 승인, 주문 대리 입력(배치), 선결제 잔액 차감 처리 등 전용 관리 화면 사용.

### 1-3. 핵심 컨셉
- **회원가입 없는 PIN 기반 접근 제어**: 부서별 고정 PIN(3자리) + 매일 자동으로 바뀌는 회전 숫자(1자리, 매장에서만 구두로 공지) = 4자리 조합. 기관 간, 부서 간 접근을 자연스럽게 분리.
- **정산서 PIN**: 부서 PIN과 별개로, 정산서 조회·다운로드 전용 PIN(설정 시트의 공통값). 부서 PIN을 알아도 정산서 PIN 없이는 금액 내역을 볼 수 없음.
- **1인당 한도 9,000원** (부서가 설정 시트에서 조정 가능), 인원수만큼 풀링(pooled)되어 총한도 = 9,000원 × 인원. 초과분은 매장에서 현장 결제(시스템에는 "초과" 표시만).
- **개인 실명 기록**: "외 3명" 같은 방식 금지, 식사하는 사람 전원의 실명을 각각 기록.
- **정산서 변조 방지**: 다운로드 JPG에 실제 매장 로고 워터마크(반복 패턴, 저투명도) 삽입, 해상도 2K 이상 강제.
- **정산서 수정 워크플로**: 직원이 수정 요청 → 사장님 승인 후에만 반영, 금액은 절대 수정 불가(날짜·이름만), 월 다운로드 3회 제한, 1회라도 다운로드하면 잠김.
- **선결제(충전) 시스템**: 사장님 메뉴의 `선결제 관리`에서 충전과 단체 차감을 선택. 부서 홈의 `선결제`에서도 잔액 확인/단체 차감 가능. 메뉴 주문은 잔액을 먼저 사용하고 부족액은 현장결제하며, 사용액은 주문일 매출에 포함하되 월 정산서에는 중복 청구하지 않음.
- **사장님 대리 입력(백필)**: 누락된 과거 날짜 주문을 사장님이 나중에 입력. 한 달치를 로컬에서 모아(스테이징) 한 번의 배치 요청으로 저장(여러 번 네트워크 왕복 없이).
- **신규 부서 PIN 자동 생성 시 기존 PIN 불변 + 신규 PIN끼리도 중복 없음**을 보장.

### 1-4. 톤앤매너
- 키워드: **햄버거 가게 특유의 따뜻하고 손맛나는(hand-crafted) 다이너(diner) 무드**. 케첩/머스타드 색감, 크래프트 페이퍼 느낌의 베이지 배경.
- 폰트: 제목·숫자류는 둥글고 팝한 "Do Hyeon"(구글 폰트), 본문은 "IBM Plex Sans KR". 시스템 폰트 폴백: `system-ui, -apple-system, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`.
- 라이트/다크 모드 모두 지원 (`prefers-color-scheme` + `data-theme` 속성 강제 전환 모두 대응).
- 컴포넌트는 카드형(`.card`, 둥근 모서리 14px), 하단 고정 합계바(`.bar`), 원형 탭(`.tab`), 촉감있는 버튼(active 시 머스타드색으로 반전).

---

## 2. 기술 스택

| 구분 | 내용 |
|---|---|
| 프런트엔드 | 순수 HTML + Vanilla JavaScript (프레임워크 없음), 단일 파일 SPA. `el()`이라는 자체 DOM 빌더 헬퍼 + 수제 라우터(`render(screenFn)`)로 화면 전환. 빌드 도구·번들러 없음 — 파일 그대로 정적 호스팅. |
| 백엔드 | Google Apps Script (`Code.gs`), 구글 스프레드시트에 바인딩된 웹앱(`doGet`/`doPost`)으로 배포. 실행 계정: 나(소유자), 액세스 권한: 모든 사용자. |
| 데이터 저장소 | Google Sheets (아래 4. 데이터 및 연동 참조) |
| 외부 CDN 스크립트 | `https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js` (정산서를 JPG로 캡처할 때만 **지연 로딩**, 페이지 최초 로드 시에는 불러오지 않음 — 2026-09-25 속도 개선 작업에서 변경됨) |
| 외부 폰트 | Google Fonts: `https://fonts.googleapis.com/css2?family=Do+Hyeon&family=IBM+Plex+Sans+KR:wght@400;500;600&display=swap` (+ `preconnect` to fonts.googleapis.com / fonts.gstatic.com) |
| 정적 호스팅 | Netlify (사이트명: `woofsnackbar`, URL: `https://woofsnackbar.netlify.app/`). **반드시 기존 사이트의 Deploys 탭에서 파일을 드래그해 재배포**해야 함 — Netlify Drop(app.netlify.com/drop)을 다시 쓰면 매번 새 임의 이름의 프로젝트가 생성되므로 사용 금지(과거 실수로 `superlative-longma-336431`이라는 중복 프로젝트가 생성되어 삭제한 이력 있음). |
| 로컬 검증 도구(개발 중 사용, 배포물 아님) | jsdom(HTML/JS 동작 검증), Node.js `Proxy` 기반 GAS 전역객체 스텁 + `new Function()`(Code.gs 문법·순서 오류 검증), WeasyPrint+pdf2image+pypdf(PDF 생성·검증), Playwright/Chromium(실제 화면 스크린샷 캡처) |

### 사용하지 않기로 한 기술 (명시적으로 배제)
- **회원가입/로그인 시스템 (OAuth 등)**: 공무원 이용자에게 계정을 만들게 하고 싶지 않다는 사용자 요구로, PIN 기반 무계정 접근 방식을 채택.
- **SPA 프레임워크(React/Vue 등), 번들러(Webpack/Vite 등)**: 별도 빌드 과정 없이 HTML 파일 하나를 그대로 Netlify에 올리는 단순 배포를 위해 vanilla JS로 유지.
- **외부 DB(Firebase, PostgreSQL 등)**: 사장님이 별도 도구 없이 익숙한 "구글 스프레드시트"를 직접 열어보고 수정할 수 있어야 한다는 요구 때문에 시트를 그대로 DB처럼 사용.

---

## 3. 파일 구조

```
/mnt/user-data/outputs/
├── index.html                          # 프런트엔드 전체 (SPA, 1,066줄, 약 95.7KB)
├── Code.gs                             # 백엔드 전체 (Google Apps Script, 1,088줄, 약 59.4KB)
├── 부서마스터.csv                        # 실제 77개 부서 PIN 목록 (기관명,부서명,PIN) — 스프레드시트 "부서마스터" 탭 초기 데이터용
├── 부서_PIN_안내(직원용).pdf              # 내부 배포용 77개 부서 PIN 안내 인쇄물 (WeasyPrint로 생성)
├── 부서_PIN_안내_및_이용방법.pdf           # 위 PDF + 실제 앱 화면 스크린샷 기반 "이용방법 5단계" 가이드 결합본
└── 식대장부_시트샘플.xlsx                 # 스프레드시트가 어떤 형태로 쌓이는지 보여주는 샘플 워크북 (openpyxl로 생성)
```

### 파일 간 의존 관계
- `index.html`은 `CONFIG.SCRIPT_URL`에 박혀있는 Apps Script 웹앱 배포 URL(`https://script.google.com/macros/s/AKfycbzo1aYFlYVsEnnC7Hj_Nnhes8H_MG5LgXlPa1bDj9lF-5iHcHK61eAfyGSJd5ebI_uDiw/exec`)로 모든 데이터를 `fetch()`합니다. **`SCRIPT_URL`이 빈 문자열이면 자동으로 "체험(demo) 모드"**로 전환되어 서버 없이 내장 샘플 데이터로 동작합니다(`S.demo = !CONFIG.SCRIPT_URL`).
- `Code.gs`는 **구글 스프레드시트 하나에 바인딩(컨테이너 바운드 스크립트)**되어 있으며, 그 시트 안의 탭들(아래 4번 참고)을 직접 읽고 씁니다. `Code.gs` 자체는 다른 파일을 import하지 않는 단일 파일입니다.
- `부서마스터.csv`는 최초 세팅 시 구글 시트의 "부서마스터" 탭에 수동으로 붙여넣기 위한 소스 데이터입니다. (스크립트가 자동으로 읽어들이는 것이 아니라, 사람이 시트에 채워넣는 용도)
- 두 PDF와 xlsx 샘플은 **실행에 필요 없는 참고/배포용 산출물**이며 앱 동작과 무관합니다.
- Netlify에는 **`index.html` 한 파일만** 업로드합니다. `Code.gs`는 Netlify가 아니라 **Google Apps Script 편집기**에 붙여넣고 그쪽에서 배포합니다.

---

## 4. 전체 소스 코드

> 아래는 최종본 원본 그대로입니다 (요약 없음). 최신 소스는 첨부된 zip 파일(`woofsnackbar_source.zip`)의 `index.html`, `Code.gs`를 그대로 사용하세요 — 이 문서에는 동일 내용을 코드 블록으로도 포함합니다.

### 4-1. `index.html`

```html
<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>식대 장부 입력</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Do+Hyeon&family=IBM+Plex+Sans+KR:wght@400;500;600&display=swap" rel="stylesheet">
<style>
:root{
  --bg:#F3EEE3; --paper:#FFFFFF; --ink:#2B2118; --muted:#7A6B5C; --line:#DDD3C2;
  --mustard:#F0B429; --mustard-ink:#2B2118; --ketchup:#C93A26; --ketchup-bg:#FCE9E4; --ok:#2F7D4F; --ok-bg:#E4F3EA;
  box-sizing:border-box; padding-top:env(safe-area-inset-top,0px); padding-bottom:env(safe-area-inset-bottom,0px);
}
@media (prefers-color-scheme: dark){
  :root:not([data-theme="light"]){
    --bg:#1B1611; --paper:#27201A; --ink:#F4ECDF; --muted:#A79886; --line:#41372D;
    --mustard:#F0B429; --mustard-ink:#2B2118; --ketchup:#FF7B67; --ketchup-bg:#3E1F19; --ok:#6CCB93; --ok-bg:#1D3427;
  }
}
:root[data-theme="dark"]{
  --bg:#1B1611; --paper:#27201A; --ink:#F4ECDF; --muted:#A79886; --line:#41372D;
  --mustard:#F0B429; --mustard-ink:#2B2118; --ketchup:#FF7B67; --ketchup-bg:#3E1F19; --ok:#6CCB93; --ok-bg:#1D3427;
}
html{scroll-padding-top:env(safe-area-inset-top,0px);height:100%}
*,*::before,*::after{box-sizing:border-box}
body{margin:0;min-height:100%;background:var(--bg);color:var(--ink);font-family:"IBM Plex Sans KR",system-ui,-apple-system,"Apple SD Gothic Neo","Malgun Gothic",sans-serif;font-size:16px;line-height:1.5}
.wrap{max-width:520px;margin:0 auto;padding:16px 16px 140px}
h1,h2,.num{font-family:"Do Hyeon","IBM Plex Sans KR",system-ui,sans-serif;font-weight:400;letter-spacing:.01em}
h1{font-size:28px;margin:8px 0 2px}
h2{font-size:20px;margin:0 0 10px}
.sub{color:var(--muted);margin:0 0 16px;font-size:14px}
.demo{background:var(--mustard);color:var(--mustard-ink);border-radius:10px;padding:10px 12px;font-size:13px;margin-bottom:14px}
.card{background:var(--paper);border:1.5px solid var(--line);border-radius:14px;padding:16px;margin-bottom:14px}
.orgs{display:grid;gap:10px}
button{font:inherit;color:inherit;cursor:pointer}
button:focus-visible,input:focus-visible{outline:3px solid var(--mustard);outline-offset:2px}
.big{width:100%;text-align:left;background:var(--paper);border:1.5px solid var(--line);border-radius:12px;padding:16px;font-size:18px;font-family:"Do Hyeon",sans-serif}
.big:active{background:var(--mustard)}
input[type=text],input[type=date],input[type=password],input[type=search]{width:100%;font:inherit;font-size:17px;padding:13px 14px;border:1.5px solid var(--line);border-radius:10px;background:var(--bg);color:var(--ink)}
label.f{display:block;font-size:14px;color:var(--muted);margin:12px 0 6px}
.dlist{max-height:46vh;overflow:auto;margin-top:10px;border:1.5px solid var(--line);border-radius:10px}
.dlist button{display:block;width:100%;text-align:left;background:var(--paper);border:0;border-bottom:1px solid var(--line);padding:14px;font-size:16px}
.dlist button:last-child{border-bottom:0}
.dlist button:active{background:var(--mustard)}
.empty{padding:16px;color:var(--muted);font-size:14px}
.back{background:none;border:0;color:var(--muted);padding:6px 0;font-size:14px;margin-bottom:4px}
.badge{display:inline-block;background:var(--mustard);color:var(--mustard-ink);border-radius:999px;padding:3px 12px;font-size:14px;margin-bottom:8px}
.pin{letter-spacing:.6em;text-align:center;font-size:28px !important}
.err{color:var(--ketchup);font-size:14px;min-height:20px;margin-top:8px}
.tabs{display:flex;gap:6px;overflow-x:auto;margin:14px 0 10px;padding-bottom:4px}
.tab{flex:0 0 auto;border:1.5px solid var(--line);background:var(--paper);border-radius:999px;padding:8px 14px;font-size:15px}
.tab[aria-selected=true]{background:var(--ink);color:var(--paper);border-color:var(--ink)}
.menu{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.item{background:var(--paper);border:1.5px solid var(--line);border-radius:12px;padding:12px;text-align:left;min-height:74px;display:flex;flex-direction:column;justify-content:space-between}
.item:active{background:var(--mustard)}
.item .n{font-size:15px;line-height:1.3}
.item .p{font-family:"Do Hyeon",sans-serif;font-size:18px;margin-top:6px}
.item.wide{grid-column:1/-1;flex-direction:row;align-items:center;min-height:56px}
.note{font-size:13px;color:var(--muted);margin:8px 0 0}
.line{display:flex;align-items:center;gap:8px;padding:10px 0;border-bottom:1px dashed var(--line)}
.line:last-child{border-bottom:0}
.line .t{flex:1;font-size:15px}
.line .a{font-family:"Do Hyeon",sans-serif;min-width:64px;text-align:right}
.nm{display:flex;gap:8px;align-items:center}
.nm input{flex:1;min-width:0}
.pm{width:48px;height:48px;flex:0 0 auto;border-radius:10px;border:1.5px solid var(--line);background:var(--mustard);color:var(--mustard-ink);font-size:24px;line-height:1}
.stp{display:flex;align-items:center;gap:2px;border:1.5px solid var(--line);border-radius:10px;padding:3px;background:var(--bg)}
.stp button{width:36px;height:40px;border-radius:8px;border:0;background:var(--paper);font-size:20px;line-height:1}
.stp span{min-width:44px;text-align:center;font-family:"Do Hyeon",sans-serif;font-size:18px}
.avail{margin:10px 0 0;padding:8px 12px;border-radius:10px;background:var(--ok-bg);color:var(--ok);font-size:14px}
.q{display:flex;align-items:center;gap:4px}
.q button{width:32px;height:32px;border-radius:8px;border:1.5px solid var(--line);background:var(--bg);font-size:18px;line-height:1}
.bar{position:fixed;left:0;right:0;bottom:0;background:var(--paper);border-top:1.5px solid var(--line);padding:12px 16px calc(12px + env(safe-area-inset-bottom,0px))}
.bar .in{max-width:520px;margin:0 auto}
.row{display:flex;justify-content:space-between;align-items:baseline}
.total{font-family:"Do Hyeon",sans-serif;font-size:26px}
.warn{background:var(--ketchup-bg);color:var(--ketchup);border:1.5px solid var(--ketchup);border-radius:10px;padding:8px 12px;font-size:14px;margin:8px 0}
.okline{color:var(--ok);font-size:14px}
.go{width:100%;margin-top:8px;background:var(--mustard);color:var(--mustard-ink);border:0;border-radius:12px;padding:15px;font-size:19px;font-family:"Do Hyeon",sans-serif}
.go:disabled{opacity:.4}
.go.red{background:var(--ketchup);color:#fff}
.sec{background:transparent;border:1.5px solid var(--line);width:100%;padding:13px;border-radius:12px;margin-top:8px;font-size:16px}
.overlay{position:fixed;inset:0;background:rgba(0,0,0,.55);display:flex;align-items:flex-end;justify-content:center;z-index:9}
.sheet{background:var(--paper);width:100%;max-width:520px;border-radius:18px 18px 0 0;padding:20px 16px calc(20px + env(safe-area-inset-bottom,0px))}
.hide{display:none !important}
table{width:100%;border-collapse:collapse;font-size:13px}
td,th{border-bottom:1px solid var(--line);padding:6px 4px;text-align:left;white-space:nowrap}
.scroll{overflow-x:auto}
.topbar{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px}
.homebtn{display:flex;align-items:center;gap:6px;background:var(--paper);border:1.5px solid var(--line);border-radius:999px;padding:7px 14px;font-size:14px;color:var(--ink)}
.homebtn:active{background:var(--mustard)}
.brand{font-family:"Do Hyeon",sans-serif;font-size:17px;display:inline-block;border-bottom:3px solid var(--mustard);margin-bottom:8px}
.status{border-radius:10px;padding:10px 12px;margin:0 0 12px;font-size:14px;background:var(--paper);border:1.5px solid var(--line)}
.editline{background:var(--paper);border:1.5px solid var(--line);border-radius:12px;padding:12px;margin-bottom:10px}
.editline .top2{display:flex;justify-content:space-between;color:var(--muted);font-size:13px;margin-bottom:6px}
.editline .ro{font-size:14px;color:var(--muted);margin:2px 0 8px}
.editline input[type=text]{margin-bottom:6px}
.pendingbox{background:var(--mustard);color:var(--mustard-ink);border-radius:12px;padding:12px 14px;margin-bottom:12px;font-size:14px}
.lockbox{background:var(--paper);border:1.5px solid var(--line);border-radius:12px;padding:12px 14px;margin-bottom:12px;font-size:14px;color:var(--muted)}
.batchcard{background:var(--paper);border:1.5px solid var(--line);border-radius:14px;padding:14px;margin-bottom:12px}
.diffline{display:flex;gap:10px;font-size:14px;padding:6px 0;border-bottom:1px dashed var(--line)}
.diffline:last-child{border-bottom:0}
.diffline .old{color:var(--ketchup);text-decoration:line-through;flex:1}
.diffline .new{color:var(--ok);flex:1}
.status.done{background:var(--ok-bg);color:var(--ok);border-color:var(--ok)}
.paper{background:#fff;color:#222;border:1.5px solid #cfc6b6;border-radius:6px;padding:20px 16px;font-family:"IBM Plex Sans KR",system-ui,sans-serif}
.paper h2{font-size:24px;text-align:center;margin:0 0 4px;color:#222}
.paper .meta{text-align:center;font-size:14px;color:#555;margin-bottom:12px}
.paper .org{text-align:center;font-size:19px;font-weight:600;color:#222;margin:2px 0}
.paper table{font-size:14px;table-layout:fixed}
.paper th{background:#f3eee3;color:#222;border:1px solid #cfc6b6;text-align:center;padding:7px 4px}
.paper td{border:1px solid #cfc6b6;padding:7px 6px;white-space:normal;word-break:keep-all;vertical-align:top;color:#222}
.paper td.r{text-align:right;white-space:nowrap}
.paper .sm{display:block;font-size:11px;color:#b3321f}
.paper tr.tot td{font-weight:600;background:#faf6ec}
.paper .foot{margin-top:14px;font-size:12px;color:#555;line-height:1.7}
.paper .sign{display:flex;justify-content:space-between;margin-top:10px;font-size:12px;color:#555}
.wrap.k{max-width:760px}
.kcard{background:var(--paper);border:2px solid var(--line);border-radius:14px;padding:14px;margin-bottom:12px}
.kcard.fresh{border-color:var(--mustard);box-shadow:0 0 0 4px var(--mustard)}
.kcard .top{display:flex;justify-content:space-between;align-items:baseline;gap:8px}
.kcard .time{font-family:"Do Hyeon",sans-serif;font-size:30px}
.kcard .who{font-size:21px;font-weight:600;margin:6px 0}
.kcard .kmenu{font-family:"Do Hyeon",sans-serif;font-size:27px;line-height:1.3}
.chip{display:inline-block;border-radius:999px;padding:3px 12px;font-size:15px;margin:8px 8px 0 0}
.chip.red{background:var(--ketchup-bg);color:var(--ketchup);border:1.5px solid var(--ketchup)}
.kbar{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px}
.kbar button{flex:1;min-width:120px;border:1.5px solid var(--line);background:var(--paper);border-radius:10px;padding:10px;font-size:15px}
.salesbox{background:var(--paper);border:2px solid var(--line);border-radius:14px;padding:16px;margin-bottom:14px}
.salesbox .big2{font-family:"Do Hyeon",sans-serif;font-size:40px;line-height:1.1}
.salesbox .sub2{color:var(--muted);font-size:14px;margin-top:2px}
.daynav{display:flex;align-items:center;justify-content:center;gap:14px;margin-bottom:14px}
.daynav button{width:42px;height:42px;border-radius:10px;border:1.5px solid var(--line);background:var(--paper);font-size:20px}
.daynav .dtxt{font-family:"Do Hyeon",sans-serif;font-size:20px;min-width:150px;text-align:center}
.mtable{width:100%;border-collapse:collapse;margin-top:6px}
.mtable th{font-size:13px;color:var(--muted);text-align:left;padding:6px 4px;border-bottom:1.5px solid var(--line)}
.mtable td{font-size:15px;padding:8px 4px;border-bottom:1px solid var(--line)}
.mtable .pc{display:inline-block;background:var(--mustard);color:var(--mustard-ink);border-radius:999px;font-family:"Do Hyeon",sans-serif;font-size:12px;padding:1px 8px;margin-right:6px;vertical-align:middle}
.mtable td.r{text-align:right;font-family:"Do Hyeon",sans-serif}
.kdigit{display:flex;align-items:center;justify-content:space-between;gap:12px;background:var(--mustard);color:var(--mustard-ink);border-radius:14px;padding:12px 16px;margin-bottom:12px}
.kdigit b{font-family:"Do Hyeon",sans-serif;font-size:64px;line-height:1}
.kstat{font-family:"Do Hyeon",sans-serif;font-size:22px;margin:4px 0}
.item{position:relative}
.item .d{font-size:12px;color:var(--muted);line-height:1.3;margin-top:2px}
.item .medal{position:absolute;top:6px;right:8px;font-size:18px}
.item .hot{position:absolute;top:8px;right:34px;font-size:11px;background:var(--mustard);color:var(--mustard-ink);border-radius:999px;padding:0 7px}
.notice{background:var(--mustard);color:var(--mustard-ink);border-radius:12px;padding:10px 14px;margin-bottom:14px;font-size:14px}
.info{white-space:pre-line;font-size:14px;color:var(--muted);line-height:1.8}
.info b{color:var(--ink);font-weight:600}
.info a{color:inherit}
.pop{display:grid;gap:6px;margin:6px 0 0}
.pop div{display:flex;gap:10px;align-items:center;font-size:16px}
.pop span{font-size:22px}
.agree{display:flex;gap:10px;align-items:flex-start;margin:12px 0;font-size:14px;line-height:1.5}
.agree input{width:22px;height:22px;flex:0 0 auto;margin-top:1px}
.pv h2{margin-top:18px}
.pv p,.pv li{font-size:14px;line-height:1.7;margin:4px 0}
.done-mark{font-family:"Do Hyeon",sans-serif;font-size:56px;color:var(--ok);line-height:1}
</style>
</head>
<body>
<div class="wrap" id="app"></div>
<script>
let _h2cPromise=null;
function loadHtml2Canvas(){
  if(typeof html2canvas!=="undefined")return Promise.resolve();
  if(_h2cPromise)return _h2cPromise;
  _h2cPromise=new Promise((resolve,reject)=>{
    const s=document.createElement("script");
    s.src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
    s.onload=()=>resolve();
    s.onerror=()=>{_h2cPromise=null;reject(new Error("load fail"))};
    document.head.appendChild(s);
  });
  return _h2cPromise;
}
const CONFIG = { SCRIPT_URL: "https://script.google.com/macros/s/AKfycbzo1aYFlYVsEnnC7Hj_Nnhes8H_MG5LgXlPa1bDj9lF-5iHcHK61eAfyGSJd5ebI_uDiw/exec", LIMIT: 9000 };
// 구글 Apps Script는 가끔 순간적으로 응답이 늦거나 실패할 수 있어서, 실패하면 잠깐 기다렸다가 한 번 더 시도해요.
async function apiFetch(url, opts){
  try{ return await fetch(url, opts); }
  catch(e){
    await new Promise(res=>setTimeout(res, 900));
    return await fetch(url, opts);
  }
}
// 저장·다운로드처럼 "한 번만 처리돼야 하는" 요청에 붙이는 고유 번호예요.
// 응답만 유실돼서 자동 재시도가 같은 요청을 또 보내도, 서버가 이 번호로 "이미 처리했다"를 알아채고
// 중복으로 저장하지 않아요.
function newReqId(){return Date.now()+"-"+Math.random().toString(36).slice(2,10)}

// 아래 값은 실제 운영 시 구글 시트 '설정' 탭에서 사장님이 직접 수정합니다. (체험 화면용 기본값)
const DEFAULT_CFG = { appName:"우프스낵바 식대 장부", storeName:"우프스낵바", bizNo:"000-00-00000", owner:"홍사장", phone:"032-000-0000", address:"", limit:9000, hours:"월~토 11:00~20:30 (브레이크타임 15:30~17:00, 라스트오더 20:00)\n일 11:00~15:00 (라스트오더 14:30)", notice:"이번 주 금요일은 매장 사정으로 15시에 마감합니다.", retention:"5년 (예시)", accent:"", textColor:"", account:"국민 123456-78-901234 (우프스낵바)" };
let DATA = {"CITY": {"name": "인천시청", "depts": ["감사관실", "감염병관리과", "건강증진과", "건설심사과", "건축과", "경보통제소", "공보담당관실", "공원조성과", "교육협력담당관실", "군부대이전개발과", "기반지원과", "기획총괄과", "녹지정책과", "대기보전과", "도로과", "도시개발과", "도시계획과", "도시관리과", "도시균형정책과", "디지털보안담당관", "매립지정책과", "보건의료정책과", "보훈정책과", "복지정책과", "부평혁신과", "비상대책과", "사회재난과", "수질하천과", "안전상황실", "안전예방과", "예산", "위생정책과", "인사과", "인천대로개발과", "자치행정과", "재난상황실", "재산담당관실", "재정관리담당관실", "정보지원과", "정보화담당관", "정책기획관", "제물포르네상스개발", "제물포르네상스계획", "주거정비과", "주택정책과", "청년정칙담당관실", "총무과", "특별사법경찰과", "하수과", "혁신기획당당관실", "현안조정과", "홍보기획관", "환경기후정책과", "환경안전과"]}, "COUNCIL": {"name": "인천시의회", "depts": ["건설교통위원회", "문화복지위원회", "산업경제", "소통홍보담당관실", "운영전문위원실", "의사담당관", "의정정책관실", "행정안전위원회", "환경교통위원회"]}, "EDU": {"name": "인천시교육청", "depts": ["세계시민교육과", "노사협력과", "진로진학과", "수능팀", "학교생활교육과", "안전복지과", "정책기획조정관", "융합인재교육과", "중등교육과 고시팀", "중등교육과", "중앙도서관", "초등교육과", "학교마을협력", "체육건강교육과"]}};
// 체험 화면용: 부서 이름 목록에 코드를 붙여요. 실제 운영에서는 시트 '부서마스터'에서 부서 목록을 불러옵니다.
Object.entries(DATA).forEach(([org,o])=>{o.depts=o.depts.map((n,i)=>({code:org+"-"+String(i+1).padStart(3,"0"),name:n}))});
// 실제 운영 시 메뉴는 구글 시트 '메뉴판' 탭에서 사장님이 수정합니다. (체험 화면용 기본 메뉴)
const B=["치즈버거","불고기버거","스낵버거","머쉬룸버거","쉬림프버거","PBJ버거","텐더버거"];
const DEFAULT_MENU=[].concat(
  B.map(b=>["세트",b+" 세트",9000,"버거+음료 · "+({"치즈버거":"체다치즈가 듬뿍","불고기버거":"달콤짭짤한 불고기 패티","스낵버거":"가볍게 먹기 좋은 작은 버거","머쉬룸버거":"구운 버섯 소스","쉬림프버거":"통새우 패티","PBJ버거":"땅콩버터+잼의 달콤함","텐더버거":"바삭한 치킨 텐더"})[b]]),
  B.map(b=>["버거 단품",b+" 단품",8400,""]),
  [["사이드 세트","버팔로윙(7개) 세트",9000,"사이드+음료"],["사이드 세트","텐더치킨(8조각) 세트",9000,"사이드+음료"],
   ["사이드","버팔로윙(7개)",8000,""],["사이드","어니언링(10개)",7000,""],["사이드","텐더치킨(5조각)",6000,""],
   ["사이드","감자튀김",5000,""],["사이드","콘샐러드",2500,""],["사이드","음료 추가",1000,"사이드에 음료를 붙일 때"]]);
let MENU=[], TABS=[];
function setMenu(rows){
  MENU=rows.map(([tab,name,price,sub])=>({id:name,tab,name,sub:sub||"",price:Number(price)}));
  TABS=[...new Set(MENU.map(m=>m.tab))].map(k=>[k,k]);
}
setMenu(DEFAULT_MENU);
function limitNow(){return CONFIG.LIMIT*S.people}
const won = n => n.toLocaleString("ko-KR")+"원";
const $ = (s,r=document)=>r.querySelector(s);
const el = (tag,attrs={},...kids)=>{const e=document.createElement(tag);for(const[k,v]of Object.entries(attrs)){if(k==="class")e.className=v;else if(k.startsWith("on"))e.addEventListener(k.slice(2),v);else if(v===false||v===null||v===undefined)continue;else if(v===true)e.setAttribute(k,"");else e.setAttribute(k,v)}kids.flat().forEach(c=>e.append(c instanceof Node?c:document.createTextNode(c)));return e};

const params = new URLSearchParams(location.search);
const ED={pendingBatches:[]};
const S = { spin:"", demoStmtCache:{}, demoDownloads:{}, popular:["치즈버거 세트","불고기버거 세트","버팔로윙(7개) 세트"], from:null, names:[""], get people(){return this.names.length}, cfg:Object.assign({},DEFAULT_CFG), org:null, dept:null, pin:"", tab:"set", cart:{}, sheetRows:[], demo:!CONFIG.SCRIPT_URL };

function demoSpin(){const d=new Date();return String(d.getFullYear()).slice(2)+String(d.getMonth()+1).padStart(2,"0")}
function demoDigit(){const d=new Date();return String((d.getDate()*7+d.getMonth()+3)%10)}
function isHex(v){return /^#[0-9a-fA-F]{6}$/.test(String(v||"").trim())}
function today(){const d=new Date();return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0")}
function deptsOf(org){return DATA[org].depts}
function items(){return Object.entries(S.cart).filter(([,q])=>q>0).map(([id,q])=>{const m=MENU.find(x=>x.id===id);return{id,name:m.name,price:m.price,qty:q}})}
function total(){return items().reduce((s,i)=>s+i.price*i.qty,0)}

function noticeEl(){return S.cfg.notice?el("div",{class:"notice"},"📢 "+S.cfg.notice):""}
function storeCard(){
  const c=S.cfg,rows=[];const style=isHex(c.textColor)?("color:"+c.textColor.trim()):"";
  if(c.storeName)rows.push(["매장",c.storeName]);
  if(c.hours)rows.push(["영업시간",c.hours]);
  if(c.phone)rows.push(["전화",c.phone]);
  if(c.address)rows.push(["주소",c.address]);
  if(!rows.length)return "";
  const d=el("div",{class:"info",style});
  rows.forEach(([k,v],i)=>{if(i)d.append(el("br"));d.append(el("b",{},k+" "),v)});
  return el("div",{class:"card",style:"margin-top:14px"},el("h2",{style:"font-size:17px"},"매장 정보"),d);
}
function popularCard(){
  if(!S.popular.length)return "";
  const m=["🥇","🥈","🥉"],c=el("div",{class:"card"},el("h2",{style:"font-size:17px"},"지난주 인기 메뉴 TOP "+Math.min(3,S.popular.length)));
  const p=el("div",{class:"pop"});S.popular.slice(0,3).forEach((n,i)=>p.append(el("div",{},el("span",{},m[i]),n)));
  c.append(p);return c;
}
function goHome(){
  clearInterval(K.timer);
  S.org=null;S.dept=null;S.pin="";S.spin="";S.cart={};S.names=[""];S.who="";S.month=null;
  render(pickOrg);
}
function render(screen){
  clearInterval(K.timer); const app=$("#app"); app.replaceChildren(); app.className="wrap";
  if(S.demo) app.append(el("div",{class:"demo"},"체험 화면입니다. 실제 시트에는 저장되지 않아요. 입력할 4자리는 부서 PIN 123 + 오늘의 번호 "+demoDigit()+" = 123"+demoDigit()+" 입니다. (실제 오늘의 번호는 매장에서만 알려 줘요) 정산서 PIN은 "+demoSpin()+" (년월 4자리 예시)입니다."));
  const bar=el("div",{class:"topbar"},el("div",{class:"brand"},S.cfg.appName));
  if(screen!==pickOrg&&screen!==kitchenLogin&&screen!==kitchenScreen&&screen!==ownerHome&&screen!==salesScreen&&screen!==editApprovalScreen&&screen!==obOrgScreen&&screen!==obDeptScreen&&screen!==obBuilder&&screen!==pdOrgScreen&&screen!==pdDeptScreen&&screen!==pdBuilder)
    bar.append(el("button",{class:"homebtn",onclick:goHome},"\u2302 \uCC98\uC74C\uC73C\uB85C"));
  app.append(bar);
  screen(app);
  if(screen!==kitchenLogin&&screen!==kitchenScreen&&screen!==ownerHome&&screen!==salesScreen&&screen!==editApprovalScreen&&screen!==obOrgScreen&&screen!==obDeptScreen&&screen!==obBuilder&&screen!==pdOrgScreen&&screen!==pdDeptScreen&&screen!==pdBuilder&&screen!==privacyScreen)
    app.append(el("button",{class:"back",style:"margin-top:26px;text-decoration:underline",onclick:()=>{S.from=screen;render(privacyScreen)}},"개인정보 처리방침"));
}
function pickOrg(app){
  app.append(noticeEl(), el("h1",{},"기관 선택"), el("p",{class:"sub"},"소속 기관을 선택하세요"));
  const g=el("div",{class:"orgs"});
  Object.entries(DATA).forEach(([code,o])=>g.append(el("button",{class:"big",onclick:()=>{S.org=code;render(pickDept)}},o.name)));
  app.append(g, storeCard());
  if(S.demo)app.append(el("button",{class:"sec",style:"margin-top:22px",onclick:()=>render(kitchenLogin)},"사장님 주문 확인 화면 보기 (체험)"));
}
function pickDept(app){
  if(!S.org) return render(pickOrg);
  app.append(noticeEl(), el("h1",{},DATA[S.org].name), el("p",{class:"sub"},"부서를 검색해서 선택하세요"));
  const inp=el("input",{type:"search",placeholder:"예: 인사, 총무",autocomplete:"off","aria-label":"부서 검색"});
  const list=el("div",{class:"dlist"});
  const draw=()=>{list.replaceChildren();const q=inp.value.trim();const r=deptsOf(S.org).filter(d=>d.name.includes(q));
    if(!r.length)list.append(el("div",{class:"empty"},"검색 결과가 없어요. 부서명이 맞는지 확인해 주세요."));
    r.forEach(d=>list.append(el("button",{onclick:()=>{S.dept=d;S.pin="";render(pinScreen)}},d.name)))};
  inp.addEventListener("input",draw); app.append(el("div",{class:"card"},inp,list), storeCard()); draw();
}
function pinScreen(app){
  app.append(el("button",{class:"back",onclick:()=>render(pickDept)},"‹ 부서 다시 선택"));
  app.append(el("span",{class:"badge"},DATA[S.org].name+" "+S.dept.name), el("h2",{},"부서 PIN 3자리 + 오늘의 번호 1자리"), el("p",{class:"sub"},"매장에서 알려 주는 오늘의 번호를 부서 PIN 뒤에 붙여 4자리로 입력하세요. (예: 부서 PIN 123, 오늘의 번호 8 → 1238)"));
  const inp=el("input",{type:"password",inputmode:"numeric",maxlength:"4",class:"pin",autocomplete:"off","aria-label":"PIN"});
  const err=el("div",{class:"err"});
  inp.addEventListener("input",async()=>{
    inp.value=inp.value.replace(/\D/g,""); err.textContent="";
    if(inp.value.length<4)return;
    const ok=await verifyPin(inp.value,err);
    if(ok){S.pin=inp.value;S.cart={};S.names=[""];S.tab=TABS[0][0];render(homeScreen)} else {inp.value=""}
  });
  app.append(el("div",{class:"card"},inp,err)); setTimeout(()=>inp.focus(),50);
}
async function verifyPin(pin,err){
  if(S.demo){ if(pin==="123"+demoDigit())return true; err.textContent="PIN 또는 오늘의 번호가 맞지 않아요. 매장에서 알려 주는 오늘의 번호를 확인해 주세요."; return false }
  try{
    const r=await apiFetch(CONFIG.SCRIPT_URL+"?action=verify&dept="+encodeURIComponent(S.dept.code)+"&pin="+pin);
    const j=await r.json(); if(j.ok)return true; err.textContent=j.message||"PIN 또는 오늘의 번호가 맞지 않아요."; return false;
  }catch(e){err.textContent="연결에 실패했어요. 잠시 후 다시 시도해 주세요."; return false}
}
function homeScreen(app){
  app.append(el("button",{class:"back",onclick:()=>render(pickDept)},"‹ 부서 다시 선택"));
  app.append(el("span",{class:"badge"},DATA[S.org].name+" "+S.dept.name), noticeEl(), el("h1",{},"무엇을 할까요?"));
  app.append(popularCard());
  const g=el("div",{class:"orgs"});
  g.append(el("button",{class:"big",onclick:()=>{S.cart={};S.names=[""];S.tab=TABS[0][0];render(orderScreen)}},"주문 입력"),
    el("button",{class:"big",onclick:()=>{S.spin="";render(spinScreen)}},"정산서 보기 · 다운로드"));
  app.append(g, storeCard());
}
function orderScreen(app){
  app.append(el("button",{class:"back",onclick:()=>render(homeScreen)},"‹ 처음으로"));
  app.append(el("span",{class:"badge"},DATA[S.org].name+" "+S.dept.name), el("h1",{},"주문 입력"));
  app.append(el("div",{class:"card"},el("label",{class:"f",for:"date",style:"margin-top:0"},"① 날짜"), el("input",{type:"date",id:"date",value:S.date||today(),oninput:dateNote}),el("div",{class:"warn hide",id:"dnote",style:"margin-bottom:0"},"오늘이 아닌 날짜예요. 날짜가 맞는지 확인해 주세요. 입력한 시각은 장부에 함께 기록됩니다.")));
  setTimeout(dateNote,0);
  const p=S.people;
  const nc=el("div",{class:"card"},el("label",{class:"f",style:"margin:0 0 6px"},"② 이름 (드시는 분 한 명 한 명 모두 입력)"));
  S.names.forEach((n,i)=>{
    const row=el("div",{class:"nm",style:i?"margin-top:8px":""},
      el("input",{type:"text",class:"pname",placeholder:i?"이름 "+(i+1):"이름 1 (대표 작성자)",value:n,autocomplete:"off","aria-label":"이름 "+(i+1)}),
      i===0?el("button",{class:"pm",onclick:()=>addPerson(),"aria-label":"인원 추가"},"+"):el("button",{class:"pm",onclick:()=>removePerson(i),"aria-label":"인원 삭제"},"−"));
    nc.append(row);
  });
  nc.append(el("div",{class:"note",style:"margin:8px 0 0"},"입력한 이름·소속은 식대 정산 목적으로만 사용됩니다."));
  nc.append(el("div",{class:"avail"},"사용 가능 금액 "+won(limitNow())+(p>1?" ("+p+"명 × "+won(CONFIG.LIMIT)+")":"")));
  app.append(nc);
  app.append(el("h2",{style:"margin-top:4px"},"③ 메뉴"));
  const tabs=el("div",{class:"tabs",role:"tablist",style:"margin-top:0"});
  TABS.forEach(([k,n])=>tabs.append(el("button",{class:"tab",role:"tab","aria-selected":String(S.tab===k),onclick:()=>{sync();S.tab=k;render(orderScreen)}},n)));
  app.append(tabs);
  const g=el("div",{class:"menu"});
  MENU.filter(m=>m.tab===S.tab).forEach(m=>g.append(el("button",{class:"item",onclick:()=>add(m.id)},el("span",{class:"n"},m.name),m.sub?el("span",{class:"d"},m.sub):"",el("span",{class:"p"},won(m.price)),(()=>{const i=S.popular.indexOf(m.name);return i>=0&&i<3?el("span",{class:"medal",title:"지난주 인기 "+(i+1)+"위"},["🥇","🥈","🥉"][i]):""})())));
  app.append(g);
  const cart=el("div",{class:"card",style:"margin-top:14px"},el("h2",{},"④ 담은 메뉴 · 금액"));
  const its=items();
  if(!its.length)cart.append(el("div",{class:"empty",style:"padding:6px 0"},"메뉴를 눌러 담아 주세요."));
  its.forEach(i=>cart.append(el("div",{class:"line"},el("span",{class:"t"},i.name),
    el("span",{class:"q"},el("button",{"aria-label":"줄이기",onclick:()=>add(i.id,-1)},"−"),el("span",{style:"min-width:20px;text-align:center"},String(i.qty)),el("button",{"aria-label":"늘리기",onclick:()=>add(i.id,1)},"+")),
    el("span",{class:"a"},won(i.price*i.qty)))));
  app.append(cart);
  const t=total(), over=Math.max(0,t-limitNow());
  const bar=el("div",{class:"bar"});const inn=el("div",{class:"in"});
  inn.append(el("div",{class:"row"},el("span",{},"합계 (한도 "+won(limitNow())+")"),el("span",{class:"total"},won(t))));
  if(over>0)inn.append(el("div",{class:"warn",role:"alert"},"한도를 "+won(over)+" 초과했어요. 초과분은 매장에서 직접 결제해 주세요."));
  else if(t>0)inn.append(el("div",{class:"okline"},"한도 안에서 주문했어요"));
  const go=el("button",{class:"go"+(over>0?" red":""),onclick:()=>tryConfirm()},over>0?"초과 확인 후 입력":"확인");
  go.disabled=t===0; inn.append(go); bar.append(inn); app.append(bar);
}
function syncSafe(){try{sync()}catch(e){}}
function sync(){
  const d=$("#date"); if(d)S.date=d.value;
  const n=[...document.querySelectorAll(".pname")]; if(n.length)S.names=n.map(i=>i.value);
}
function dateNote(){const d=$("#date"),n=$("#dnote");if(d&&n)n.classList.toggle("hide",!d.value||d.value===today())}
function addPerson(){sync();if(S.names.length>=30)return;S.names.push("");const y=scrollY;render(orderScreen);scrollTo(0,y);
  const ins=document.querySelectorAll(".pname");ins[ins.length-1].focus()}
function removePerson(i){sync();S.names.splice(i,1);const y=scrollY;render(orderScreen);scrollTo(0,y)}
function add(id,d=1){
  sync();
  S.cart[id]=Math.max(0,(S.cart[id]||0)+d); const y=scrollY; render(orderScreen); scrollTo(0,y);
}
function tryConfirm(){
  sync(); S.names=S.names.map(n=>n.trim());
  const ins=[...document.querySelectorAll(".pname")];
  const empty=S.names.findIndex(n=>!n);
  if(empty>=0){alert("이름을 모두 입력해 주세요. ("+(empty+1)+"번째 이름이 비어 있어요)");ins[empty].focus();return}
  const dup=S.names.find((n,i)=>S.names.indexOf(n)!==i);
  if(dup){alert("같은 이름 "+dup+"이(가) 두 번 입력됐어요. 동명이인이면 이름 뒤에 구분(예: 홍길동A)을 붙여 주세요.");return}
  if(!S.date){alert("날짜를 선택해 주세요.");return}
  const t=total(),over=Math.max(0,t-limitNow());
  const ov=el("div",{class:"overlay"});const sh=el("div",{class:"sheet"});
  sh.append(el("h2",{},"이렇게 입력할까요?"),
    el("p",{style:"margin:0 0 8px"},DATA[S.org].name+" "+S.dept.name+" · "+S.names.join(", ")+" · "+S.date));
  items().forEach(i=>sh.append(el("div",{class:"line"},el("span",{class:"t"},i.name+" × "+i.qty),el("span",{class:"a"},won(i.price*i.qty)))));
  sh.append(el("div",{class:"row",style:"margin-top:10px"},el("span",{},"합계"),el("span",{class:"total"},won(t))));
  if(over>0)sh.append(el("div",{class:"warn"},"한도 초과 "+won(over)+" · 초과분은 매장에서 직접 결제"));
  const ok=el("button",{class:"go"+(over>0?" red":""),onclick:async()=>{ok.disabled=true;ok.textContent="저장 중…";await submit(t,over,ov,sh)}},"입력하기");
  ok.disabled=true;
  const cb=el("input",{type:"checkbox",id:"agree","aria-label":"개인정보 수집·이용 확인"});cb.addEventListener("change",()=>{ok.disabled=!cb.checked});
  sh.append(el("label",{class:"agree",for:"agree"},cb,el("span",{},"입력한 이름·소속(기관·부서)을 식대 정산 목적으로 수집·이용하며 "+(S.cfg.retention||"○년")+"간 보관하는 것을 확인했습니다. 동의하지 않으면 장부 입력이 어려울 수 있어요. ",
    el("a",{href:"#",style:"color:inherit",onclick:e=>{e.preventDefault();ov.remove();S.from=orderScreen;syncSafe();render(privacyScreen)}},"처리방침 보기"))));
  sh.append(ok, el("button",{class:"sec",onclick:()=>ov.remove()},"돌아가서 수정"));
  ov.append(sh); document.body.append(ov);
}
async function submit(t,over,ov,sh){
  const payload={org:S.org,orgName:DATA[S.org].name,deptCode:S.dept.code,deptName:S.dept.name,pin:S.pin,date:S.date,names:S.names,people:S.people,items:items(),total:t,over:over,reqId:newReqId()};
  let ok=true,msg="";
  if(S.demo){ S.sheetRows.push(payload) }
  else{
    try{const r=await apiFetch(CONFIG.SCRIPT_URL,{method:"POST",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify(payload)});
      const j=await r.json(); ok=!!j.ok; msg=j.message||""}catch(e){ok=false;msg="연결에 실패했어요. 입력이 저장되지 않았으니 다시 시도해 주세요."}
  }
  ov.remove();
  if(!ok){alert(msg||"저장에 실패했어요.");return}
  render(doneScreen);
}
function doneScreen(app){
  const last=S.demo?S.sheetRows[S.sheetRows.length-1]:null;
  app.append(el("div",{class:"card",style:"text-align:center"},el("div",{class:"done-mark"},"입력 완료"),
    el("p",{},S.names.join(", ")+" · "+S.date+" · "+won(total()))));
  if(total()>limitNow())app.append(el("div",{class:"warn"},"한도 초과분 "+won(total()-limitNow())+"은 매장에서 직접 결제해 주세요."));
  app.append(el("button",{class:"go",onclick:()=>{S.cart={};S.names=[""];render(orderScreen)}},"다음 사람 입력"),
    el("button",{class:"sec",onclick:()=>render(homeScreen)},"처음으로"),
    el("button",{class:"sec",onclick:()=>{S.cart={};S.names=[""];S.dept=null;render(pickDept)}},"다른 부서로 입력"));
  if(S.demo){
    const tb=el("table",{});tb.append(el("tr",{},...["기관","부서","날짜","이름","메뉴","합계","초과"].map(h=>el("th",{},h))));
    S.sheetRows.forEach(r=>tb.append(el("tr",{},el("td",{},r.orgName),el("td",{},r.deptName),el("td",{},r.date),el("td",{},r.names.join(", ")),el("td",{},r.items.map(i=>i.name+"×"+i.qty).join(", ")),el("td",{},won(r.total)),el("td",{style:r.over?"color:var(--ketchup)":""},r.over?won(r.over):"-"))));
    app.append(el("div",{class:"card",style:"margin-top:16px"},el("h2",{},"사장님 시트에는 이렇게 쌓여요"),el("div",{class:"scroll"},tb)));
  }
}

function monthKey(offset){const d=new Date();d.setDate(1);d.setMonth(d.getMonth()+offset);return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")}
function monthLabel(m){return m.slice(0,4)+"년 "+Number(m.slice(5))+"월"}
function md(d){return Number(d.slice(5,7))+"/"+Number(d.slice(8,10))}
async function loadStatement(month){
  const cacheKey=S.dept.code+"|"+month;
  if(S.demo){
    if(!S.demoStmtCache[cacheKey]){
      const [y,m]=month.split("-");
      const sample=month===monthKey(-1)?[
        [3,"텐더버거 세트","홍길동",9000,0,1],[5,"불고기버거 세트","김영희",9000,0,1],[10,"버팔로윙(7개) 세트","박철수",9000,0,1],
        [12,"텐더치킨(8조각) 세트","이수진",9000,0,1],[17,"치즈버거 세트×3","홍길동, 김영희, 박철수",27000,0,3],[24,"쉬림프버거 세트","최민호",9000,0,1]
      ].map(([d,menu,name,amount,over,people])=>({date:y+"-"+m+"-"+String(d).padStart(2,"0"),menu,name,amount,over,people})):[];
      const mine=S.sheetRows.filter(r=>r.deptCode===S.dept.code&&r.date.startsWith(month)).map(r=>({date:r.date,menu:r.items.map(i=>i.qty>1?i.name+"×"+i.qty:i.name).join(", "),name:r.names.join(", "),amount:Math.min(r.total,CONFIG.LIMIT*r.people),over:r.over,people:r.people}));
      const rows=sample.concat(mine).sort((a,b)=>a.date.localeCompare(b.date));
      rows.forEach((r,i)=>{r.row=i;r.key=i;});
      S.demoStmtCache[cacheKey]=rows;
    }
    const rows=S.demoStmtCache[cacheKey];
    const pending=ED.pendingBatches.some(b=>b.deptCode===S.dept.code&&b.month===month);
    const downloads=S.demoDownloads[cacheKey]||0;
    const editStatus={locked:downloads>0,pending,downloadsLeft:Math.max(0,3-downloads)};
    return {rows,settle:month===monthKey(-1)?{done:false,receiptDate:monthKey(0)+"-08",paidDate:""}:null,editStatus};
  }
  const r=await apiFetch(CONFIG.SCRIPT_URL+"?action=statement&dept="+encodeURIComponent(S.dept.code)+"&pin="+S.pin+"&spin="+S.spin+"&month="+month);
  const j=await r.json(); if(!j.ok)throw new Error(j.message||"불러오지 못했어요."); return {rows:j.rows,settle:j.settle,editStatus:j.editStatus||{locked:false,pending:false,downloadsLeft:3}};
}
const WM_LOGO = "data:image/jpeg;base64,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";
function watermarkNode(){
  return el("div",{style:"position:absolute;inset:-30%;z-index:0;background-image:url('"+WM_LOGO+"');background-repeat:repeat;background-size:120px auto;opacity:0.13;transform:rotate(-14deg);pointer-events:none;filter:grayscale(35%)"});
}
function paperEl(rows,month){
  const sum=rows.reduce((s,r)=>s+r.amount,0);
  const content=el("div",{style:"position:relative;z-index:1"},
    el("h2",{},"식대 정산서"),
    el("div",{class:"org"},DATA[S.org].name+" "+S.dept.name),
    el("div",{class:"meta"},"정산월 "+monthLabel(month)));
  const p=el("div",{class:"paper",id:"paper",style:"position:relative;overflow:hidden;background-color:#fff"},
    watermarkNode(), content);
  const tb=el("table",{});
  const cg=el("colgroup",{});["16%","46%","20%","18%"].forEach(w=>cg.append(el("col",{style:"width:"+w})));tb.append(cg);
  tb.append(el("tr",{},...["날짜","메뉴","금액","이름"].map(h=>el("th",{},h))));
  rows.forEach(r=>tb.append(el("tr",{},el("td",{style:"text-align:center"},md(r.date)),
    el("td",{},r.menu),
    el("td",{class:"r"},r.amount.toLocaleString("ko-KR")),el("td",{style:"text-align:center"},r.name))));
  tb.append(el("tr",{class:"tot"},el("td",{colspan:"2",style:"text-align:center"},"합계 ("+rows.length+"건)"),el("td",{class:"r"},sum.toLocaleString("ko-KR")),el("td",{},"")));
  content.append(tb);
  const d=new Date(), c=S.cfg, blank="__________";
  const foot=el("div",{class:"foot"},"청구금액 "+won(sum)+(c.account?"("+c.account+")":""),el("br"),
    "매장: "+(c.storeName||blank)+"  사업자번호: "+(c.bizNo||blank));
  if(c.owner||c.phone){foot.append(el("br"),"대표자: "+(c.owner||blank)+"  연락처: "+(c.phone||blank))}
  foot.append(el("br"),"발행일: "+d.getFullYear()+"."+(d.getMonth()+1)+"."+d.getDate());
  content.append(foot);
  return p;
}
function spinScreen(app){
  app.append(el("button",{class:"back",onclick:()=>render(homeScreen)},"‹ 처음으로"));
  app.append(el("span",{class:"badge"},DATA[S.org].name+" "+S.dept.name), el("h2",{},"정산서 PIN 4자리"),
    el("p",{class:"sub"},"정산서는 부서 담당자만 볼 수 있어요. 매장에서 받은 4자리 번호를 입력하세요."));
  const inp=el("input",{type:"password",inputmode:"numeric",maxlength:"4",class:"pin",autocomplete:"off","aria-label":"정산서 PIN"});
  const err=el("div",{class:"err"});
  inp.addEventListener("input",async()=>{
    inp.value=inp.value.replace(/\D/g,"");err.textContent="";if(inp.value.length<4)return;
    const v=inp.value;let ok=false;
    if(S.demo){ok=v===demoSpin();if(!ok)err.textContent="정산서 PIN이 맞지 않아요."}
    else{try{const r=await apiFetch(CONFIG.SCRIPT_URL+"?action=verifyspin&dept="+encodeURIComponent(S.dept.code)+"&pin="+S.pin+"&spin="+v);
      const j=await r.json();ok=!!j.ok;if(!ok)err.textContent=j.message||"정산서 PIN이 맞지 않아요."}catch(e){err.textContent="연결에 실패했어요. 잠시 후 다시 시도해 주세요."}}
    if(ok){S.spin=v;S.month=monthKey(-1);render(statementScreen)}else inp.value="";
  });
  app.append(el("div",{class:"card"},inp,err)); setTimeout(()=>inp.focus(),50);
}
function statementScreen(app){
  app.append(el("button",{class:"back",onclick:()=>{S.spin="";render(homeScreen)}},"‹ 처음으로"));
  app.append(el("span",{class:"badge"},DATA[S.org].name+" "+S.dept.name), el("h1",{},"정산서"));
  const tabs=el("div",{class:"tabs",style:"margin-top:0"});
  [[-1,"지난달"],[0,"이번달"]].forEach(([o,n])=>tabs.append(el("button",{class:"tab","aria-selected":String(S.month===monthKey(o)),onclick:()=>{S.month=monthKey(o);render(statementScreen)}},n+" ("+monthLabel(monthKey(o))+")")));
  app.append(tabs);
  const box=el("div",{},el("div",{class:"empty"},"불러오는 중…")); app.append(box);
  const month=S.month;
  loadStatement(month).then(({rows,settle,editStatus})=>{
    box.replaceChildren();
    if(!rows.length){box.append(el("div",{class:"card"},el("div",{class:"empty"},monthLabel(month)+" 이용 내역이 없어요.")));return}
    S.lastStatement={rows,month,editStatus};
    box.append(statusEl(settle));
    if(editStatus.pending){
      box.append(el("div",{class:"pendingbox"},"✋ 수정 요청을 매장이 확인하고 있어요. 승인되면 이 정산서를 다시 열 수 있어요. 승인 전까지는 수정과 다운로드가 모두 막혀 있어요."));
    }else if(editStatus.locked){
      box.append(el("div",{class:"lockbox"},"이 정산서는 이미 다운로드되어 더 이상 수정할 수 없어요. 고칠 내용이 있으면 매장에 문의해 주세요."));
    }
    box.append(paperEl(rows,month));
    if(!editStatus.pending&&!editStatus.locked){
      box.append(el("button",{class:"sec",style:"margin-top:10px",onclick:()=>render(editStatementScreen)},"날짜·이름 수정하기"));
    }
    const dlWrap=el("div",{style:"margin-top:10px"});
    if(editStatus.pending){
      dlWrap.append(el("button",{class:"go",disabled:true},"승인 대기 중 · 다운로드 불가"));
    }else if(editStatus.downloadsLeft<=0){
      dlWrap.append(el("button",{class:"go",disabled:true},"이번 달 다운로드 3회를 모두 사용했어요"));
    }else{
      dlWrap.append(el("button",{class:"go",onclick:()=>saveJpg(month)},"JPG로 저장 (이번 달 남은 횟수 "+editStatus.downloadsLeft+"회)"));
    }
    box.append(dlWrap, el("p",{class:"note"},"이 화면을 직접 캡처해도 됩니다. 이 정산서와 지출증빙 영수증을 함께 제출하세요."));
  }).catch(e=>{box.replaceChildren(el("div",{class:"card"},el("div",{class:"err"},e.message||"연결에 실패했어요. 잠시 후 다시 시도해 주세요.")))});
}
function editStatementScreen(app){
  const {rows,month}=S.lastStatement||{};
  app.append(el("button",{class:"back",onclick:()=>render(statementScreen)},"‹ 정산서로 돌아가기"));
  app.append(el("span",{class:"badge"},DATA[S.org].name+" "+S.dept.name), el("h1",{},"날짜·이름 수정"),
    el("p",{class:"sub"},"금액은 바꿀 수 없어요. 날짜와 이름만 고친 뒤 요청하면 매장의 승인 후에 반영돼요."));
  if(!rows||!rows.length){app.append(el("div",{class:"card"},el("div",{class:"empty"},"수정할 내역이 없어요.")));return}
  const inputs=[];
  const list=el("div",{});
  rows.forEach(r=>{
    const names=r.name.split(", ");
    const nameInputs=names.map((n,i)=>el("input",{type:"text",value:n,autocomplete:"off","aria-label":"이름 "+(i+1)}));
    const dateInp=el("input",{type:"date",value:r.date});
    const box=el("div",{class:"editline"},
      el("div",{class:"top2"},el("span",{},r.menu),el("span",{},won(r.amount))),
      dateInp);
    nameInputs.forEach(inp=>box.append(inp));
    list.append(box);
    inputs.push({row:r.row,key:r.key,dateInp,nameInputs});
  });
  app.append(list);
  const err=el("div",{class:"err"});
  const go=el("button",{class:"go",style:"margin-top:6px"},"수정 완료 (승인 요청)");
  go.addEventListener("click",async()=>{
    err.textContent="";
    const edits=[];
    for(const it of inputs){
      const d=it.dateInp.value;
      if(!d){err.textContent="날짜를 모두 채워 주세요.";return}
      const names=it.nameInputs.map(i=>i.value.trim());
      if(names.some(n=>!n)){err.textContent="이름을 모두 채워 주세요.";return}
      if(new Set(names).size!==names.length){err.textContent="같은 이름이 중복됐어요. 동명이인이면 구분을 붙여 주세요.";return}
      edits.push({row:it.row,key:it.key,date:d,names});
    }
    go.disabled=true;go.textContent="요청 중…";
    const res=await submitEditRequest(month,edits);
    go.disabled=false;go.textContent="수정 완료 (승인 요청)";
    if(!res.ok){err.textContent=res.message||"요청에 실패했어요.";return}
    render(statementScreen);
  });
  app.append(go,err,el("button",{class:"sec",onclick:()=>render(statementScreen)},"취소"));
}
async function submitEditRequest(month,edits){
  if(S.demo){
    ED.pendingBatches.push({month,org:DATA[S.org].name,dept:S.dept.name,deptCode:S.dept.code,items:edits.map(e=>{
      const cache=S.demoStmtCache[S.dept.code+"|"+month];
      const row=cache.find(r=>r.row===e.row);
      return {row:e.row,key:e.key,oldDate:row.date,oldNames:row.name,newDate:e.date,newNames:e.names};
    })});
    return {ok:true};
  }
  try{
    const r=await apiFetch(CONFIG.SCRIPT_URL,{method:"POST",headers:{"Content-Type":"text/plain;charset=utf-8"},
      body:JSON.stringify({action:"requestEdit",deptCode:S.dept.code,pin:S.pin,spin:S.spin,month,edits,reqId:newReqId()})});
    return await r.json();
  }catch(e){return {ok:false,message:"연결에 실패했어요. 잠시 후 다시 시도해 주세요."}}
}
function statusEl(s){
  const f=d=>d?Number(d.slice(5,7))+"/"+Number(d.slice(8,10)):"";
  if(s&&s.done)return el("div",{class:"status done"},"정산 완료"+(s.paidDate?" · 입금일 "+f(s.paidDate):""));
  if(s&&s.receiptDate)return el("div",{class:"status"},"영수증 발행일 "+f(s.receiptDate)+" · 입금 대기 중");
  return el("div",{class:"status"},"정산 전 · 매장에서 지출증빙 영수증을 발행받으면 상태가 바뀝니다");
}
async function checkDownloadAllowed(month){
  if(S.demo){
    const key=S.dept.code+"|"+month;
    const pending=ED.pendingBatches.some(b=>b.deptCode===S.dept.code&&b.month===month);
    if(pending)return {ok:false,message:"수정 승인 대기 중이라 다운로드할 수 없어요."};
    const cur=S.demoDownloads[key]||0;
    if(cur>=3)return {ok:false,message:"이번 달 다운로드 가능 횟수(3회)를 모두 사용했어요. 매장에 문의해 주세요."};
    S.demoDownloads[key]=cur+1;
    return {ok:true,downloadsLeft:3-(cur+1)};
  }
  try{
    const r=await apiFetch(CONFIG.SCRIPT_URL,{method:"POST",headers:{"Content-Type":"text/plain;charset=utf-8"},
      body:JSON.stringify({action:"download",deptCode:S.dept.code,pin:S.pin,spin:S.spin,month,reqId:newReqId()})});
    return await r.json();
  }catch(e){return {ok:false,message:"연결에 실패했어요. 잠시 후 다시 시도해 주세요."}}
}
async function saveJpg(month){
  try{await loadHtml2Canvas();}catch(e){}
  if(typeof html2canvas==="undefined"){alert("이미지 저장 기능을 불러오지 못했어요. 잠시 후 다시 시도하거나 화면을 직접 캡처해 주세요.");return}
  const gate=await checkDownloadAllowed(month);
  if(!gate.ok){alert(gate.message||"다운로드할 수 없어요.");render(statementScreen);return}
  const target=$("#paper");
  const w=target.getBoundingClientRect().width||520;
  const scale=Math.max(4,Math.ceil(2048/w));   // 다운로드 이미지는 최소 2K(2048px) 이상이 되도록 배율을 계산해요
  const c=await html2canvas(target,{scale:scale,backgroundColor:"#ffffff"});
  const url=c.toDataURL("image/jpeg",0.92), fname=S.dept.name+"_"+month+"_정산서.jpg";
  const ov=el("div",{class:"overlay"});const sh=el("div",{class:"sheet",style:"max-height:92vh;overflow:auto"});
  const a=el("a",{href:url,download:fname,class:"go",style:"display:block;text-align:center;text-decoration:none;margin-top:12px"},"이미지 다운로드");
  sh.append(el("h2",{},"정산서 이미지"),el("img",{src:url,alt:"정산서",style:"width:100%;border:1px solid var(--line)"}),a,
    el("p",{class:"note"},"이번 달 남은 다운로드 횟수 "+gate.downloadsLeft+"회. 다운로드가 안 되면 이미지를 길게 눌러 저장하세요."),
    el("button",{class:"sec",onclick:()=>{ov.remove();render(statementScreen)}},"닫기"));
  ov.append(sh);document.body.append(ov);
}

const K={pin:"",orders:[],seen:null,fresh:new Set(),sound:false,timer:null,showDone:false,ctx:null,t0:0,demoAdded:false,demoList:[],last:""};
const KMODE = params.get("mode")==="kitchen";
function beep(){try{if(!K.ctx)K.ctx=new (window.AudioContext||window.webkitAudioContext)();const c=K.ctx;[880,1175].forEach((f,i)=>{const o=c.createOscillator(),g=c.createGain();o.frequency.value=f;o.connect(g);g.connect(c.destination);const s=c.currentTime+i*0.2;g.gain.setValueAtTime(0.3,s);g.gain.exponentialRampToValueAtTime(0.001,s+0.18);o.start(s);o.stop(s+0.19)})}catch(e){}}
function hm(d){return String(d.getHours()).padStart(2,"0")+":"+String(d.getMinutes()).padStart(2,"0")}
function initDemoOrders(){
  const now=Date.now(),mk=(min,org,dept,menu,names,over,flag,date)=>({id:"d"+min,time:hm(new Date(now-min*60000)),org,dept,date:date||today(),menu,names,people:names.split(", ").length,over,flag:flag||"",packed:false});
  K.demoList=[mk(9,"인천시청","인사과","불고기버거 세트×3","홍길동, 김영희, 박철수",0),
    mk(4,"인천시의회","건설교통위원회","머쉬룸버거 세트×1, 감자튀김×1","강민수",5000),
    mk(2,"인천시청","예산","치즈버거 세트×2","최민호, 정하나",0,"⚠ 1일 전 날짜",(()=>{const d=new Date(now-864e5);return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0")})())];
}
async function fetchOrders(){
  if(S.demo){
    if(!K.demoAdded&&Date.now()-K.t0>8000){K.demoAdded=true;K.demoList.push({id:"dnew",time:hm(new Date()),org:"인천시교육청",dept:"수능팀",date:today(),menu:"스낵버거 세트×2",names:"문서준, 권다은",people:2,over:0,flag:"",packed:false})}
    return {ok:true,orders:K.demoList,dailyDigit:demoDigit()};
  }
  const r=await apiFetch(CONFIG.SCRIPT_URL+"?action=orders&pin="+K.pin);return r.json();
}
function kitchenLogin(app){
  app.append(el("h1",{},"주문 확인"),el("p",{class:"sub"},"사장님 전용 · 오늘 들어온 주문을 실시간으로 확인해요"));
  if(S.demo)app.append(el("div",{class:"demo"},"체험 화면입니다. 사장님 PIN은 0000이에요. 잠시 후 새 주문이 하나 들어옵니다."));
  const inp=el("input",{type:"password",inputmode:"numeric",maxlength:"4",class:"pin",autocomplete:"off","aria-label":"사장님 PIN"});
  const err=el("div",{class:"err"});
  inp.addEventListener("input",async()=>{
    inp.value=inp.value.replace(/\D/g,"");err.textContent="";if(inp.value.length<4)return;
    K.pin=inp.value;K.t0=Date.now();K.seen=null;K.fresh=new Set();K.showDone=false;K.salesDate=today();if(S.demo)initDemoOrders();
    try{const j=await fetchOrders();
      if(S.demo&&K.pin!=="0000"){err.textContent="PIN이 맞지 않아요.";inp.value="";return}
      if(!j.ok){err.textContent=j.message||"PIN이 맞지 않아요.";inp.value="";return}
      render(ownerHome);
    }catch(e){err.textContent="연결에 실패했어요. 잠시 후 다시 시도해 주세요.";inp.value=""}
  });
  app.append(el("div",{class:"card"},inp,err));
  if(S.demo)app.append(el("button",{class:"back",onclick:()=>render(pickOrg)},"‹ 담당자 화면으로"));
  setTimeout(()=>inp.focus(),50);
}
function ownerHome(app){
  app.append(el("h1",{},"사장님 메뉴"));
  const g=el("div",{class:"orgs"});
  g.append(el("button",{class:"big",onclick:()=>render(kitchenScreen)},"오늘 주문 확인 (포장)"),
    el("button",{class:"big",onclick:()=>render(salesScreen)},"일자별 매출 확인"),
    el("button",{class:"big",onclick:()=>render(editApprovalScreen)},"정산서 수정 요청 확인"),
    el("button",{class:"big",onclick:()=>{OB.org=null;OB.dept=null;OB.added=[];OB.pending=[];render(obOrgScreen)}},"주문 일괄 입력 (대리 입력)"),
    el("button",{class:"big",onclick:()=>{PD.org=null;PD.dept=null;PD.added=[];render(pdOrgScreen)}},"선결제 차감 처리 (단체 주문)"));
  app.append(g, el("button",{class:"back",style:"margin-top:20px",onclick:()=>{K.pin="";render(kitchenLogin)}},"‹ 로그아웃"));
}
const OB={org:null,dept:null,date:today(),names:[""],cart:{},tab:null,added:[]};
function obReset(){OB.date=today();OB.names=[""];OB.cart={};OB.tab=TABS[0][0];OB.pending=[]}
function obOrgScreen(app){
  app.append(el("button",{class:"back",onclick:()=>render(ownerHome)},"‹ 사장님 메뉴"));
  app.append(el("h1",{},"주문 일괄 입력"), el("p",{class:"sub"},"담당자가 입력을 놓친 과거 날짜 주문을 대신 넣을 수 있어요. 이 내역은 일자별 매출 집계에서는 자동으로 빠지고, 정산서에는 그대로 포함돼요."));
  const g=el("div",{class:"orgs"});
  Object.entries(DATA).forEach(([code,o])=>g.append(el("button",{class:"big",onclick:()=>{OB.org=code;OB.dept=null;render(obDeptScreen)}},o.name)));
  app.append(g);
}
function obDeptScreen(app){
  if(!OB.org){render(obOrgScreen);return}
  app.append(el("button",{class:"back",onclick:()=>render(obOrgScreen)},"‹ 기관 다시 선택"));
  app.append(el("h1",{},DATA[OB.org].name), el("p",{class:"sub"},"부서를 검색해서 선택하세요"));
  const inp=el("input",{type:"search",placeholder:"예: 인사, 총무",autocomplete:"off","aria-label":"부서 검색"});
  const list=el("div",{class:"dlist"});
  const draw=()=>{list.replaceChildren();const q=inp.value.trim();const r=deptsOf(OB.org).filter(d=>d.name.includes(q));
    if(!r.length)list.append(el("div",{class:"empty"},"검색 결과가 없어요."));
    r.forEach(d=>list.append(el("button",{onclick:()=>{OB.dept=d;OB.added=[];OB.pending=[];obReset();render(obBuilder)}},d.name)))};
  inp.addEventListener("input",draw); app.append(el("div",{class:"card"},inp,list)); draw();
}
function obSync(){
  const d=$("#obdate");if(d)OB.date=d.value;
  const ins=[...document.querySelectorAll(".obname")];if(ins.length)OB.names=ins.map(i=>i.value);
}
function obAddPerson(){obSync();if(OB.names.length>=30)return;OB.names.push("");const y=scrollY;render(obBuilder);scrollTo(0,y);
  const ins=document.querySelectorAll(".obname");ins[ins.length-1].focus()}
function obRemovePerson(i){obSync();OB.names.splice(i,1);const y=scrollY;render(obBuilder);scrollTo(0,y)}
function obAddItem(id,d=1){obSync();OB.cart[id]=Math.max(0,(OB.cart[id]||0)+d);const y=scrollY;render(obBuilder);scrollTo(0,y)}
function obItems(){return Object.entries(OB.cart).filter(([,q])=>q>0).map(([id,q])=>{const m=MENU.find(x=>x.id===id);return{id,name:m.name,price:m.price,qty:q}})}
function obTotal(){return obItems().reduce((s,i)=>s+i.price*i.qty,0)}
function obBuilder(app){
  if(!OB.dept){render(obOrgScreen);return}
  if(!OB.tab)OB.tab=TABS[0][0];
  if(!OB.pending)OB.pending=[];
  app.append(el("button",{class:"back",onclick:()=>render(obDeptScreen)},"‹ 부서 변경"));
  app.append(el("span",{class:"badge"},DATA[OB.org].name+" "+OB.dept.name), el("h1",{},"주문 대리 입력"),
    el("p",{class:"sub"},"여러 날짜·여러 건을 먼저 목록에 담아두고, 마지막에 한 번에 저장할 수 있어요. 누락분을 한 달치 몰아서 넣을 때 편해요."));
  app.append(el("div",{class:"card"},el("label",{class:"f",for:"obdate",style:"margin-top:0"},"날짜 (과거 날짜도 가능, 건마다 다르게 담을 수 있어요)"),
    el("input",{type:"date",id:"obdate",value:OB.date})));
  const nc=el("div",{class:"card"},el("label",{class:"f",style:"margin:0 0 6px"},"이름 (드시는 분 모두)"));
  OB.names.forEach((n,i)=>{
    const row=el("div",{class:"nm",style:i?"margin-top:8px":""},
      el("input",{type:"text",class:"obname",placeholder:i?"이름 "+(i+1):"이름 1",value:n,autocomplete:"off"}),
      i===0?el("button",{class:"pm",onclick:()=>obAddPerson()},"+"):el("button",{class:"pm",onclick:()=>obRemovePerson(i)},"−"));
    nc.append(row);
  });
  app.append(nc);
  const tabs=el("div",{class:"tabs",style:"margin-top:0"});
  TABS.forEach(([k,n])=>tabs.append(el("button",{class:"tab","aria-selected":String(OB.tab===k),onclick:()=>{obSync();OB.tab=k;render(obBuilder)}},n)));
  app.append(tabs);
  const g=el("div",{class:"menu"});
  MENU.filter(m=>m.tab===OB.tab).forEach(m=>g.append(el("button",{class:"item",onclick:()=>obAddItem(m.id)},el("span",{class:"n"},m.name),m.sub?el("span",{class:"d"},m.sub):"",el("span",{class:"p"},won(m.price)))));
  app.append(g);
  const cart=el("div",{class:"card",style:"margin-top:14px"},el("h2",{},"담은 메뉴"));
  const its=obItems();
  if(!its.length)cart.append(el("div",{class:"empty",style:"padding:6px 0"},"메뉴를 눌러 담아 주세요."));
  its.forEach(i=>cart.append(el("div",{class:"line"},el("span",{class:"t"},i.name),
    el("span",{class:"q"},el("button",{onclick:()=>obAddItem(i.id,-1)},"−"),el("span",{style:"min-width:20px;text-align:center"},String(i.qty)),el("button",{onclick:()=>obAddItem(i.id,1)},"+")),
    el("span",{class:"a"},won(i.price*i.qty)))));
  app.append(cart);
  const t=obTotal(),limit=CONFIG.LIMIT*Math.max(1,OB.names.length),over=Math.max(0,t-limit);
  const sum=el("div",{class:"card"});
  sum.append(el("div",{class:"row"},el("span",{},"합계 (한도 "+won(limit)+")"),el("span",{class:"total"},won(t))));
  if(over>0)sum.append(el("div",{class:"warn"},"한도를 "+won(over)+" 초과했어요. 현장결제로 처리돼요."));
  const err=el("div",{class:"err"});
  const addBtn=el("button",{class:"go"+(over>0?" red":"")},t>0?"목록에 담기":"메뉴를 담아 주세요");
  addBtn.disabled=t===0;
  addBtn.addEventListener("click",()=>{
    obSync(); err.textContent="";
    if(!OB.date){err.textContent="날짜를 선택해 주세요.";return}
    const names=OB.names.map(n=>n.trim());
    if(names.some(n=>!n)){err.textContent="이름을 모두 입력해 주세요.";return}
    if(new Set(names).size!==names.length){err.textContent="같은 이름이 중복됐어요.";return}
    OB.pending.push({date:OB.date,names,items:obItems()});
    OB.cart={}; OB.names=[""];
    render(obBuilder);
  });
  sum.append(err,addBtn); app.append(sum);

  if(OB.pending.length){
    const list=el("div",{class:"card",style:"margin-top:14px"},el("h2",{},"담아둔 목록 ("+OB.pending.length+"건) · 아직 저장 전이에요"));
    OB.pending.forEach((p,idx)=>{
      const pt=p.items.reduce((s,i)=>s+i.price*i.qty,0);
      list.append(el("div",{class:"line"},
        el("span",{class:"t"},md(p.date)+" · "+p.names.join(", ")+" · "+p.items.map(i=>i.name+"×"+i.qty).join(", ")),
        el("span",{class:"a"},won(pt)),
        el("button",{class:"sec",style:"padding:4px 10px;margin-left:8px",onclick:()=>{OB.pending.splice(idx,1);render(obBuilder)}},"삭제")));
    });
    const saveErr=el("div",{class:"err"});
    const saveBtn=el("button",{class:"go",style:"margin-top:10px"},"전체 저장하기 ("+OB.pending.length+"건)");
    saveBtn.addEventListener("click",async()=>{
      saveErr.textContent=""; saveBtn.disabled=true; saveBtn.textContent="저장 중… ("+OB.pending.length+"건)";
      const res=await obSubmitBatch(OB.pending);
      saveBtn.disabled=false; saveBtn.textContent="전체 저장하기 ("+OB.pending.length+"건)";
      if(!res.ok){saveErr.textContent=res.message||"저장에 실패했어요.";return}
      const failed=[];
      res.results.forEach((r,i)=>{
        const p=OB.pending[i];
        if(r.ok)OB.added.unshift({date:p.date,names:p.names.join(", "),menu:p.items.map(x=>x.name+"×"+x.qty).join(", "),amount:r.total-r.over,over:r.over});
        else failed.push(p);
      });
      OB.pending=failed;
      if(failed.length)saveErr.textContent=failed.length+"건은 실패해서 목록에 남겨뒀어요. 확인 후 다시 저장해 주세요.";
      render(obBuilder);
    });
    list.append(saveErr,saveBtn);
    app.append(list);
  }

  if(OB.added.length){
    const hist=el("div",{class:"card",style:"margin-top:14px"},el("h2",{},"저장 완료된 내역 ("+OB.added.length+"건)"));
    OB.added.forEach(a=>hist.append(el("div",{class:"line"},el("span",{class:"t"},md(a.date)+" · "+a.names+" · "+a.menu),el("span",{class:"a"},won(a.amount)+(a.over?" (초과 "+won(a.over)+")":"")))));
    app.append(hist);
  }
}

async function obSubmit(names,items,date){
  if(S.demo)return {ok:true,total:items.reduce((s,i)=>s+i.price*i.qty,0),over:0};
  try{
    const r=await apiFetch(CONFIG.SCRIPT_URL,{method:"POST",headers:{"Content-Type":"text/plain;charset=utf-8"},
      body:JSON.stringify({action:"ownerAdd",pin:K.pin,deptCode:OB.dept.code,date,names,items,reqId:newReqId()})});
    return await r.json();
  }catch(e){return {ok:false,message:"연결에 실패했어요. 잠시 후 다시 시도해 주세요."}}
}
async function obSubmitBatch(pending){
  if(S.demo){
    return {ok:true,okCount:pending.length,total:pending.length,
      results:pending.map(p=>({ok:true,total:p.items.reduce((s,i)=>s+i.price*i.qty,0),over:0}))};
  }
  try{
    const r=await apiFetch(CONFIG.SCRIPT_URL,{method:"POST",headers:{"Content-Type":"text/plain;charset=utf-8"},
      body:JSON.stringify({action:"ownerAddBatch",pin:K.pin,deptCode:OB.dept.code,
        entries:pending.map(p=>({date:p.date,names:p.names,items:p.items})),reqId:newReqId()})});
    return await r.json();
  }catch(e){return {ok:false,message:"연결에 실패했어요. 담아둔 목록은 그대로 남아있으니 다시 눌러 주세요."}}
}
const PD={org:null,dept:null,date:today(),added:[],balance:0};
function pdOrgScreen(app){
  app.append(el("button",{class:"back",onclick:()=>render(ownerHome)},"‹ 사장님 메뉴"));
  app.append(el("h1",{},"선결제 차감 처리"), el("p",{class:"sub"},"선결제 잔액이 있는 부서의 단체 주문을 이름 없이 금액만으로 빠르게 기록해요. 일자별 매출에는 잡히지 않아요."));
  const g=el("div",{class:"orgs"});
  Object.entries(DATA).forEach(([code,o])=>g.append(el("button",{class:"big",onclick:()=>{PD.org=code;PD.dept=null;render(pdDeptScreen)}},o.name)));
  app.append(g);
}
function pdDeptScreen(app){
  if(!PD.org){render(pdOrgScreen);return}
  app.append(el("button",{class:"back",onclick:()=>render(pdOrgScreen)},"‹ 기관 다시 선택"));
  app.append(el("h1",{},DATA[PD.org].name), el("p",{class:"sub"},"부서를 검색해서 선택하세요"));
  const inp=el("input",{type:"search",placeholder:"예: 예산, 인사",autocomplete:"off","aria-label":"부서 검색"});
  const list=el("div",{class:"dlist"});
  const draw=()=>{list.replaceChildren();const q=inp.value.trim();const r=deptsOf(PD.org).filter(d=>d.name.includes(q));
    if(!r.length)list.append(el("div",{class:"empty"},"검색 결과가 없어요."));
    r.forEach(d=>list.append(el("button",{onclick:async()=>{PD.dept=d;PD.added=[];PD.date=today();PD.balance=await pdFetchBalance(d.code);render(pdBuilder)}},d.name)))};
  inp.addEventListener("input",draw); app.append(el("div",{class:"card"},inp,list)); draw();
}
async function pdFetchBalance(deptCode){
  if(S.demo)return S.demoBalances&&S.demoBalances[deptCode]!==undefined?S.demoBalances[deptCode]:18000;
  try{const r=await apiFetch(CONFIG.SCRIPT_URL+"?action=prepaidBalance&pin="+K.pin+"&dept="+encodeURIComponent(deptCode));const j=await r.json();return j.ok?j.balance:0}catch(e){return 0}
}
function pdBuilder(app){
  if(!PD.dept){render(pdOrgScreen);return}
  app.append(el("button",{class:"back",onclick:()=>render(pdDeptScreen)},"‹ 부서 변경"));
  app.append(el("span",{class:"badge"},DATA[PD.org].name+" "+PD.dept.name), el("h1",{},"선결제 차감"));
  app.append(el("div",{class:"salesbox"},el("div",{class:"sub2"},"현재 선결제 잔액"),el("div",{class:"big2"},won(PD.balance))));
  if(PD.balance<=0)app.append(el("div",{class:"lockbox"},"이 부서는 선결제 잔액이 없어요. 시트 메뉴 [선결제 충전 등록]으로 먼저 충전해 주세요."));
  const card=el("div",{class:"card"});
  card.append(el("label",{class:"f",style:"margin-top:0"},"날짜"), el("input",{type:"date",id:"pddate",value:PD.date}));
  card.append(el("label",{class:"f"},"차감 금액"), el("input",{type:"text",inputmode:"numeric",id:"pdamount",placeholder:"예: 180000",autocomplete:"off"}));
  card.append(el("label",{class:"f"},"인원 (기록용, 선택)"), el("input",{type:"text",inputmode:"numeric",id:"pdpeople",placeholder:"예: 20",autocomplete:"off"}));
  card.append(el("label",{class:"f"},"메모 (선택)"), el("input",{type:"text",id:"pdmemo",placeholder:"예: 송년회 단체 주문",autocomplete:"off"}));
  const err=el("div",{class:"err"});
  const go=el("button",{class:"go",style:"margin-top:10px"},"차감 처리");
  go.disabled=PD.balance<=0;
  go.addEventListener("click",async()=>{
    err.textContent="";
    const date=$("#pddate").value, amount=Number($("#pdamount").value.replace(/[^0-9]/g,"")), people=Number($("#pdpeople").value.replace(/[^0-9]/g,""))||1, memo=$("#pdmemo").value.trim();
    if(!date){err.textContent="날짜를 선택해 주세요.";return}
    if(!amount||amount<=0){err.textContent="차감 금액을 입력해 주세요.";return}
    if(amount>PD.balance){err.textContent="잔액("+won(PD.balance)+")보다 큰 금액은 차감할 수 없어요.";return}
    go.disabled=true;go.textContent="처리 중…";
    const res=await pdSubmit(date,amount,people,memo);
    go.disabled=false;go.textContent="차감 처리";
    if(!res.ok){err.textContent=res.message||"처리에 실패했어요.";return}
    PD.balance=res.balance;
    PD.added.unshift({date,amount,people,memo});
    $("#pdamount").value="";$("#pdpeople").value="";$("#pdmemo").value="";
    render(pdBuilder);
  });
  card.append(err,go); app.append(card);
  if(PD.added.length){
    const hist=el("div",{class:"card",style:"margin-top:14px"},el("h2",{},"이번에 처리한 내역 ("+PD.added.length+"건)"));
    PD.added.forEach(a=>hist.append(el("div",{class:"line"},el("span",{class:"t"},md(a.date)+" · "+a.people+"명"+(a.memo?" · "+a.memo:"")),el("span",{class:"a"},won(a.amount)))));
    app.append(hist);
  }
}
async function pdSubmit(date,amount,people,memo){
  if(S.demo){
    const cur=(S.demoBalances&&S.demoBalances[PD.dept.code]!==undefined)?S.demoBalances[PD.dept.code]:PD.balance;
    if(amount>cur)return {ok:false,message:"잔액이 부족해요."};
    S.demoBalances=S.demoBalances||{};S.demoBalances[PD.dept.code]=cur-amount;
    return {ok:true,balance:cur-amount};
  }
  try{
    const r=await apiFetch(CONFIG.SCRIPT_URL,{method:"POST",headers:{"Content-Type":"text/plain;charset=utf-8"},
      body:JSON.stringify({action:"prepaidDeduct",pin:K.pin,deptCode:PD.dept.code,date,amount,people,memo,reqId:newReqId()})});
    return await r.json();
  }catch(e){return {ok:false,message:"연결에 실패했어요. 잠시 후 다시 시도해 주세요."}}
}
async function fetchPendingEdits(){
  if(S.demo)return {ok:true,batches:ED.pendingBatches};
  const r=await apiFetch(CONFIG.SCRIPT_URL+"?action=pendingEdits&pin="+K.pin);return r.json();
}
async function resolveBatch(b,approve){
  if(S.demo){
    if(approve){
      const cache=S.demoStmtCache[b.deptCode+"|"+b.month];
      if(cache)b.items.forEach(it=>{const row=cache.find(r=>r.row===it.row);if(row){row.date=it.newDate;row.name=it.newNames}});
    }
    ED.pendingBatches=ED.pendingBatches.filter(x=>x!==b);
    return {ok:true};
  }
  try{
    const r=await apiFetch(CONFIG.SCRIPT_URL,{method:"POST",headers:{"Content-Type":"text/plain;charset=utf-8"},
      body:JSON.stringify({action:"resolveEdit",pin:K.pin,month:b.month,deptCode:b.deptCode,approve,reqId:newReqId()})});
    return await r.json();
  }catch(e){return {ok:false,message:"연결에 실패했어요."}}
}
function editApprovalScreen(app){
  app.append(el("button",{class:"back",onclick:()=>render(ownerHome)},"‹ 사장님 메뉴"),el("h1",{},"정산서 수정 요청"));
  const box=el("div",{},el("div",{class:"empty"},"불러오는 중…"));app.append(box);
  fetchPendingEdits().then(j=>{
    box.replaceChildren();
    if(!j.ok){box.append(el("div",{class:"card"},el("div",{class:"err"},j.message||"불러오지 못했어요.")));return}
    if(!j.batches.length){box.append(el("div",{class:"card"},el("div",{class:"empty"},"대기 중인 수정 요청이 없어요.")));return}
    j.batches.forEach(b=>{
      const card=el("div",{class:"batchcard"},
        el("div",{style:"font-weight:600;margin-bottom:8px"},b.org+" "+b.dept+" · "+monthLabel(b.month)));
      b.items.forEach(it=>{
        card.append(el("div",{class:"diffline"},
          el("div",{class:"old"},md(it.oldDate)+" · "+it.oldNames),
          el("div",{class:"new"},md(it.newDate)+" · "+it.newNames)));
      });
      const btns=el("div",{style:"display:flex;gap:8px;margin-top:10px"});
      const ok=el("button",{class:"go",style:"flex:1"},"승인");
      const no=el("button",{class:"sec",style:"flex:1"},"거부");
      ok.addEventListener("click",async()=>{ok.disabled=true;no.disabled=true;const r=await resolveBatch(b,true);if(!r.ok){alert(r.message||"실패했어요.");ok.disabled=false;no.disabled=false;return}render(editApprovalScreen)});
      no.addEventListener("click",async()=>{ok.disabled=true;no.disabled=true;const r=await resolveBatch(b,false);if(!r.ok){alert(r.message||"실패했어요.");ok.disabled=false;no.disabled=false;return}render(editApprovalScreen)});
      btns.append(ok,no);card.append(btns);
      box.append(card);
    });
  }).catch(()=>{box.replaceChildren(el("div",{class:"card"},el("div",{class:"err"},"연결에 실패했어요. 잠시 후 다시 시도해 주세요.")))});
}
function shiftDay(d,n){const dt=new Date(d+"T00:00:00");dt.setDate(dt.getDate()+n);return dt.getFullYear()+"-"+String(dt.getMonth()+1).padStart(2,"0")+"-"+String(dt.getDate()).padStart(2,"0")}
function dlabel(d){const dt=new Date(d+"T00:00:00"),w=["일","월","화","수","목","금","토"][dt.getDay()];return (Number(d.slice(5,7)))+"월 "+(Number(d.slice(8,10)))+"일 ("+w+")"+(d===today()?" · 오늘":"")}
async function fetchSales(date){
  if(S.demo){
    const base=demoSalesFor(date);
    return {ok:true, ...base};
  }
  const r=await apiFetch(CONFIG.SCRIPT_URL+"?action=sales&pin="+K.pin+"&date="+date);return r.json();
}
function demoSalesFor(date){
  if(date!==today())return {count:0,total:0,over:0,rows:[]};
  const rows=[
    {time:"12:18",org:"인천시청",dept:"인사과",names:"홍길동, 김영희, 박철수",people:3,amount:27000,over:0},
    {time:"12:27",org:"인천시교육청",dept:"수능팀",names:"문서준, 권다은, 조현우, 송예린",people:4,amount:27000,over:0},
    {time:"12:33",org:"인천시의회",dept:"건설교통위원회",names:"강민수",people:1,amount:9000,over:5000},
    {time:"12:50",org:"인천시청",dept:"예산",names:"이수진",people:1,amount:9000,over:0},
    {time:"13:02",org:"인천시청",dept:"총무과",names:"한지민",people:1,amount:4000,over:0}
  ];
  return {count:5,total:76000,over:5000,rows:rows};
}
function salesScreen(app){
  app.append(el("button",{class:"back",onclick:()=>render(ownerHome)},"‹ 사장님 메뉴"),el("h1",{},"일자별 매출"));
  const nav=el("div",{class:"daynav"});
  const dtxt=el("div",{class:"dtxt"},dlabel(K.salesDate));
  nav.append(el("button",{"aria-label":"전날",onclick:()=>{K.salesDate=shiftDay(K.salesDate,-1);render(salesScreen)}},"‹"),
    dtxt,
    el("button",{"aria-label":"다음날",disabled:K.salesDate>=today(),onclick:()=>{if(K.salesDate<today()){K.salesDate=shiftDay(K.salesDate,1);render(salesScreen)}}},"›"));
  app.append(nav);
  const box=el("div",{},el("div",{class:"empty"},"불러오는 중…"));app.append(box);
  fetchSales(K.salesDate).then(j=>{
    box.replaceChildren();
    if(!j.ok){box.append(el("div",{class:"card"},el("div",{class:"err"},j.message||"불러오지 못했어요.")));return}
    const sb=el("div",{class:"salesbox"},
      el("div",{class:"big2"},won(j.total)),
      el("div",{class:"sub2"},"청구 매출 · 주문 "+j.count+"건"+(j.over>0?" · 현장결제(별도) "+won(j.over):"")));
    box.append(sb);
    if(!j.rows.length){box.append(el("div",{class:"card"},el("div",{class:"empty"},"이 날짜에는 이용 내역이 없어요.")));return}
    const t=el("table",{class:"mtable"});
    t.append(el("tr",{},el("th",{},"기관"),el("th",{},"부서"),el("th",{},"이름"),el("th",{style:"text-align:right"},"금액")));
    j.rows.forEach(r=>{
      const tr=el("tr",{},el("td",{},r.org),el("td",{},r.dept),el("td",{},el("span",{class:"pc"},(r.people||1)+"명"),r.names),el("td",{class:"r"},won(r.amount)));
      if(r.over>0)tr.append();
      t.append(tr);
      if(r.over>0){const sub=el("tr",{},el("td",{colspan:"4",style:"padding:0 4px 8px;font-size:12px;color:var(--ketchup)"},r.time+" · 현장결제 "+won(r.over)+" 별도"));t.append(sub)}
    });
    box.append(el("div",{class:"card"},el("h2",{style:"font-size:17px"},"건별 내역 ("+j.rows.length+"건)"),el("div",{class:"scroll"},t)));
  }).catch(()=>{box.replaceChildren(el("div",{class:"card"},el("div",{class:"err"},"연결에 실패했어요. 잠시 후 다시 시도해 주세요.")))});
}
function kitchenScreen(app){
  app.classList.add("k");
  app.append(el("button",{class:"homebtn",style:"margin-bottom:10px",onclick:()=>{clearInterval(K.timer);render(ownerHome)}},"\u2302 \uC0AC\uC7A5\uB2D8 \uBA54\uB274"));
  app.append(el("div",{class:"kdigit",id:"kdigit"}),el("div",{class:"kstat",id:"kstat"}),el("div",{class:"kbar",id:"kbar"}),el("div",{id:"kboard"}));
  poll();K.timer=setInterval(poll,10000);
}
async function poll(){
  try{
    const j=await fetchOrders();
    if(!j.ok){$("#kstat")&&($("#kstat").textContent=j.message||"불러오지 못했어요.");return}
    let fresh=false;
    if(K.seen)j.orders.forEach(o=>{if(!K.seen.has(o.id)){K.fresh.add(o.id);fresh=true}});
    K.seen=new Set(j.orders.map(o=>o.id));K.orders=j.orders;K.digit=j.dailyDigit;
    const d=new Date();K.last=hm(d)+":"+String(d.getSeconds()).padStart(2,"0");K.err="";
    if(fresh&&K.sound)beep();
    renderBoard();
  }catch(e){K.err="연결이 끊겼어요. 다시 연결하는 중…";renderBoard()}
}
async function pack(o,undo){
  o.packed=!undo;K.fresh.delete(o.id);renderBoard();
  if(S.demo)return;
  try{const r=await apiFetch(CONFIG.SCRIPT_URL,{method:"POST",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify({action:"pack",pin:K.pin,row:o.row,key:o.key,undo:!!undo,reqId:newReqId()})});
    const j=await r.json();if(!j.ok)alert(j.message||"저장에 실패했어요.")}catch(e){alert("저장에 실패했어요. 연결을 확인해 주세요.")}
  poll();
}
function kcard(o){
  const c=el("div",{class:"kcard"+(K.fresh.has(o.id)?" fresh":""),onclick:()=>{K.fresh.delete(o.id);c.classList.remove("fresh")}},
    el("div",{class:"top"},el("span",{class:"time"},o.time),el("span",{style:"color:var(--muted)"},o.org+" "+o.dept)),
    el("div",{class:"who"},o.names+" ("+o.people+"명)"),
    el("div",{class:"kmenu"},o.menu));
  if(o.over)c.append(el("span",{class:"chip red"},"현장결제 "+won(o.over)+" 받기"));
  if(o.flag)c.append(el("span",{class:"chip red"},o.flag+" · 장부 날짜 "+md(o.date)));
  c.append(o.packed?el("button",{class:"sec",onclick:e=>{e.stopPropagation();pack(o,true)}},"되돌리기")
                  :el("button",{class:"go",onclick:e=>{e.stopPropagation();pack(o,false)}},"포장 완료"));
  return c;
}
function renderBoard(){
  const stat=$("#kstat"),bar=$("#kbar"),board=$("#kboard");if(!board)return;
  const dg=$("#kdigit");if(dg&&K.digit!==undefined)dg.replaceChildren(el("div",{},el("div",{style:"font-size:15px"},"오늘의 번호"),el("div",{style:"font-size:13px;opacity:.8"},"공무원에게 매장에서 알려 주세요 · 매일 자동으로 바뀌어요")),el("b",{},String(K.digit)));
  const wait=K.orders.filter(o=>!o.packed),done=K.orders.filter(o=>o.packed);
  stat.textContent="대기 "+wait.length+"건 · 완료 "+done.length+"건"+(K.err?" · "+K.err:"  (갱신 "+K.last+")");
  bar.replaceChildren(
    el("button",{onclick:()=>{K.sound=!K.sound;if(K.sound)beep();renderBoard()}},K.sound?"🔔 알림음 켜짐 (끄기)":"🔕 알림음 켜기"),
    el("button",{onclick:()=>{K.showDone=!K.showDone;renderBoard()}},K.showDone?"완료 목록 숨기기":"완료 목록 보기 ("+done.length+")"),
    el("button",{onclick:()=>poll()},"↻ 새로고침"));
  board.replaceChildren();
  if(!wait.length)board.append(el("div",{class:"card"},el("div",{class:"empty"},"대기 중인 주문이 없어요. 새 주문이 들어오면 여기에 나타납니다.")));
  wait.forEach(o=>board.append(kcard(o)));
  if(K.showDone&&done.length){board.append(el("h2",{style:"margin-top:18px"},"포장 완료"));done.slice().reverse().forEach(o=>board.append(kcard(o)))}
}
function privacyScreen(app){
  const c=S.cfg,o=c.storeName||"매장",ret=c.retention||"○년(설정 필요)";
  app.append(el("button",{class:"back",onclick:()=>render(S.from||pickOrg)},"‹ 돌아가기"),el("h1",{},"개인정보 처리방침"));
  const p=el("div",{class:"card pv"});
  const H=(t)=>p.append(el("h2",{style:"font-size:17px"},t)),P=(t)=>p.append(el("p",{},t)),L=(a)=>{const u=el("ul",{style:"padding-left:18px;margin:4px 0"});a.forEach(x=>u.append(el("li",{},x)));p.append(u)};
  P(o+"(이하 '매장')은 개인정보 보호법에 따라 이용자의 개인정보를 보호하고 관련 고충을 신속하게 처리하기 위해 다음과 같이 개인정보 처리방침을 수립·공개합니다.");
  H("1. 개인정보의 처리 목적");P("식대 장부 작성 및 식대 정산(정산서 발행, 영수증 발행, 입금 확인, 문의 응대)을 위해 개인정보를 처리하며, 이 목적 외의 용도로는 이용하지 않습니다.");
  H("2. 처리하는 개인정보 항목");L(["이름","소속(기관명, 부서명)","이용 내역(이용 날짜, 메뉴, 금액, 인원)","입력 일시"]);
  H("3. 개인정보의 처리 및 보유 기간");P("정산 목적 달성 후 "+ret+"간 보관하며, 보유 기간이 지나면 지체 없이 파기합니다. 다만 관계 법령에 따라 보존이 필요한 경우 해당 기간 동안 보관합니다.");
  H("4. 개인정보의 파기 절차 및 방법");P("보유 기간이 지난 개인정보는 장부(전자 문서)에서 해당 정보를 삭제하는 방법으로 파기합니다. 출력물(정산서 등)은 분쇄하거나 소각합니다.");
  H("5. 개인정보의 제3자 제공");P("매장은 이용자의 개인정보를 제3자에게 제공하지 않습니다.");
  H("6. 개인정보 처리의 위탁 및 저장");P("장부 데이터는 구글(Google LLC)의 클라우드 서비스(Google 스프레드시트, Apps Script)에 저장·처리되며, 서버가 국외에 있을 수 있습니다. 이 서비스는 이용자의 별도 회원가입 없이 이름과 소속만을 입력받습니다.");
  H("7. 정보주체의 권리와 행사 방법");P("이용자는 언제든지 자신의 개인정보에 대한 열람, 정정, 삭제, 처리정지를 요구할 수 있으며, 아래 연락처로 요청하면 지체 없이 조치합니다. 개인정보 수집·이용에 동의하지 않을 권리가 있으며, 동의하지 않을 경우 장부 입력 등 정산 서비스 이용이 어려울 수 있습니다.");
  H("8. 개인정보의 안전성 확보 조치");L(["접근 제한: 장부 데이터는 매장 관리자만 열람할 수 있습니다.","부서별 PIN과 매일 바뀌는 번호로 입력을 제한하고, 정산서 조회에는 별도의 정산서 PIN을 사용합니다.","전송 구간은 HTTPS로 암호화됩니다."]);
  H("9. 개인정보 보호책임자");
  P("성명(대표자): "+(c.owner||"__________")+"  /  연락처: "+(c.phone||"__________"));
  if(c.address)P("주소: "+c.address);
  H("10. 처리방침의 변경");P("이 처리방침은 법령이나 서비스 변경에 따라 바뀔 수 있으며, 변경 시 이 페이지를 통해 알려 드립니다.");
  app.append(p);
}
(async function boot(){
  if(!S.demo){
    let booted=false;
    try{
      const r=await apiFetch(CONFIG.SCRIPT_URL+"?action=boot");const j=await r.json();
      if(j.ok){
        S.cfg=Object.assign({},DEFAULT_CFG,{appName:"식대 장부",storeName:"",bizNo:"",owner:"",phone:"",address:"",hours:"",notice:"",retention:"",accent:"",textColor:"",account:""},j.cfg);
        CONFIG.LIMIT=Number(S.cfg.limit)||9000;
        if(j.orgs&&Object.keys(j.orgs).length)DATA=j.orgs;
        S.popular=j.top||[];
        if(j.menu&&j.menu.length)setMenu(j.menu.map(m=>[m.category,m.name,m.price,m.desc]));
        booted=true;
      }
    }catch(e){}
    if(!booted){
      // 통합 호출이 실패한 경우에만 예전 방식(4번 나눠 호출)으로 대신 불러와요
      try{const r=await apiFetch(CONFIG.SCRIPT_URL+"?action=config");const j=await r.json();
        if(j.ok){S.cfg=Object.assign({},DEFAULT_CFG,{appName:"식대 장부",storeName:"",bizNo:"",owner:"",phone:"",address:"",hours:"",notice:"",retention:"",accent:"",textColor:"",account:""},j.cfg);CONFIG.LIMIT=Number(S.cfg.limit)||9000}
      }catch(e){}
      try{const r=await apiFetch(CONFIG.SCRIPT_URL+"?action=depts");const j=await r.json();
        if(j.ok&&Object.keys(j.orgs).length)DATA=j.orgs;
      }catch(e){}
      try{const r=await apiFetch(CONFIG.SCRIPT_URL+"?action=popular");const j=await r.json();
        if(j.ok)S.popular=j.top||[];
      }catch(e){S.popular=[]}
      try{const r=await apiFetch(CONFIG.SCRIPT_URL+"?action=menu");const j=await r.json();
        if(j.ok&&j.menu.length)setMenu(j.menu.map(m=>[m.category,m.name,m.price,m.desc]));
      }catch(e){}
    }
  }
  if(DATA[params.get("org")])S.org=params.get("org");
  S.tab=TABS[0][0];
  document.title=S.cfg.appName;
  if(isHex(S.cfg.accent))document.documentElement.style.setProperty("--mustard",S.cfg.accent.trim());
  if(isHex(S.cfg.textColor)){document.documentElement.style.setProperty("--ink",S.cfg.textColor.trim());document.documentElement.style.setProperty("--muted",S.cfg.textColor.trim())}
  if(KMODE){render(kitchenLogin);return}
  if(params.get("page")==="privacy"){S.from=pickOrg;render(privacyScreen);return}
  render(S.org?pickDept:pickOrg);
})();
</script>
</body>
</html>

```

### 4-2. `Code.gs`

```javascript
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

// 거래내역 열 순서 (입력일시가 맨 오른쪽)
// A기관 B부서 C날짜 D메뉴 E금액(청구) F이름 G인원 H한도초과 I초과금액(현장결제) J기관코드 K부서코드 L날짜확인 M포장완료 N입력일시
const TZ = 'Asia/Seoul';
const LOG_COLS = 16;  // 15번째 '구분': 비어있으면 정상, '사장님 대리입력'이면 사장님이 대신 넣은 것
                       // 16번째 '결제방식': 비어있으면 일반 청구, '선결제차감'이면 미리 받은 선결제에서 자동으로 깎인 것 (월 정산서에서 제외)

function setupLog() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_LOG) || ss.insertSheet(SHEET_LOG);
  if (sh.getLastRow() === 0) {
    sh.appendRow(['기관', '부서', '날짜', '메뉴', '금액(청구)', '이름', '인원', '한도초과', '초과금액(현장결제)', '기관코드', '부서코드', '날짜확인', '포장완료', '입력일시', '구분', '결제방식']);
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
  if (!log || log.getLastRow() < 2) return { count: 0, total: 0, over: 0, rows: [] };
  let count = 0, total = 0, over = 0;
  const rows = [];
  log.getRange(2, 1, log.getLastRow() - 1, LOG_COLS).getValues().forEach(r => {
    const date = r[2] instanceof Date ? Utilities.formatDate(r[2], TZ, 'yyyy-MM-dd') : String(r[2]);
    if (date !== dateStr) return;
    if (String(r[14] || '').trim()) return;                    // 사장님 대리입력 건은 일자별 매출에서 제외
    if (String(r[15] || '') === '선결제차감') return;           // 선결제에서 차감된 건도 일자별 매출에서 제외 (이미 받은 돈이라 오늘 매출이 아님)
    const ts = r[13];
    count++; total += Number(r[4]) || 0; over += Number(r[8]) || 0;
    rows.push({
      time: ts instanceof Date ? Utilities.formatDate(ts, TZ, 'HH:mm') : '',
      org: String(r[0]), dept: String(r[1]), names: String(r[5]), people: Number(r[6]) || 1,
      amount: Number(r[4]) || 0, over: Number(r[8]) || 0
    });
  });
  rows.sort((a, b) => a.time < b.time ? -1 : a.time > b.time ? 1 : 0);
  return { count: count, total: total, over: over, rows: rows };
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
      if (String(r[15] || '') === '선결제차감') return; // 이미 선결제로 낸 건 청구합계에서 제외
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
    spin: normSpin_(r[6])
  }));
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
    if (String(r[15] || '') === '선결제차감') return; // 이미 선결제로 낸 건 정산서(청구)에서 제외
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
// tag가 비어있으면 '정상 입력'(담당자가 직접), '사장님 대리입력'이면 사장님이 대신 넣은 건(일자별 매출에서 제외).
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

function deductPrepaid_(dept, amount, memo) {
  const sh = setupPrepaid_();
  sh.appendRow([new Date(), dept.orgName, dept.name, dept.code, '차감', amount, memo || '']);
}

// 사장님 화면의 '선결제 차감 처리' 전용 기능. 단체 주문처럼 참석자 이름을 일일이 적기 어려운 경우,
// 금액만 입력하면 잔액에서 바로 차감돼요. 이름 목록 대신 메모 한 줄과 인원수만 받아요.
// 거래내역에는 기록을 남기되(추후 확인용), 한도·초과 계산은 하지 않고, 일자별 매출에도 잡히지 않아요.
function prepaidDeductSimple_(b) {
  const chk = checkOwner_(b.pin);
  if (!chk.ok) return json_(chk);
  const dept = readMaster_().filter(d => d.code === b.deptCode)[0];
  if (!dept) return json_({ ok: false, message: '부서를 찾을 수 없어요.' });
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
  rng.setNumberFormats([['@', '@', '@', '@', '#,##0', '@', '0', '@', '#,##0', '@', '@', '@', '@', 'yyyy-mm-dd hh:mm', '@', '@']]);
  rng.setValues([[dept.orgName, dept.name, String(b.date), memo || '선결제 단체 차감',
    amount, '선결제 단체(' + people + '명)' + (memo ? ' - ' + memo : ''), people, '', '',
    dept.orgCode, dept.code, dateFlag_(String(b.date)), '', new Date(), '사장님 대리입력', '선결제차감']]);

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

  // 선결제 잔액이 청구금액을 전부 덮을 만큼 남아있으면, 이번 건은 청구하지 않고 잔액에서 자동으로 차감해요.
  // (잔액이 모자라면 안전하게 평소처럼 정상 청구로 처리해요 — 일부만 차감하는 복잡한 분할은 하지 않아요.)
  let paymentMethod = '';
  const balance = prepaidBalance_(dept.code);
  if (balance > 0 && balance >= billed && billed > 0) {
    deductPrepaid_(dept, billed, String(dateStr) + ' 주문 자동차감 (' + menus.join(', ') + ')');
    paymentMethod = '선결제차감';
  }

  setupLog();
  const log = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_LOG);
  const row = log.getLastRow() + 1;
  const rng = log.getRange(row, 1, 1, LOG_COLS);
  rng.setNumberFormats([['@', '@', '@', '@', '#,##0', '@', '0', '@', '#,##0', '@', '@', '@', '@', 'yyyy-mm-dd hh:mm', '@', '@']]);
  rng.setValues([[dept.orgName, dept.name, String(dateStr), menus.join(', '),
    billed, persons.join(', '), people, over > 0 ? '초과' : '', over || '',
    dept.orgCode, dept.code, dateFlag_(String(dateStr)), '', new Date(), tag || '', paymentMethod]]);
  return json_({ ok: true, total: total, over: over, paymentMethod: paymentMethod });
}

// 사장님이 담당자를 대신해 과거 날짜 주문을 몰아서 입력할 때 씀. PIN·오늘의 번호 없이 사장님 PIN만 확인.
// '사장님 대리입력'으로 표시되어, 일자별 매출 집계에서는 자동으로 빠져요 (정산서·정산현황에는 그대로 포함돼요).
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

```

---

## 5. 기능 명세

### 5-1. 완성된 기능

| 기능 | 동작 설명 |
|---|---|
| 기관/부서 선택 | 첫 화면에서 기관(시청/시의회/교육청) 선택 → 부서명 검색 후 선택. 부서 목록은 `action=depts`(또는 통합 `action=boot`)로 서버에서 실시간으로 불러오며, "사용여부"가 N인 부서는 제외. |
| PIN 인증 | 부서 PIN 3자리 + 오늘의 회전 숫자 1자리(총 4자리) 입력 → `action=verify`(또는 `boot`)로 서버 검증. 5회 연속 실패 시 10분 잠금(`MAX_FAILS=5`, `LOCK_SECONDS=600`, `CacheService` 사용). |
| 회전 숫자(오늘의 번호) | `PropertiesService`에 저장된 비밀값 기반 HMAC 스타일 해시로 매일 자동 변경(`dailyDigit_`/`todayDigit_`). 클라이언트에는 노출되지 않고, 매장에서 구두로만 공지. |
| 주문 입력 | 날짜(기본 오늘, 과거 날짜 선택 시 경고), 식사 인원 전원의 실명(동명이인 방지 검사 포함), 메뉴 탭별 선택, 합계/초과 여부 실시간 계산(1인당 9,000원 × 인원수). 제출 시 `reqId`로 멱등성 보장. |
| 인기 메뉴 TOP3 | 최근 1주일 주문 집계(`popularTop3_`, `refreshStats`)로 메뉴 카드에 🥇🥈🥉 메달 배지 표시. |
| 정산서 조회/다운로드 | 정산서 PIN(공통값, 설정 시트) 입력 후 월별 청구 내역 테이블 확인. **워터마크 JPG 다운로드**: 실제 업로드된 우프스낵바 로고를 반복·회전·저투명도로 배경에 깔고(`z-index:0`), 콘텐츠는 그 위(`z-index:1`)에 렌더링, html2canvas로 캡처 시 가로폭 기준 스케일을 동적 계산해 **최소 2048px(2K) 이상** 보장. 계좌번호 포함, 담당자/매장 확인란(서명란)은 제거. |
| 정산서 수정 요청 | 담당자가 날짜/이름만 수정 요청 가능(금액은 잠금), 사장님 승인 전까지 미반영. 요청이 대기 중이면 잠금 표시. |
| 다운로드 제한 | 월 3회(`MAX_DOWNLOADS=3`)까지만 다운로드 가능, 1회라도 다운로드하면 그 달은 수정 요청 자체가 불가(잠김). |
| 사장님 홈 메뉴 | ① 오늘 주문 확인·포장, ② 일자별 매출·마감 확인, ③ 정산서 수정 요청 확인, ④ 누락 주문 대리 입력, ⑤ 선결제 관리(충전/단체 차감), ⑥ 부서 등록. |
| 주방(오늘 주문) 보드 | 오늘 들어온 주문을 실시간 카드로 표시, 포장완료 체크/취소(`packOrder_`), 오늘의 회전 숫자도 함께 표시(매장 내부 공지용). |
| 일자별 매출 확인 | 선택한 주문 날짜의 총 주문 매출을 청구/현장결제/선결제 사용액으로 나눠 표시. 오늘 화면에는 입력일시가 오늘인 주문을 빨간색으로 별도 집계하고, 펼치면 주문 날짜와 입력 시간을 확인할 수 있어요. 사장님 대리입력과 선결제 사용도 주문일 매출에 포함. |
| 사장님 대리 입력(백필) | 부서 선택 후 여러 날짜의 주문을 **로컬에 스테이징(`OB.pending` 배열)** → "확인" 버튼 한 번으로 **전체를 한 번의 네트워크 요청(`action=ownerAddBatch`)으로 일괄 저장**(기존에는 건당 1회 호출이었으나 사용자 요청으로 배치화됨). 한 번에 최대 150건. |
| 선결제(충전) 시스템 | 사장님이 매장 결제 수령 후 부서별 충전을 등록. 부서의 메뉴 주문은 잔액을 먼저 쓰고 부족분은 현장결제. 주문일 매출에는 선결제 사용액을 별도 표시해 총 주문 매출에 포함하고, 월 정산서에서는 중복 청구하지 않음. |
| 선결제 단체 차감(이름 없이) | 부서 홈의 `선결제`에서 해당 부서가 직접 차감하거나 사장님 메뉴에서 처리. 둘 다 선결제 원장과 거래내역에 기록하고, 사용액은 일자별 매출에 포함. |
| 선결제 잔액 확인 | 사장님 화면에서 부서별 잔액 조회(`action=prepaidBalance`/`prepaidBalances`) + 시트 메뉴 [부서별 선결제 잔액 확인]으로도 확인 가능. |
| 부서 등록 | 사장님 웹 메뉴에서 기관/부서명/담당자 이름·이메일/연락처/메모와 서류 메일 발송 여부를 선택. 서버가 기관별 부서코드와 전체 부서 중복 없는 3자리 PIN을 생성해 부서마스터 A~K열에 기록. 메일 발송을 선택하지 않으면 연락처 이메일과 문서 업로드 없이 등록 가능. 중복 기관+부서명은 거부. |
| 부서 안내 서류 | 이메일 발송을 선택한 부서에만 사업자등록증·통장사본을 첨부. 필요 시 등록 화면에서 파일을 최초 업로드하고, 스크립트 소유자의 비공개 Drive 폴더에 보관. 발송 실패 시 등록 결과 화면에서 재전송 가능. 최초 사용 시 Apps Script 메뉴 [부서 서류 이메일 권한 확인] 실행. |
| 부서 신규 등록 시 PIN 자동 생성 | 웹 부서 등록 시 PIN 자동 생성. 시트 메뉴 [PIN 자동 생성]도 기존 PIN을 바꾸지 않고 비어있는 행에만 고유 PIN을 발급. |
| 속도 개선 (2026-09-25) | 최초 접속 시 4번 나눠 하던 호출(`config`/`depts`/`popular`/`menu`)을 **`action=boot` 단일 통합 호출**로 축소(실패 시 기존 4회 호출로 자동 폴백). html2canvas 스크립트를 페이지 로드 시 즉시 불러오지 않고 **"이미지로 저장" 버튼을 실제로 누를 때만 지연 로딩**하도록 변경. |
| 연결 재시도 + 중복 방지 | `apiFetch()`가 네트워크 실패 시 900ms 후 자동 1회 재시도. 모든 저장성 POST에 `reqId`를 실어보내고, 서버는 `withIdempotency_()`로 같은 `reqId`의 응답을 600초간 캐시해 재전송해도 중복 저장되지 않도록 함. |
| 자동 백업 | 매일 새벽 3시(`backupNow`, 시간 트리거) 스프레드시트 전체를 Drive에 복사본으로 백업, 30일 지난 백업은 자동 삭제(`BACKUP_KEEP_DAYS=30`). |
| 월간 자동 정산 | 매월 1일 오전 6시(`monthlyAuto`, 시간 트리거) 전월 정산 현황을 자동 갱신(`refreshSettlementFor_`). |
| 시트 오손 방지(경고) | 거래내역/부서마스터/설정/메뉴판/정산현황/선결제 시트에 **10,000행까지 미리 보호 범위를 지정**(`setupSafety`, 경고 전용 보호 — 접근 제어 아님, 실수로 지울 때 경고창만 뜸). |
| 개인정보 처리방침 페이지 | 앱 내 별도 화면(`privacyScreen`)으로 제공, 이름 보관 기간 등 안내. |
| 오래된 이름 자동 삭제 | `purgeOldNames` — 보관 기간 경과 후 개인정보(이름) 자동 파기 (시간 트리거로 정기 실행되는 것으로 추정 — **정확한 트리거 주기는 Code.gs `setup*Trigger` 계열 함수 확인 필요. 설정 여부 확인 필요**). |

### 5-2. 미완성/버그가 의심되거나 확인이 필요한 항목
- **`purgeOldNames`의 자동 실행 트리거 설정 여부** — 함수는 존재하나, 이 함수를 주기적으로 호출하는 트리거(`setup...Trigger`)가 실제로 등록되어 실행 중인지 **확인 필요**. (스프레드시트 트리거 목록에서 직접 확인 권장)
- **PIN 5회 실패 잠금(`MAX_FAILS`/`LOCK_SECONDS`) 관련 UI 안내 문구** — 서버 로직은 구현되어 있으나, 잠금 상태일 때 프런트엔드가 "몇 분 후 다시 시도하세요" 같은 구체적 안내를 보여주는지 **index.html 전체 재검토로 확인 필요** (5-1 표의 다른 항목들처럼 개별적으로 재확인된 것은 아님).
- **`GET /?page=privacy` 이외에 사장님 화면(주방보드/매출/승인/백필/선결제)에서 브라우저 뒤로가기(모바일 제스처)에 대한 동작** — 앱 내 자체 "처음으로" 버튼은 있으나 브라우저 네이티브 뒤로가기 버튼과의 상호작용은 **확인 필요**.
- **오프라인 상태에서의 동작** — PWA/서비스워커가 없어 완전 오프라인 시에는 동작하지 않음(네트워크 재시도는 있지만 완전 단절 시 대응 없음). 필요 시 추가 논의 필요.

### 5-3. 사용자가 요청했지만 아직 반영되지 않은 사항
- **전용 "선결제 잔액 요약" 탭**: "차감된 잔액은 어디에 표시가 되는거야?"라는 질문에 답하면서, 매번 시트 메뉴를 실행하지 않아도 항상 최신 잔액을 볼 수 있는 별도 요약 탭을 만들어주겠다고 제안했으나, **사용자가 아직 원한다/안한다 답변을 하지 않은 상태**입니다. (현재는 사장님 웹 화면의 선결제 잔액 확인 기능 + 시트 메뉴 [부서별 선결제 잔액 확인]으로만 확인 가능)

---

## 6. 디자인 세부사항

### 6-1. 색상 팔레트 (CSS 커스텀 프로퍼티, `index.html` `:root`)

**라이트 모드 (기본)**
| 변수 | HEX | 용도 |
|---|---|---|
| `--bg` | `#F3EEE3` | 전체 배경 (크래프트 베이지) |
| `--paper` | `#FFFFFF` | 카드 배경 |
| `--ink` | `#2B2118` | 기본 텍스트 |
| `--muted` | `#7A6B5C` | 보조 텍스트 |
| `--line` | `#DDD3C2` | 테두리 |
| `--mustard` | `#F0B429` | 포인트/강조(버튼, 배지, 활성 탭) |
| `--mustard-ink` | `#2B2118` | 머스타드 배경 위 텍스트 |
| `--ketchup` | `#C93A26` | 경고/초과 |
| `--ketchup-bg` | `#FCE9E4` | 경고 배경 |
| `--ok` | `#2F7D4F` | 정상/성공 |
| `--ok-bg` | `#E4F3EA` | 성공 배경 |

**다크 모드** (`prefers-color-scheme: dark` 또는 `data-theme="dark"`)
| 변수 | HEX |
|---|---|
| `--bg` | `#1B1611` |
| `--paper` | `#27201A` |
| `--ink` | `#F4ECDF` |
| `--muted` | `#A79886` |
| `--line` | `#41372D` |
| `--mustard` | `#F0B429` (동일) |
| `--ketchup` | `#FF7B67` |
| `--ketchup-bg` | `#3E1F19` |
| `--ok` | `#6CCB93` |
| `--ok-bg` | `#1D3427` |

정산서(JPG로 출력되는 `.paper` 영역)는 위 CSS 변수와 무관하게 **항상 흰 배경(`#fff`)에 어두운 텍스트(`#222`)로 고정** — 다크모드에서도 인쇄물처럼 보이도록 의도됨. 정산서 초과 표기는 `#b3321f`.

관리자(사장님) 화면 강조색: 지정 없음, 위와 동일한 팔레트 재사용.

사장님이 설정 시트에서 브랜드 강조색(`accent`)과 본문색(`textColor`)을 직접 HEX로 지정하면, `--mustard`와 `--ink`/`--muted`를 런타임에 덮어씀(`isHex()` 검증 후 `style.setProperty`).

### 6-2. 폰트
- 제목/숫자/버튼 등 강조 텍스트: **"Do Hyeon"** (구글 폰트, 단일 weight)
- 본문: **"IBM Plex Sans KR"**, weight 400/500/600
- 폴백: `system-ui, -apple-system, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`
- 기본 body font-size: `16px`, line-height `1.5`

### 6-3. 여백/사이즈 규칙
- 전체 컨테이너(`.wrap`) 최대 너비: **520px**, 좌우 패딩 16px, 하단 패딩 140px(고정 하단 바 공간 확보)
- 주방 화면(`.wrap.k`)만 예외적으로 최대 너비 **760px**
- 카드(`.card`) 모서리 반경 14px, 패딩 16px
- 버튼/탭 모서리 반경: 큰 버튼 12px, 원형 탭 999px(완전 pill), 정산서 칩(`.badge`) 999px
- 하단 고정 합계 바(`.bar`): `position:fixed`, `env(safe-area-inset-bottom)` 반영(아이폰 노치 대응)
- 포커스 표시: `outline:3px solid var(--mustard)` + `outline-offset:2px` (접근성)

### 6-4. 반응형 브레이크포인트
- **별도의 `@media (max-width: ...)` 브레이크포인트 없음.** 모바일 우선 단일 레이아웃(최대 520px 폭 고정, 그 이상 화면에서는 가운데 정렬)으로 설계되어 있어 태블릿/데스크톱에서도 폭만 제한된 채 동일하게 보임.
- 다크모드 전환은 `@media (prefers-color-scheme: dark)`로만 처리(뷰포트 폭과 무관).
- **확인 필요**: 실제 매장에서 사용하는 기기(태블릿 vs 휴대폰 vs 키오스크)의 화면 크기가 520px보다 훨씬 클 경우 레이아웃이 의도대로 보이는지 실기기 확인 권장.

### 6-5. 이미지/아이콘 출처
- **로고**: 사용자가 대화 중 업로드한 실제 우프스낵바 로고 이미지(`/mnt/user-data/uploads/` 내 업로드 파일 중 하나 — **정확히 어느 파일이 최종 채택된 로고인지, 그리고 그 base64가 `index.html`의 워터마크 레이어에 정확히 어떤 형태로 인라인 삽입되어 있는지는 소스 전문을 grep하여 재확인 필요.** 현재 `index.html` 발췌본에서는 워터마크 관련 base64 블록이 확인되지 않았으므로, 최종 zip의 `index.html` 전체(1,066줄)에서 `data:image` 또는 `watermark` 키워드로 직접 검색해 확인할 것.**확인 필요**)
- 이모지 아이콘만 사용(🥇🥈🥉, 📢, ⌂ 등) — 별도의 아이콘 폰트/SVG 아이콘 세트 없음.
- 업로드된 모든 원본 이미지는 `/mnt/user-data/uploads/`에 보관되어 있으며 파일명은 타임스탬프 기반(`1790xxxxxxxxx_image.png` 등)이라 의미를 알 수 없음 — **어느 파일이 최종 로고/워터마크 원본인지 확인 필요**.

---

## 7. 데이터 및 연동

### 7-1. 사용된 외부 서비스
- **Google Apps Script** (백엔드 실행 환경) — API 키 불필요, Apps Script 프로젝트를 구글 스프레드시트에 바인딩하고 웹앱으로 배포하는 방식이라 별도 인증키가 노출되지 않음.
- **Google Sheets** (데이터 저장) — 별도 API 키 없이 Apps Script의 `SpreadsheetApp`로 같은 프로젝트 내에서 직접 접근.
- **Google Fonts CDN** — 키 불필요.
- **cdnjs (Cloudflare)** — html2canvas 라이브러리, 키 불필요.
- **Netlify** — 정적 호스팅, 별도 API 키로 배포하지 않고 웹 UI(Deploys 탭 드래그)로 수동 배포.

### 7-2. 환경변수/키
**이 프로젝트는 `.env` 또는 시크릿 키를 전혀 사용하지 않습니다.** 대신 아래 "비밀값"이 존재하며, 모두 구글 스프레드시트 자체 또는 Apps Script `PropertiesService`에 저장되어 있습니다.

| 이름(역할) | 저장 위치 | 필요 이유 |
|---|---|---|
| 부서 PIN(3자리, 77개 부서 각각) | "부서마스터" 시트 탭 | 부서별 접근 분리 |
| 정산서 PIN(공통값) | "설정" 시트 탭 | 금액 정보(정산서) 접근 분리 |
| 사장님(owner) PIN | "설정" 시트 탭 (`getOwnerPin_()`) | 관리자 화면 접근 |
| 회전 숫자 비밀 시드(HMAC용) | Apps Script `PropertiesService` | 매일 자동으로 바뀌는 4번째 숫자 생성 |
| `CONFIG.SCRIPT_URL` (Apps Script 웹앱 배포 주소) | `index.html` 내 하드코딩 | 프런트→백엔드 통신 — **이 값은 비밀키가 아니라 공개 엔드포인트 URL**이지만, 재배포(새 버전 배포) 시 주소가 바뀔 수 있으므로 갱신 필요 |

### 7-3. 폼 제출/DB 연동
- 폼 제출 = `index.html`의 `apiFetch(CONFIG.SCRIPT_URL, {method:'POST', ...})` → Apps Script `doPost(e)` 라우터가 `e.postData.contents`를 JSON 파싱 → `b.action` 값에 따라 분기.
- DB = 별도 DB 없음. **구글 스프레드시트 탭 자체가 DB**:

| 시트 탭 이름(상수명) | 역할 |
|---|---|
| `부서마스터` (`SHEET_MASTER`) | A~G열은 기관코드/기관명/부서코드/부서명/PIN/사용여부/정산서PIN, H~K열은 담당자 이름/이메일/연락처/메모. 부서 등록 화면에서 기록. |
| `거래내역` (`SHEET_LOG`) | 모든 주문 원장 (17개 컬럼, `LOG_COLS=17`). Q열 `선결제 사용액`을 추가해 주문 매출/청구/현장결제/선결제 사용을 구분 기록. |
| `설정` (`SHEET_SETTINGS`) | 매장명/사업자번호/대표자/전화/주소/영업시간/공지/보관기간/색상/계좌번호/사장님PIN/정산서공통PIN/1인당 한도 등 키-값 설정 |
| `메뉴판` (`SHEET_MENU`) | 메뉴 탭/이름/가격/설명 |
| `정산현황` (`SHEET_SETTLE`) | 월별×부서별 정산 상태(다운로드횟수, 승인대기 여부, 수정요청 JSON, 마지막처리일시) |
| `선결제` (`SHEET_PREPAID`) | 부서별 충전/차감 거래 로그 (잔액은 이 로그의 합산으로 산출) |

### 7-4. Apps Script 라우팅 전체 목록 (엔드포인트 스펙)

**`doGet(e)` — `?action=` 쿼리 파라미터로 분기**
| action | 필요 파라미터 | 설명 |
|---|---|---|
| `verify` | `dept`, `pin` | 부서 PIN+오늘의번호 검증 |
| `verifyspin` | `dept`, `pin`, `spin` | 정산서 PIN 검증 |
| `statement` | `dept`, `pin`, `spin`, `month` | 월별 정산 내역 + 수정상태 |
| `depts` | - | 사용 중인 부서 목록(기관별로 묶어서, PIN 미포함) |
| `popular` | - | 최근 1주 인기 메뉴 TOP3 |
| `menu` | - | 메뉴판 전체 |
| `config` | - | 설정값 전체 |
| **`boot`** | - | **(2026-09-25 신규)** config+depts+popular+menu를 한 번에 |
| `pendingEdits` | `pin`(owner) | 승인 대기 중인 수정요청 목록 |
| `prepaidBalance` | `pin`(owner), `dept` | 특정 부서 선결제 잔액 |
| `deptPrepaidBalance` | `dept`, `pin`(해당 부서) | 로그인한 부서의 선결제 잔액 |
| `deptDocsStatus` | `pin`(owner) | 부서 등록 서류 업로드 여부/파일명 |
| `prepaidBalances` | `pin`(owner) | 전체 부서 선결제 잔액 목록 |
| `sales` | `pin`(owner), `date` | 주문 날짜별 총매출 및 오늘 입력된 주문 목록 |
| `orders` | `pin`(owner) | 오늘 주문 목록 + 오늘의 회전숫자 |

**`doPost(e)` — JSON body의 `action` 필드로 분기, 전체가 `withIdempotency_(reqId, fn)`으로 래핑됨**
| action | 설명 |
|---|---|
| (body 최상위, action 필드 없음) | 일반 주문 제출 (`insertOrderRow_` 경로) |
| `pack` | 사장님: 주문 포장완료 체크/해제 |
| `requestEdit` | 담당자: 날짜·이름 수정 요청 |
| `resolveEdit` | 사장님: 수정 요청 승인/거부 |
| `download` | 다운로드 전 서버측 허용 여부 확인(승인대기/월3회 제한) |
| `ownerAdd` | 사장님: 과거 날짜 주문 1건 대리 입력 |
| `ownerAddBatch` | 사장님: 여러 건을 한 번에 대리 입력(배치, 최대 150건) |
| `prepaidDeduct` | 사장님: 선결제 잔액에서 금액만(이름 없이) 바로 차감 |
| `prepaidDeptDeduct` | 부서 PIN으로 해당 부서 선결제 단체 차감 |
| `prepaidCharge` | 사장님: 부서 선결제 충전 |
| `deptDocsUpload` | 사장님: 사업자등록증/통장사본 비공개 Drive 업로드 |
| `registerDepartment` | 사장님: 부서코드/PIN 생성, 부서마스터 기록, 선택 시 안내 서류 이메일 발송 |
| `deptDocsResend` | 사장님: 등록된 부서로 안내 서류 재전송 |

> 위 표는 `Code.gs`를 `grep`하여 추출한 **실제 코드 기준 확정 목록**입니다.

---

## 8. 대화 중 결정된 사항 (Decision Log, 시간순)

1. **최초 아이디어**: "매장 수기 장부를 디지털화" → 공공기관 3곳(시청/시의회/교육청)이 부서별로 접근을 분리해야 한다는 요구로 확장.
2. **회원가입 여부**: "공무원들은 회원가입을 하지 않는다"로 명시적으로 결정 → PIN 기반 무계정 인증 채택.
3. **접근 구분 단위**: 기관 단위가 아니라 **부서 단위**로 코드(PIN) 발급하기로 결정. (QR코드 방식도 검토됐으나 최종적으로 PIN 입력 방식 채택 — **QR을 배제한 구체적 이유가 대화에 명시되어 있지 않아 확인 필요**.)
4. **한도**: 1인당 9,000원, 초과분은 "매장에서 직접 구두로 처리"(시스템은 경고만 표시하고 결제를 막지는 않음)로 결정.
5. **실명 기록**: 애초부터 "외 N명" 표기 금지, 전원 실명 입력으로 결정.
6. **정산서 위치/실시간성**: 사장님이 시트를 직접 수정해도 실시간 반영되도록(정산서, 부서 목록, 메뉴 모두) 결정 — 시트가 곧 소스오브트루스(Source of Truth).
7. **사장님 전용 주문 확인 화면 UX**: 사용자가 "뭐가 좋은지 모르겠다"고 답해, Claude가 방식을 제안하고 결정한 사안(주방 보드 형태로 최종 구현).
8. **워터마크 요구**: "WOOF SNACK BAR 텍스트 + 햄버거 스탬프 + 강아지 캐릭터"로 최초 요청 → 이후 **실제 업로드한 로고 이미지로 교체**하기로 변경.
9. **정산서 레이아웃**: 담당자 확인란/매장 확인란(서명란) **제거**, 계좌번호 **추가**, 순서는 "청구금액(계좌번호) → 사업자번호 → 대표자 연락처 → 발행일" 순으로 확정. 매장 주소는 정산서에서 제외(단, 앱 내 매장정보 카드에는 별도 표시 가능).
10. **정산서 수정 워크플로**: "금액은 고정, 날짜·이름만 수정 가능 + 사장님 승인 필요 + 승인 후에도 다운로드 전이면 재수정 가능 + 다운로드 1회 이상 시 잠금 + 월 3회 다운로드 제한"으로 세부 규칙까지 전부 확정.
11. **PIN 재생성 버그 리포트 → 수정**: "재생성 시 기존 부서 PIN도 바뀐다"는 **우려**였으나 실제로는 기존 값은 안 바뀌고 있었음(빈 칸만 채우는 로직). 다만 **신규 발급 PIN끼리 충돌 가능성**이 실제 결함으로 확인되어 수정.
12. **사장님 대리 입력 방식 변경**: 원래 "건당 1회 네트워크 호출" → 사용자가 "누락된 걸 하루하루 입력하고 확인 누르는 게 오래 걸린다"고 명시적으로 불편 제기 → **로컬 스테이징 + 단일 배치 제출**로 변경.
13. **선결제(충전) 시스템 추가**: "일일 매출 화면에 선결제 차감이 빠져있다"는 버그 리포트 + "20명 단체 주문은 이름 없이 금액만 차감할 수 있어야 한다"는 신규 요구가 동시에 제기되어, 둘 다 구현(버그 수정 + 신규 화면 추가).
14. **접속 속도 개선(가장 최근, 2026-09-25)**: "사이트 접속 속도를 빠르게 하는 방법"을 물어, Claude가 (a) boot 액션 통합, (b) html2canvas 지연 로딩 2가지를 원인 진단과 함께 제안·구현·배포 안내까지 완료.
15. **Netlify 배포 실수 반복 → 절차 고정**: "Drop으로 새로 올리면 매번 새 프로젝트가 생긴다"는 문제를 겪은 뒤, **"반드시 기존 `woofsnackbar` 사이트 → Deploys 탭에서 재배포"**로 절차를 고정.
16. **파일 인코딩 문제**: 사용자가 메모장(Notepad)으로 `index.html`을 열어 저장하면서 한글이 깨지는 사고 발생 → **VS Code 사용 권장**으로 결정, Claude가 UTF-8로 재전달.

---

## 9. 배포 관련

### 9-1. 목표 배포 플랫폼
- **프런트엔드**: Netlify (정적 호스팅) — 현재 운영 중인 사이트: `https://woofsnackbar.netlify.app/`
- **백엔드**: Google Apps Script 웹앱 배포 (현재 배포 URL: `https://script.google.com/macros/s/AKfycbzo1aYFlYVsEnnC7Hj_Nnhes8H_MG5LgXlPa1bDj9lF-5iHcHK61eAfyGSJd5ebI_uDiw/exec`)

### 9-2. 도메인
- 커스텀 도메인(가비아 등) 연결 여부: **대화 중 "가비아 도메인 구입?" 질문은 있었으나, 실제로 커스텀 도메인을 구입·연결했다는 확정 진행 기록은 없음 — 확인 필요.** 현재는 Netlify가 제공하는 기본 서브도메인(`woofsnackbar.netlify.app`)만 사용 중인 것으로 보임.

### 9-3. 빌드 명령어
- **없음.** `index.html`은 빌드 과정 없이 파일 그대로 Netlify Deploys 탭에 드래그 앤 드롭하면 즉시 반영됩니다.
- `Code.gs`도 트랜스파일/빌드 없이, Apps Script 온라인 편집기에 전체 코드를 붙여넣고 **배포 → 배포 관리 → 편집(연필 아이콘) → 새 버전으로 배포**하면 됩니다(기존 배포 URL 유지).

### 9-4. 배포 시 주의사항
1. **`index.html` 업로드 전 반드시 UTF-8 인코딩으로 저장**할 것 (메모장 사용 금지, VS Code 권장) — 안 그러면 한글이 깨져 "Uncaught SyntaxError" 발생.
2. **Netlify는 반드시 `woofsnackbar` 사이트의 Deploys 탭**에서 재배포할 것. `app.netlify.com/drop`을 쓰면 매번 새 프로젝트가 생성됨.
3. **Code.gs 배포는 "새 버전으로 배포"를 선택**해야 기존 웹앱 URL이 유지됨(새 배포를 만들면 URL이 바뀌어 `index.html`의 `CONFIG.SCRIPT_URL`도 같이 갱신해야 하는 번거로움 발생).
4. Code.gs를 수정해 배포한 뒤에는, 구글 시트 메뉴에서 **[실수 방지 설정 켜기]**(`setupSafety`)를 다시 눌러 최신 보호 범위(10,000행)를 재적용할 것.
5. 신규 부서를 등록한 뒤에는 **[PIN 자동 생성]** 메뉴를 실행해야 PIN이 채워짐(기존 PIN은 보존, 신규만 채움, 중복 없음).
6. 첫 배포/설정 시 실행해야 하는 Apps Script 함수(시트 메뉴 또는 편집기에서 1회 수동 실행): `setupLog`, `setupSettings`, `setupMenu`, `setupSafety`, `setupBackupTrigger`, `setupMonthlyTrigger`, `setupPrepaid_`, `generatePins` — **정확한 최초 설치 순서와 각 함수의 의존관계(예: 어떤 걸 먼저 실행해야 하는지)는 `Code.gs`의 `onOpen()` 메뉴 구성과 각 setup 함수의 전제조건을 코드 레벨로 재확인 필요.**

---

## 10. 남은 작업 (TODO, 우선순위 순)

| 우선순위 | 작업 | 상태/비고 |
|---|---|---|
| 1 (사용자 응답 대기) | "선결제 잔액 요약" 전용 시트 탭 추가 여부 확정 | Claude가 제안했으나 사용자 미응답. 다음 대화에서 먼저 확인할 것. |
| 2 | `purgeOldNames` 자동 실행 트리거가 실제로 등록되어 있는지 확인 | 개인정보 보관기간 정책 준수와 직결되므로 우선 확인 권장 |
| 3 | 커스텀 도메인 연결 여부/계획 확정 | "가비아 도메인" 언급만 있고 후속 진행 기록 없음 |
| 4 | 워터마크 로고 원본 파일 식별 및 재확인 | `/mnt/user-data/uploads/` 내 어느 파일이 최종 채택본인지 문서화 필요 |
| 5 | PIN 5회 실패 잠금에 대한 사용자 안내 문구가 실제로 존재하는지 `index.html` 전수 재검토 | UX 완성도 이슈 |
| 6 (낮음, 아이디어 단계) | 구글 애드센스 승인용 별도 정보성 블로그/사이트 운영 아이디어 | "궁금해서 물어본 것"이라며 실제 제작 요청은 아니었음(보류) |

---

## 부록: 이어받는 세션(Claude Code 등)을 위한 즉시 실행 체크리스트

1. 첨부된 `woofsnackbar_source.zip`의 압축을 풀어 `index.html`, `Code.gs`, `부서마스터.csv`, PDF 2종, xlsx 샘플을 확인한다.
2. `index.html`을 로컬 브라우저로 열면 `CONFIG.SCRIPT_URL`이 채워져 있어 데모 모드가 아니라 **실제 운영 중인 구글시트와 통신하는 상태**이므로, 로컬 테스트 시 실수로 실거래 데이터를 건드리지 않도록 주의한다(테스트가 필요하면 `SCRIPT_URL`을 빈 문자열로 바꿔 데모 모드로 전환).
3. `Code.gs`를 수정할 경우, 반드시 본 문서 2번(기술 스택)·7-4번(엔드포인트 스펙)·9번(배포 주의사항)을 먼저 읽고, 같은 Apps Script 프로젝트의 "새 버전으로 배포"로만 배포한다.
4. 사용자는 비개발자(사장님)이므로, 모든 안내는 한국어로, 배포 절차를 포함해 아주 구체적으로 안내해야 한다(이번 대화 전체의 톤을 유지).
