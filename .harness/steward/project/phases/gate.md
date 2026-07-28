---
name:     gate
desc:     "커밋 전 통합 관문 — 전체 테스트·타입검사·빌드에 더해 정본(기획·QA 문서)과 코드의 어긋남(drift)을 점검할 때."
consumes: [build-report, findings?, spec-delta?]
produces: gate-report
gate:     "전체 테스트·타입검사·빌드 통과 · 변경이 건드린 정본 노드가 갱신됐거나 '명세 영향 없음'이 명시됨"
requires: [typecheck_command, build_command, test_command, spec_dir, qa_dir, e2e-runner:capability?]
tier:     standard
---
입력 {build-report}를 읽는다 ({findings}·{spec-delta}가 있으면 함께).

1. **전체 검사** — 이번 변경만이 아니라 전체를 돌린다:
   {typecheck_command} · {build_command} · {test_command}.
   e2e 러너가 있으면 {cap:e2e-runner}도 돌린다 (미바인딩이면 건너뛰되 리포트에 명시).
   돌린 결과를 {qa_dir}/runs/에 회차 기록으로 남긴다 — 추가만. 최소 필드: 기준 커밋
   해시(검사 시점 HEAD = 부모 커밋) · 범위 · 결과. {qa_dir}에 양식 README가 있으면 따르고,
   없으면 최소 필드로 적는다(멈추지 않는다). 기록 파일은 이번 변경과 같은 커밋에 담는다 —
   "어떤 정의·코드로 돌았나"는 그 커밋 자체가 보증하고, 해시 필드는 직전 상태 참고용이다.
2. **drift 체크** — 변경분(git diff)이 건드린 코드와 정본을 대조한다:
   - 바뀐 코드가 {spec_dir}/의 노드(안정 ID)에 걸리는가? 걸리면 그 노드가 이번 작업에서
     갱신됐는지 확인한다. 안 됐으면 갱신하거나, 유저에게 알리고 결정을 받는다.
   - 새/변경 동작을 덮는 테스트 정의가 {qa_dir}/에 있는가?
   - {qa_dir}/에 "커버리지 구멍"으로 적힌 항목이 있으면 그 근거(전제)가 지금 코드에서도
     유효한지 본다 — 전제가 이미 해소됐으면(낡았으면) 리포트에 적고 갱신하거나 유저에게 알린다.
   - 어느 쪽에도 안 걸리면 "명세 영향 없음"을 리포트에 명시한다 (침묵 금지 —
     명시가 있어야 나중에 감사가 된다). 단, 변경이 정책·화면·API처럼 명세감 있는 동작인데
     덮는 노드가 아예 없어서 안 걸린 것이면 "이 영역 노드를 신설할까요?" 한 줄을 띄운다 —
     미커버를 "영향 없음"으로 눙치지 않는다.
3. 하나라도 실패하면 통과시키지 않는다 — 원인을 리포트에 적고 build로 되돌린다.
   "대체로 통과" 같은 얼버무림 금지.

산출 {gate-report} (헤더 phase: gate — 검사 결과 표 + drift 판정). → {next}
