import type { Judgment, TransactionSummary } from '../../types/domain';
import { MEDICAL_PREFIX } from '../../parser/primitives';
import { formatFullDate, toKst } from '../../utils/format';
import { AWAITING_ANSWER } from '../../utils/verdict';

/** 의료 업종은 올릴 때 상호를 가린다(의료_마스킹_01 …). 번호는 업로드마다 새로 매겨서 보여 주지 않는다 (C32) */
export const MASKED_MEDICAL = '의료기관 (이름 가림)';

/**
 * 결과 표와 상세의 거래 제목. 카드에 찍힌 이름을 쓴다.
 * 정규화 이름(merchantNorm)은 FIGMA.COM 을 FIGMACOM 으로, 온새미로 공방을 온새미로공방으로 붙여 써서 사람이 읽을 이름이 아니다
 */
export const merchantTitle = ({ merchantRaw, merchantNorm }: Pick<TransactionSummary, 'merchantRaw' | 'merchantNorm'>) =>
merchantName(merchantRaw) || merchantNorm;

/**
 * 카드에 찍힌 상호를 화면 이름으로 바꾼다. 올리기 미리보기처럼 거래가 되기 전의 행에도 쓴다.
 * 가린 의료기관(의료_마스킹_01)과 카드사가 소액 교통비를 묶어 찍은 합산 행(버스_모바일 3 건)은 그대로 보여 주지 않는다 (C32)
 */
export const merchantName = (merchantRaw: string) => {
  const raw = merchantRaw.trim();
  if (raw.startsWith(MEDICAL_PREFIX)) return MASKED_MEDICAL;
  const merged = /^(\S+)_(\S+) (\d+) 건$/.exec(raw);
  return merged ? `${merged[1]} ${merged[2]} ${merged[3]}건` : raw;
};

/** 카테고리의 화면 이름. 어휘(rules/categories.yaml)의 키는 밑줄로 잇거나 내부 표시라 그대로 보여 주지 않는다 */
const CATEGORY_LABEL: Record<string, string> = {
  PG_미상: '결제대행 (가맹점 모름)'
};

export const categoryLabel = (category: string) => CATEGORY_LABEL[category] ?? category.replace(/_/g, ' ');

/**
 * 판정 배지 아래에 붙는 한 마디. 같은 배지라도 사용자가 할 일이 달라서 표와 상세에 같이 쓴다.
 * 답변 대기는 질문의 답을 받기 전이라 일단 불가로 둔 거래다(소명 대기, rule-card-fields.md)
 */
export const verdictNote = (judgment: Judgment, awaitingAnswer: boolean): string | null =>
judgment.origin.type === 'OVERRIDE' ?
'직접 수정' :
judgment.outOfScope ?
'세무사에게 넘김' :
awaitingAnswer && judgment.verdict.code === 'UNAVAILABLE' ?
AWAITING_ANSWER :
null;

/**
 * 불가의 이유 문장. 서버 explanation 은 아직 늘 비어 있어서(#132) 막힌 단계와 판정이 생긴 까닭으로 만든다 (C10).
 * G1 은 법이 막은 지출(§33), G2 는 업무 관련성(§27·§33①5)이다. 문장을 지어낼 근거가 없으면 null 이다
 */
export const unavailableReason = (judgment: Judgment): string | null => {
  if (judgment.verdict.code !== 'UNAVAILABLE') return null;
  if (judgment.blockedAtGate === 'G1') return '법이 필요경비에 넣지 못하게 정한 지출입니다.';
  if (judgment.origin.type === 'USER_FACT') return '답하신 내용으로는 업무에 쓴 지출로 보기 어려워 경비에서 뺐습니다.';
  if (judgment.blockedAtGate === 'G2') return '업무에 쓴 지출로 보기 어려워 경비에서 뺐습니다.';
  return null;
};

const yes = (label: string) => (value: unknown) => value === true ? label : null;
const text = (value: unknown) => typeof value === 'string' && value.trim() ? value : null;

/**
 * 상세에 보여 줄 판정 속성. 규칙 카드가 넣는 키는 영문·밑줄이라(가산세_대상, 즉시상각_근거) 사람이 읽을 이름이 있는 것만 고른다 (C11).
 * 여기 없는 키와 읽을 수 없는 값은 보여 주지 않는다. 순서는 이 목록 순서다
 */
const ATTRIBUTES: [key: string, label: string, value: (value: unknown) => string | null][] = [
['증빙', '증빙', text],
['가산세_대상', '증빙불비 가산세', (value) => value === true ? '대상' : value === false ? '대상 아님' : null],
['즉시상각', '즉시상각', yes('올해 경비로 처리')],
['자산', '감가상각', yes('자산으로 나눠 처리')],
['상각방법', '상각 방법', text],
['내용연수', '내용연수', (value) => typeof value === 'number' ? `${value}년` : null],
['안분', '업무 비율', (value) => value === '작업공간비율' ? '작업 공간 면적 비율만큼' : null],
['선급비용', '선급비용', yes('기간에 나눠 처리')],
// 값은 한도 묶음 ID(접대비)라 그대로 보이면 위 계정과목(기업업무추진비)과 이름이 달라진다
['limit_bucket', '연간 한도', (value) => text(value) ? '대상' : null]];


export const attributeRows = (attributes: Record<string, unknown>) =>
ATTRIBUTES.flatMap(([key, label, read]) => {
  const value = read(attributes[key]);
  return value === null ? [] : [{ label, value }];
});

const CIRCLED = '①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳';

/**
 * 규칙 카드 문장의 조문 기호를 말로 푼다. 시행령 §67⑦ → 시행령 제67조 제7항, §33①5 → 제33조 제1항 제5호.
 * 화면 문구에 §와 원 숫자를 쓰지 않는다 (11/5 치오 방향)
 */
export const plainLaw = (sentence: string) =>
sentence.replace(/§\s?(\d+)(의\d+)?([①-⑳])?(\d+)?/g, (_, article: string, branch = '', paragraph?: string, item?: string) =>
[`제${article}조${branch}`, paragraph && `제${CIRCLED.indexOf(paragraph) + 1}항`, item && `제${item}호`].
filter(Boolean).
join(' ')
);

/**
 * 장부에 올려야 경비가 되는 경우의 안내(R-240 등). 놓치면 경비를 잃는 문장이라 따로 보여 준다.
 * 자산으로 나눠 처리하기로 답한 거래에는 즉시 경비 안내가 맞지 않아 보이지 않는다
 */
export const bookingNote = (attributes: Record<string, unknown>) => {
  if (attributes['자산'] === true) return null;
  const note = text(attributes['계상_안내']);
  return note && plainLaw(note);
};

/** 판정 이력의 시각. 다른 날짜와 같은 꼴(2026. 11. 05)에 시:분을 붙인다 (C86) */
export const formatStamp = (iso: string) => {
  const { date, time } = toKst(iso);
  return `${formatFullDate(date)} ${time}`;
};
