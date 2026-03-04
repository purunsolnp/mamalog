# 🍼 맘마로그 (MammaLog)

> 우리 아이의 식단 기록부터 성장 발달까지, 달력 기반으로 한눈에 관리하는 스마트 육아 일지

## ✨ 주요 기능

- **👨‍👩‍👧‍👦 다자녀 프로필 관리**
  - 여러 명의 아이 프로필을 하나의 계정에서 손쉽게 생성하고 관리
  - 아이별 독립적인 식단 및 성장 데이터 조회 보장
- **🍽️ 스마트 식단 기록 (다중 메뉴 대응)**
  - 달력에서 원하는 날짜, 시간대(아침/점심/저녁/간식)별로 손쉽게 기록
  - 한 끼에 여러 가지 메뉴(이유식/유아식 구분)와 조리법, 재료 등을 개별 기록
  - 식단별 아기의 만족도를 스마일 아이콘(1~5점)으로 직관적으로 평가
- **📈 정밀 성장 분석 (질병관리청 표준 데이터 연동)**
  - 아이의 월령과 성별에 따른 **정확한 백분위수(Percentile)** 계산 제공
  - 질병관리청 소아청소년 성장도표(2017) 최신 데이터를 기반으로 선형 보간법 적용
  - 신장 대비 체중 / 연령 대비 체중 / 연령 대비 신장에 대한 세밀한 성장 추이 제공
- **📊 통계 및 로그 조회 (`/logs`)**
  - 지정한 날짜 범위 내의 식단 제공 내역을 한눈에 조회
  - 어떤 날, 어떤 음식을 가장 잘 먹었는지 일별 통계 요약

## 🛠 기술 스택

- **프레임워크:** [Next.js](https://nextjs.org/) (App Directory)
- **언어:** TypeScript
- **스타일링:** Tailwind CSS, Material Symbols
- **상태 관리:** Zustand
- **백엔드/DB:** [Supabase](https://supabase.com/) (PostgreSQL + Row-Level Security)
- **날짜 처리:** date-fns

## 🗄️ 데이터베이스 스키마 (`supabase/migrations/`)

본 프로젝트는 안전한 Row-Level Security(RLS)를 적용한 Supabase DB를 사용합니다. 루트 디렉토리의 `supabase/migrations/` 안에 다음의 주요 테이블 설정 SQL이 포함되어 있습니다.
- `users`, `profiles` (사용자 및 아기 프로필)
- `meal_logs` (식단 기록 JSONB 포맷 구조체)
- `daily_summaries` (하루 요약 및 몸무게/키 기록)
- `growth_charts` (선형 보간을 위한 표준 성장 지표)

## 🚀 시작하기

### 1. 환경 변수 설정
`.env.local.example` 파일을 참고하여 최상위 경로에 `.env.local`을 생성하고 귀하의 Supabase URL과 Anon Key를 입력하세요.

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 2. 패키지 설치 및 실행
```bash
npm install
npm run dev
```

브라우저에서 `http://localhost:3000`에 접속하여 서비스를 이용하실 수 있습니다!
