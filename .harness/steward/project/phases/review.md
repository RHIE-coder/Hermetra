---
name:     review
desc:     "구현 결과를 관점별로 감사할 때 — 코드 품질·보안·성능·설계 패턴·UI 시각."
when:     "경로가 small 이상 (small = 관점 1개, feature 이상 = 관점 5개 병렬)"
consumes: [build-report, spec-delta?]
produces: findings
gate:     "심각(high) 지적 0 — 남아 있으면 build로 되돌아가 해소한 뒤 다시 온다"
requires: [ui-preview:capability?, ui-shot:capability?, token-guard:capability?, contrast-check:capability?]
tier:     strong
workers:
  select: dynamic
  options:
    reviewer: "같은 reviewer 에이전트 정의를 관점 지시만 바꿔 병렬로 여러 번 스폰(경로에 따라 1~5회) — 에이전트를 관점별로 복제하지 않는다. 명세를 쓴 손과 검사하는 눈을 분리"
---
입력 {build-report}를 읽고, 변경분(git diff)을 직접 본다. {spec-delta}가 있으면
명세와의 일치도 함께 본다.

1. 경로에 맞는 관점을 고른다:
   - small → **품질** 1개.
   - feature 이상 → **품질 · 보안 · 성능 · 설계 패턴 · UI 시각** 5개를 병렬로.
2. 각 관점은 독립적으로 본다 — 한 리뷰어가 다 보면 다 얕게 본다.
   UI 시각 관점은 ui-designer 스킬의 rubric(12축)으로 채점하고 마지막에 기계 판정을
   낸다(review-check 형식). 코드만 읽지 말고 {cap:ui-preview}로 띄워 조작하고(주요
   흐름 클릭·입력, 콘솔 에러 확인), {cap:ui-shot}으로 화면을 캡처해 시각 축을 채점한다.
   {cap:token-guard}·{cap:contrast-check}가 붙어 있으면 돌려 그 결정적 결과(토큰 규율·
   대비 위반)를 점수에 반영한다. 정지 화면만 보고 통과시키지 않는다. {spec-delta}가
   있으면 인수조건을 하나씩 실제로 확인한다 — 눌러도 반응 없는 "겉만 있는" 기능은
   코드만 읽어서는 안 드러난다. (시각 능력이 하나도 안 붙었으면 이 관점은 자연 스킵 —
   findings에 명시.)
3. 지적마다: 위치 · 무엇이 문제인가 · 왜(구체 실패 시나리오) · 심각도(high/medium/low).
   추측성 지적은 심각도를 올리지 말고 근거를 붙인다. 발견한 지적을 "별일 아니다"로
   깎아 접지 않는다 — 기록은 리뷰어의 몫, 통과 여부는 gate의 몫.
4. 심각(high)이 있으면 build로 되돌아가 해소하고, 해소 후 해당 관점만 재확인한다.
   **UI 시각은 점수 루프다:** rubric 판정이 PASS가 아니면(어느 축 ≤2 또는 실패 모드
   참) mustFix를 build로 넘겨 고치고 {cap:ui-shot}으로 다시 캡처해 재채점한다 —
   PASS까지, 최대 3회. 3회 안에 PASS 못 하면 남은 mustFix를 findings에 high로 남기고
   gate로 넘긴다(무한 루프 금지).

산출 {findings} (헤더 phase: review — 관점별 지적 목록 + 해소 여부). → {next}
