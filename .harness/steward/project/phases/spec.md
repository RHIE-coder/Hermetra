---
name:     spec
desc:     "feature 이상 작업에서 살아있는 정본(기획 트리·테스트 정의)을 이번 요구에 맞게 고칠 때. 이번 작업용 명세 사본을 만드는 단계가 아니다."
when:     "경로가 feature 이상"
consumes: [intake]
produces: spec-delta
gate:     "바뀐 정본 노드 목록이 기록됨 · 새/변경 동작마다 인수조건 ≥1 · 테스트 정의 반영"
requires: [spec_dir, qa_dir]
tier:     strong
workers:
  select: dynamic
  options:
    planner:     "화면·기능 명세, 정책 위계(Application>Service>Surface>Section>Component) 수립·갱신이 필요할 때"
    qa-designer: "테스트 정의(TestPlan>Scenario>Suite>Case) 신설·갱신이 필요할 때"
    ui-designer: "와이어프레임·화면 디자인 방향이 필요할 때"
---
입력 {intake}를 읽는다. 이 단계의 산출물은 "이번 작업용 명세"가 아니라
**살아있는 정본에 가한 수정**이다 — 정본은 {spec_dir}/(기획 트리)와 {qa_dir}/(테스트 정의)에 산다.

1. 이번 요구가 건드리는 정본 노드를 찾는다. 없으면 위계
   (Application>Service>Surface>Section>Component)에 맞는 자리에 신설한다.
   깊이는 경로에 비례 — feature는 해당 Surface까지, greenfield는 Service부터.
2. 정본을 직접 고친다. 노드와 테스트 케이스에는 안정 ID를 붙인다
   (예: `<service>.<surface>.<section>`, `CASE-<service>-NNN`) — 나중에 코드·테스트와
   기계 대조가 가능해야 한다.
3. 새/변경 동작마다 인수조건을 최소 1개 적는다 — "무엇이 되면 끝인가"가 검증 가능한 문장으로.
   디자인 문서(방향·와이어프레임)에 적힌 동작·상호작용 요구도 해당 surface 인수조건으로
   승격한다 — 인수조건이 아니면 build·review·gate 어디서도 검증되지 않는다.
4. 테스트 정의({qa_dir}/)를 대응시킨다 — 바뀐 노드를 덮는 Scenario/Suite/Case를
   신설·갱신한다. 회차 기록은 여기서 만들지 않는다(그건 QA 실행의 몫).

산출 {spec-delta} (헤더 phase: spec) — **바뀐 노드 ID 목록 + 바꾼 이유만** 적는다.
내용 자체는 정본에 있다(중복 금지). → {next}
