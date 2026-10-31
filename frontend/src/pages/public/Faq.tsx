import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronDownIcon } from 'lucide-react';
import { PublicLayout } from '../../components/PublicLayout';
import {
  APPROVAL_EXPORT_STEPS,
  ASSISTANT_DESTINATION,
  ASSISTANT_DOES_NOT_SEND,
  ASSISTANT_SENDS,
  HELP_TOPICS } from
'../../components/assistant/help';
import { SUPPORT_EMAIL } from '../../utils/contact';

const helpText = (id: string) => HELP_TOPICS.find((topic) => topic.id === id)?.text ?? '';

interface Item {
  question: string;
  answer: React.ReactNode;
}

/** 문장은 화면 문구와 비서 도움말(help.ts)에서 옮겼다. 규칙이 바뀌면 거기와 같이 고친다 */
const GROUPS: {title: string;items: Item[];}[] = [
{
  title: '서비스',
  items: [
  {
    question: 'PreeT는 무엇을 해 주나요?',
    answer:
    '카드 승인내역을 올리면 거래마다 사업 경비로 처리할 수 있는지를 「가능」·「불가」·「확인 필요」로 알려 줍니다. 판단에 쓴 소득세법 조문과 시행 버전을 함께 보여 주고, 세무대리인에게 넘길 요약을 만들어 줍니다.'
  },
  {
    question: '누가 쓸 수 있나요?',
    answer:
    '지금은 프리랜서·인적용역 사업자(국세청 업종코드 940909, 컴퓨터 프로그래머 등)만 판정합니다. 직원이 없는 1인 사업자이고 복식부기 의무가 있는 경우를 기준으로 규칙을 만들었습니다. 다른 업종은 규칙이 준비되면 엽니다.'
  },
  {
    question: '판정 결과를 그대로 신고에 써도 되나요?',
    answer:
    '아니요. PreeT는 확인할 항목과 근거까지만 보여 주고, 세액을 확정하거나 신고를 대리하지 않습니다. 요약 화면의 「세무대리인에게 넘길 문장」을 가지고 세무대리인의 확인을 받아 주세요.'
  },
  {
    question: '판정 근거는 어디서 오나요?',
    answer:
    '국가법령정보 OPEN API에서 소득세법과 시행령을 매일 받아 옵니다. 판정 규칙은 팀이 조문을 읽고 만든 것으로, 아직 세무 전문가의 검수를 마치지 않았습니다. 그래서 판정마다 근거 조문을 함께 보여 드립니다.'
  }]

},
{
  title: '카드내역',
  items: [
  {
    question: '어떤 파일을 올리나요?',
    answer: `국민카드와 기업카드의 이용(승인)내역 엑셀입니다. ${APPROVAL_EXPORT_STEPS} 순서로 받을 수 있습니다. 청구내역은 할부가 회차별로 쪼개져 있어 판정에 쓰지 않습니다.`
  },
  {
    question: '카드내역 원본이 서버에 저장되나요?',
    answer:
    '아니요. 파일은 브라우저 안에서 읽고, 승인일·가맹점명·금액처럼 판정에 필요한 항목만 서버로 보냅니다. 원본 파일과 카드번호, 이용고객명은 브라우저에만 남습니다.'
  },
  {
    question: '「확인 필요」는 무엇인가요?',
    answer: helpText('review')
  },
  {
    question: '「소명 대기」는 무엇인가요?',
    answer: helpText('presumed')
  }]

},
{
  title: '비서와 개인정보',
  items: [
  {
    question: '비서 Really에게 물으면 무엇이 밖으로 나가나요?',
    answer: `${ASSISTANT_SENDS}을 보냅니다. ${ASSISTANT_DOES_NOT_SEND} ${ASSISTANT_DESTINATION}`
  },
  {
    question: '탈퇴하면 데이터는 어떻게 되나요?',
    answer:
    '계정과 함께 올린 카드내역, 판정 결과, 질문과 답변, 사업자 문진을 모두 지웁니다. 데이터베이스 백업은 7일 뒤 자동으로 지워져서, 백업에는 최대 7일 동안 남습니다.'
  }]

},
{
  title: '계정',
  items: [
  {
    question: '이메일 계정과 카카오 계정을 합칠 수 있나요?',
    answer:
    '지금은 합칠 수 없습니다. 같은 이메일을 쓰더라도 이메일로 가입한 계정과 카카오로 로그인한 계정은 서로 다른 계정이고, 판정 이력도 따로 보관됩니다.'
  },
  {
    question: '비밀번호를 잊었어요.',
    answer:
    <>
          비밀번호 찾기는 준비하고 있습니다. 그전까지는{' '}
          <a href={`mailto:${SUPPORT_EMAIL}`} className="underline underline-offset-4">{SUPPORT_EMAIL}</a>로
          가입한 이메일을 적어 보내 주세요.
        </>

  },
  {
    question: '오류를 발견했어요.',
    answer:
    <>
          로그인한 뒤 화면 맨 아래의 「버그 신고」를 누르면 지금 화면과 시각을 채운 메일을 쓸 수 있습니다. 로그인 전이라면{' '}
          <a href={`mailto:${SUPPORT_EMAIL}`} className="underline underline-offset-4">{SUPPORT_EMAIL}</a>로 보내
          주세요.
        </>

  }]

}];


/** 자주 묻는 질문. 랜딩에서 거는 링크는 재성 몫이다 */
export function Faq() {
  return (
    <PublicLayout>
      <header>
        <p className="text-small font-bold text-accent">PreeT</p>
        <h1 className="mt-1.5 text-h2 font-bold tracking-tight text-ink">자주 묻는 질문</h1>
        <p className="mt-2 text-body text-ink2">
          여기에 없는 내용은 <Link to="/privacy" className="underline underline-offset-4">개인정보처리방침</Link>과{' '}
          <Link to="/terms" className="underline underline-offset-4">이용약관</Link>을 봐 주세요.
        </p>
      </header>

      {GROUPS.map((group) =>
      <section key={group.title} className="mt-10">
          <h2 className="text-h4 font-bold text-ink">{group.title}</h2>
          <div className="mt-3 divide-y divide-line2 rounded-2xl border border-line bg-sheet">
            {group.items.map((item) =>
          <details key={item.question} className="group px-5 py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-body font-bold text-ink [&::-webkit-details-marker]:hidden">
                  {item.question}
                  <ChevronDownIcon
                className="h-4 w-4 shrink-0 text-muted transition-transform duration-150 group-open:rotate-180"
                aria-hidden="true" />

                </summary>
                <div className="mt-3 text-body leading-7 text-ink2">{item.answer}</div>
              </details>
          )}
          </div>
        </section>
      )}
    </PublicLayout>);

}
