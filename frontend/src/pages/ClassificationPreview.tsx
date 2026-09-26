import { AppShell } from '../components/AppShell';
import { SectionHeading } from '../components/ui';

/** 업로드한 거래의 가맹점 분류 결과를 확인하고, 미분류 건을 먼저 봅니다. — 명세 확정 후 구현. 라우트만 먼저 잡아둔다. */
export function ClassificationPreview() {
  return (
    <AppShell>
      <SectionHeading
        eyebrow="2단계 · 분류 확인"
        title="분류 결과 미리보기"
        description="업로드한 거래의 가맹점 분류 결과를 확인하고, 미분류 건을 먼저 봅니다." />
      
    </AppShell>);

}
