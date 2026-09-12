import { Container } from './ui';

export function MarketingFooter() {
  return (
    <footer className="border-t border-line bg-surface">
      <Container className="py-12">
        <div className="flex flex-wrap items-start justify-between gap-8">
          <div className="max-w-xl">
            <p className="text-body-lg font-bold text-ink">경비판정</p>
            <p className="mt-3 text-small leading-6 text-muted">
              이 서비스는 확인할 항목과 근거까지만 제시합니다. 세액을 확정하거나
              세무 신고를 대리하지 않으며, 최종 판단에는 세무대리인의 확인이
              필요합니다. 판정 결과를 그대로 신고에 사용해 발생한 결과에 대해서는
              책임을 지지 않습니다.
            </p>
          </div>
          <dl className="grid gap-x-10 gap-y-2 text-small sm:grid-cols-2">
            <div className="flex gap-3">
              <dt className="text-muted">데이터 출처</dt>
              <dd className="text-ink2">국가법령정보 OPEN API</dd>
            </div>
            <div className="flex gap-3">
              <dt className="text-muted">조문 동기화</dt>
              <dd className="tabular-nums text-ink2">매일 03:00 KST</dd>
            </div>
            <div className="flex gap-3">
              <dt className="text-muted">지원 파일</dt>
              <dd className="text-ink2">홈택스 XLSX · 카드사 CSV</dd>
            </div>
            <div className="flex gap-3">
              <dt className="text-muted">문의</dt>
              <dd className="text-ink2">help@expense-verdict.kr</dd>
            </div>
          </dl>
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-line2 pt-6 text-caption text-muted">
          <p>© 2026 경비판정. 무자격 세무대리를 하지 않습니다.</p>
          <ul className="flex gap-5">
            <li>이용약관</li>
            <li>개인정보처리방침</li>
            <li>데이터 경계 안내</li>
          </ul>
        </div>
      </Container>
    </footer>);

}