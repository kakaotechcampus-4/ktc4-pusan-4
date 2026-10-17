/**
 * 디자인 토큰. 색·타이포·간격은 여기서만 정의하고 화면에서는 이름으로 쓴다.
 * 사용 규칙은 DESIGN.md 참고.
 *
 * 레퍼런스: kakaocorp.com/ir — 흰 바탕에 회색 패널, 괘선만 쓰는 표,
 * 400/700 두 굵기, 그림자 없음, 강조색은 한 화면에 한 번.
 */
export default {content: [
  './index.html',
  './src/**/*.{js,ts,jsx,tsx}'
],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Pretendard Variable', 'Pretendard', 'system-ui', 'sans-serif'],
      },
      /** 타이포 스케일. [크기, 행간]. 임의 px(text-[15px])는 쓰지 않는다. */
      fontSize: {
        caption: ['12px', '18px'],
        small: ['13px', '20px'],
        body: ['14px', '24px'],
        prose: ['14px', '28px'],
        'body-lg': ['15px', '28px'],
        lead: ['17px', '30px'],
        h4: ['17px', '26px'],
        h3: ['22px', '30px'],
        'h3-lg': ['26px', '36px'],
        h2: ['28px', '38px'],
        'h2-lg': ['36px', '48px'],
        h1: ['38px', '48px'],
        'h1-lg': ['52px', '66px'],
        stat: ['34px', '36px'],
        /* 레퍼런스에서 1440 폭으로 직접 잰 값 */
        'ir-display': ['48px', '60px'],
        'ir-section': ['48px', '72px'],
        'ir-panel': ['30px', '45px'],
        'ir-lead': ['22px', '33px'],
        'ir-num': ['26px', '39px'],
      },
      letterSpacing: {
        ir: '-1px',
        'ir-sm': '-0.8px',
        'ir-xs': '-0.6px',
      },
      spacing: {
        /* 레퍼런스 본문 좌우 여백 */
        gutter: '62px',
      },
      colors: {
        /** 바탕은 흰색이고 패널이 회색이다 (기존과 반대) */
        canvas: '#FFFFFF',
        surface: '#F3F3F3',
        /** 표처럼 패널 위에서 흰 바탕이 필요할 때 */
        sheet: '#FFFFFF',
        /** 패널보다 한 단계 짙은 바탕. 첫 화면 큰 판에만 쓴다 */
        surface2: '#E4E4E4',
        line: '#EEEEEE',
        line2: '#F5F5F5',
        /** 괘선 중 굵은 것 — 표 머리 위에 긋는다 */
        rule: '#333333',
        ink: '#000000',
        ink2: '#333333',
        muted: '#888888',
        /** 주된 동작은 검정이다. 파랑은 문장 속 링크에만 쓴다 */
        accent: {
          DEFAULT: '#000000',
          hover: '#333333',
          soft: '#F3F3F3',
          line: '#D9D9D9',
        },
        link: '#0073FF',
        /** 한 화면에 한 번만 쓰는 강조 블록 */
        highlight: '#FAE100',
        ok: {
          DEFAULT: '#0B7A4B',
          bg: '#F0F8F4',
          line: '#CCE6D9',
        },
        warn: {
          DEFAULT: '#8A5209',
          bg: '#FDF7EC',
          line: '#EEDFC0',
        },
        deny: {
          DEFAULT: '#D5362B',
          bg: '#FDF1F0',
          line: '#F4CFCB',
        },
      },
      borderRadius: {
        lg: '12px',
        xl: '16px',
        '2xl': '24px',
        '3xl': '36px',
      },
      /** 페이지 컨테이너 폭 */
      maxWidth: {
        page: '1440px',
      },
      /** 그림자를 쓰지 않는다. 겹침은 괘선과 바탕색으로 가른다 */
      boxShadow: {
        card: 'none',
        panel: 'none',
      },
      transitionTimingFunction: {
        snap: 'cubic-bezier(0.23, 1, 0.32, 1)',
      },
      keyframes: {
        rise: {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        /* 궤도를 도는 그림. 바깥 테가 돌면 그림은 반대로 돌아 똑바로 선다 */
        orbit: {
          from: { transform: 'rotate(0deg)' },
          to: { transform: 'rotate(360deg)' },
        },
        'orbit-back': {
          from: { transform: 'rotate(0deg)' },
          to: { transform: 'rotate(-360deg)' },
        },
      },
      animation: {
        rise: 'rise 0.32s cubic-bezier(0.23, 1, 0.32, 1) both',
        orbit: 'orbit 52s linear infinite',
        'orbit-back': 'orbit-back 52s linear infinite',
        'orbit-slow': 'orbit-back 78s linear infinite',
        'orbit-slow-back': 'orbit 78s linear infinite',
      },
    },
  },
}
