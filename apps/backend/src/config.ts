export function jwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) throw new Error('JWT_SECRET must contain at least 32 characters.');
  return secret;
}
export function allowedDomains(): string[] {
  return (process.env.ALLOWED_EMAIL_DOMAINS || 'fpt.edu.vn,fe.edu.vn,gmail.com').split(',').map(value => value.trim().toLowerCase().replace(/^@/, '')).filter(Boolean);
}
export function allowedOrigins(): string[] {
  return (process.env.FRONTEND_ORIGINS || 'http://localhost:5173').split(',').map(value => value.trim()).filter(Boolean);
}
export function secureCookies(): boolean {
  return process.env.NODE_ENV === 'production' || process.env.COOKIE_SECURE === 'true';
}
