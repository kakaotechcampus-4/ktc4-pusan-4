-- 평일 공휴일 목록 (대체·임시공휴일 포함). 판정이 JudgmentEngine.judge(..., publicHolidays) 로 넘긴다.
-- 공공데이터포털 특일정보 API 에서 받아 연도별로 교체한다. 판정은 API 를 직접 부르지 않고 이 표만 읽는다.
-- API 장애가 판정 실패로 번지지 않게 하고, 같은 표를 읽는 동안에는 재판정 결과가 흔들리지 않게 하려는 것이다.
-- 토·일에 겹친 공휴일이 들어 있어도 된다. 엔진이 토·일은 요일로 따로 판단한다.
CREATE TABLE public_holiday (
    holiday_date date PRIMARY KEY,
    name text NOT NULL,
    fetched_at timestamptz NOT NULL DEFAULT now()
);
