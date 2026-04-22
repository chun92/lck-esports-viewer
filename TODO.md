# TODO

## 완료
- [x] Claude Code 환경 세팅 (CLAUDE.md, notion-tasks skill, context7)
- [x] GitHub 레포 생성 (`lck-esports-viewer`)
- [x] README.md + .gitignore

## 1단계 — Python: 데이터 수집
- [x] `data-pipeline/fetch.py` — Leaguepedia API 연동
- [x] LCK 팀 목록 / 선수 목록 호출
- [x] 원본 csv 저장
- [ ] 추후 PlayerLeagueHistory, ScoreboardGames, ScoreboardPlayers, ScoreboardTeams, TournamentPlayers 등을 가져올 수 있을 듯.

## 2단계 — Python: 데이터 가공
- [ ] `data-pipeline/transform.py` — 필요한 필드 추출/정제
- [ ] `data/players.json`, `data/teams.json` 생성

## 3단계 — Node.js: API 서버 구성
- [x] Express 프로젝트 세팅 (`api-server/`)
- [x] `GET /players`, `GET /players/:id`
- [ ] `GET /teams`, `GET /teams/:id/roster` (teams.json 선행 필요)

## 4단계 — 프론트엔드 (React + Vite, 에이전트 위임)
- [x] Vite + React + TS + Tailwind v4 스캐폴드 (`frontend/`)
- [x] 해시 라우팅 (`/#/player/:id`)
- [x] 선수 상세 페이지 (헤더 + Career Timeline)
- [x] 데이터 예외 처리 규칙 유틸 (fallback / formatPeriod / resolveDuration)
- [ ] 선수 목록 페이지
- [ ] 팀별 로스터 보기

## 5단계 — 기능 확장
- [ ] 검색 / 포지션별 필터 / 정렬
- [ ] 선수 상세 페이지 확장: 사진, 경기 기록, 커리어 타이틀 등
- [ ] (선택) Python 데이터 보강 — 이적 이력, 통계 등
