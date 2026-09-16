/**
 * 디자인 토큰. 색·타이포·간격은 여기서만 정의하고 화면에서는 이름으로 쓴다.
 * 사용 규칙은 DESIGN.md 참고.
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
        lead: ['16px', '32px'],
        h4: ['17px', '24px'],
        h3: ['22px', '30px'],
        'h3-lg': ['26px', '34px'],
        h2: ['28px', '38px'],
        'h2-lg': ['36px', '48px'],
        h1: ['38px', '46px'],
        'h1-lg': ['52px', '64px'],
        stat: ['34px', '34px'],
      },
      colors: {
        canvas: '#F6F7F9',
        surface: '#FFFFFF',
        line: '#E4E7EC',
        line2: '#F0F2F5',
        ink: '#101418',
        ink2: '#3A424D',
        muted: '#6B7480',
        accent: {
          DEFAULT: '#1F4FD8',
          hover: '#183FAE',
          soft: '#EEF2FE',
          line: '#C7D5F8',
        },
        ok: {
          DEFAULT: '#0B7A4B',
          bg: '#E9F6EF',
          line: '#B7E0CB',
        },
        warn: {
          DEFAULT: '#8A5209',
          bg: '#FDF4E3',
          line: '#EBD3A3',
        },
        deny: {
          DEFAULT: '#B02318',
          bg: '#FCEDEB',
          line: '#F0C4BE',
        },
      },
      /** 페이지 컨테이너 폭 */
      maxWidth: {
        page: '1180px',
      },
      boxShadow: {
        card: '0 1px 2px rgba(16, 20, 24, 0.04)',
        panel: '0 8px 24px rgba(16, 20, 24, 0.08)',
      },
      transitionTimingFunction: {
        snap: 'cubic-bezier(0.23, 1, 0.32, 1)',
      },
      keyframes: {
        rise: {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        rise: 'rise 0.32s cubic-bezier(0.23, 1, 0.32, 1) both',
      },
    },
  },
}
