import { LegalHeader, LegalSection, PublicLayout } from '../../components/PublicLayout';
import { ASSISTANT_DOES_NOT_SEND, ASSISTANT_SENDS } from '../../components/assistant/help';
import { SUPPORT_EMAIL } from '../../utils/contact';
import { PAGES } from '../../seo';

const COLLECTED = [
{
  item: '계정',
  fields: '이메일, 비밀번호(암호화해 저장). 카카오 로그인은 카카오 회원번호만 받고 이메일은 받지 않습니다.',
  purpose: '로그인, 판정 이력 보관'
},
{
  item: '가입 인증',
  fields: '이메일, 인증 코드',
  purpose: '본인 이메일 확인. 코드는 5분이 지나면 쓸 수 없습니다.'
},
{
  item: '사업자 문진',
  fields: '업종, 직전연도 수입금액, 개업일, 기장의무, 직원 유무, 자택 작업 비율',
  purpose: '판정 기준'
},
{
  item: '카드 이용내역',
  fields: '카드사, 조회 기간, 승인일, 가맹점명(의료 업종은 가림), 가맹점 사업자번호(IBK기업), 금액, 할부 개월, 승인번호, 메모(KB국민), 처리 상태, 파일 해시',
  purpose: '거래별 판정'
},
{
  item: '판정과 답변',
  fields: '판정 결과, 확인 질문에 단 답, 이용자가 바꾼 판정과 그 사유',
  purpose: '결과 보관, 다시 판정'
},
{
  item: '세무대리인 질문',
  fields: '비서가 제안하고 이용자가 [적용]한 질문 문장(300자 이내), 관련 거래 id',
  purpose: '요약 화면의 세무사에게 넘길 문장'
},
{
  // 웹 서버(deploy/caddy/Caddyfile)의 접근 기록. 거기서 남기는 항목을 바꾸면 여기도 맞춘다
  item: '접속 기록',
  fields: '화면을 요청한 시각, 요청한 주소, 응답 결과, 브라우저나 검색 로봇 종류 같은 요청 헤더(쿠키와 인증 정보는 지움), 앞 두 자리만 남긴 IP 주소. 로그인 뒤 서버에 보내는 요청(API)은 남기지 않습니다.',
  purpose: '서비스 운영, 검색엔진과 AI 크롤러 방문 확인'
}];


const SENT = [
{
  to: 'Amazon Web Services (서울 리전)',
  what: '위 정보 전부',
  why: '서버, 데이터베이스, 백업 보관'
},
{
  to: '엘리스 LLM 게이트웨이를 거쳐 OpenAI 모델 (국외)',
  what: `${ASSISTANT_SENDS}. ${ASSISTANT_DOES_NOT_SEND}`,
  why: '비서 답변 생성. 비서에게 물을 때만 보냅니다.'
},
{
  to: 'Langfuse Cloud (일본)',
  what: '비서 대화와 비서가 읽은 정보. 이메일, 전화번호, 주민등록번호, 카드번호는 가린 뒤 보냅니다.',
  why: '비서 답변 품질 점검'
},
{
  to: '카카오',
  what: '카카오가 준 인가 코드',
  why: '카카오 로그인. 카카오 로그인을 쓸 때만 주고받습니다.'
},
{
  to: 'Google (Gmail)',
  what: '이메일, 인증 코드',
  why: '가입 인증 메일 발송'
}];


export const PRIVACY_EFFECTIVE = '2026년 11월 6일';

