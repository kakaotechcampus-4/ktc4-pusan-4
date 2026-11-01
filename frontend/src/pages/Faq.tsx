import { MarketingHeader } from '../components/MarketingHeader';
import { MarketingFooter } from '../components/MarketingFooter';
import { Button, SectionHeading } from '../components/ui';
import { FAQ_GROUPS } from '../mock/faq';

/**
 * 자주 묻는 질문. 답은 접었다 편다.
 *
 * 여닫이는 <details>/<summary> 를 그대로 쓴다. 키보드·스크린리더 동작이
 * 브라우저에 이미 있어서, 직접 만들면 그만큼 잃는다.
 */
export function Faq() {
  return (
    <div className="min-h-full bg-canvas">
      <MarketingHeader />

      <main className="mx-auto w-full max-w-page px-6 pb-28 pt-16 lg:px-gutter">
        <SectionHeading
          eyebrow="자주 묻는 질문"
          title="먼저 묻는 것들"
          description="판정을 누가 하는지, 내 파일이 어디까지 가는지, 결과를 어디까지 믿어도 되는지." />

        <div className="mt-16 space-y-16">
          {FAQ_GROUPS.map((group) =>
          <section key={group.title}>
              <h2 className="text-h3 font-bold tracking-ir-sm text-ink">
                {group.title}
              </h2>

              <ul className="mt-6 border-t border-line">
                {group.items.map((item) =>
              <li key={item.q} className="border-b border-line">
                    <details className="group">
                      <summary className="flex cursor-pointer list-none items-start justify-between gap-6 py-6 text-body-lg font-bold text-ink [&::-webkit-details-marker]:hidden">
                        <span className="[word-break:keep-all]">{item.q}</span>
                        <span
                      aria-hidden="true"
                      className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-accent-line text-muted transition-transform duration-150 ease-snap group-open:rotate-45">

                          +
                        </span>
                      </summary>
                      <div className="pb-7 pr-12 text-prose text-ink2 [word-break:keep-all]">
                        {item.a.map((line) =>
                    <p key={line} className="mt-3 first:mt-0">
                            {line}
                          </p>
                    )}
                      </div>
                    </details>
                  </li>
              )}
              </ul>
            </section>
          )}
        </div>

        <div className="mt-20 rounded-2xl bg-surface px-8 py-12 sm:px-16">
          <p className="text-h3 font-bold tracking-ir-sm text-ink [word-break:keep-all]">
            여기에 없는 것은 직접 돌려 보는 편이 빠릅니다
          </p>
          <p className="mt-4 max-w-2xl text-body leading-6 text-ink2 [word-break:keep-all]">
            카드내역 한 달치면 판정이 어떻게 나오는지 바로 보입니다. 결과가
            마음에 들지 않으면 되묻기에 답해 다시 판정할 수 있습니다.
          </p>
          <Button to="/login" size="md" className="mt-8">
            판정해보기
          </Button>
        </div>
      </main>

      <MarketingFooter />
    </div>);

}
