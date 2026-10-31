import { useSession } from '../../contexts/SessionContext';
import { PublicLayout } from '../../components/PublicLayout';
import { Button } from '../../components/ui';

/** 없는 주소. 예전에는 홈으로 바로 보내서 주소를 잘못 친 것인지 알 수 없었다 */
export function NotFound() {
  const { isAuthenticated } = useSession();
  return (
    <PublicLayout>
      <div className="py-16 text-center">
        <p className="text-small font-bold tabular-nums text-accent">404</p>
        <h1 className="mt-2 text-h2 font-bold tracking-tight text-ink">찾는 화면이 없습니다</h1>
        <p className="mt-3 text-body leading-7 text-ink2">주소가 바뀌었거나 잘못 입력됐습니다.</p>
        <div className="mt-8 flex justify-center gap-2">
          <Button to="/" variant="secondary" size="md">
            홈으로
          </Button>
          {isAuthenticated &&
          <Button to="/upload" size="md">
              내 판정으로
            </Button>
          }
        </div>
      </div>
    </PublicLayout>);

}
