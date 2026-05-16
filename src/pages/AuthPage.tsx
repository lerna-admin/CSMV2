import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login, register } from '../lib/auth';
import { getSettings } from '../lib/storage';

export default function AuthPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const settings = getSettings();

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get('email') || '').trim();
    const password = String(form.get('password') || '').trim();
    const name = String(form.get('name') || '').trim();

    if (mode === 'login') {
      const user = login(email, password);
      if (!user) return setError('Credenciales invalidas');
      navigate('/app');
      return;
    }

    const result = register(name, email, password);
    if (!result.ok) return setError(result.error || 'No fue posible registrarse');
    if (result.issue) window.open(result.issue, '_blank', 'noopener,noreferrer');
    navigate('/app');
  }

  return (
    <main className="auth-page">
      <h1>CSMV2</h1>
      <p>CMS visual sin backend para publicar en GitHub Pages.</p>
      <form onSubmit={onSubmit}>
        {mode === 'register' && <input name="name" placeholder="Nombre" required />}
        <input name="email" type="email" placeholder="Correo" required />
        <input name="password" type="password" placeholder="Contrasena" required />
        {error && <p className="error">{error}</p>}
        <button type="submit" disabled={mode === 'register' && !settings.allowPublicSignup}>{mode === 'login' ? 'Entrar' : 'Crear cuenta'}</button>
      </form>
      {mode === 'register' && !settings.allowPublicSignup && <p className="error">Registro publico deshabilitado por administracion.</p>}
      <button type="button" className="link" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
        {mode === 'login' ? 'No tienes cuenta? Registrate' : 'Ya tienes cuenta? Inicia sesion'}
      </button>
    </main>
  );
}
