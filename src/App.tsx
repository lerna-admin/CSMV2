import { Navigate, Route, Routes } from 'react-router-dom';
import AuthPage from './pages/AuthPage';
import AppShell from './pages/AppShell';
import PublicSite from './pages/PublicSite';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<AuthPage />} />
      <Route path="/app" element={<Navigate to="/app/site" replace />} />
      <Route path="/app/site" element={<AppShell />} />
      <Route path="/app/templates" element={<AppShell />} />
      <Route path="/app/admin" element={<AppShell />} />
      <Route path="/s/:slug" element={<PublicSite />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
