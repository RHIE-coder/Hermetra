# 게이트 기록 — 2026-08-14 · workspace-switch-and-overlay-freeze

유저 제보 네 건. 둘은 같은 뿌리였고, 하나는 질문이었다.

| 슬롯 | 값 |
|---|---|
| 대상 | `src/renderer/App.tsx` · `modules/{studio,web,mobile}/store.ts` · `components/dev-feedback/feedback-overlay.tsx` · `main/services/scripts.ts` · `studio/pages/BrowserPage.tsx` |
| 인수조건 | `AC-workspace.switcher.list-02` · `-02a` · `AC-tools.dev-feedback.mark-04` · `AC-studio.browser-29` · `-30` |
| 스펙 | `docs/spec/workspace/switcher.md` · `docs/spec/tools/dev-feedback.md` · `docs/spec/studio/browser.md` |
| 테스트 | `modules/studio/store.test.ts` (3, 신규) · `feedback-overlay.test.tsx` (+2) · `tests/api/scripts.test.ts` (+4) |

## 1. 워크스페이스를 바꿔도 스크립트가 그대로였다

**제보** — "워크스페이스를 바꿨는데 왜 스크립트 폴더구조가 그대로야? shared한걸 원하는게
아닌데" / "왜 폴더만드니까 lib가 사라진거야?"

두 제보가 한 결함의 앞뒤다. `App.tsx` 의 워크스페이스 전환 처리에 **브라우저 작업대
(`modules/studio`)가 없었다** — 2026-08-12 에 데이터 파이프라인에서 갈라져 나오면서
목록에 안 올랐다. 그래서:

1. 전환해도 파일 트리가 안 바뀐다 → "스크립트가 공유되는구나"로 읽힌다.
2. 폴더를 하나 만드는 순간 메인이 **지금 워크스페이스의** 목록을 돌려주고, 그때서야 트리가
   갱신되어 앞 워크스페이스의 `lib` 가 사라진다 → "폴더를 만들었더니 lib 가 지워졌다".

디스크는 처음부터 옳았다(제보 시점 실측):

```
workspaces/ws-msadnh22n858(default)/scripts/studio/  example.ts, lib/rows.ts
workspaces/ws-msskbsx6ka42(Example)/scripts/studio/  example.ts, <새 폴더 2개>
```

**고친 것** — 세 스토어에 `reloadScripts` 를 두고 `App.tsx` 전환 처리가 셋 다 부른다.
목록만 다시 읽던 웹·모바일도 같이 바꿨다: 편집기에 열린 파일이 떠난 워크스페이스 것으로
남아 있었고, 거기서 저장하면 남의 워크스페이스에 그 파일이 생긴다. 트리 교체와 편집기
비우기는 **한 갱신**이다 — 사이가 벌어지면 편집기가 곧 없어질 파일을 자동으로 집는다.

**확인** — 실제 앱(빌드본, mock 드라이버, 격리 userData)을 Playwright 로 몰아서:

| 단계 | 트리 | 편집기 |
|---|---|---|
| default | `example.ts` | `example.ts` |
| default + `only-in-default.ts` 만들고 열기 | `example.ts`, `only-in-default.ts` | `only-in-default.ts` |
| Second 로 전환 | `example.ts` | `example.ts` |

## 2. 피드백 오버레이가 떠 있어도 앱의 팝업이 닫혔다

**제보** — "워크스페이스 팝업창이 띄어진 상태에서 Feedback을 보내려고 하는데 자꾸 마우스
클릭하면 없어지네? 앱 freeze가 왜 안되는거야?"

에러가 아니라 얼리기의 구멍이다. 오버레이가 앱을 덮으니 누름이 앱의 **버튼**에는 안 닿지만,
팝업의 "밖을 누르면 닫힌다"는 `window.addEventListener('mousedown')` 이고 오버레이 위의
누름도 거기까지 거품처럼 올라간다. 가리키려는 순간 가리킬 것이 사라졌다.

**고친 것** — 오버레이가 열린 동안 `document.body` 에서 오버레이發 포인터·마우스·터치
이벤트의 전파를 끊는다. React 는 그 아래 루트 컨테이너(`#root`)에서 이벤트를 나눠 주므로
오버레이 자신의 버튼은 그대로다. 휠·키보드는 뺐다 — 이 도구의 스크롤 예외와 단축키가
`window` 에 걸려 있다.

**확인** — 개발 서버 + 빌드된 메인 + 격리 userData (이 도구는 개발 빌드에만 있어 e2e 로
못 덮는다. `docs/spec/tools/dev-feedback.md` 의 "알려진 한계" 절차 그대로):

