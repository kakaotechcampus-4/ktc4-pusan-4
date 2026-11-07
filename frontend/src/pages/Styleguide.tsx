import React, { useState } from 'react';
import { AlertTriangleIcon, ArrowRightIcon, CheckIcon, InboxIcon } from 'lucide-react';
import { StatuteCitation } from '../components/StatuteCitation';
import { VerdictBadge } from '../components/VerdictBadge';
import {
  Badge,
  Button,
  Card,
  ChoiceGroup,
  Container,
  Empty,
  FilterBar,
  Modal,
  Pagination,
  Table,
  Field,
  Input,
  SectionHeading,
  Select,
  type BadgeTone,
  type ButtonSize,
  type ButtonVariant } from
'../components/ui';

/** 토큰 값은 tailwind.config.js와 같아야 한다. 여기서는 보여주기용으로만 적는다. */
const COLORS: { name: string; cls: string; hex: string; use: string }[] = [
{ name: 'canvas', cls: 'bg-canvas', hex: '#FFFFFF', use: '페이지 바탕' },
{ name: 'surface', cls: 'bg-surface', hex: '#F2F4F6', use: 'hover, 고른 상태 (카드와 패널은 칠하지 않는다)' },
{ name: 'surface2', cls: 'bg-surface2', hex: '#2C6AE8', use: '첫 화면 큰 판 (글자는 흰색)' },
{ name: 'sheet', cls: 'bg-sheet', hex: '#FFFFFF', use: '패널 위 흰 바탕, 표' },
{ name: 'line', cls: 'bg-line', hex: '#E5E8EB', use: '테두리 기본, 행 괘선' },
{ name: 'line2', cls: 'bg-line2', hex: '#EDEFF2', use: '약한 구분선 (surface 위에서도 보임)' },
{ name: 'edge', cls: 'bg-edge', hex: '#838B96', use: '입력칸, select, 고르지 않은 선택지 테두리 (3:1)' },
{ name: 'rule', cls: 'bg-rule', hex: '#191F28', use: '표 머리 위 굵은 괘선' },
{ name: 'ink', cls: 'bg-ink', hex: '#191F28', use: '제목, 어두운 판' },
{ name: 'ink2', cls: 'bg-ink2', hex: '#4E5968', use: '본문, 읽어야 하는 보조 글' },
{ name: 'muted', cls: 'bg-muted', hex: '#5F6B78', use: '날짜, 건수 같은 작은 메타 정보' },
{ name: 'accent', cls: 'bg-accent', hex: '#2C6AE8', use: '주 버튼, 지금 고른 자리' },
{ name: 'accent-hover', cls: 'bg-accent-hover', hex: '#1C5FD4', use: '주 버튼 hover, accent-soft 위의 글자' },
{ name: 'accent-soft', cls: 'bg-accent-soft', hex: '#E4EDFB', use: '고른 선택지, 고른 행, 진행 중 단계' },
{ name: 'accent-line', cls: 'bg-accent-line', hex: '#DCE3EB', use: '테두리 버튼, 패널 안 구분선' },
{ name: 'link', cls: 'bg-link', hex: '#2C6AE8', use: '문장 속 링크' },
{ name: 'highlight', cls: 'bg-highlight', hex: '#FF5C9A', use: '한 화면에 한 번 쓰는 강조' },
{ name: 'ok', cls: 'bg-ok', hex: '#00703D', use: '가능 — 글자' },
{ name: 'ok-bg', cls: 'bg-ok-bg', hex: '#E8F6F0', use: '가능 — 박스 바탕' },
{ name: 'ok-line', cls: 'bg-ok-line', hex: '#B2E3CE', use: '가능 — 박스 테두리' },
{ name: 'ok-bar', cls: 'bg-ok-bar', hex: '#12B76A', use: '가능 — 막대, 점' },
{ name: 'warn', cls: 'bg-warn', hex: '#8A5A10', use: '확인 필요 — 글자' },
{ name: 'warn-bg', cls: 'bg-warn-bg', hex: '#FDF3E3', use: '확인 필요 — 박스 바탕' },
{ name: 'warn-line', cls: 'bg-warn-line', hex: '#EFD7A4', use: '확인 필요 — 박스 테두리' },
{ name: 'warn-bar', cls: 'bg-warn-bar', hex: '#F7A51B', use: '확인 필요 — 막대, 점' },
{ name: 'deny', cls: 'bg-deny', hex: '#C5283D', use: '불가 — 글자' },
{ name: 'deny-bg', cls: 'bg-deny-bg', hex: '#FDEDEF', use: '불가 — 박스 바탕' },
{ name: 'deny-line', cls: 'bg-deny-line', hex: '#F7CDD4', use: '불가 — 박스 테두리' },
{ name: 'deny-bar', cls: 'bg-deny-bar', hex: '#FF5A5A', use: '불가 — 막대, 점' }];


