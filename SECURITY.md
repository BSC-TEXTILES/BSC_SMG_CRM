# Security Architecture

The BSC Enterprise HRMS platform employs a defense-in-depth security architecture designed to protect sensitive HR data, prevent unauthorized access, and mitigate common web application attacks.

## 1. Authentication & Authorization
- **Password Security**: All user passwords are hashed using `bcryptjs` with a secure work factor of 12 rounds. Legacy plaintext passwords are automatically migrated to `bcrypt` upon next successful login.
- **Session Management**: JWT tokens are issued with a strict 6-hour absolute lifetime. Tokens are stored in a `Secure`, `HttpOnly`, `SameSite=Lax` cookie in production.
- **Role-Based Access Control (RBAC)**: All endpoints are protected by a centralized `authorize(...roles)` middleware that cryptographically validates the user's role against the JWT signature.
- **Account Lockout**: Repeated failed logins trigger an automated 10-minute account and IP lockout to prevent brute-force attacks.

## 2. API & Network Security
- **Web Application Firewall (WAF)**: It is strongly recommended to deploy this application behind a CDN/WAF (e.g., Cloudflare) to block volumetric DDoS attacks and known malicious signatures.
- **Rate Limiting**: 
  - Global API: 500 requests per 15 minutes per IP.
  - Login/Auth: 50 requests per 10 minutes per IP.
- **CSRF Protection**: All state-changing requests (POST, PUT, DELETE) require a cryptographically secure CSRF token exchanged via the `x-csrf-token` header and validated against the `_csrf` cookie.
- **Security Headers (Helmet)**: Strict Content Security Policy (CSP), HTTP Strict Transport Security (HSTS), and X-Content-Type-Options are enforced on all responses.

## 3. Data Protection
- **SQL Injection Prevention**: All MySQL queries utilize strict parameterized bindings (`pool.query(sql, [params])`). Dynamic string concatenation is strictly prohibited.
- **Input Validation**: Critical endpoints leverage `express-validator` to strictly type-check, length-check, and sanitize input payloads before processing.
- **File Upload Security**: Uploads via `multer` are restricted to a strict allow-list of MIME types (PDF, PNG, JPG) and extensions. Filenames are randomized with UUIDs to prevent directory traversal and arbitrary file overwrite vulnerabilities.

## 4. Incident Response
In the event of a suspected security breach:
1. **Containment**: Immediately revoke compromised JWT secrets by rotating the `JWT_SECRET` in `.env` and restarting the passenger instance.
2. **Analysis**: Review the `wedding_audit_logs` and server logs for anomalous activity.
3. **Lockdown**: Temporarily restrict administrative routes using IP whitelisting at the infrastructure level.