| 확인 | 고치기 전 (HEAD) | 고친 뒤 |
|---|---|---|
| 전환기 팝업 열림 | true | true |
| 오버레이 열림 | true | true |
| 오버레이 띄운 직후 팝업 | true | true |
| **표시한 뒤 팝업** | **false** | **true** |
| 오버레이 자신의 훑어보기 버튼 | true | true |

## 3. "이건 어떻게 import해서 사용하는거야?" — 시드가 답을 안 하고 있었다

**제보** — 화면 피드백(`.harness/feedback/20260814-152452-studio-browser`)에서 `lib` 폴더를
가리키며 물었다.

물음 자체가 결함의 증거다. 시드는 `lib/` 를 만들지도 가리키지도 않으면서 "imports of your
other scripts ... all work" 를 **주석으로만** 적고 있었고, 그 옆에는 예전 시드가 남긴 `lib/`
폴더가 설명 없이 서 있었다. 주석은 정작 물리는 두 가지를 짐작에 맡긴다 — 어느 폴더인지,
그리고 **확장자가 선택이 아니라는 것**. 둘 다 글로는 멀쩡해 보이고 실행이 실패해야 드러난다.

**고친 것** — 시드가 실제로 import 하고, 불러오는 파일을 같이 깐다.

```ts
// Your own file, one folder down — open lib/rows.ts to see the other side.
// The '.ts' is not optional: Node loads these as ES modules, and an ES module
// asks for the file by its real name. A package you installed is a bare name
// instead: import { load } from 'cheerio';
import { clean, type Row } from './lib/rows.ts';
...
console.log(headings.length, 'headings', headings.map(clean));
```

`lib/rows.ts` 의 이름·모양은 **이미 사람들 디스크에 있는 그 파일에 맞췄다**(2026-08-13 이전에
열린 워크스페이스마다 있다). 그쪽이 이제 사람의 파일이라 덮지 않으므로, 시드가 거기 맞추는
방향이어야 한다.

새 파일을 만들 때 놓이는 문구(`DEFAULT_SCRIPT`)는 예시를 **되풀이하지 않고 가리킨다** — 그
문구는 만들어진 자리에 그대로 놓이고, 하위 폴더의 `'./lib/rows.ts'` 는 아무 데도 안 닿는다.

**테스트가 무엇을 잡나** (셋 다 일부러 깨뜨려 빨간불을 확인했다):

| 깨뜨린 것 | 결과 |
|---|---|
| `'./lib/rows.ts'` → `'./lib/rows'` (확장자 뺌) | 실행 테스트 FAIL (`ERR_MODULE_NOT_FOUND`) |
| `clean` → `scrub` (export 안 된 이름) | 정적 대조 + 실행 테스트 FAIL |
| — (원상복구) | 33 passed |

**확인 (1) — 빌드된 앱, mock, 새 워크스페이스:**

```
트리: lib / example.ts        → lib 를 펴면 rows.ts
열린 파일: example.ts, 12번째 줄에 import
편집기 빨간 줄(squiggle): 0
```

**확인 (2) — 실제 Camoufox 로 실행 버튼을 눌렀다** (`HERMETRA_DRIVERS=real`, 헤드리스,
격리 userData). 예시를 고치지 않고 앱이 깐 그대로 돌렸다:

```
연결됨 — ws://[::1]:62875/5c4e6d71a4e415bbf8e7113a5665f52f
열린 탭 — https://example.com/
출력 —
  title: Example Domain
  1 headings [{"title":"Example Domain"}]
```

에러 줄 0. 붙는 데 2초, 예시는 한 번에 통과했다. 이 한 번이 세 가지를 같이 답한다 —
상대 import 가 스크립트 옆에서 풀리고, Node 가 `import { clean, type Row }` 의 인라인
`type` 지정자를 벗겨 내고, `headings.map(clean)` 이 실제로 불릴 함수를 받았다는 것
(못 받았으면 그 줄에서 던진다). `clean` 이 **무엇을 하는지**는 여기서 안 보인다 —
example.com 의 `h1` 에 깎을 공백이 없다. 그쪽은 패딩 넣은 입력으로 진짜 실행기를 돌리는
`tests/api/scripts.test.ts` 가 덮는다.

기존 워크스페이스 갱신도 실측했다. 유저의 `default` 워크스페이스 `example.ts` 는 등록한 옛
시드와 **바이트 단위로 일치**(850자)하므로 다음 실행에서 새 시드로 바뀌고, 이미 있는
`lib/rows.ts` 는 그대로 남는다 — 그 파일이 export 하는 이름이 새 시드가 부르는 이름이다.

## 4. "문법은 뭘 참고해? extract/transform 은 왜 필요한데?"

