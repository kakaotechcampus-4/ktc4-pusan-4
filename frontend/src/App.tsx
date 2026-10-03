import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { SessionProvider } from './contexts/SessionContext';
import { RequireAuth } from './components/RequireAuth';
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


export function App() {
  return (
    <SessionProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/styleguide" element={<Styleguide />} />
          {PROTECTED.map((route) =>
          <Route
            key={route.path}
            path={route.path}
            element={<RequireAuth>{route.element}</RequireAuth>} />

          )}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </SessionProvider>);

}