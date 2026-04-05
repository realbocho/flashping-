# ⚡ FlashPing

> 연락 안 받는 친구 폰을 번쩍이게 만드는 PWA 앱

---

## 📱 앱 설치 방법 (사용자용)

PWA(Progressive Web App)는 앱스토어 없이 **홈화면에 설치** 할 수 있습니다.

### Android (크롬)
1. 앱 URL을 크롬에서 열기
2. 주소창 오른쪽 메뉴(⋮) → **"홈 화면에 추가"**
3. 설치 완료 — 일반 앱처럼 아이콘으로 실행

### iPhone (사파리)
1. 사파리에서 앱 URL 열기
2. 하단 공유 버튼(□↑) 탭
3. **"홈 화면에 추가"** 탭
4. 설치 완료

---

## 🚀 배포 순서 (개발자용)

### 1단계 — Supabase 프로젝트 생성

1. [https://supabase.com](https://supabase.com) 가입/로그인
2. **New Project** 생성
3. **SQL Editor** 탭 클릭
4. `supabase-schema.sql` 내용을 붙여넣고 **Run** 실행
5. **Settings → API** 에서 다음 두 값 복사:
   - `Project URL` (예: `https://abcd1234.supabase.co`)
   - `anon public` 키

### 2단계 — config.js 수정

`public/config.js` 파일을 열어 두 값 교체:

```js
window.SUPABASE_URL = 'https://YOUR_PROJECT_ID.supabase.co'; // ← 교체
window.SUPABASE_ANON_KEY = 'YOUR_ANON_KEY_HERE';             // ← 교체
```

### 3단계 — 배포

**옵션 A: Vercel (추천, 무료)**
```bash
npm install -g vercel
vercel --prod
```

**옵션 B: Netlify (무료)**
```bash
npm install -g netlify-cli
netlify deploy --prod --dir=public
```

**옵션 C: GitHub Pages**
1. GitHub에 레포 생성 후 push
2. Settings → Pages → Source: `public` 폴더 선택

---

## 🔧 앱 사용법

### 최초 설정
1. 두 사람 모두 앱을 열기
2. 각자 **내 이름** 입력
3. **내 코드**를 카카오톡으로 상대에게 전송
4. **친구 코드** 입력 후 **연결하기** 버튼
5. 연결 완료!

### 플래시 보내기
- 메인 화면의 **빨간 버튼** 클릭
- 상대방 폰 화면 전체가 **3번 깜박임** + 진동
- 5초 쿨다운 후 다시 전송 가능

### 상태 메시지
- 하단 입력창에 현재 상태를 자유롭게 입력
- 빠른 버튼: 📖 공부 중 / 😴 자는 중 / ✅ 가능 / 🚫 방해 금지
- 상대방 상태는 상단 카드에서 실시간 확인

---

## 🏗 기술 스택

| 역할 | 기술 |
|------|------|
| 프론트엔드 | 바닐라 HTML/CSS/JS (프레임워크 없음) |
| 실시간 통신 | Supabase Realtime (WebSocket Broadcast) |
| 상태 저장 | Supabase PostgreSQL |
| 설치 | PWA (manifest + Service Worker) |
| 배포 | Vercel / Netlify (정적 호스팅) |

---

## 📂 파일 구조

```
flashping/
├── public/
│   ├── index.html      # 앱 메인 HTML
│   ├── style.css       # 스타일
│   ├── app.js          # 앱 로직 + Supabase 연동
│   ├── config.js       # ⚠️ Supabase URL/Key 입력
│   ├── manifest.json   # PWA 매니페스트
│   ├── sw.js           # Service Worker
│   └── icons/
│       ├── icon-192.png
│       └── icon-512.png
├── supabase-schema.sql # DB 스키마 (Supabase에서 실행)
├── vercel.json         # Vercel 배포 설정
├── netlify.toml        # Netlify 배포 설정
└── README.md
```

---

## ⚠️ 참고사항

- **실제 카메라 플래시(토치)** 는 iOS/Android 보안 정책상 브라우저 웹앱에서 제어 불가
- 대신 **화면 전체 화이트 플래시 + 진동**으로 동일한 효과 구현
- 진동은 Android 지원, iPhone은 일부 지원
- HTTPS 배포 필수 (PWA, 진동 API 요구사항)