**제보** — 앞 건의 예시를 받고 나서 두 개가 더 나왔다. ⑴ 참고할 문서 링크라도 있었으면 좋겠다,
⑵ 시드 끝의 `export extract` / `transform` 세 줄이 무엇이고 왜 필요한지 모르겠다.

### ⑵ 부터 — 정당화가 안 됐다

코드로 확인한 것:

| 물음 | 사실 |
|---|---|
| 라이브러리 문법인가 | 아니다. 이 앱이 지은 이름 둘 |
| 그 이름을 아는 코드 | `host/runner.ts` 6줄. `src/` 안에 다른 참조 없음 |
| 부른다던 화면(수집·처리) | 13줄짜리 `PipelinePlaceholder` |
| 그 화면 스펙 | "아직 껍데기다 … 데이터 모양은 이 화면이 내용을 가질 때 채운다" |
| 오늘 그걸 써서 얻는 것 | 없다. 평범한 스크립트도 돌고 출력도 찍힌다 |

**소비자가 정해지기 전에 만든 계약**이고, 그 소비자의 스펙이 모양을 안 정했다고 적고 있다.
게다가 이름을 문자로 맞추므로 `extrct` 는 조용히 아무 일도 안 한다. **시드에서 뺐다.**

러너의 6줄은 **남긴다.** 예전 시드(`export extract` 로 열리던 것)를 고쳐 쓰는 파일이 있으면
그것을 지우는 순간 그 파일이 말없이 아무 일도 안 하게 된다. 설명은 가이드가 지금 상태 그대로
싣는다("이건 아직 쓰이는 데가 없다. 평범한 스크립트를 써라").

### ⑴ 가이드는 스크립트 옆에 파일로 둔다

답의 3분의 2(Playwright)는 링크 말고 될 것이 없고, 나머지 3분의 1 — 전역 여섯 개, **엔진이
Firefox** 라는 것, 상대 import 의 확장자 — 은 이 앱 고유이고 찾아볼 데가 없었다. 그 3분의
1을 `GUIDE.md` 가 진다. UI 패널이 아니라 워크스페이스의 파일인 이유는 스크립트와 같은
편집기에서 열리고, 네트워크 없이 열리고, 고치거나 지울 수 있어서다.

딸려 온 것 셋:

- 목록이 `.md` 도 싣는다(`LISTED_EXT`). 편집기는 이미 마크다운을 칠할 줄 알았고 목록 필터만
  막고 있었다.
- `GUIDE.md` 는 **빈 슬롯이 아니어도** 깔린다. 가이드가 필요한 사람은 이미 자기 파일로 찬
  폴더를 보고 있는 사람이라, 시드 규칙으로는 영영 안 닿는다. 대신 **시드 판정에서 빼야 했다** —
  안 그러면 모든 슬롯이 찬 것으로 보여 시작 스크립트가 영영 안 깔린다(구현 중 실제로 그랬다).
- `실행` 이 스크립트 확장자에만 열린다. 안 그러면 가이드를 열어 둔 채 실행을 누르는 순간
  사람이 쓰지도 않은 문법 오류가 패널에 찍힌다.

