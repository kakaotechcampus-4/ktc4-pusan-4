import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useSession } from '../contexts/SessionContext';

export function RequireAuth({ children }: {children: React.ReactElement;}) {
  const { status } = useSession();
  const location = useLocation();

  // 새로고침 뒤 로그인을 이어 가는 동안은 로그인 화면으로 보내지 않는다
  if (status === 'restoring') return null;

  if (status !== 'signedIn') {
    return (
      <Navigate to="/login" replace state={{ from: location.pathname }} />);

  }

  return children;
}