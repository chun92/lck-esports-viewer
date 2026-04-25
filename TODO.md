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
- [x] `data_pipeline/transform.py` — 필드 추출/정제, 선수 이력 조립
- [x] `players_info.json`, `players_list.csv`, `teams_info.json`, `teams_orphan.json` 생성
- [x] TeamRenames/RenamedTo 체인으로 팀 이름 canonical 해석
- [x] 연속된 tenure 구간 병합 (선수 Career Timeline)
- [x] 팀 PlayerHistory: 계열 기반 병합 + 포지션 slash 병기

## 3단계 — Node.js: API 서버 구성
- [x] Express 프로젝트 세팅 (`api-server/`)
- [x] `GET /players`, `GET /players/:id`
- [x] `GET /teams`, `GET /teams/:id`

## 4단계 — 프론트엔드 (React + Vite, 에이전트 위임)
- [x] Vite + React + TS + Tailwind v4 스캐폴드 (`frontend/`)
- [x] 해시 라우팅 (`/#/player/:id`)
- [x] 선수 상세 페이지 (헤더 + Career Timeline)
- [x] 데이터 예외 처리 규칙 유틸 (fallback / formatPeriod / resolveDuration)

## 5단계 — 선수 목록 페이지
- [x] 목록 렌더링 + 페이지네이션
- [x] 검색 (ID / Name / 전체 필드)
- [x] 고급 필터 (포지션 멀티 체크, 팀 드롭다운, 데뷔년도)
- [x] 컬럼 헤더 클릭 정렬

## 6단계 — 팀 페이지
- [x] 팀 상세 페이지 구성 (헤더 + Current Roster + Player History)
- [x] 선수 상세 페이지에서 팀 링크 연결 (canonical 이름으로 resolve)
- [x] 팀 로고 수집/표시 (Leaguepedia Special:FilePath)
- [x] 이전 이름(Predecessors / FormerNames) 표시
- [x] Current Roster / Player History 계열별(InGame / Coach / Other) UI 분리
- [x] Career Timeline 박스 전체 클릭 + 해석 불가한 팀 붉은색 표기

## 6.5단계 — 피드백 + 추가 구현

### 피드백
- [ ] Player 페이지 헤더: 현재 팀(이름 + 로고) / 포지션을 우측 badge가 아니라 이름 하단에 강조 표시
- [ ] Player 페이지 Career Timeline: 팀 이름 옆에 팀 로고 표시
- [ ] Team 페이지 Player History: Duration을 month → day 단위로 변경

### 구현
- [ ] Career Timeline의 팀 로고를 "당시 시점의 로고"로 표시
  - 현재 Teams 정보에는 현재 이름의 로고만 존재
  - 예: ShowMaker는 DAMWON → DWG KIA → Dplus KIA로 팀 이름이 바뀌면서 로고도 매번 달라졌음 (https://lol.fandom.com/wiki/ShowMaker 참고)
  - rename 이전 시점에는 그 시점의 로고를 가져다 써야 함
  - Leaguepedia에서 과거 로고를 어떻게 가져오는지 조사 후 파이프라인 반영
- [ ] Team 목록 페이지 (Players 목록 페이지처럼 탐색 가능하게)

## 7단계 — 선수 사진 추가
- [ ] 사진 데이터 소스 확보 + 파이프라인 반영
- [ ] 선수 상세 헤더에 사진 노출

## 8단계 — 선수 시즌별 통계 페이지
- [ ] 커리어/시즌별 플레이 정보
- [ ] 승률
- [ ] 사용 챔피언

## 9단계 — 선수 비교 페이지
- [ ] 선수별 커리어 기간 비교 UI