**확인 — 실제 앱, 진짜 Camoufox 붙인 채로** (그래야 "잠김"이 "브라우저 없음"이 아니라 "이건
스크립트가 아님"을 뜻한다):

```
트리: lib / example.ts / GUIDE.md
붙은 뒤 example.ts 에서 실행 열림: true
GUIDE.md 클릭 → 편집기에 열림, 마크다운으로 칠해짐
GUIDE.md 에서 실행 잠김: true
```

## 5. "import 한 거 뭐가 있어? lib 가져와서 활용하는 거. 아무것도 안 보이는데?"

**제보** — 스크린샷과 함께. 두 가지가 겹쳐 있었다.

### ⑴ 화면이 옛 코드였다 (결함 아님, 알아야 할 것)

시드를 까는 것은 **메인 프로세스**이고, `npm run dev` 는 `-w` 없이는 메인을 다시 빌드하지
않는다. 앱을 켠 시점의 메인이 계속 돌고 있어 새 시드가 워크스페이스에 안 닿았다. 재시작이
답이다. 이 사실이 어디에도 안 적혀 있어 "고쳤다는데 안 보인다"로 읽힌다.

### ⑵ 예시가 `lib/` 의 존재 이유를 못 보여 줬다 — 이쪽이 진짜 결함

그때 헬퍼는 문자열 하나를 `trim` 했다. 누구나 그 자리에 인라인으로 쓸 일이라, 예시는
**`import` 의 기계적 동작만 보여 주고 왜 파일을 나누는지는 하나도 보여 주지 못했다.** 게다가
결과만 찍어서 견줄 것이 없었다.

고친 것 둘:

- 헬퍼가 **되풀이하기 싫을 만큼**의 일을 한다 — 줄바꿈을 접고, 빈 줄을 버리고, 중복을 버린다.
- 예시가 **손 안 댄 것과 거친 것을 나란히** 찍는다.

API 가 바뀌었다(`clean(row)` → `clean(rows)`). 그래서 **짝을 함께 갱신한다** — 스크립트만
바꾸고 옛 헬퍼를 두면 정작 가르치려던 그 줄이 던진다. 짝 중 하나라도 사람이 고친 것이면 둘 다
그대로 둔다(낡았어도 도는 예시 > 새것인데 못 도는 예시). 앱이 쓴 `lib/rows.ts` 원문은
`PAST_STUDIO_LIBS` 가 든다.

**확인 — 진짜 Camoufox, 기본 주소(example.com), 예시 그대로:**

```
title: Example Domain
raw     [{"text":"Example Domain"},{"text":"This domain is for use ..."},
         {"text":"Learn more"},{"text":"Learn more"}]
cleaned [{"text":"Example Domain"},{"text":"This domain is for use ..."},
         {"text":"Learn more"}]
```

기본 페이지에서 **중복이 실제로 하나 사라진다**(`<p>` 안의 `<a>` 가 두 번 잡힌다). 꾸미지
않아도 차이가 보이는 것이 이번 요구의 핵심이었다.

## 게이트

| 명령 | 결과 |
|---|---|
| `npm run typecheck` (node + web) | PASS |
| `npm run lint` | PASS |
| `npm run test` | PASS — 49 files, 687 tests (신규 18) |
| `npm run build` | PASS |
| `npm run test:e2e` | PASS — 20 passed |
| `npm run sweep` | PASS — tokens·imports·i18n·ledger·coverage 5/5 |

UI 게이트(`surface-verify`)는 **안 돌렸다.** 이번 변경은 `.tsx` 를 건드리지만 그린 것은
바뀌지 않는다 — 이벤트 배선과 스토어뿐이고 마크업·클래스·토큰에 손대지 않았다. 커밋 시점에
훅이 기록을 요구하면 그때 돌려야 한다.

## 남는 것

- `CASE-workspace-015`(전환 시 각 모듈 상태 재적재)는 여전히 **미구현**이다. 이번에 덮은
  것은 스크립트 축(`016`~`018`)뿐이고, 변수·연결 구성·북마크·시나리오 축은 테스트가 없다.
- `App.tsx` 의 전환 목록 자체를 지키는 테스트가 없다. 이번 결함이 바로 "목록에서 한 모듈이
  빠졌다"였는데, 스토어 테스트는 그것을 못 잡는다 — 새 모듈이 또 빠져도 초록이다.
- **가이드가 영어다.** 이 앱이 워크스페이스에 쓰는 다른 파일(시드·`hermetra-env.d.ts`)이 전부
  영어라 맞춘 것인데, 제보한 사람은 한국어로 물었다. i18n 규칙(`messages.ts` en/ko)은 화면
  문자열에 걸리는 것이라 이 파일은 sweep 을 통과하지만, **읽는 사람 기준으로는 반쪽짜리
  해결일 수 있다.** 한국어판으로 바꾸거나 두 벌을 싣는 것은 아직 결정 안 했다.
- `GUIDE.md` 개정판을 낼 때는 시드가 이미 가진 장치(앱이 쓴 바이트와 일치할 때만 교체)가
  필요하다. 아직 판이 하나뿐이라 그 장치는 안 넣었다 — 지금 규칙은 "없으면 놓는다"뿐이라,
  다음 판은 이미 그 파일이 있는 워크스페이스에 **안 닿는다.**
- 실제 브라우저 확인은 **새 워크스페이스 한 개, macOS 한 대, 헤드리스 한 번**이다. 창을 띄운
  모드와 이미 쓰던 워크스페이스가 시드로 갱신된 뒤의 실행은 추론이다 — 시드는 같은 파일이고
  갱신 여부는 바이트 대조로 확인했지만, 그 조합을 실제로 밟지는 않았다.
- `AC-studio.browser-29`·`-30` 은 시드가 **자기 파일**을 import 하는 것만 못박는다. 설치한
  패키지(`npm i cheerio`)를 시드가 실제로 부르지는 않는다 — 워크스페이스에 설치를 요구하게
  되고, 이 앱은 남의 폴더에 의존성을 받아 오지 않는다. 주석 한 줄로 모양만 보인다.
  (패키지 해석 자체는 `AC-studio.browser-23` 과 `runs/2026-08-13-studio-script-runtime.md`
  가 덮는다.)
