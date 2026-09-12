import React from 'react';
import { ArrowRightIcon } from 'lucide-react';
import { StatuteCitation } from '../components/StatuteCitation';
import { VerdictBadge } from '../components/VerdictBadge';
import {
  Badge,
  Button,
  Card,
  Container,
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
{ name: 'canvas', cls: 'bg-canvas', hex: '#F6F7F9', use: '페이지 바탕, 구분 섹션' },
{ name: 'surface', cls: 'bg-surface', hex: '#FFFFFF', use: '카드, 헤더, 입력' },
{ name: 'line', cls: 'bg-line', hex: '#E4E7EC', use: '테두리 기본' },
{ name: 'line2', cls: 'bg-line2', hex: '#F0F2F5', use: '약한 구분선, 칩 배경' },
{ name: 'ink', cls: 'bg-ink', hex: '#101418', use: '제목, 본문 강조, 다크 섹션' },
{ name: 'ink2', cls: 'bg-ink2', hex: '#3A424D', use: '본문' },
{ name: 'muted', cls: 'bg-muted', hex: '#6B7480', use: '보조 설명, 캡션' },
{ name: 'accent', cls: 'bg-accent', hex: '#1F4FD8', use: 'CTA, 링크, 아이브로우' },
{ name: 'accent-soft', cls: 'bg-accent-soft', hex: '#EEF2FE', use: 'soft 버튼 배경' },
{ name: 'ok', cls: 'bg-ok', hex: '#0B7A4B', use: '가능' },
{ name: 'warn', cls: 'bg-warn', hex: '#8A5209', use: '확인 필요' },
{ name: 'deny', cls: 'bg-deny', hex: '#B02318', use: '불가' }];


const TYPE: { token: string; cls: string; spec: string; use: string }[] = [
{ token: 'h1 / h1-lg', cls: 'text-h1 sm:text-h1-lg', spec: '38/46 → 52/64', use: '랜딩 히어로 제목' },
{ token: 'h2 / h2-lg', cls: 'text-h2 sm:text-h2-lg', spec: '28/38 → 36/48', use: '섹션 제목, 앱 페이지 제목' },
{ token: 'h3 / h3-lg', cls: 'text-h3 sm:text-h3-lg', spec: '22/30 → 26/34', use: '소섹션 제목, 큰 카드 제목' },
{ token: 'h4', cls: 'text-h4', spec: '17/24', use: '카드 제목, 로고' },
{ token: 'stat', cls: 'text-stat', spec: '34/34', use: '숫자 강조' },
{ token: 'lead', cls: 'text-lead', spec: '16/32', use: '히어로 리드 문단' },
{ token: 'body-lg', cls: 'text-body-lg', spec: '15/28', use: '설명 문단, 라벨' },
{ token: 'prose', cls: 'text-prose', spec: '14/28', use: '마케팅 본문 (넉넉한 행간)' },
{ token: 'body', cls: 'text-body', spec: '14/24', use: '앱 UI 본문, 입력, 버튼' },
{ token: 'small', cls: 'text-small', spec: '13/20', use: '캡션, 표 셀, 보조 설명' },
{ token: 'caption', cls: 'text-caption', spec: '12/18', use: '메타 정보, 칩' }];


