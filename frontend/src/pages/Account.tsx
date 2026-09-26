import { AppShell } from '../components/AppShell';
import { SectionHeading } from '../components/ui';

/** 가입 이메일과 가입일을 보고, 탈퇴합니다. (FR-02·03) — 명세 확정 후 구현. 라우트만 먼저 잡아둔다. */
export function Account() {
  return (
    <AppShell>
      <SectionHeading
        eyebrow="설정"
        title="내 정보"
        description="가입 이메일과 가입일을 보고, 탈퇴합니다. (FR-02·03)" />
      
    </AppShell>);

}
