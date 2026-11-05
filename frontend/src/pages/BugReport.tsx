import { MarketingHeader } from '../components/MarketingHeader';
import { MarketingFooter } from '../components/MarketingFooter';
import { SectionHeading } from '../components/ui';
import { BugReportAddress, BugReportMailButton } from '../components/BugReport';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { WHAT_TO_WRITE } from '../utils/bugReport';

/**
 * 버그 신고. 레포가 공개라 GitHub 이슈 대신 메일로 받는다(받는 주소는 utils/contact.ts).
 * 머리말의 「버그 신고」는 같은 내용을 창으로 띄우고, 이 화면은 꼬리말 링크와 주소로 바로 들어올 때 쓴다.
 * 메뉴만 넣고 라우트가 없으면 `*` 가 없는 주소 화면으로 보내서 눌러도 아무 일이 없는 것처럼 보인다(#211)
 */
export function BugReport() {
  useDocumentTitle('버그 신고');
  return (
    <div className="min-h-full bg-canvas">
      <MarketingHeader />

      <main className="mx-auto w-full max-w-page px-6 pb-28 pt-16 lg:px-gutter">
        <SectionHeading
          as="h1"
          eyebrow="버그 신고"
          title="잘못 나온 것을 알려주세요"
          description="판정이 이상하거나 화면이 깨졌다면 알려주시면 고칩니다." />

        <div className="mt-12 max-w-2xl rounded-2xl border border-line bg-surface px-8 py-10">
          <p className="text-h4 font-bold text-ink">메일로 받습니다</p>
          <p className="mt-4 text-body leading-6 text-ink2 [word-break:keep-all]">
            「메일 쓰기」를 누르면 아래 적을 것과 지금 시각·브라우저를 채운 메일이 열립니다.
          </p>
          <div className="mt-6">
            <BugReportMailButton />
          </div>
          <div className="mt-6">
            <BugReportAddress />
          </div>
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
