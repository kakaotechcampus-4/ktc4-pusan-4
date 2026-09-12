import { ArrowRightIcon } from 'lucide-react';
import { MarketingHeader } from '../components/MarketingHeader';
import { MarketingFooter } from '../components/MarketingFooter';
import { StatuteCitation } from '../components/StatuteCitation';
import { AgentPreview } from '../components/AgentPreview';
import {
  Badge,
  Button,
  Card,
  Container,
  SectionHeading,
  type BadgeTone } from
'../components/ui';
import {
  DEV_EXPENSES,
  FLOW_STEPS,
  NOT_DOING,
  STATS,
  SYSTEM_FEATURES } from
'../mock/marketing';

const EXPENSE_TONE: Record<
  (typeof DEV_EXPENSES)[number]['verdict'],
  { label: string; tone: BadgeTone }> =
{
  ok: { label: '가능', tone: 'ok' },
  ask: { label: '확인 필요', tone: 'warn' },
  deny: { label: '불가', tone: 'deny' }
};

const VERDICTS = [
{
  symbol: '✓',
  label: '가능',
  body: '근거 조문이 붙은 건만 여기로 옵니다. 산입 금액과 준비할 증빙을 함께 적어둡니다.'
},
{
  symbol: '?',
  label: '확인 필요',
  body: '전문가끼리도 갈리는 건, 목적·비율·기간이 확인되지 않은 건은 단정하지 않고 여기 남깁니다.'
},
{
  symbol: '✕',
  label: '불가',
  body: '법에 열거된 불산입 항목과 업종 통상성이 부정되는 건. 왜 안 되는지 조문으로 답합니다.'
}];


const EVIDENCE_POINTS = [
'조문마다 시행일과 버전 번호를 함께 인쇄합니다',
'판정 시점에 읽은 버전을 고정해 과거 결과가 바뀌지 않습니다',
'존재하지 않는 조문 ID는 저장 전에 걸러냅니다'];


