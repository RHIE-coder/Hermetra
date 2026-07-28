---
name:     build
desc:     "구현 단계 — 계획하고, 만들고, 그 자리에서 검증한다. hotfix 이상 모든 경로가 지나는 단계."
consumes: [intake?, spec-delta?]
produces: build-report
gate:     "이번 작업의 새/변경 테스트 전부 통과 · 동작을 실제로 확인함"
requires: [tdd_mode, typecheck_command, test_command, ui-preview:capability?]
tier:     strong
---
입력이 있으면 {intake}와 {spec-delta}를 읽는다 (hotfix 경로는 둘 다 없을 수 있다 —
그 경우 유저 요청 자체가 요구다).

작은 반복(마이크로 루프)으로 돈다: **Plan → Execute → Verify → Report.**

1. **Plan** — 시작할 때 근거 블록을 1회, 고정 양식으로 짧게 적는다:
   목표 / 접근 / 이유 / 가정 / 위험 / 완료 기준. 매 발화마다 반복하지 않는다.
2. **Execute** — 구현한다. 테스트 순서는 {tdd_mode} 값을 따른다:
   - `strict`: 모든 변경에 실패하는 테스트 먼저 → 통과 → 정리 (red-green-refactor).
   - `routed`: 순수 로직·API 계약은 테스트 먼저, UI·e2e(= 처음부터 끝까지 전체 흐름을
     돌려보는 테스트)는 구현 후 테스트 허용.
   - `off`: 순서 자유 (테스트 자체는 여전히 필수).
   테스트 유형(단위·API·화면·e2e)은 전부 요구하지 말고 **변경 영향 범위**로 고른다.
   명세의 데이터 규칙(필드 제약·중복 금지·필수값)은 화면이 아니라 도메인/스토어 한 곳에서
   강제한다 — 화면에는 그 지점을 부르는 코드만 둔다(규칙이 화면마다 흩어지면 새 진입 경로가 우회한다).
3. **Verify** — {typecheck_command}와 {test_command}를 돌린다. 화면이 바뀌었으면
   {cap:ui-preview}로 실제로 띄워 확인하되, 바뀐 동작은 눈으로만 보지 말고 직접
   조작해 본다(클릭·입력 — 겉만 있는 기능은 정지 화면에 안 드러난다). (있을 때만 —
   미바인딩이면 건너뛰되 리포트에 "화면 확인 못 함"을 명시). 실패하면 2로 돌아간다.
4. **Report** — 무엇을 바꿨고, 무엇으로 검증했고, 남은 위험이 뭔지 짧게 적는다.
   실수·유저 정정이 있었다면 여기 기록해 둔다 (immunize 단계가 읽는다).

산출 {build-report} (헤더 phase: build). → {next}
