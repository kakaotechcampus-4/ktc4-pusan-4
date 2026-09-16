import React from 'react';
import { InfoIcon } from 'lucide-react';

/** 전 화면 상시 노출. 세무대리로 오인될 소지를 화면에서 차단한다. */
export function DisclaimerBar() {
  return (
    <div className="border-b border-line2 bg-accent-soft">
      <div className="mx-auto flex max-w-[1240px] items-center gap-2 px-6 py-2 text-[13px] leading-5 text-ink2">
        <InfoIcon className="h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
        <p>
          이 서비스는 <strong className="font-semibold">확인할 항목과 근거</strong>까지만
          제시합니다. 세액을 확정하거나 신고를 대리하지 않으며, 최종 판단은 세무대리인의
          확인이 필요합니다.
        </p>
      </div>
    </div>);

}