export function Landing() {
  return (
    <div className="flex min-h-full w-full flex-col bg-surface">
      <MarketingHeader />

      <main className="flex-1">
        {/* 히어로 */}
        <Container as="section" className="pb-16 pt-20 sm:pt-28">
          <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div>
              <SectionHeading
                as="h1"
                size="lg"
                eyebrow="1인 IT 개발 사업자를 위한 경비 판정"
                title={
                <>
                    이 카드값이 경비인지,
                    <br />
                    조문까지 붙여 답합니다
                  </>
                } />

              <p className="mt-6 max-w-xl text-lead text-ink2">
                혼자 개발하는 사업자의 카드내역 수백 건을 건별로 판정합니다.
                클라우드·구독·장비처럼 개발자에게 반복되는 지출을 기준으로 규칙을
                짰고, 결과마다 어떤 조문의 어떤 버전을 읽었는지 함께 보여드립니다.
              </p>
              <div className="mt-9 flex flex-wrap items-center gap-4">
                <Button to="/login" size="lg">
                  무료로 판정해보기
                </Button>
                <Button href="#system" variant="ghost" size="inline">
                  판정 방식 보기
                  <ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            </div>

            <figure className="justify-self-center lg:justify-self-end">
              <AgentPreview />
              <figcaption className="mt-3 text-center text-small text-muted">
                실제 규칙 카드 순서 그대로 · 샘플 3건 순환
              </figcaption>
            </figure>
          </div>
        </Container>

        {/* 개발자 지출 */}
        <Container className="pb-20">
          <SectionHeading
            size="sm"
            title="개발자 카드에 찍히는 지출만 깊게 봅니다"
            description="업종을 컴퓨터 프로그래밍 서비스업 하나로 좁힌 대신, AWS 청구서부터 코워킹 데스크까지 개발자 지출 하나하나에 규칙 카드를 붙였습니다." />

          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {DEV_EXPENSES.map((item) => {
              const tone = EXPENSE_TONE[item.verdict];
              return (
                <Card key={item.kind} as="li" className="flex flex-col">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-body-lg font-semibold text-ink">
                        {item.kind}
                      </p>
                      <p className="mt-1 text-small text-muted">{item.examples}</p>
                    </div>
                    <Badge tone={tone.tone} className="shrink-0">
                      {tone.label}
                    </Badge>
                  </div>
                  <p className="mt-5 text-body text-ink2">{item.point}</p>
                </Card>);

            })}
          </ul>
        </Container>

        {/* 숫자 */}
        <section id="evidence" className="border-y border-line bg-canvas">
          <Container className="py-14">
            <dl className="grid grid-cols-2 gap-8 md:grid-cols-4">
              {STATS.map((stat) =>
              <div key={stat.label}>
                  <dd className="text-stat font-bold tabular-nums text-ink">
                    {stat.value}
                  </dd>
                  <dt className="mt-2 text-small text-muted">{stat.label}</dt>
                </div>
              )}
            </dl>
          </Container>
        </section>

        {/* 판정 방식 */}
        <Container id="system" className="py-24">
          <SectionHeading
            className="max-w-2xl"
            title={
            <>
                결과보다 먼저,
                <br />
                그 결과가 나온 경로를 보여드립니다
              </>
            } />


          <div className="mt-12 grid gap-5 lg:grid-cols-3">
            <Card as="article" tone="canvas" padding="lg" className="lg:col-span-2">
              <h3 className="whitespace-pre-line text-h3 font-bold tracking-tight text-ink sm:text-h3-lg">
                {SYSTEM_FEATURES[0].title}
              </h3>
              <p className="mt-5 max-w-xl text-body-lg text-ink2">
                {SYSTEM_FEATURES[0].body}
              </p>
              <p className="mt-8 border-l-2 border-accent pl-4 text-body-lg font-semibold text-ink">
                {SYSTEM_FEATURES[0].caption}
              </p>
            </Card>

            <div className="grid gap-5">
              {SYSTEM_FEATURES.slice(1).map((feature) =>
              <Card key={feature.title} as="article" padding="md">
                  <h3 className="whitespace-pre-line text-h4 font-bold text-ink">
                    {feature.title}
                  </h3>
                  <p className="mt-3 text-prose text-muted">{feature.body}</p>
                </Card>
              )}
            </div>
          </div>
        </Container>

        {/* 3분류 */}
        <section className="relative overflow-hidden bg-ink">
          <img
            src="/agent-flow.webp"
            alt=""
            aria-hidden="true"
            className="pointer-events-none absolute right-0 top-0 hidden h-[420px] w-[58%] object-cover object-right opacity-90 [mask-image:linear-gradient(to_right,transparent,black_30%,black_80%,transparent),linear-gradient(to_bottom,black_70%,transparent)] [mask-composite:intersect] lg:block" />

          <Container className="relative py-24">
            <SectionHeading
              inverse
              className="max-w-2xl"
              eyebrow="3분류 판정"
              title={
              <>
                  최악의 결과가 「틀린 답」이 아니라
                  <br />
                  「질문 하나 더」가 되도록
                </>
              } />

            <ul className="mt-12 grid gap-px overflow-hidden rounded-2xl bg-white/15 md:grid-cols-3">
              {VERDICTS.map((verdict) =>
              <li key={verdict.label} className="bg-ink p-8">
                  <Badge tone="inverse" size="md" symbol={verdict.symbol}>
                    {verdict.label}
                  </Badge>
                  <p className="mt-5 text-prose text-white/70">{verdict.body}</p>
                </li>
              )}
            </ul>
            <p className="mt-8 max-w-3xl text-prose text-white/50">
              조문을 붙일 수 없는 건은 가능·불가로 저장되지 않습니다. 근거가 0건이면
              저장 자체가 거부되고, 「확인 필요」로만 남습니다.
            </p>
          </Container>
        </section>

        {/* 근거 표기 */}
        <Container className="py-24">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
            <div>
              <SectionHeading
                title={
                <>
                    근거와 참고 해석기준을
                    <br />
                    섞지 않습니다
                  </>
                } />

              <p className="mt-6 max-w-lg text-body-lg text-ink2">
                법률·시행령은 판정의 근거로, 기본통칙·심판례·판례는 참고 해석기준으로
                구분해 표기합니다. 하위 근거 하나로 상위 조문을 뒤집는 판정이 나오지
                않도록 탐색 순서를 코드로 강제합니다.
              </p>
              <ul className="mt-8 space-y-3 text-prose text-ink2">
                {EVIDENCE_POINTS.map((point) =>
                <li key={point} className="flex gap-3">
                    <span
                    aria-hidden="true"
                    className="mt-3 h-1 w-1 shrink-0 rounded-full bg-accent" />

                    {point}
                  </li>
                )}
              </ul>
            </div>

            <Card tone="canvas" className="space-y-3">
              <p className="text-small font-semibold text-muted">
                실제 판정 화면에 붙는 근거
              </p>
              <StatuteCitation statuteId="소득세법-33-1-5" />
              <StatuteCitation statuteId="기본통칙-27-1" />
            </Card>
          </div>
        </Container>

        {/* 흐름 */}
        <section id="flow" className="border-y border-line bg-canvas">
          <Container className="py-24">
            <SectionHeading title="네 단계로 끝납니다" />
            <ol className="mt-12 grid gap-8 md:grid-cols-2 lg:grid-cols-4">
              {FLOW_STEPS.map((item) =>
              <li key={item.step} className="border-t-2 border-ink pt-5">
                  <p className="text-small font-bold tabular-nums text-accent">
                    {item.step}
                  </p>
                  <h3 className="mt-2.5 text-h4 font-bold text-ink">
                    {item.title}
                  </h3>
                  <p className="mt-2.5 text-prose text-muted">{item.body}</p>
                </li>
              )}
            </ol>
          </Container>
        </section>

        {/* 하지 않는 일 */}
        <Container id="scope" className="py-24">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
            <SectionHeading
              title={
              <>
                  하지 않는 일도
                  <br />
                  먼저 알려드립니다
                </>
              } />

            <dl className="divide-y divide-line border-y border-line">
              {NOT_DOING.map((item) =>
              <div
                key={item.title}
                className="flex flex-wrap items-baseline gap-x-6 gap-y-1 py-5">

                  <dt className="w-48 shrink-0 text-lead font-semibold leading-normal text-ink">
                    {item.title}
                  </dt>
                  <dd className="text-prose text-muted">{item.body}</dd>
                </div>
              )}
            </dl>
          </div>
        </Container>

        {/* CTA */}
        <section className="border-t border-line bg-canvas">
          <Container className="flex flex-wrap items-center justify-between gap-6 py-16">
            <div>
              <h2 className="text-h3-lg font-bold tracking-tight text-ink sm:text-h2">
                1월 카드내역부터 시작해보세요
              </h2>
              <p className="mt-3 text-body-lg text-muted">
                로그인 후 파일 하나만 올리면 됩니다. 원본은 서버로 올라가지 않습니다.
              </p>
            </div>
            <Button to="/login" size="lg">
              로그인하고 시작하기
            </Button>
          </Container>
        </section>
      </main>

      <MarketingFooter />
    </div>);

}
