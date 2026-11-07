import { Link } from 'react-router-dom';
import { Container } from './ui';
import { SUPPORT_EMAIL } from '../utils/contact';
import { DISCLAIMER } from '../copy';

export function MarketingFooter() {
  return (
    <footer className="border-t border-line bg-canvas">
      <Container className="py-12">
        <div className="flex flex-wrap items-start justify-between gap-8">
          <div className="max-w-xl">
            <p className="text-body-lg font-bold text-ink">PreeT</p>
            <p className="mt-3 text-small leading-6 text-ink2 [word-break:keep-all]">{DISCLAIMER}</p>
          </div>
          <dl className="grid gap-x-10 gap-y-2 text-small sm:grid-cols-2">
            <div className="flex gap-3">
              <dt className="text-muted">조문 출처</dt>
              <dd className="text-ink2">국가법령정보센터</dd>
            </div>
            <div className="flex gap-3">
              <dt className="text-muted">지원 파일</dt>
              <dd className="text-ink2">KB국민카드, IBK기업은행 승인내역</dd>
            </div>
            <div className="flex gap-3">
              <dt className="text-muted">문의</dt>
              <dd className="break-all text-ink2">{SUPPORT_EMAIL}</dd>
            </div>
          </dl>
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-line2 pt-6 text-caption text-muted">
          <p>© 2026 PreeT</p>
          <ul className="flex flex-wrap items-center gap-5">
            <li>
              <Link to="/faq" className="transition-colors hover:text-ink">
                자주 묻는 질문
              </Link>
            </li>
            <li>
              <Link to="/bug-report" className="transition-colors hover:text-ink">
                버그 신고
              </Link>
            </li>
            <li>
              <Link to="/terms" className="transition-colors hover:text-ink">
                이용약관
              </Link>
            </li>
            <li>
              <Link to="/privacy" className="font-bold transition-colors hover:text-ink">
                개인정보처리방침
              </Link>
            </li>
          </ul>
        </div>
      </Container>
    </footer>);

}