/** 처리방침 본문. 이 페이지와 가입 화면의 모달이 같이 쓴다 (#247 리뷰) */
export function PrivacyBody() {
  return (
    <>
    <LegalSection title="1. 모으는 정보와 쓰는 곳">
      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full min-w-[560px] text-left text-small">
          <thead className="border-b border-line text-muted">
            <tr>
              <th scope="col" className="whitespace-nowrap px-3.5 py-2.5 font-normal">항목</th>
              <th scope="col" className="whitespace-nowrap px-3.5 py-2.5 font-normal">내용</th>
              <th scope="col" className="whitespace-nowrap px-3.5 py-2.5 font-normal">목적</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line2 bg-sheet">
            {COLLECTED.map((row) =>
            <tr key={row.item} className="align-top">
                <th scope="row" className="whitespace-nowrap px-3.5 py-2.5 font-bold text-ink">{row.item}</th>
                <td className="px-3.5 py-2.5 leading-6">{row.fields}</td>
                <td className="px-3.5 py-2.5 leading-6">{row.purpose}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p>
        카드내역 원본 파일은 서버로 올리지 않습니다. 파일은 이 브라우저 안에서 읽고, 판정에 필요한 항목만 보냅니다.
        카드번호, 이용고객명, 이용카드명, 승인 시각은 브라우저에만 남고 서버로 가지 않습니다.
      </p>
      <p>비서와 나눈 대화는 PreeT 데이터베이스에 저장하지 않습니다. 화면을 닫거나 로그아웃하면 사라집니다.</p>
    </LegalSection>

    <LegalSection title="2. 보관 기간">
      <p>
        탈퇴할 때까지 보관하고, 탈퇴하면 바로 지웁니다. 업로드 이력에서 업로드 하나를 지우면 그 업로드의 거래, 판정, 질문도
        함께 지웁니다. 세무대리인 질문은 업로드를 지워도 남고, 탈퇴하면 지웁니다.
      </p>
      <p>데이터베이스 백업은 7일이 지나면 자동으로 지워집니다. 그래서 지운 정보도 백업에는 최대 7일 동안 남습니다.</p>
      <p>접속 기록은 10MB 파일 5개까지만 두고, 넘으면 오래된 것부터 지웁니다. 계정과 묶어 두지 않아 탈퇴와 상관없이 이 방식으로 지워집니다.</p>
    </LegalSection>

    <LegalSection title="3. 외부로 보내는 정보">
      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full min-w-[560px] text-left text-small">
          <thead className="border-b border-line text-muted">
            <tr>
              <th scope="col" className="whitespace-nowrap px-3.5 py-2.5 font-normal">받는 곳</th>
              <th scope="col" className="whitespace-nowrap px-3.5 py-2.5 font-normal">보내는 정보</th>
              <th scope="col" className="whitespace-nowrap px-3.5 py-2.5 font-normal">목적</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line2 bg-sheet">
            {SENT.map((row) =>
            <tr key={row.to} className="align-top">
                <th scope="row" className="whitespace-nowrap px-3.5 py-2.5 font-bold text-ink">{row.to}</th>
                <td className="px-3.5 py-2.5 leading-6">{row.what}</td>
                <td className="px-3.5 py-2.5 leading-6">{row.why}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p>
        새 판정 규칙을 고를 때는 가맹점 카테고리와 업종별 집계(이용자 수, 건수)만 AI 모델에 보냅니다. 거래 하나하나나
        이용자를 알아볼 수 있는 정보는 보내지 않습니다.
      </p>
    </LegalSection>

    <LegalSection title="4. 이용자의 권리">
      <ul className="list-disc space-y-1.5 pl-5">
        <li>내 정보 화면에서 가입 정보를 보고 탈퇴할 수 있습니다.</li>
        <li>업로드 이력에서 올린 카드내역을 업로드 단위로 지울 수 있습니다.</li>
        <li>그 밖에 열람, 정정, 삭제가 필요하면 아래 문의처로 알려 주세요.</li>
      </ul>
    </LegalSection>

    <LegalSection title="5. 쿠키와 브라우저 저장소">
      <p>
        로그인을 이어 가는 데 쓰는 리프레시 토큰을 쿠키에 둡니다. 이 쿠키는 스크립트로 읽을 수 없습니다(httpOnly).
        카카오 로그인 중에는 요청을 맞춰 보는 값을 브라우저 세션 저장소에 잠시 둡니다. 광고용이나 분석용 쿠키는 쓰지 않습니다.
      </p>
    </LegalSection>

    <LegalSection title="6. 안전하게 지키는 방법">
      <ul className="list-disc space-y-1.5 pl-5">
        <li>비밀번호는 bcrypt로 바꿔 저장해 운영자도 원래 값을 알 수 없습니다.</li>
        <li>모든 통신은 HTTPS로 암호화합니다.</li>
        <li>데이터베이스 백업은 공개 접근을 막은 저장소에 암호화해 보관합니다.</li>
      </ul>
    </LegalSection>

    <LegalSection title="7. 문의">
      <p>
        개인정보와 관련한 문의는{' '}
        <a href={`mailto:${SUPPORT_EMAIL}`} className="underline underline-offset-4">{SUPPORT_EMAIL}</a>로 보내 주세요.
      </p>
    </LegalSection>
    </>);

}

/** 개인정보처리방침. 외부로 보내는 항목은 코드에서 확인한 것만 적는다(ai/app/config.py, ai/pipeline/llm.py) */
export function Privacy() {
  return (
    <PublicLayout title={PAGES.privacy.title}>
      <LegalHeader title="개인정보처리방침" effective={PRIVACY_EFFECTIVE} />
      <PrivacyBody />
    </PublicLayout>);

}
