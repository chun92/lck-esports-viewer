# LCK Esports Viewer — 재활 훈련 프로젝트

## 프로젝트 개요

육아휴직 후 복직을 위한 JavaScript/Python 재활 훈련 프로젝트.
League of Legends LCK 리그의 선수/팀 정보를 보여주는 웹 앱.

## 재활 목표

### JavaScript / Node.js
- [ ] 모듈 시스템 (`require` / `import`)
- [ ] Express 라우팅, 미들웨어
- [ ] `async/await`, Promise 비동기 처리
- [ ] 배열 메서드 (`map`, `filter`, `reduce`, `find`)
- [ ] `fetch` API
- [ ] REST API 설계 원칙

> 프론트엔드는 에이전트에 위임하므로 재활 대상에서 제외.

### Python
- [ ] 함수/클래스 설계
- [ ] `requests` / `httpx` HTTP 호출
- [ ] 딕셔너리/리스트 조작, comprehension
- [ ] 파일 I/O (JSON 읽기/쓰기)
- [ ] 가상환경, 패키지 관리 (`pip`, `venv`)
- [ ] 스크립트 구조 (`argparse`, `if __name__ == "__main__"`)

## 기술 스택

| 레이어 | 기술 |
|--------|------|
| 데이터 수집/가공 | Python 3.11+ |
| API 서버 | Node.js 20+ / Express |
| 프론트엔드 | React + Vite (에이전트에 위임) |
| 데이터 저장 | JSON 파일 → (추후) SQLite |
| 데이터 소스 | Leaguepedia API (Fandom) |

## 프로젝트 구조 (목표)

```
practice/
├── data-pipeline/      # Python: 데이터 수집 & 가공
│   ├── fetch.py        # Leaguepedia API 호출
│   ├── transform.py    # 데이터 정제/변환
│   └── requirements.txt
├── api-server/         # Node.js: REST API
│   ├── src/
│   │   ├── routes/
│   │   └── index.js
│   └── package.json
├── frontend/           # React + Vite (에이전트가 구현)
│   ├── src/
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
└── data/               # 공유 데이터 (Python → Node.js)
    └── players.json
```

## 개발 단계

| 단계 | 언어 | 내용 | 상태 |
|------|------|------|------|
| 1 | Python | Leaguepedia에서 LCK 선수/팀 데이터 수집 → `players.json` | 대기 |
| 2 | Node.js | Express로 REST API 구성 (players.json 기반) | 대기 |
| 3 | JS (프론트) | API 호출, 선수 카드 목록 렌더링 | 대기 |
| 4 | Python | 데이터 보강 (팀 이력, 포지션 통계 등) | 대기 |
| 5 | Node.js | 검색/필터 API 추가 | 대기 |
| 6 | JS (프론트) | 검색/필터 UI, 선수 상세 페이지 | 대기 |

## 개발 규칙

- 단계별로 진행하고, 각 단계 완료 시 커밋
- 코드 작성 전 해당 개념을 직접 떠올려보고 막히면 질문
- 라이브러리 문서는 context7로 조회
- 완성된 코드는 `/simplify`로 리뷰
