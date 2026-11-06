import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Loader2Icon } from 'lucide-react';
import { useSession } from '../contexts/SessionContext';

export function RequireAuth({ children }: {children: React.ReactElement;}) {
  const { status, endReason } = useSession();
  const location = useLocation();

  // 새로고침 뒤 로그인을 이어 가는 동안은 로그인 화면으로 보내지 않는다. 빈 화면 대신 기다린다는 것을 보인다
  if (status === 'restoring')
  return (
    <p role="status" className="flex min-h-full items-center justify-center gap-2 bg-canvas text-body text-ink2">
        <Loader2Icon className="h-4 w-4 animate-spin text-accent" aria-hidden="true" />
        로그인 정보를 확인하고 있습니다…
      </p>);

  // 로그인이 저절로 끝났으면 왜 끝났는지 로그인 화면이 알린다 (C51)
  if (status !== 'signedIn') {
    return (
      <Navigate to="/login" replace state={{ from: location.pathname, reason: endReason }} />);

  }

  return children;
}