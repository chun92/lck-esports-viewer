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
- [ ] Express 프로젝트 세팅 (`api-server/`)
- [ ] `GET /api/players`, `GET /api/players/:id`
- [ ] `GET /api/teams`, `GET /api/teams/:id/roster`

## 4단계 — Vanilla JS: 프론트엔드
- [ ] 선수 카드 목록 렌더링 (`frontend/`)
- [ ] 팀별 로스터 보기
- [ ] API `fetch()` 연동

## 5단계 — 기능 확장
- [ ] 검색 / 포지션별 필터 / 정렬
- [ ] 선수 상세 페이지
- [ ] (선택) Python 데이터 보강 — 이적 이력, 통계 등
