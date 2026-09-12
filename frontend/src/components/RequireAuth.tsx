import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useSession } from '../contexts/SessionContext';

export function RequireAuth({ children }: {children: React.ReactElement;}) {
  const { isAuthenticated } = useSession();
  const location = useLocation();

  if (!isAuthenticated) {
    return (
      <Navigate to="/login" replace state={{ from: location.pathname }} />);

  }

  return children;
}