# phases/ — 단계 계약 사본 (검증기용)

이 폴더의 `*.md` 는 steward 플러그인 묶음 `phases/` 의 **사본**이다 (기준 버전: steward 0.3.0).

## 왜 사본을 두나

`.harness/steward/core/validate.mjs` 는 단계별 frontmatter(`consumes`/`produces`/`requires`)를
읽어 배선을 검사한다 — 값 빈자리가 비었는지, 산출물이 끊겼는지(dangling), 중복 산출이 있는지.
플러그인만 설치된 상태에서는 검증기가 이 정의를 찾지 못해 전부 경고로 흘리고, **빈 값도
통과시킨다**. 사본을 두면 검증기가 실제로 검사한다.

## 주의

- 단계 스킬의 **본문**은 여기가 아니라 설치된 플러그인이 제공한다. 이 사본은 검증기만 읽는다.
- 그래서 이 파일을 고쳐도 에이전트 동작은 바뀌지 않는다 — 고치지 말 것.
- 플러그인을 새 버전으로 올렸으면 이 사본도 다시 복사한다:
  ```bash
  cp "$CLAUDE_PLUGIN_ROOT"/phases/*.md .harness/steward/project/phases/
  node .harness/steward/core/validate.mjs
  ```
