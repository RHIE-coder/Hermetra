# `pipeline.storage` — 저장소

라우트 `/pipeline/storage` · 컨테이너 `page-pipeline-storage` · 사이드바 `nav-pipeline-storage`

**아직 껍데기다** (`README.md` "지금 상태").

들어와야 하는 것: 데이터가 쌓이는 곳. 수집 직후의 원천 데이터도, 처리를 마친 데이터도 여기로
간다 — 그래서 "적재 대상"(Destinations)이 아니라 저장소다. 한 저장소가 두 종류를 다 받을 수
있어야 한다.

이 화면이 내용을 가질 때 채운다: 저장소 하나의 데이터 모양, 원천·처리 데이터의 구분 방식,
보관 기간, 워크스페이스 경계와의 관계(`app.tenancy`), 그리고 그때의 인수조건.
