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

export function App() {
  return (
    <SessionProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/styleguide" element={<Styleguide />} />
          <Route
            path="/upload"
            element={
            <RequireAuth>
                <Upload />
              </RequireAuth>
            } />
          
          <Route
            path="/interview"
            element={
            <RequireAuth>
                <Interview />
              </RequireAuth>
            } />
          
          <Route
            path="/confirm"
            element={
            <RequireAuth>
                <Confirm />
              </RequireAuth>
            } />
          
          <Route
            path="/run"
            element={
            <RequireAuth>
                <Run />
              </RequireAuth>
            } />
          
          <Route
            path="/results"
            element={
            <RequireAuth>
                <Results />
              </RequireAuth>
            } />
          
          <Route
            path="/questions"
            element={
            <RequireAuth>
                <Questions />
              </RequireAuth>
            } />
          
          <Route
            path="/summary"
            element={
            <RequireAuth>
                <Summary />
              </RequireAuth>
            } />
          
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </SessionProvider>);

}