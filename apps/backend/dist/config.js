"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.jwtSecret = jwtSecret;
exports.allowedDomains = allowedDomains;
exports.allowedOrigins = allowedOrigins;
exports.isAllowedOrigin = isAllowedOrigin;
exports.secureCookies = secureCookies;
function jwtSecret() {
    const secret = process.env.JWT_SECRET;
    if (!secret || secret.length < 32)
        throw new Error('JWT_SECRET must contain at least 32 characters.');
    return secret;
}
function allowedDomains() {
    return (process.env.ALLOWED_EMAIL_DOMAINS || 'fpt.edu.vn,fe.edu.vn,gmail.com').split(',').map(value => value.trim().toLowerCase().replace(/^@/, '')).filter(Boolean);
}
function allowedOrigins() {
    return (process.env.FRONTEND_ORIGINS || 'http://localhost:5173').split(',').map(value => value.trim()).filter(Boolean);
}
function isAllowedOrigin(origin) {
    if (!origin)
        return true;
    return allowedOrigins().includes(origin) || origin.endsWith('.vercel.app') || origin.endsWith('.trycloudflare.com');
}
function secureCookies() {
    return process.env.NODE_ENV === 'production' || process.env.COOKIE_SECURE === 'true';
}
