# Frontend Palette — LCK Esports Viewer

LCK 공식 브랜드 가이드는 공개 접근 불가(`brand.lck.co.kr` 응답 없음).
아래 팔레트는 공개된 단서로 구성한 **비공식** 참고용.

## 참고 근거
- LCK 로고: 실버/블랙 모노톤 각진 산세리프
- 2021 리브랜딩 방송: "sky and atmosphere에서 영감받은 bright colors" + 미니멀
- LoL 본체 컬러: Gold `#C89B3C`, Dark Navy `#0A1428`, Silver `#A0A7B4`

## 토큰

| 역할 | HEX | 용도 |
|---|---|---|
| `--bg-base` | `#0A0F1C` | 페이지 배경 (dark navy) |
| `--bg-surface` | `#151B2C` | 카드/컨테이너 표면 |
| `--border` | `#2A3142` | 구분선, 머플 테두리 |
| `--text-primary` | `#F5F7FA` | 기본 텍스트 |
| `--text-muted` | `#A0A7B4` | 보조 텍스트, 라벨 (LoL silver) |
| `--accent-sky` | `#4FA8E0` | 주요 강조, 링크, 포커스 |
| `--accent-gold` | `#C89B3C` | 챔피언/하이라이트 (hextech gold) |
| `--success` | `#10B981` | 승리/생존 지표 |
| `--danger` | `#EF4444` | 패배 지표 |

## Tailwind v4 매핑 예시

```css
@theme {
  --color-bg-base: #0A0F1C;
  --color-bg-surface: #151B2C;
  --color-border: #2A3142;
  --color-text-primary: #F5F7FA;
  --color-text-muted: #A0A7B4;
  --color-accent-sky: #4FA8E0;
  --color-accent-gold: #C89B3C;
  --color-success: #10B981;
  --color-danger: #EF4444;
}
```

## 타이포 방향
- 본문: system-ui / Pretendard 선호 (한글 가독성)
- 숫자 강조(KDA, 승률): tabular-nums + semibold
- 선수 ID 같은 짧은 영문: 약간 더 굵은 weight
