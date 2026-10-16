import React from 'react';
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { SessionProvider } from './contexts/SessionContext';
import { RequireAuth } from './components/RequireAuth';
import { Assistant } from './components/assistant/Assistant';
import { AssistantProvider } from './components/assistant/AssistantProvider';
import { Landing } from './pages/Landing';
import { Login } from './pages/Login';
import { Upload } from './pages/Upload';
import { Interview } from './pages/Interview';
import { Confirm } from './pages/Confirm';
import { Run } from './pages/Run';
import { Results } from './pages/Results';
import { Questions } from './pages/Questions';
import { Summary } from './pages/Summary';
import { Styleguide } from './pages/Styleguide';
import { ClassificationPreview } from './pages/ClassificationPreview';
import { Uploads } from './pages/Uploads';
import { Transactions } from './pages/Transactions';
import { Account } from './pages/Account';

/** 로그인 필요 라우트 */
const PROTECTED: { path: string; element: React.ReactElement }[] = [
{ path: '/upload', element: <Upload /> },
{ path: '/preview', element: <ClassificationPreview /> },
{ path: '/uploads', element: <Uploads /> },
{ path: '/transactions', element: <Transactions /> },
{ path: '/interview', element: <Interview /> },
{ path: '/confirm', element: <Confirm /> },
{ path: '/run', element: <Run /> },
{ path: '/results', element: <Results /> },
{ path: '/questions', element: <Questions /> },
{ path: '/summary', element: <Summary /> },
{ path: '/account', element: <Account /> }];


/**
 * 로그인 뒤 화면을 감싼다. 비서는 여기 한 번만 올라가 화면을 옮겨도 대화가 이어지고(FR-1),
 * 로그아웃하면 함께 내려가 대화가 사라진다. 화면마다 AppShell 을 그리는 것은 그대로다
 */
function SignedIn() {
  return (
    <RequireAuth>
      <AssistantProvider>
        <Outlet />
        <Assistant />
      </AssistantProvider>
    </RequireAuth>);

}

export function App() {
  return (
    <SessionProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/styleguide" element={<Styleguide />} />
          <Route element={<SignedIn />}>
            {PROTECTED.map((route) =>
            <Route key={route.path} path={route.path} element={route.element} />
            )}
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </SessionProvider>);

}