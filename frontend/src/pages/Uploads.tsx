import { AppShell } from '../components/AppShell';
import { SectionHeading } from '../components/ui';

/** 지금까지 올린 파일 목록과 기간·건수를 봅니다. (FR-24·25) — 명세 확정 후 구현. 라우트만 먼저 잡아둔다. */
export function Uploads() {
  return (
    <AppShell>
      <SectionHeading
        eyebrow="업로드 이력"
        title="업로드 이력"
        description="지금까지 올린 파일 목록과 기간·건수를 봅니다. (FR-24·25)" />
      
    </AppShell>);

}
