# docs/qa/runs — 검사 회차 기록

steward 의 `gate` 단계가 전체 검사를 돌리고 그 결과를 여기 **추가만** 한다. 고치거나 지우지 않는다.
회차 파일은 그 변경과 **같은 커밋**에 담는다 — "어떤 정의·코드로 돌았나"는 커밋 자체가 보증한다.

## 파일 이름

`<YYYY-MM-DD>-<작업폴더>.md` — 같은 날 같은 작업으로 여러 번 돌면 같은 파일에 회차를 append 한다.

## 양식 (최소 필드)

```markdown
## 2026-07-28 · <작업폴더> · 회차 1

- 기준 커밋: <검사 시점 HEAD 해시 = 이 변경의 부모 커밋>
- 범위: 전체 (typecheck+lint · test · build · e2e)
- 결과:
  | 검사 | 명령 | 결과 |
  |---|---|---|
  | 타입·린트 | `npm run typecheck && npm run lint` | PASS |
  | 단위·API·스키마·컴포넌트 | `npm run test` | PASS (N개) |
  | 빌드 | `npm run build` | PASS |
  | E2E | `npm run test:e2e` | PASS (N개) |
  | 드리프트 검사 | `npm run sweep` | PASS |
- 미실행·미바인딩: (없으면 "없음" — 건너뛴 것을 침묵하지 않는다)
- 실패 상세: (있으면 원인과 되돌린 단계)
```

`PASS` 말고 `FAIL` 이면 gate 는 통과가 아니다. "대체로 통과" 같은 표현을 쓰지 않는다.
