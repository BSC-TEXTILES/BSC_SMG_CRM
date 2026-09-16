# BSC Textiles Portal

A comprehensive, multi-location Enterprise Portal for BSC Textiles managing hiring, human resources, store operations, security, and developer diagnostics.

## Features

- **Store Kiosk PINs**: Securely manage hardware access (Greeter, TV, Cash)
- **Role-Based Access Control**: Granular permissions (View, Edit, Delete, Approve)
- **Location-Based Filtering**: Users are restricted to data for Belagavi, Davanagere, or Shivamogga, while Global Admins see everything.
- **Audit Logging**: Comprehensive, tamper-proof logging of all sensitive actions.
- **Developer Tools**: Real-time API health, system diagnostics, and audit viewers.

## Technology Stack

- **Frontend:** React 18, TypeScript, Vite, TailwindCSS
- **Backend:** Node.js 18+, Express.js, MySQL 8
- **Authentication:** JWT, bcryptjs

## Prerequisites

- Node.js >= 18.0.0
- MySQL >= 8.0

## Setup & Installation

1. Clone the repository
2. Run `npm install` in both the root, `backend/`, and `frontend/` folders
3. Copy `.env.example` to `.env` in the root and fill in the database credentials
4. Start the application:
   ```bash
   npm run dev
   ```
5. The application will automatically create all missing database tables on first launch.

## Default Admin Credentials

- **Username:** admin@bsctextiles.com
- **Password:** admin123
- **Role:** Super Admin

## Production Deployment

This application is configured for deployment on Hostinger via Passenger.
The entry point is `backend/index.js`. Do not change this as Passenger requires it.
Ensure `NODE_ENV=production` is set in the Hostinger control panel.

## Documentation

Full architectural and developer documentation can be found in the `memory/` directory and `DOCME.md`.
