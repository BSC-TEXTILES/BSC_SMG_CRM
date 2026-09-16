# System Architecture

## Technology Stack

- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS 3, Lucide React (Icons), React Router v6
- **Backend:** Node.js, Express.js 4, JSON Web Tokens (JWT) for Auth, bcryptjs for hashing
- **Database:** MySQL 8 with connection pooling

## Directory Structure

\`\`\`
/
├── backend/
│   ├── src/
│   │   ├── config/        # DB configuration, auto-initialization
│   │   ├── controllers/   # Request handlers (UserMgmt, Security, DevTools, etc.)
│   │   ├── middleware/    # Auth, RBAC, Location checking, File uploads
│   │   ├── routes/        # API route definitions
│   │   ├── services/      # Business logic (Audit, Authorization)
│   │   ├── utils/         # Helpers (Logger, Date, Response)
│   │   └── validators/    # Server-side validation schemas
│   └── index.js         # Entry point (Hostinger Passenger compatible)
│
├── frontend/
│   ├── src/
│   │   ├── components/    # Reusable UI components (Sidebar, Topbar)
│   │   ├── pages/         # Full page views (Settings, DevTools, UserMgmt)
│   │   ├── services/      # API client wrappers (api.ts)
│   │   └── App.tsx        # React router setup
│
├── database/            # Base schema SQL files
├── memory/              # Project documentation
└── tests/               # Automated test suites
\`\`\`

## High-Level Data Flow

1. **Client** makes an HTTP request to \`/api/*\` with a \`Bearer\` token.
2. **Express Middleware** (\`auth.js\`) validates the token and attaches user info (including \`locationId\`) to \`req.user\`.
3. **Authorization Service** (\`authorizationService.js\`) checks if the user's role and location permit the action.
4. **Validator** (\`userValidator.js\`) ensures input data is formatted correctly.
5. **Controller** interacts with the DB pool to perform the action.
6. **Audit Service** (\`auditService.js\`) records the event, success/failure, IP, User-Agent, and correlation ID.
7. **Response** is sent back to the client using standardized JSON format from \`utils/response.js\`.
