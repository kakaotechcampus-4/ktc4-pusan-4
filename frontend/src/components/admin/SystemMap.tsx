import { Fragment, useState, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { ArrowDownIcon, ArrowRightIcon, ChevronDownIcon, CogIcon, CornerDownRightIcon, SparklesIcon, UserIcon } from 'lucide-react';
import { CARDS, GATES, cardsOf } from '../../rules/cards';
import { CardGraph } from '../rules/CardGraph';
import { cn } from '../ui';

/**
 * 누가 하는 일인가. 색이 아니라 모양과 낱말로 가른다.
 * LLM 은 점선 둥근 상자, 규칙(코드)은 각진 상자, 사람은 알약 모양이다
 */
type Kind = 'llm' | 'rule' | 'person';

const KIND: Record<Kind, {label: string;icon: LucideIcon;shape: string;}> = {
  llm: { label: 'LLM', icon: SparklesIcon, shape: 'rounded-2xl border-dashed' },
  rule: { label: '규칙', icon: CogIcon, shape: 'rounded-md' },
  person: { label: '사람', icon: UserIcon, shape: 'rounded-full px-5' }
};

interface MapNode {
  title: string;
  kind: Kind;
  onOpen?: () => void;
  /** 누르면 무엇을 여는지. 화면 읽기 프로그램에 읽어 준다 */
  openLabel?: string;
  wide?: ReactNode;
}


/** 관문마다 카드 수. 한 계열이라 accent 하나로 그리고 범례는 두지 않는다 */
function GateBars() {
  const counts = GATES.map((gate) => ({ ...gate, count: cardsOf(gate.id).length }));
  const max = Math.max(1, ...counts.map((item) => item.count));
  return (
    <ol aria-label="관문마다 카드 수" className="mt-3 grid w-full grid-cols-6 items-end gap-0.5">
      {counts.map((item) =>
      <li key={item.id} title={`${item.id} ${item.name} 카드 ${item.count}장`} className="flex flex-col items-center">
          <span className="text-caption tabular-nums text-ink">{item.count}</span>
          <span className="mt-1 flex h-10 w-full items-end justify-center">
            <span
            aria-hidden="true"
            className="w-2.5 rounded-t-[4px] bg-accent"
            style={{ height: item.count === 0 ? 0 : `${Math.max(8, item.count / max * 100)}%` }} />
          </span>
          <span className="mt-1 border-t border-line pt-1 text-caption tabular-nums text-ink2">{item.id}</span>
        </li>
      )}
    </ol>);

}

function Node({ node }: {node: MapNode;}) {
  const kind = KIND[node.kind];
  const Icon = kind.icon;
  const body =
  <>
      <span className="flex items-center gap-1.5 text-caption text-ink2">
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        {kind.label}
      </span>
      <span className="mt-1 block text-small font-bold text-ink">{node.title}</span>
      {node.wide}
    </>;

  const box = cn(
    'flex min-w-0 flex-col items-start justify-center border border-edge bg-canvas px-4 py-3 text-left',
    node.wide ? 'w-full lg:w-60' : 'w-full lg:w-auto lg:min-w-[7.5rem]',
    kind.shape
  );
  return node.onOpen ?
  <button
    type="button"
    onClick={node.onOpen}
    aria-label={node.openLabel ? `${node.title}, ${node.openLabel}` : undefined}
    className={cn(box, 'm-lift transition-colors duration-150 hover:border-ink hover:bg-surface')}>

      {body}
    </button> :

  <div className={box}>{body}</div>;

}

/** 다음 마디로 가는 화살표. 넓은 화면은 옆으로, 좁은 화면은 아래로 */
function Arrow({ turn = false }: {turn?: boolean;}) {
  return (
    <li aria-hidden="true" className="flex justify-center">
      {turn ?
      <CornerDownRightIcon className="hidden h-4 w-4 shrink-0 text-ink2 lg:block" /> :
      <ArrowRightIcon className="hidden h-4 w-4 shrink-0 text-ink2 lg:block" />}
      <ArrowDownIcon className="h-4 w-4 text-ink2 lg:hidden" />
    </li>);

}

/**
 * 한 줄의 흐름. rows 가 둘이면 넓은 화면에서 두 줄로 나눠 그리고, 둘째 줄은 꺾인 화살표로 잇는다.
 * 저절로 줄을 바꾸게 두면 줄 끝에 갈 곳 없는 화살표가 남는다
 */
function Lane({ title, rows, children }: {title: string;rows: MapNode[][];children?: ReactNode;}) {
  return (
    <div className="grid gap-3 lg:grid-cols-[4rem_minmax(0,1fr)] lg:items-start">
      <h3 className="text-small font-bold text-ink lg:pt-3">{title}</h3>
      <div className="space-y-2">
        {rows.map((row, rowIndex) =>
        <ol key={rowIndex} className="flex flex-col items-stretch gap-2 lg:flex-row lg:items-center">
            {rowIndex > 0 && <Arrow turn />}
            {row.map((node, index) =>
          <Fragment key={node.title}>
                <li className="flex">
                  <Node node={node} />
                </li>
                {index < row.length - 1 && <Arrow />}
              </Fragment>
          )}
          </ol>
        )}
        {children}
      </div>
    </div>);

}

/** 접어 둔 것을 기억한다. 이 브라우저에만 남는다 */
const OPEN_KEY = 'preet.admin.systemMap.open';
const readOpen = () => {
  try {
    return localStorage.getItem(OPEN_KEY) !== '0';
  } catch {
    return true;
  }
};

/**
 * 시스템 맵. 판정하는 줄, 판정을 점검하는 줄, 규칙을 배우는 줄이다(docs/architecture.md 1, 3장).
 * 판정 경로에는 LLM 이 없다. LLM 은 분류 후보, Really, 규칙 초안 세 곳에만 있다.
 * 마디 아래의 건수와 설명 글은 두지 않는다(11/11 치오). 관문별 카드 수 막대만 남긴다
 */
export function SystemMap({ onOpenQueue, onOpenCandidates }: {onOpenQueue: () => void;onOpenCandidates: () => void;}) {
  const [graphOpen, setGraphOpen] = useState(false);
  const [open, setOpen] = useState(readOpen);
  const toggle = () => {
    const next = !open;
    setOpen(next);
    try {
      localStorage.setItem(OPEN_KEY, next ? '1' : '0');
    } catch {
      // 저장하지 못해도 이번 화면에서는 접히고 펼쳐진다
    }
  };

  const classify: MapNode[] = [
  { title: '카드내역 올리기', kind: 'person' },
  { title: '브라우저 파서', kind: 'rule' },
  { title: '키워드 룰', kind: 'rule' },
  { title: '분류 모델', kind: 'llm' },
  { title: '분류 확인', kind: 'person' }];

  const decide: MapNode[] = [
  {
    title: '규칙 엔진 G1~G6',
    kind: 'rule',
    onOpen: () => setGraphOpen(true),
    openLabel: '카드 전체 그래프 열기',
    wide: <GateBars />
  },
  { title: '질문과 답', kind: 'person' }];


  const check: MapNode[] = [
  { title: '평가셋 CI', kind: 'rule' },
  { title: '사용자 수정', kind: 'person' },
  { title: '법령 동기화', kind: 'rule' },
  {
    title: '카드 검토',
    kind: 'person',
    onOpen: onOpenQueue,
    openLabel: '카드 검토 대기열 보기'
  }];


  const learn: MapNode[] = [
  { title: '미판정 집계', kind: 'rule' },
  { title: '규칙 초안', kind: 'llm' },
  { title: '보류 판정', kind: 'rule' },
  {
    title: '관리자 승인',
    kind: 'person',
    onOpen: onOpenCandidates,
    openLabel: '규칙 후보 보기'
  },
  { title: '카드 PR', kind: 'rule' }];


  return (
    <section aria-labelledby="system-map-title" className="rounded-2xl border border-line p-5 sm:p-6">
      <h2 id="system-map-title" className="text-h4 font-bold text-ink">
        <button
          type="button"
          aria-expanded={open}
          aria-controls="system-map-body"
          onClick={toggle}
          className="-mx-2 -my-1 inline-flex items-center gap-1.5 rounded-lg px-2 py-1 transition-colors duration-150 hover:bg-surface">

          시스템 맵
          <ChevronDownIcon
            className={cn('h-5 w-5 text-ink2 transition-transform duration-150', open && 'rotate-180')}
            aria-hidden="true" />

        </button>
      </h2>
      <div id="system-map-body" hidden={!open} className="mt-5 space-y-7">
        <Lane title="판정" rows={[classify, decide]}>
          {/* Really는 판정하지 않는다. 사용자 곁에서 묻고 답하며 제안 카드만 만든다. 흐름 밖이라 화살표 없이 따로 둔다 */}
          <div className="flex pt-2">
            <Node node={{ title: 'Really', kind: 'llm' }} />
          </div>
        </Lane>
        <Lane title="점검" rows={[check]} />
        <Lane title="학습" rows={[learn]} />
      </div>
      <CardGraph open={graphOpen} onClose={() => setGraphOpen(false)} title={`규칙 카드 ${CARDS.length}장`} links />
    </section>);

}
