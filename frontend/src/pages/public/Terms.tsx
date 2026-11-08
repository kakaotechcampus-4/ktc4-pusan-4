import { Link } from 'react-router-dom';
import { LegalHeader, LegalSection, PublicLayout } from '../../components/PublicLayout';
import { SUPPORT_EMAIL } from '../../utils/contact';
import { PAGES } from '../../seo';

export const TERMS_EFFECTIVE = '2026년 11월 6일';

/**
 * 약관 본문. 이 페이지와 가입 화면의 모달이 같이 쓴다 (#247 리뷰).
 *
 * onOpenPrivacy 는 모달이 넘긴다. 창 안에서 처리방침 링크를 누르면 가입 화면을 떠나
 * 적던 메일·비밀번호가 날아가므로, 떠나는 대신 같은 창을 처리방침으로 갈아끼운다
 */
export function TermsBody({ onOpenPrivacy }: {onOpenPrivacy?: () => void;} = {}) {
  return (
    <>
    <LegalSection title="1. 서비스">
      <p>
        PreeT는 카드 이용내역을 올리면 거래마다 사업 경비로 처리할 수 있는지를 소득세법 조문을 근거로 안내합니다.
        결과는 가능, 불가, 확인 필요 가운데 하나로 나오고, 판단에 쓴 조문과 시행일을 함께 보여 줍니다.
      </p>
      <p>
        PreeT는 확인할 항목과 근거까지만 제시합니다. 세액을 확정하거나 세무 신고를 대리하지 않으며, 최종 판단에는
        세무대리인의 확인이 필요합니다.
      </p>
    </LegalSection>

    <LegalSection title="2. 계정">
      <p>
        계정은 이메일 가입(메일 인증)이나 카카오 로그인으로 만듭니다. 같은 이메일을 쓰더라도 이메일 계정과 카카오
        계정은 서로 다른 계정이고, 판정 이력도 따로 보관됩니다.
      </p>
      <p>계정은 본인만 사용할 수 있습니다. 비밀번호를 다른 사람에게 알려 생긴 문제는 이용자가 책임집니다.</p>
    </LegalSection>

    <LegalSection title="3. 이용자가 지킬 것">
      <ul className="list-disc space-y-1.5 pl-5">
        <li>본인이 사용한 카드의 이용내역만 올려야 합니다.</li>
        <li>문진, 질문 답변, 비서 대화에 다른 사람의 개인정보를 적으면 안 됩니다.</li>
        <li>자동화된 방법으로 요청을 대량으로 보내거나 서비스 운영을 방해하면 안 됩니다.</li>
      </ul>
    </LegalSection>

    <LegalSection title="4. 비서">
      <p>
        비서의 답변은 AI 모델이 만듭니다. 틀릴 수 있으니 근거 조문과 함께 확인해 주세요. 판정을 바꾸거나 답을
        저장하는 일은 이용자가 직접 [적용]을 눌렀을 때만 일어납니다.
      </p>
      <p>
        비서에게 물을 때 외부 모델로 보내는 정보는{' '}
        {onOpenPrivacy ?
      <button type="button" onClick={onOpenPrivacy} className="underline underline-offset-4">개인정보처리방침</button> :
      <Link to="/privacy" className="underline underline-offset-4">개인정보처리방침</Link>}{' '}
        3항에서 확인할 수 있습니다.
      </p>
    </LegalSection>

    <LegalSection title="5. 책임의 한계">
      <p>
        판정 결과를 세무대리인의 확인 없이 신고에 그대로 사용해 생긴 문제는 책임지지 않습니다. 조문은 국가법령정보
        OPEN API에서 일주일마다 받아 오므로, 법령이 바뀐 직후에는 반영이 늦을 수 있습니다.
      </p>
      <p>점검이나 장애로 서비스가 잠시 중단될 수 있습니다.</p>
    </LegalSection>

    <LegalSection title="6. 탈퇴">
      <p>
        내 정보 화면에서 언제든 탈퇴할 수 있습니다. 탈퇴하면 계정과 함께 올린 카드내역, 판정 결과, 질문과 답변, 사업자
        문진이 모두 삭제되며 되돌릴 수 없습니다.
      </p>
    </LegalSection>

    <LegalSection title="7. 약관 변경">
      <p>약관을 바꿀 때는 시행 7일 전까지 이 화면에 알립니다. 이용자에게 불리한 변경은 30일 전까지 알립니다.</p>
    </LegalSection>

    <LegalSection title="8. 문의">
      <p>
        <a href={`mailto:${SUPPORT_EMAIL}`} className="underline underline-offset-4">{SUPPORT_EMAIL}</a>
      </p>
    </LegalSection>
    </>);

}

/** 이용약관. 가입 화면의 [필수] 동의가 이 문서를 가리킨다 */
export function Terms() {
  return (
    <PublicLayout title={PAGES.terms.title}>
      <LegalHeader title="이용약관" effective={TERMS_EFFECTIVE} />
      <TermsBody />
    </PublicLayout>);

}
