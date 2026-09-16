# Security Controls

This document details the security posture of the BSC Textiles Portal.

## 1. Authentication & Sessions

- **Passwords:** Hashed using \`bcryptjs\` with a work factor of 10. Never stored or logged in plain text.
- **Tokens:** JSON Web Tokens (JWT) signed with a secret. Lifetime is typically 6 hours.
- **Session Validation:** The frontend validates session expiry via \`Auth.check()\`. The backend validates the JWT signature and expiration on every protected request.

## 2. Password Policy

Enforced by \`userValidator.js\` on the backend:
- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one digit

## 3. Account Lockout & Brute Force Prevention

- Failed logins are tracked in the \`users.failed_login_count\` column.
- Exceeding the maximum allowed failed attempts temporarily locks the account by setting \`locked_until\`.
- Admins can manually unlock accounts via the Security Settings page.

## 4. Audit Logging

All significant actions are recorded via the \`auditService.js\`:
- Logs contain: Username, Action, Module, IP Address, User-Agent, Success/Failure, Timestamp, and a unique Correlation ID.
- **Sensitive Data Redaction:** The audit service automatically sanitizes payload details, stripping passwords, PINs, and tokens before writing to the database.

## 5. Store Kiosk PINs

- Kiosk, TV, Cash, and Greeter PINs are hashed with bcrypt.
- They are verified by comparing the hash, preventing DB admins from viewing the PINs.
