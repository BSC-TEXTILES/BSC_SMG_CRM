# Permissions & RBAC

The BSC Textiles Portal implements a multi-layered Role-Based Access Control (RBAC) system combined with Location-Based Access Control (LBAC).

## 1. Authentication Layer
Handled by the \`authenticate\` middleware. Ensures the user is logged in with a valid, unexpired JWT.

## 2. Location Filtering Layer (LBAC)
A user is restricted to data for their assigned location(s).
- **Global Admins:** Users with \`location_id = NULL\` (or \`isGlobalAdmin = true\`) can see data across all locations (Belagavi, Davanagere, Shivamogga).
- **Store Users:** Pinned to a specific store (e.g., Davanagere). API endpoints filter responses so store managers cannot view candidates or settings for other stores.

## 3. Role Layer
Users have a primary role (Admin, HR, Manager, Greeter, etc.).
- \`Admin\` and \`Super Admin\` bypass module-level permission checks.

## 4. Module Permission Layer
For non-admin users, access is controlled via the \`user_permissions\` table.
- A user must have a record for the specific module (e.g., \`user_management\`) with the requested action flag set to TRUE (\`can_view\`, \`can_edit\`, etc.).

## 5. Authorization Service
The \`backend/src/services/authorizationService.js\` orchestrates these layers. 
Routes are protected using the \`authorizeAction(module, action)\` middleware factory, which cleanly encapsulates the logic.
