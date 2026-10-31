import React from 'react';
import { BrowserRouter, Outlet, Route, Routes } from 'react-router-dom';
import { SessionProvider, useSession } from './contexts/SessionContext';
import { RequireAuth } from './components/RequireAuth';
import { Assistant } from './components/assistant/Assistant';
import { AssistantProvider } from './components/assistant/AssistantProvider';
import { Landing } from './pages/Landing';
import { Faq } from './pages/Faq';
import { Login } from './pages/Login';
import { Signup } from './pages/Signup';
import { KakaoCallback } from './pages/KakaoCallback';
import { Terms } from './pages/public/Terms';
import { Privacy } from './pages/public/Privacy';
import { NotFound } from './pages/public/NotFound';
import { ErrorBoundary } from './components/ErrorBoundary';
import { KAKAO_CALLBACK_PATH } from './auth/kakao';
import { Upload } from './pages/Upload';
import { Interview } from './pages/Interview';
import { Confirm } from './pages/Confirm';
import { Run, RunEntry } from './pages/Run';
import { Results } from './pages/Results';
import { Questions } from './pages/Questions';
import { Summary } from './pages/Summary';
import { Styleguide } from './pages/Styleguide';
import { ClassificationPreview } from './pages/ClassificationPreview';
import { Uploads } from './pages/Uploads';
import { Transactions } from './pages/Transactions';
import { Account } from './pages/Account';
import { Admin } from './pages/Admin';

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

/** 로그인 뒤 화면을 감싼다. 비서 버튼·패널은 여기서만 그린다. 화면마다 AppShell 을 그리는 것은 그대로다 */
function SignedIn() {
  return (
    <RequireAuth>
      <>
        <Outlet />
        <Assistant />
      </>
    </RequireAuth>);

}

export function App() {
  return (
    <SessionProvider>
      <BrowserRouter>
        <AssistantRoot>
          <ErrorBoundary>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/faq" element={<Faq />} />
            <Route path="/signup" element={<Signup />} />
            <Route path={KAKAO_CALLBACK_PATH} element={<KakaoCallback />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/styleguide" element={<Styleguide />} />
            <Route element={<SignedIn />}>
              {PROTECTED.map((route) =>
              <Route key={route.path} path={route.path} element={route.element} />
              )}
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
          </ErrorBoundary>
        </AssistantRoot>
      </BrowserRouter>
    </SessionProvider>);

}