const BUTTON_VARIANTS: ButtonVariant[] = ['primary', 'secondary', 'soft', 'ghost'];
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
  return (
    <div className="min-h-full bg-surface">
      <Container className="py-16">
        <SectionHeading
          eyebrow="Design System · 초안"
          title="경비판정 스타일가이드"
          description="화면을 새로 만들 때 이 부품과 토큰만 씁니다. 규칙과 이유는 DESIGN.md에 있습니다." />


        <Block title="색" note="상태색(ok·warn·deny)은 배경·테두리·글자 세트로만 쓴다. 단독 사용 금지.">
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {COLORS.map((color) =>
            <li key={color.name} className="rounded-xl border border-line p-3">
                <div className={`h-12 rounded-lg border border-line2 ${color.cls}`} />
                <p className="mt-2 text-small font-semibold text-ink">{color.name}</p>
                <p className="font-mono text-caption tabular-nums text-muted">{color.hex}</p>
                <p className="mt-1 text-caption text-muted">{color.use}</p>
              </li>
            )}
          </ul>
        </Block>

        <Block title="타이포" note="임의 px 크기 금지. 반응형은 h1·h2·h3만 sm: 접두로 키운다.">
          <ul className="divide-y divide-line2">
            {TYPE.map((t) =>
            <li key={t.token} className="grid items-baseline gap-4 py-4 sm:grid-cols-[160px_minmax(0,1fr)_200px]">
                <div>
                  <p className="font-mono text-small text-ink">{t.token}</p>
                  <p className="font-mono text-caption tabular-nums text-muted">{t.spec}</p>
                </div>
                <p className={`${t.cls} font-semibold text-ink`}>
                  이 카드값이 경비인지
                </p>
                <p className="text-caption text-muted">{t.use}</p>
              </li>
            )}
          </ul>
        </Block>

        <Block title="Button" note="sm 헤더·표, md 폼, lg 랜딩 CTA. 한 화면에 primary는 하나.">
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

        <Block title="Badge" note="색만으로 상태를 말하지 않는다. 판정 배지는 VerdictBadge를 쓰면 기호가 자동으로 붙는다.">
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
              <VerdictBadge verdict="POSSIBLE" />
              <VerdictBadge verdict="NEEDS_REVIEW" />
              <VerdictBadge verdict="IMPOSSIBLE" />
              <VerdictBadge verdict="POSSIBLE" size="md" />
              <VerdictBadge verdict="NEEDS_REVIEW" size="md" />
              <VerdictBadge verdict="IMPOSSIBLE" size="md" />
            </div>
          </div>
        </Block>

        <Block title="Card" note="tone: surface(기본)·canvas(강조 배경)·ink(다크). padding: sm·md·lg.">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <p className="text-body-lg font-semibold text-ink">surface · sm</p>
              <p className="mt-2 text-body text-ink2">목록 항목, 지출 카드</p>
            </Card>
            <Card tone="canvas" padding="md">
              <p className="text-body-lg font-semibold text-ink">canvas · md</p>
              <p className="mt-2 text-body text-ink2">강조하고 싶은 큰 카드</p>
            </Card>
            <Card tone="ink" padding="md">
              <p className="text-body-lg font-semibold">ink · md</p>
              <p className="mt-2 text-body text-white/70">다크 패널, 라이브 미리보기</p>
            </Card>
          </div>
        </Block>

        <Block title="SectionHeading" note="eyebrow → title → description 순서 고정. 랜딩·앱 페이지 머리에 쓴다.">
          <div className="space-y-10">
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

        <Block title="Field · Input · Select" note="라벨은 body-lg semibold, 힌트는 small muted, 오류는 small deny + role=alert.">
          <div className="grid max-w-xl gap-5">
            <Field label="1. 업종" htmlFor="sg-industry" hint="업종 프로파일과 경비율 조회의 기준이 됩니다.">
              <Select id="sg-industry" defaultValue="62010">
                <option value="62010">62010 · 컴퓨터 프로그래밍 서비스업</option>
                <option value="62021">62021 · 시스템 통합 자문·구축 서비스업</option>
              </Select>
            </Field>
            <Field label="2. 직전연도 수입금액" htmlFor="sg-revenue">
              <div className="w-56">
                <Input id="sg-revenue" type="number" placeholder="0" className="tabular-nums" />
              </div>
            </Field>
            <Field label="이메일" htmlFor="sg-email" error="이메일 형식을 확인해 주세요.">
              <Input id="sg-email" type="email" defaultValue="dev@example" />
            </Field>
          </div>
        </Block>

        <Block title="StatuteCitation" note="근거(실선)와 참고 해석기준(점선)을 시각적으로 구분한다.">
          <div className="grid max-w-2xl gap-3">
            <StatuteCitation statuteId="소득세법-33-1-5" />
            <StatuteCitation statuteId="기본통칙-27-1" />
          </div>
        </Block>
      </Container>
    </div>);

}
