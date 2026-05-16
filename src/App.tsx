import { Navigate, Route, Routes } from 'react-router-dom';
import AuthPage from './pages/AuthPage';
import AppShell from './pages/AppShell';
import PublicSite from './pages/PublicSite';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<AuthPage />} />
      <Route path="/app" element={<AppShell />} />
      <Route path="/s/:slug" element={<PublicSite />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
