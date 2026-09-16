# BSC Textiles Portal — Memory Documentation

Welcome to the project memory for the BSC Textiles Portal. This folder contains the persistent architectural and technical documentation for the system. 

## Documentation Map

- [Project Memory & Status](project-memory.md) — Current state of the project, feature inventory, and pending work
- [System Architecture](architecture.md) — Tech stack, high-level architecture, directory structure
- [Database Schema](database.md) — Database layout, core tables, relationships
- [API Reference](api.md) — Key API routes and conventions
- [Permissions & RBAC](permissions.md) — Security model, roles, module permissions
- [Security Controls](security.md) — Account lockout, session management, auditing
- [Developer Tools](developer-tools.md) — How to use the DevTools for diagnostics
- [UI Conventions](ui.md) — Styling, components, responsive behavior
- [Testing Strategy](testing.md) — Unit, integration, and security tests

## Core Principles

1. **Production-Ready**: No mockups, static demos, or half-implemented features. 
2. **Secure by Default**: Passwords hashed, inputs validated, actions audited.
3. **Multi-Location Aware**: Everything respects location boundaries (Belagavi, Davanagere, Shivamogga) unless accessed by a Global Admin.
4. **Resilient**: Robust error handling on both frontend and backend.
5. **No Blind Spots**: Comprehensive audit logging for all critical operations.
