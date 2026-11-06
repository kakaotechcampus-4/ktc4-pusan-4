import { useSession } from '../../contexts/SessionContext';
import { PublicLayout } from '../../components/PublicLayout';
import { Button } from '../../components/ui';

/** 없는 주소. 예전에는 홈으로 바로 보내서 주소를 잘못 친 것인지 알 수 없었다 */
export function NotFound() {
  const { isAuthenticated, batchId, batchStatus } = useSession();
  // 머리말의 「내 판정으로」와 같은 곳으로 간다 (C83)
  const mine = batchStatus === 'ready' && batchId === null ? '/upload' : '/results';
  return (
    <PublicLayout title="찾는 화면이 없습니다">
      <div className="py-16 text-center">
        <h1 className="text-h2 font-bold tracking-tight text-ink">찾는 화면이 없습니다</h1>
        <p className="mt-3 text-body leading-7 text-ink2">주소가 바뀌었거나 잘못 입력됐습니다.</p>
        <div className="mt-8 flex justify-center gap-2">
          <Button to="/" variant="secondary" size="md">
            홈으로
          </Button>
          {isAuthenticated &&
          <Button to={mine} size="md">
              내 판정으로
            </Button>
          }
        </div>
      </div>
    </PublicLayout>);

}
