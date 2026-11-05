# PreeT 브랜드 에셋

확정본: **로고** Nunito Black 워드마크 · **앱 아이콘** P + 핑크 배지 점 · **Really 버튼** 원형 블루 / 화이트

모든 SVG는 글자까지 도형으로 바꿔 두어서 폰트를 설치하지 않아도 그대로 보입니다. 외부 리소스도 없습니다.

## 폴더 구성

```
preet-brand/
├─ logo/          워드마크
│  ├─ preet-logo.svg           흰 배경용 (남색 + T 파랑 + 핑크 점)
│  ├─ preet-logo-white.svg     파란/어두운 배경용
│  └─ png/                     높이 24·32·40·48·64px, 각 @1x / @2x
├─ icon/          앱 아이콘 (P + 핑크 배지 점)
│  ├─ preet-icon.svg           둥근 모서리 포함
│  ├─ preet-icon-square.svg    모서리 없는 정사각 (iOS·안드로이드가 직접 둥글게 자름)
│  └─ png/                     16 ~ 1024px
├─ favicon/       public/ 에 그대로 복사해서 쓰는 세트
│  ├─ favicon.svg  favicon.ico  favicon-16/32/48.png
│  ├─ apple-touch-icon.png (180)  android-chrome-192/512.png  maskable-512.png
│  └─ site.webmanifest
├─ really-fab/    Really 원형 플로팅 버튼
│  ├─ really-fab-blue.svg      ① 블루 (기본)
│  ├─ really-fab-white.svg     ③ 화이트 (파란 화면 위)
│  ├─ sizes/                   44·56·72px 고정 크기 SVG
│  └─ png/                     44·56·72px, 각 @1x / @2x
└─ tokens.css     브랜드 색상 변수
```

## 추천 배치 (Vite / React 기준)

- `favicon/` 안의 파일 전부 → `public/`
- `logo/`, `icon/`, `really-fab/` → `src/assets/brand/`

## 쓰는 법

### 파비콘 (index.html `<head>`)

```html
<link rel="icon" href="/favicon.svg" type="image/svg+xml" />
<link rel="icon" href="/favicon.ico" sizes="any" />
<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
<link rel="manifest" href="/site.webmanifest" />
<meta name="theme-color" content="#2F5BFF" />
```

### 헤더 로고

```jsx
import logo from '@/assets/brand/logo/preet-logo.svg';

<a href="/" aria-label="PreeT 홈">
  <img src={logo} alt="PreeT" height={32} />
</a>
```

파란·어두운 배경에서는 `preet-logo-white.svg`를 쓰세요. 높이는 24~40px를 권장합니다. 가로는 비율대로 자동으로 맞춰집니다.

### Really 플로팅 버튼

```jsx
import reallyFab from '@/assets/brand/really-fab/really-fab-blue.svg';

<button className="really-fab" aria-label="Really와 대화하기">
  <img src={reallyFab} alt="" />
</button>
```

```css
.really-fab {
  position: fixed; right: 24px; bottom: 24px;
  width: 56px; height: 56px;          /* 44 · 56 · 72 중 선택 (기본 56) */
  padding: 0; border: 0; border-radius: 50%;
  background: transparent; cursor: pointer;
  box-shadow: 0 8px 20px rgba(11, 26, 58, 0.28);
}
.really-fab img { width: 100%; height: 100%; display: block; border-radius: 50%; }
.really-fab:focus-visible { outline: 3px solid #FF5C9A; outline-offset: 3px; }
```

화이트 버전은 흰 배경 위에서 경계가 사라지니 그림자를 꼭 같이 넣어 주세요.

## 색상

| 이름 | 값 | 용도 |
|---|---|---|
| PreeT Blue | `#2F5BFF` | 메인, 아이콘 배경, T |
| Deep Navy | `#0B1A3A` | 로고 글자, 본문 |
| Pretty Pink | `#FF5C9A` | 포인트 점 (한 화면에 조금만) |
| Blush | `#FFE3EE` | 연한 핑크 배경 |
| Mist Blue | `#EEF2FF` | 연한 파랑 배경 |

`tokens.css`를 전역으로 불러오면 `var(--preet-blue)`처럼 쓸 수 있습니다.

## 지켜 주세요

- 로고 비율을 늘리거나 줄이지 말고, 색을 임의로 바꾸지 마세요.
- 로고 주변에는 핑크 점 지름 이상의 여백을 두세요.
- 서체(Nunito)는 SIL Open Font License라 상업적으로 사용할 수 있습니다.
