import type { User } from '../types/domain';
import { getSession, getUsers, setSession, upsertUser } from './storage';

function normalizeEmail(value: string): string {
  return String(value || '').trim().toLowerCase();
}

export function currentUser(): User | null {
  const email = normalizeEmail(getSession() || '');
  if (!email) return null;
  return getUsers().find((u) => normalizeEmail(u.email) === email) || null;
}

export function login(email: string, password: string): User | null {
  const normalizedEmail = normalizeEmail(email);
  const normalizedPassword = String(password || '').trim();
  const user = getUsers().find((u) => normalizeEmail(u.email) === normalizedEmail && String(u.password).trim() === normalizedPassword) || null;
  if (user) setSession(user.email);
  return user;
}

export function register(name: string, email: string, password: string): { ok: boolean; error?: string } {
  const normalizedEmail = normalizeEmail(email);
  const normalizedPassword = String(password || '').trim();
  const users = getUsers();
  if (users.some((u) => normalizeEmail(u.email) === normalizedEmail)) return { ok: false, error: 'El correo ya existe' };
  upsertUser({ name: String(name || '').trim(), email: normalizedEmail, password: normalizedPassword, role: 'usuario', createdAt: new Date().toISOString() });
  setSession(normalizedEmail);
  return { ok: true };
}
