/** 1인 IT 개발 사업자에게 반복되는 지출 유형과 판정에서 보는 지점 */
export const DEV_EXPENSES = [
{
  kind: '클라우드 · 인프라',
  examples: 'AWS · GCP · Vercel',
  point: '사업용 계정 명의와 과금 리전을 확인합니다.',
  verdict: 'ok'
},
{
  kind: '개발 도구 구독',
  examples: 'GitHub · Notion · JetBrains',
  point: '개인 플랜과 사업용 플랜을 구분해 봅니다.',
  verdict: 'ok'
},
{
  kind: '장비 구입',
  examples: '맥북 · 모니터 · 데스크체어',
  point: '100만 원 기준으로 즉시 비용과 감가상각이 갈립니다.',
  verdict: 'ask'
},
{
  kind: '카페 · 코워킹',
  examples: '스타벅스 · 위워크 데스크',
  point: '작업 공간 답변에 따라 통상성 판단이 달라집니다.',
  verdict: 'ask'
},
{
  kind: 'AI · API 사용료',
  examples: 'OpenAI · Anthropic · ElevenLabs',
  point: '해외 결제라 증빙은 인보이스가 대신합니다.',
  verdict: 'ok'
},
{
  kind: '개인 구독 · 소비',
  examples: 'Netflix · 백화점 상품권',
  point: '업무 관련성이 없으면 조문을 들어 불가로 답합니다.',
  verdict: 'deny'
}] as const;




export const STATS = [
{ value: '40+', label: '검수를 마친 규칙 카드' },
{ value: '60건', label: '적재된 조문·해석 버전' },
{ value: '100%', label: '판정에 붙는 근거 조문' },
{ value: '0건', label: '허용하는 오탐' }];


export const SYSTEM_FEATURES = [
{
  title: '판정은 규칙 엔진이 하고,\nAI는 분류까지만 합니다',
  body: 'AI가 하는 일은 가맹점 이름을 정리하고 속성을 뽑는 것까지입니다. 최종 판정은 검수를 마친 규칙 카드가 순서대로 실행되며 내립니다. AI가 틀리면 규칙 매칭이 실패해 「확인 필요」로 내려갈 뿐, 틀린 판정이 나가지 않습니다.',
  caption: '같은 거래를 두 번 넣으면 두 번 같은 결과가 나옵니다.'
},
{
  title: '조문은 그날 시행 중인\n버전을 고정합니다',
  body: '국가법령정보 API에서 매일 개정을 감지해 새 버전으로 쌓습니다. 판정은 그때 읽은 버전 번호를 그대로 붙들고 있어, 작년 결과를 다시 열어도 근거가 조용히 바뀌지 않습니다.'
},
{
  title: '원본 파일은\n서버로 올라가지 않습니다',
  body: '카드내역은 브라우저에서 파싱하고 카드번호·계좌번호는 그 단계에서 폐기합니다. 서버로는 날짜·가맹점명·금액만 전송하며, 로그에 소득 금액과 이름을 남기지 않습니다.'
}];


export const FLOW_STEPS = [
{
  step: '01',
  title: '카드내역 올리기',
  body: '홈택스 사업용카드 승인내역 또는 카드사 CSV. 브라우저에서 바로 열립니다.'
},
{
  step: '02',
  title: '사업자 문진 7문항',
  body: '직원·작업 공간·차량·수입 규모. 같은 지출도 상황에 따라 결과가 달라집니다.'
},
{
  step: '03',
  title: '건별 판정과 근거',
  body: '가능·확인 필요·불가 세 갈래로 나누고 조문 원문과 준비할 증빙을 함께 보여줍니다.'
},
{
  step: '04',
  title: '애매한 건만 되묻기',
  body: '같은 사유끼리 묶어 몇 개 질문으로 줄입니다. 한 번 답하면 다시 묻지 않습니다.'
}];


export const NOT_DOING = [
{ title: '전자신고·홈택스 제출', body: '되돌릴 수 없는 동작은 만들지 않습니다.' },
{ title: '세액 확정 제시', body: '확인할 항목과 근거까지만 제시합니다.' },
{ title: '금전 이동·외부 발송', body: '서비스 안에 돈이 움직이는 칸이 없습니다.' }];