const TYPE: { token: string; cls: string; spec: string; use: string }[] = [
{ token: 'ir-display', cls: 'text-ir-display font-normal tracking-ir', spec: '48/60, 굵기 400, 자간 -1px', use: '첫 화면 큰 판 제목' },
{ token: 'ir-section', cls: 'text-ir-section font-normal tracking-ir', spec: '48/72, 굵기 400, 자간 -1px', use: '랜딩 섹션 제목' },
{ token: 'ir-panel', cls: 'text-ir-panel tracking-ir-sm', spec: '30/45, 자간 -0.8px', use: '랜딩 패널과 카드 제목, 큰 숫자' },
{ token: 'ir-num', cls: 'text-ir-num tracking-ir-sm', spec: '26/39', use: '띠 카드 숫자' },
{ token: 'ir-lead', cls: 'text-ir-lead font-normal tracking-ir-xs', spec: '22/33, 굵기 400', use: '큰 알약 글자' },
{ token: 'h1 / h1-lg', cls: 'text-h1 sm:text-h1-lg', spec: '38/48 → 52/66', use: '앱 화면 큰 제목' },
{ token: 'h2 / h2-lg', cls: 'text-h2 sm:text-h2-lg', spec: '28/38 → 36/48', use: '앱 페이지 제목, 좁은 화면 섹션 제목' },
{ token: 'h3 / h3-lg', cls: 'text-h3 sm:text-h3-lg', spec: '22/30 → 26/36', use: '소섹션 제목, 큰 카드 제목' },
{ token: 'h4', cls: 'text-h4', spec: '17/26', use: '카드 제목, 로고' },
{ token: 'stat', cls: 'text-stat', spec: '34/36', use: '숫자 강조' },
{ token: 'lead', cls: 'text-lead', spec: '17/30', use: '리드 문단' },
{ token: 'body-lg', cls: 'text-body-lg', spec: '15/28', use: '설명 문단, 라벨' },
{ token: 'prose', cls: 'text-prose', spec: '14/28', use: '마케팅 본문 (넉넉한 행간)' },
{ token: 'body', cls: 'text-body', spec: '14/24', use: '앱 UI 본문, 입력, 버튼' },
{ token: 'small', cls: 'text-small', spec: '13/20', use: '캡션, 표 셀, 보조 설명' },
{ token: 'caption', cls: 'text-caption', spec: '12/18', use: '메타 정보, 칩' }];


const BUTTON_VARIANTS: ButtonVariant[] = ['primary', 'secondary', 'soft', 'ghost', 'danger'];

/** FilterBar 예시용. 고른 값이 아래 목록에 실제로 반영되는 것을 보여주기 위한 것 */
const FILTER_ROWS = [
{ name: 'Amazon Web Services', verdict: 'AVAILABLE', amount: 137_000 },
{ name: 'GitHub', verdict: 'AVAILABLE', amount: 27_500 },
{ name: '스타벅스 서면점', verdict: 'NEEDS_REVIEW', amount: 12_800 },
{ name: 'SKT 이용요금', verdict: 'NEEDS_REVIEW', amount: 78_000 },
{ name: '국세청 국세납부', verdict: 'UNAVAILABLE', amount: 1_240_000 }];
const BUTTON_SIZES: ButtonSize[] = ['sm', 'md', 'lg'];
const BADGE_TONES: BadgeTone[] = ['ok', 'warn', 'deny', 'neutral', 'ink'];

function Block({
  title,
  note,
  children



}: {title: string;note?: string;children: React.ReactNode;}) {
  return (
    <section className="border-t border-line py-12">
      <div className="grid gap-8 lg:grid-cols-[220px_minmax(0,1fr)]">
        <div>
          <h2 className="text-h4 font-bold text-ink">{title}</h2>
          {note && <p className="mt-2 text-small text-muted">{note}</p>}
        </div>
        <div>{children}</div>
      </div>
    </section>);

}

