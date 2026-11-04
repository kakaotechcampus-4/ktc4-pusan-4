import React from 'react';
import { BrowserRouter, Outlet, Route, Routes } from 'react-router-dom';
import { SessionProvider, useSession } from './contexts/SessionContext';
import { RequireAuth } from './components/RequireAuth';
import { Assistant } from './components/assistant/Assistant';
import { AssistantProvider } from './components/assistant/AssistantProvider';
import { Landing } from './pages/Landing';
import { Faq } from './pages/Faq';
import { BugReport } from './pages/BugReport';
import { Login } from './pages/Login';
import { Signup } from './pages/Signup';
import { KakaoCallback } from './pages/KakaoCallback';
import { Terms } from './pages/public/Terms';
import { Privacy } from './pages/public/Privacy';
import { NotFound } from './pages/public/NotFound';
import { ErrorBoundary } from './components/ErrorBoundary';
import { KAKAO_CALLBACK_PATH } from './auth/kakao';
import { Loader2Icon } from 'lucide-react';

/**
 * 로그인 뒤 화면은 들어갈 때 읽는다. 한 덩어리로 묶으면 첫 화면(랜딩·로그인)이 판정 화면 코드까지 받아
 * 번들이 500kB 를 넘는다. 화면들은 이름으로 내보내므로 default 로 바꿔 넘긴다
 */
const page = <K extends string,>(load: () => Promise<Record<K, React.ComponentType>>, name: K) =>
React.lazy(() => load().then((module) => ({ default: module[name] })));

const Upload = page(() => import('./pages/Upload'), 'Upload');
const Interview = page(() => import('./pages/Interview'), 'Interview');
const Confirm = page(() => import('./pages/Confirm'), 'Confirm');
const Run = page(() => import('./pages/Run'), 'Run');
const RunEntry = page(() => import('./pages/Run'), 'RunEntry');
const Results = page(() => import('./pages/Results'), 'Results');
const Questions = page(() => import('./pages/Questions'), 'Questions');
const Summary = page(() => import('./pages/Summary'), 'Summary');
/** 개발용 화면이다. 배포 빌드에는 넣지 않는다 */
const Styleguide = import.meta.env.DEV ? page(() => import('./pages/Styleguide'), 'Styleguide') : null;
const ClassificationPreview = page(() => import('./pages/ClassificationPreview'), 'ClassificationPreview');
const Uploads = page(() => import('./pages/Uploads'), 'Uploads');
const Transactions = page(() => import('./pages/Transactions'), 'Transactions');
const Account = page(() => import('./pages/Account'), 'Account');
const Admin = page(() => import('./pages/Admin'), 'Admin');

function PageLoading() {
  return (
    <p role="status" className="flex min-h-full items-center justify-center gap-2 bg-canvas text-body text-muted">
      <Loader2Icon className="h-4 w-4 animate-spin text-accent" aria-hidden="true" />
      화면을 불러오고 있습니다…
    </p>);

}

/** 로그인 필요 라우트 */
const PROTECTED: { path: string; element: React.ReactElement }[] = [
{ path: '/upload', element: <Upload /> },
{ path: '/preview', element: <ClassificationPreview /> },
{ path: '/uploads', element: <Uploads /> },
{ path: '/transactions', element: <Transactions /> },
{ path: '/interview', element: <Interview /> },
{ path: '/confirm', element: <Confirm /> },
{ path: '/run', element: <RunEntry /> },
{ path: '/run/:runId', element: <Run /> },
{ path: '/results', element: <Results /> },
{ path: '/questions', element: <Questions /> },
{ path: '/summary', element: <Summary /> },
{ path: '/account', element: <Account /> },
{ path: '/admin', element: <Admin /> }];


/**
 * 비서 대화는 라우트 바깥에 둔다. 로그인 뒤 레이아웃 안에 두면 로고로 랜딩에 다녀올 때 대화가 사라진다(FR-1).
 * 계정이 바뀌거나 로그아웃하면 key 가 바뀌어 대화도 함께 사라진다
 */
function AssistantRoot({ children }: {children: React.ReactNode;}) {
  const { userId } = useSession();
  return <AssistantProvider key={userId ?? ''}>{children}</AssistantProvider>;
}

/** 로그인 뒤 화면을 감싼다. 화면마다 AppShell 을 그리는 것은 그대로다 */
function SignedIn() {
  return (
    <RequireAuth>
      <Outlet />
    </RequireAuth>);

}

export function App() {
  return (
    <SessionProvider>
      <BrowserRouter>
        <AssistantRoot>
          <ErrorBoundary>
          <React.Suspense fallback={<PageLoading />}>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/faq" element={<Faq />} />
            <Route path="/bug-report" element={<BugReport />} />
            <Route path="/signup" element={<Signup />} />
            <Route path={KAKAO_CALLBACK_PATH} element={<KakaoCallback />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/privacy" element={<Privacy />} />
            {Styleguide && <Route path="/styleguide" element={<Styleguide />} />}
            <Route element={<SignedIn />}>
              {PROTECTED.map((route) =>
              <Route key={route.path} path={route.path} element={route.element} />
              )}
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
          </React.Suspense>
          {/*
            비서 버튼은 라우트 바깥에 둔다. 로그인 뒤 레이아웃 안에 두면 로고로 메인에
            돌아왔을 때 버튼이 사라진다 — 다른 화면에는 있다가 메인에서만 없어진다.
            어디서 보일지는 Assistant 가 정한다.
            요약을 PDF 로 인쇄할 때 떠 있는 버튼·패널이 찍히지 않게 한다
          */}
          <div className="print:hidden">
            <Assistant />
          </div>
          </ErrorBoundary>
        </AssistantRoot>
      </BrowserRouter>
    </SessionProvider>);

}