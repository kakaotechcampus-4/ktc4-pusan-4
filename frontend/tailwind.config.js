/**
 * 디자인 토큰. 색·타이포·간격은 여기서만 정의하고 화면에서는 이름으로 쓴다.
 * 사용 규칙은 DESIGN.md 참고.
 *
 * 레퍼런스: kakaocorp.com/ir — 흰 바탕, 괘선만 쓰는 표,
 * 400/700 두 굵기, 그림자 없음, 강조색은 한 화면에 한 번.
 * 회색 패널은 걷어 냈다(11/5 치오). 회색은 hover·고른 상태에만 남는다.
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
        /** 바탕은 흰색이다. 내용은 흰 바탕에 두고 간격으로 가른다 */
        canvas: '#FFFFFF',
        /** 옅은 회색. hover 와 고른 상태에만 쓴다. 카드·패널·구역을 칠하지 않는다 */
        surface: '#F2F4F6',
        /** 표처럼 패널 위에서 흰 바탕이 필요할 때 */
        sheet: '#FFFFFF',
        /** 첫 화면 큰 판. 어두운 남색이라 글자·그림은 흰색으로 올린다 */
        surface2: '#2C6AE8',
        line: '#E5E8EB',
        /** surface 위에서도 보여야 한다. surface 와 같은 값이면 회색 패널 안의 구분선이 사라진다 */
        line2: '#EDEFF2',
        /**
         * 입력칸·select·고르지 않은 선택지의 테두리. 컨트롤 경계는 바탕 대비 3:1 이 있어야 한다(WCAG 1.4.11).
         * line 은 흰 바탕 1.23 이라 칸이 어디서 끝나는지 안 보였다. 흰 바탕 3.44, surface 3.12
         */
        edge: '#838B96',
        /** 괘선 중 굵은 것 — 표 머리 위에 긋는다 */
        rule: '#191F28',
        ink: '#191F28',
        ink2: '#4E5968',
        /**
         * 날짜·건수 같은 작은 메타 정보. 읽어야 하는 글은 ink2 를 쓴다.
         * #6B7684 는 surface 4.19, accent-soft 3.91 로 4.5 아래였다. 흰 바탕 5.44, surface 4.93, accent-soft 4.61
         */
        muted: '#5F6B78',
        /**
         * 주된 동작의 색. 브랜드를 넣으면서 검정(#16181D)에서 파랑으로 옮겼다 (#242).
         * 주 버튼·고른 단계·현재 메뉴가 모두 이 색이다. 문장 속 링크도 같은 색을 쓴다.
         *
         * 브랜드 원본은 #2F5BFF 인데 쨍해서 한 칸 낮춘 값이다. 흰 글자 대비 4.85 로,
         * 더 밝게 올리면 4.5 아래로 떨어진다
         */
        accent: {
          DEFAULT: '#2C6AE8',
          /** 주 버튼 hover. accent-soft 위의 글자도 이 색을 쓴다 — accent 는 그 위에서 4.11 이고 이 색은 4.90 이다 */
          hover: '#1C5FD4',
          /** 고른 선택지·고른 행·진행 중인 단계의 바탕 */
          soft: '#E4EDFB',
          line: '#DCE3EB',
        },
        link: '#2C6AE8',
        /** 한 화면에 한 번만 쓰는 강조 블록 */
        highlight: '#FF5C9A',
        /**
         * 판정색. 가능·확인 필요·불가 배지와 그 건수에만 쓴다. 완료·진행·안내에는 쓰지 않는다.
         * 예외는 deny 하나다: 실패한 칸 옆의 오류 글자와 잘못 넣은 칸의 테두리
         */
        ok: {
          DEFAULT: '#00703D',
          bg: '#E8F6F0',
          line: '#B2E3CE',
          /** 막대·점처럼 글자가 안 올라가는 채움. 밝게 쓴다 */
          bar: '#12B76A',
        },
        warn: {
          DEFAULT: '#8A5A10',
          bg: '#FDF3E3',
          line: '#EFD7A4',
          bar: '#F7A51B',
        },
        deny: {
          DEFAULT: '#C5283D',
          bg: '#FDEDEF',
          line: '#F7CDD4',
          bar: '#FF5A5A',
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
        /**
         * 머리띠에만 쓴다. 머리띠는 바탕(canvas)과 같은 색이라 흰 화면에서 경계가 사라진다.
         * 괘선만으로는 스크롤한 내용이 밑으로 지나가는 것이 안 보여서 아주 옅은 음영을 같이 둔다
         */
        header: '0 1px 0 0 rgba(22, 24, 29, 0.06), 0 6px 16px -10px rgba(22, 24, 29, 0.22)',
      },
      transitionTimingFunction: {
        snap: 'cubic-bezier(0.23, 1, 0.32, 1)',
        /** 움직임의 곡선 하나. 튀거나 넘치지 않는다 (index.css --m-ease) */
        motion: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
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
        /*
         * 첫 모션 (Landing·OrbitStage) — 테가 그려지고 그림이 중심에서 제자리로 퍼진다.
         * 끝이 기본 모습(scale 1 · opacity 1)이라 모션이 끝나도 화면이 움직이지 않는다.
         * transform 을 통째로 쓰므로 -translate-x-1/2 같은 유틸리티와 같은 요소에 두면 안 된다
         */
        draw: {
          from: { opacity: '0', transform: 'scale(0.88)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        spread: {
          from: { opacity: '0', transform: 'scale(0.42)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        /*
         * 화면과 목록이 나타날 때. 끝 모습은 transform 이 없는 기본 모습이고 fill 은 backwards 다.
         * 끝난 뒤에도 transform 이 남으면 그 안의 fixed 요소(바텀시트, 끌기 그림)가 화면 대신 이 상자에 붙는다
         */
        enter: {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to: { opacity: '1', transform: 'none' },
        },
        /* 판정 칸이 하나씩 들어온다 */
        cell: {
          from: { opacity: '0', transform: 'scale(0.4)' },
          to: { opacity: '1', transform: 'none' },
        },
        /* 판정이 난 칸이 뒤집혀 판정색이 된다 */
        flip: {
          from: { transform: 'perspective(60px) rotateX(-90deg)' },
          to: { transform: 'none' },
        },
      },
      animation: {
        rise: 'rise 0.32s cubic-bezier(0.23, 1, 0.32, 1) both',
        orbit: 'orbit 52s linear infinite',
        'orbit-back': 'orbit-back 52s linear infinite',
        'orbit-slow': 'orbit-back 78s linear infinite',
        'orbit-slow-back': 'orbit 78s linear infinite',
        draw: 'draw 0.6s cubic-bezier(0.23, 1, 0.32, 1) both',
        spread: 'spread 0.7s cubic-bezier(0.23, 1, 0.32, 1) both',
        enter: 'enter 0.24s cubic-bezier(0.2, 0.8, 0.2, 1) backwards',
        cell: 'cell 0.26s cubic-bezier(0.2, 0.8, 0.2, 1) backwards',
        flip: 'flip 0.3s cubic-bezier(0.2, 0.8, 0.2, 1) backwards',
      },
    },
  },
}
