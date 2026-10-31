import { MarketingHeader } from '../components/MarketingHeader';
import { MarketingFooter } from '../components/MarketingFooter';
import { SectionHeading } from '../components/ui';

/**
 * 버그 신고. 보내는 양식은 아직 없다 — 치오님이 여기에 붙인다.
 *
 * 메뉴에 자리를 먼저 잡아 두는 쪽을 택했다. 메뉴만 넣고 라우트가 없으면
 * `*` 가 랜딩으로 되돌려서, 눌러도 아무 일이 없는 것처럼 보인다.
 *
 * 보낼 곳을 아직 지어내지 않는다. 계약(`docs/api.md`)에 신고 엔드포인트가
 * 없고, 푸터의 help@expense-verdict.kr 은 코드 어디에도 쓰이지 않는 문구다.
 * 닿지 않는 곳으로 보내는 양식은 없는 것만 못하다.
 */
const WHAT_TO_WRITE = [
{ term: '무엇을 하려다', detail: '어느 화면에서 어떤 버튼을 눌렀는지' },
{ term: '무엇을 봤는지', detail: '화면에 뜬 문구 그대로. 숫자가 안 맞으면 양쪽 숫자를 함께' },
{ term: '무엇을 기대했는지', detail: '대신 어떻게 나왔어야 하는지' },
{ term: '언제', detail: '날짜와 대략의 시각' }];


export function BugReport() {
  return (
    <div className="min-h-full bg-canvas">
      <MarketingHeader />

      <main className="mx-auto w-full max-w-page px-6 pb-28 pt-16 lg:px-gutter">
        <SectionHeading
          eyebrow="버그 신고"
          title="잘못 나온 것을 알려주세요"
          description="판정이 이상하거나 화면이 깨졌다면 알려주시면 고칩니다." />

        <div className="mt-12 max-w-2xl rounded-2xl border border-line bg-surface px-8 py-10">
          <p className="text-h4 font-bold text-ink">
            접수 창구를 준비하고 있습니다
          </p>
          <p className="mt-4 text-body leading-6 text-ink2 [word-break:keep-all]">
            곧 이 자리에서 바로 보낼 수 있게 됩니다. 그때까지는 아래 내용을
            적어 두셨다가 한 번에 보내주시면 고치는 데 걸리는 시간이 줄어듭니다.
          </p>
        </div>

        <section className="mt-16 max-w-2xl">
          <h2 className="text-h3 font-bold tracking-ir-sm text-ink">
            이렇게 적어주시면 좋습니다
          </h2>
          <dl className="mt-6 border-t border-line">
            {WHAT_TO_WRITE.map((item) =>
            <div
              key={item.term}
              className="flex flex-col gap-1 border-b border-line py-5 sm:flex-row sm:gap-8">

                <dt className="shrink-0 text-body font-bold text-ink sm:w-40">
                  {item.term}
                </dt>
                <dd className="text-body leading-6 text-ink2 [word-break:keep-all]">
                  {item.detail}
                </dd>
              </div>
            )}
          </dl>
          <p className="mt-6 text-small leading-6 text-muted [word-break:keep-all]">
            카드내역 원본 파일은 보내지 않으셔도 됩니다. 원본은 서버로
            올라가지 않으며, 저희도 받지 않습니다.
          </p>
        </section>
      </main>

      <MarketingFooter />
    </div>);

}
