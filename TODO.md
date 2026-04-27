# TODO

## 완료
- [x] Claude Code 환경 세팅 (CLAUDE.md, notion-tasks skill, context7)
- [x] GitHub 레포 생성 (`lck-esports-viewer`)
- [x] README.md + .gitignore

## 1단계 — Python: 데이터 수집
- [x] `data-pipeline/fetch.py` — Leaguepedia API 연동
- [x] LCK 팀 목록 / 선수 목록 호출
- [x] 원본 csv 저장
- [x] PlayerLeagueHistory fetch
- [x] ScoreboardPlayers fetch (HEAVY, KR 191k+ rows)
- [x] Tournaments fetch (10k+ rows)
- [x] TournamentGroups fetch (12k rows)
- [x] TournamentPlayers fetch (KR 21k rows)
- [x] fetch_with_retry 강화 (8 retries, 30s linear backoff, 광범위 transient 에러 매칭)
- [x] `--full` CLI 플래그 (since_date 무시 백필)
- [ ] ScoreboardGames / ScoreboardTeams / TournamentResults 등 추가

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
- [x] Player 페이지 헤더: 현재 팀(이름 + 로고) / 포지션을 이름 하단 강조 (b164264, 85c6c7c에서 pill 제거 + 텍스트 링크화)
- [x] Player 페이지 Career Timeline: 팀 이름 옆에 팀 로고 표시 (b164264)
- [x] Team 페이지 Player History: Duration을 month → day 단위로 변경 (b164264)

### 구현
- [x] Career Timeline의 팀 로고를 "당시 시점의 로고"로 표시 (3834207)
  - own-name imageinfo + redirect/rename chain + case-insensitive 해석
  - 237/449 resolve, 212 phantom drop, 44 era-mismatch limitation 후보 (limitations.json)
- [x] Team 목록 페이지 (895504b) — rename-aware 검색, FormerNames/Aliases 인덱싱

## 7단계 — 선수 사진 추가
- [x] 사진 데이터 소스 확보 + 파이프라인 반영 (PlayerImages cargo, IsProfileImage=1) — 68be407
- [x] 선수 상세 헤더에 사진 노출 (PlayerHeader 224×280 portrait, pill 제거) — 68be407, 85c6c7c

## 8단계 — Season Overview 강화 + 시즌별 통계
### Season Overview 리팩토링 (완료)
- [x] Tournaments table 기반으로 LeagueTimeline 재구성: Year/Split/IsPlayoffs/IsOfficial/TournamentLevel을 페이지 단위 직접 사용
- [x] 휴리스틱 split 파싱 제거 → `Tournaments.Split` exact-value 매핑 (Spring/Summer/Rounds 1-2/Cup 등)
- [x] `_INTERNATIONAL_FALLBACK` 정적 set 제거 → Tournaments.Region='International' 자동 감지
- [x] TournamentPlayers를 LeagueTimeline 메인 소스로 교체 (PLH는 TotalGames만 부수적 사용)
  - 미출전 등록(예: Scout LCK 2026) 자동 표시
  - 단발성 이벤트(Demacia/Weibo/All-Star) 표시
- [x] International / Domestic / Events 3-bucket 분류
  - 합성 쇼매치 팀 정규식(`(.*All-Star.*)`, `(Season Opening)`) 검출
  - 리그 레벨 international 우선 (regional Worlds qualifier가 host 국가 region이어도 Worlds로 묶음)
- [x] frontend: Events 섹션 + EVENT 배지/muted chip 스타일

### 시즌별 통계
- [ ] 시즌(=Tournament 그룹) 단위 집계 파이프라인
  - 게임 수, 승률, KDA 평균
  - 사용 챔피언 top N + 픽률 / 승률
  - 포지션 변화 추적 (시즌별)
- [ ] 선수 상세 페이지에 "Season Stats" 탭 또는 섹션 추가
- [ ] LCK 정규 시즌만 우선 (Spring / Summer / Cup), 국제전(Worlds/MSI)은 별도 표기

## 9단계 — 선수 비교 페이지
- [ ] 라우트 `/compare?players=A,B,C`
- [ ] 멀티 선수 선택 UI (선수 목록에서 체크박스 → 비교 보기)
- [ ] 비교 항목
  - 커리어 타임라인 가로 정렬 (같은 연도 축에 다중 선수)
  - 시즌별 핵심 스탯 (승률 / KDA) 라인 차트
  - 챔피언 풀 겹침
- [ ] 최대 4명 제한 (UI 가독성)

## 운용 / 인프라 backlog
- [ ] historical_logos.json append-only 모드 (재실행 시 기존 key freeze, 신규만 resolve, `--rebuild` 시 전체 재계산)
- [ ] limitations.json 기반 수동 override 매핑 (MiG Frost → MiGlogo, Fredit BRION → BRIONlogo, Academy/Challengers 옛 이름 등)
- [ ] revision-pinned CDN URL 저장 — 팀 로고/선수 사진 모두 `Special:FilePath`이 latest로 redirect 되어 wiki File 덮어쓰기에 취약
- [ ] Tournament 단위 다중 사진 gallery — Tournaments 테이블 fetch 필요
- [ ] 사진/로고 없는 엔티티 placeholder 일관화 (현재 컴포넌트마다 다른 fallback)
- [ ] data 갱신 자동화 — fetch.py 정기 실행 + transform.py 자동 cron / GitHub Actions
- [ ] 추가 cargo 테이블: PlayerLeagueHistory (팀-리그 이력), TournamentResults (수상)

## 데이터 품질 backlog
- [ ] orphan team 정리 (`teams_orphan.json` 265건) — 수동 alias 매핑 또는 무시 정책 명문화
- [ ] phantom team 케이스 재검증 — 단명 팀 / 아마추어 팀 분류
- [ ] 선수 ID 충돌 케이스 (대소문자 변형 — `5Kid` vs `5kid` 등) 확인

## Season Overview backlog
- [ ] `splitStripeClass`의 추가 split 값 보강 — 현재 Tournaments.Split exact-value 매칭이라 신규/희귀 라벨은 회색 fallback
  - 알려진 값: Spring, Summer, Winter, Rounds 1-2/3-5/3-4, Split 1/2/3, Opening, Closing, Cup, Kickoff, Lock-In, Finals
  - 누락 가능성 있는 값: 'Versus' (LEC), 'Summer Placements'/'Split 2 Placements' (LPL), 그 외 지역별 명칭
- [ ] All-Star Las Vegas 같은 sub-page tournament들이 별도 league row로 분산되는 문제
  - 현재 'All-Star Las Vegas/Mixed Team', 'All-Star Las Vegas/East vs West' 등이 각자 league로 잡힘
  - 부모 페이지로 묶거나 BasePage 필드 활용 검토
- [ ] year_overrides.csv의 잔여 4건 manual 매핑 (Bloody Invitational/Ultraliga 일부/NA LCS Season 3)
- [ ] KeSPA Cup Year=시즌 연도 정책 검증 (Tournaments.Year 신뢰)
