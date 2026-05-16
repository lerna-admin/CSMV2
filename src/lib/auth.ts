import type { User } from '../types/domain';
import { getSession, getUsers, setSession, upsertUser } from './storage';

export function currentUser(): User | null {
  const email = getSession();
  if (!email) return null;
  return getUsers().find((u) => u.email === email) || null;
}

export function login(email: string, password: string): User | null {
  const user = getUsers().find((u) => u.email === email && u.password === password) || null;
  if (user) setSession(user.email);
  return user;
}

export function register(name: string, email: string, password: string): { ok: boolean; error?: string } {
  const users = getUsers();
  if (users.some((u) => u.email === email)) return { ok: false, error: 'El correo ya existe' };
  upsertUser({ name, email, password, role: 'usuario', createdAt: new Date().toISOString() });
  setSession(email);
  return { ok: true };
}
