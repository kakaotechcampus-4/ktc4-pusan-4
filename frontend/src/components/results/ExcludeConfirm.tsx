import type { TransactionSummary } from '../../types/domain';
import { Button, Modal } from '../ui';
import { formatFullDate, formatWon } from '../../utils/format';
import { merchantTitle } from './display';

interface ExcludeConfirmProps {
  /** 뺄 거래. null 이면 닫혀 있다 */
  transaction: TransactionSummary | null;
  busy: boolean;
  /** 빼지 못했을 때의 문구. 뒤 화면은 백드롭에 가려서 창 안에 보인다 */
  error: string | null;
  onConfirm: () => void;
  onClose: () => void;
}

/**
 * 판정 대상에서 빼기 전에 한 번 묻는다(11/8 회의). 결과와 합계에서 거래가 사라지므로
 * 잘못 누른 것을 막는다. 거래 화면에서 다시 넣을 수 있어 빨강(danger)은 쓰지 않는다
 */
export function ExcludeConfirm({ transaction, busy, error, onConfirm, onClose }: ExcludeConfirmProps) {
  return (
    <Modal
      open={transaction !== null}
      onClose={() => {
        if (!busy) onClose();
      }}
      title="판정 대상에서 뺄까요?"
      description="결과와 합계에서 빠집니다. 거래 화면에서 다시 넣을 수 있습니다."
      footer={
      <>
          <Button variant="secondary" size="md" disabled={busy} onClick={onClose}>
            취소
          </Button>
          <Button size="md" disabled={busy} onClick={onConfirm}>
            {busy ? '빼는 중' : '빼기'}
          </Button>
        </>
      }>

      {error &&
      <p role="alert" className="mb-4 text-body text-deny">
          {error}
        </p>
      }
      {transaction &&
      <dl className="space-y-1.5 rounded-xl border border-line p-4 text-small">
          <div className="flex justify-between gap-3">
            <dt className="shrink-0 text-ink2">가맹점</dt>
            <dd className="min-w-0 truncate text-ink">{merchantTitle(transaction)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-ink2">승인일</dt>
            <dd className="tabular-nums text-ink">{formatFullDate(transaction.approvedAt)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-ink2">금액</dt>
            <dd className="tabular-nums text-ink">{formatWon(transaction.amount)}</dd>
          </div>
        </dl>
      }
    </Modal>);

}
