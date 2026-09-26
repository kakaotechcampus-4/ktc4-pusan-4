import { AppShell } from '../components/AppShell';
import { SectionHeading } from '../components/ui';

/** 배치·월·판정 결과로 걸러 보고, 개인 지출은 판정에서 제외합니다. (FR-30~33) — 명세 확정 후 구현. 라우트만 먼저 잡아둔다. */
export function Transactions() {
  return (
    <AppShell>
      <SectionHeading
        eyebrow="거래"
        title="거래 목록"
        description="배치·월·판정 결과로 걸러 보고, 개인 지출은 판정에서 제외합니다. (FR-30~33)" />
      
    </AppShell>);

}