export function Styleguide() {
  const [industry, setIndustry] = useState('940909');
  const [verdictFilter, setVerdictFilter] = useState('ALL');
  const [tablePage, setTablePage] = useState(0);
  const [pickedRow, setPickedRow] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  return (
    <div className="min-h-full bg-canvas">
      <Container className="py-16">
        <SectionHeading
          eyebrow="Design System"
          title="PreeT 스타일가이드"
          description="화면을 새로 만들 때 이 부품과 토큰만 씁니다. 규칙과 이유는 DESIGN.md에 있습니다." />


        <Block title="색" note="판정색(ok, warn, deny)은 판정 배지와 판정 건수에만 쓴다. 회색(surface)은 hover와 고른 상태에만 쓴다.">
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {COLORS.map((color) =>
            <li key={color.name} className="rounded-xl border border-line p-3">
                <div className={`h-12 rounded-lg border border-line2 ${color.cls}`} />
                <p className="mt-2 text-small font-bold text-ink">{color.name}</p>
                <p className="font-mono text-caption tabular-nums text-muted">{color.hex}</p>
                <p className="mt-1 text-caption text-muted">{color.use}</p>
              </li>
            )}
          </ul>
        </Block>

        <Block title="타이포" note="임의 px 크기 금지. 반응형은 h1, h2, h3만 sm: 접두로 키운다.">
          <ul className="divide-y divide-line2">
            {TYPE.map((t) =>
            <li key={t.token} className="grid items-baseline gap-4 py-4 sm:grid-cols-[160px_minmax(0,1fr)_200px]">
                <div>
                  <p className="font-mono text-small text-ink">{t.token}</p>
                  <p className="font-mono text-caption tabular-nums text-muted">{t.spec}</p>
                </div>
                <p className={`${t.cls} font-bold text-ink`}>
                  이 카드값이 경비인지
                </p>
                <p className="text-caption text-muted">{t.use}</p>
              </li>
            )}
          </ul>
        </Block>

        <Block title="Button" note="sm 헤더와 표, md 폼, lg 랜딩 CTA. 한 화면에 primary는 하나.">
          <div className="space-y-6">
            {BUTTON_VARIANTS.map((variant) =>
            <div key={variant} className="flex flex-wrap items-center gap-4">
                <span className="w-24 font-mono text-small text-muted">{variant}</span>
                {BUTTON_SIZES.map((size) =>
              <Button key={size} variant={variant} size={size}>
                    {size} 버튼
                  </Button>
              )}
                <Button variant={variant} size="md" disabled>
                  disabled
                </Button>
              </div>
            )}
            <div className="flex flex-wrap items-center gap-4">
              <span className="w-24 font-mono text-small text-muted">inline</span>
              <Button variant="ghost" size="inline" href="#">
                텍스트 링크
                <ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          </div>
        </Block>

        <Block title="Badge" note="색만으로 상태를 말하지 않는다. 판정 배지는 VerdictBadge에 API의 {code,label}을 넘기면 기호와 색이 붙는다.">
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-3">
              {BADGE_TONES.map((tone) =>
              <Badge key={tone} tone={tone}>
                  {tone}
                </Badge>
              )}
              <span className="rounded-lg bg-ink px-3 py-1.5">
                <Badge tone="inverse">inverse</Badge>
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <VerdictBadge verdict={{ code: 'AVAILABLE', label: '가능' }} />
              <VerdictBadge verdict={{ code: 'NEEDS_REVIEW', label: '확인 필요' }} />
              <VerdictBadge verdict={{ code: 'UNAVAILABLE', label: '불가' }} />
              <VerdictBadge verdict={{ code: 'AVAILABLE', label: '가능' }} size="md" />
              <VerdictBadge verdict={{ code: 'NEEDS_REVIEW', label: '확인 필요' }} size="md" />
              <VerdictBadge verdict={{ code: 'UNAVAILABLE', label: '불가' }} size="md" />
            </div>
          </div>
        </Block>

        <Block title="Card" note="tone: canvas(흰 상자와 옅은 테두리, 기본), ink(다크). padding: sm, md, lg. 경계가 꼭 필요한 덩어리에만 쓰고 나머지는 간격으로 가른다.">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <p className="text-body-lg font-bold text-ink">canvas, sm</p>
              <p className="mt-2 text-body text-ink2">목록 항목, 지출 카드</p>
            </Card>
            <Card tone="ink" padding="md">
              <p className="text-body-lg font-bold">ink, md</p>
              <p className="mt-2 text-body text-white/70">다크 패널, 라이브 미리보기</p>
            </Card>
          </div>
        </Block>

        <Block title="SectionHeading" note="eyebrow → title → description 순서 고정. page 는 로그인 뒤 화면의 h1, 나머지는 공개 화면 섹션 제목.">
          <div className="space-y-10">
            <SectionHeading size="page" as="h2" eyebrow="관리자" title="화면 제목 (page)" />
            <SectionHeading
              size="sm"
              eyebrow="아이브로우"
              title="소섹션 제목 (sm)"
              description="설명 문단은 max-w-2xl로 제한됩니다." />

            <SectionHeading title="섹션 제목 (md, 기본)" />
            <div className="rounded-2xl bg-ink p-8">
              <SectionHeading inverse eyebrow="다크 배경" title="inverse 모드" />
            </div>
          </div>
        </Block>

        <Block title="Field, Input, Select" note="라벨은 body-lg bold, 힌트는 small ink2, 오류는 small deny + role=alert. 잘못 넣은 칸은 aria-invalid 로 테두리를 deny 로 바꾼다.">
          <div className="grid max-w-xl gap-5">
            <Field label="1. 업종" htmlFor="sg-industry" hint="업종 프로파일과 경비율 조회의 기준이 됩니다.">
              <Select id="sg-industry" defaultValue="940909">
                <option value="940909">940909 기타자영업</option>
                <option value="940926">940926 소프트웨어 프리랜서</option>
              </Select>
            </Field>
            <Field label="2. 직전연도 수입금액" htmlFor="sg-revenue">
              <div className="w-56">
                <Input id="sg-revenue" type="number" placeholder="0" className="tabular-nums" />
              </div>
            </Field>
            <Field label="이메일" htmlFor="sg-email" error="이메일 형식을 확인해 주세요.">
              <Input id="sg-email" type="email" defaultValue="dev@example" aria-invalid="true" />
            </Field>
          </div>
        </Block>

        <Block title="ChoiceGroup" note="단일 선택 3~6개. 고르지 않은 칸은 edge 테두리. 있지만 안 되는 선택지는 disabled로 흐리게 + '준비 중'. 눌리는데 아무 일 없는 버튼은 만들지 않는다.">
          <div className="max-w-xl">
            <ChoiceGroup
              name="업종"
              value={industry}
              onChange={setIndustry}
              options={[
              { value: '940909', label: '프리랜서 인적용역', hint: '940909 기타자영업 (컴퓨터 프로그래머 등)' },
              { value: '73203', label: '디자이너', disabled: true },
              { value: '85699', label: '온라인 강사', disabled: true },
              { value: 'ETC', label: '그 외', disabled: true, disabledLabel: '문의' }]
              } />
            
          </div>
        </Block>

        <Block title="Table, Pagination" note="정렬·페이지네이션은 서버가 한다. hideBelow 로 좁은 화면에서 숨길 열을 고르되 핵심 정보에는 쓰지 않는다.">
          <Table
            caption="표 예시"
            rowKey={(row) => row.id}
            rows={[
            { id: 'a', date: '2026. 01. 31', name: 'Amazon Web Services', memo: 'AWS APN1', amount: 137_000 },
            { id: 'b', date: '2026. 01. 28', name: 'GitHub', memo: 'GITHUB INC', amount: 27_500 }]
            }
            columns={[
            { header: '승인일', width: 'w-[7.5rem]', cell: (row) => <span className="whitespace-nowrap tabular-nums text-ink2">{row.date}</span> },
            { header: '가맹점', cell: (row) =>
              <span className="block">
                    <span className="block font-normal text-ink">{row.name}</span>
                    <span className="block text-small text-muted">{row.memo}</span>
                  </span> },
            { header: '메모', hideBelow: 'sm', width: 'w-28', cell: (row) => <span className="text-small text-muted">{row.memo}</span> },
            { header: '금액', align: 'right', width: 'w-32', cell: (row) => <span className="font-bold text-ink">{row.amount.toLocaleString('ko-KR')}원</span> }]
            }
            selectedKey={pickedRow ?? undefined}
            onRowClick={(row) => setPickedRow(row.id === pickedRow ? null : row.id)} />

          <p className="text-small text-muted">
            행을 누르면 선택됩니다 — 지금 선택: {pickedRow ?? '없음'}. 행 클릭과 행 안
            버튼은 함께 쓰지 않습니다.
          </p>

          <p className="mt-4 text-small font-bold text-ink">loading (첫 로딩 골격)</p>
          <Table
            caption="로딩 예시"
            loading
            rowKey={(row: { id: string }) => row.id}
            rows={[]}
            columns={[
            { header: '승인일', width: 'w-[7.5rem]', cell: () => null },
            { header: '가맹점', cell: () => null },
            { header: '금액', align: 'right', width: 'w-32', cell: () => null }]
            } />

          <Pagination
            page={{
              number: tablePage,
              totalPages: 3,
              totalElements: 52,
              hasNext: tablePage < 2
            }}
            onChange={setTablePage} />
          
        </Block>

        <Block title="FilterBar" note="선택지가 5개 안쪽이고 서로 배타적일 때. role=group + aria-pressed 버튼 묶음이며 탭이 아니다. 건수는 서버가 준 값만 쓴다.">
          <FilterBar
            name="판정 결과"
            value={verdictFilter}
            onChange={setVerdictFilter}
            options={[
            { value: 'ALL', label: '전체', count: FILTER_ROWS.length },
            { value: 'AVAILABLE', label: '가능', count: FILTER_ROWS.filter((r) => r.verdict === 'AVAILABLE').length },
            { value: 'NEEDS_REVIEW', label: '확인 필요', count: FILTER_ROWS.filter((r) => r.verdict === 'NEEDS_REVIEW').length },
            { value: 'UNAVAILABLE', label: '불가', count: FILTER_ROWS.filter((r) => r.verdict === 'UNAVAILABLE').length }]
            } />

          <ul className="mt-3 divide-y divide-line2 rounded-xl border border-line">
            {FILTER_ROWS.filter(
              (row) => verdictFilter === 'ALL' || row.verdict === verdictFilter
            ).map((row) =>
            <li
              key={row.name}
              className="flex items-center justify-between px-4 py-2.5 text-small">

                <span className="text-ink">{row.name}</span>
                <span className="tabular-nums text-muted">
                  {row.amount.toLocaleString('ko-KR')}원
                </span>
              </li>
            )}
          </ul>
        </Block>

        <Block title="Modal" note="되돌릴 수 없는 동작 앞에서만. 무엇이 함께 사라지는지 description 에 적는다. Esc나 바깥 클릭으로 닫히고, Tab 은 대화상자 안에서만 돌며, 닫으면 열었던 버튼으로 초점이 돌아온다.">
          <Button variant="secondary" size="md" onClick={() => setModalOpen(true)}>
            삭제 확인 열기
          </Button>
          <Modal
            open={modalOpen}
            onClose={() => setModalOpen(false)}
            tone="danger"
            title="이 업로드를 지울까요?"
            description="되돌릴 수 없습니다. 이 파일에서 나온 거래와 판정 결과, 되묻기 답변까지 함께 사라집니다."
            footer={
            <>
                <Button variant="secondary" size="md" onClick={() => setModalOpen(false)}>
                  취소
                </Button>
                <Button variant="danger" size="md" onClick={() => setModalOpen(false)}>
                  지우기
                </Button>
              </>
            } />
          
        </Block>

        <Block title="Empty" note="없음이 아니라 왜 없는지를 말한다. 문장 하나와 동작 하나. 다 처리해서 비었으면 tone=ok(초록이 아니다), 화면 전체를 불러오지 못했으면 tone=error. 걸러 낸 표가 비었으면 inTable 로 상자 없이 표 괘선 아래를 비운다.">
          <div className="grid gap-4 lg:grid-cols-2">
            <Empty
              icon={<InboxIcon className="h-5 w-5" />}
              title="아직 올린 파일이 없습니다"
              action={<Button size="sm" variant="secondary">카드내역 올리기</Button>} />
            
            <Empty
              tone="ok"
              icon={<CheckIcon className="h-5 w-5" />}
              title="분류할 가맹점이 없습니다" />

            <Empty
              inTable
              icon={<InboxIcon className="h-5 w-5" />}
              title="확인이 필요한 거래가 없습니다" />

            <Empty
              tone="error"
              icon={<AlertTriangleIcon className="h-5 w-5" />}
              title="거래를 불러오지 못했습니다"
              action={<Button size="sm" variant="secondary">다시 시도</Button>} />

          </div>
        </Block>

        <Block title="StatuteCitation" note="GET /statutes/{id} 응답 그대로. 시행일과 원문 링크가 항상 붙고, hierarchy 로 근거와 참고(해석기준·사례)를 나눈다.">
          <div className="grid max-w-2xl gap-3">
            <StatuteCitation statuteVersionId={1435} />
            <StatuteCitation statuteVersionId={2071} />
          </div>
        </Block>
      </Container>
    </div>);

}
