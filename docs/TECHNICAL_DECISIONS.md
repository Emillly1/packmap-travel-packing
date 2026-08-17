# Technical Decisions

## TD-001: Vite and strict TypeScript

Use Vite with strict TypeScript and browser-native modules. The MVP does not require a component framework. This keeps the migration small while enforcing domain contracts.

Reconsider a component framework when account dashboards, shared editing, or multiple complex routes become committed scope.

## TD-002: Pure planning engine

Recommendation, quantity, placement, validation, and migration functions do not access the DOM or storage. They accept data and return data. This allows deterministic tests and future reuse by a server or mobile client.

## TD-003: One store, versioned persistence

UI modules dispatch actions to one application store. Storage subscribes to state changes. UI components do not write directly to localStorage.

## TD-004: Local-first MVP

MVP data stays in the browser and remains exportable. No analytics, account, AI, or payment dependency is required to complete the core journey.

## TD-005: Provider boundary for future AI

Both local rules and future AI providers return the same `PackingSuggestion` contract. AI calls will only occur through a server-side adapter, never from exposed browser keys.

## TD-006: Accessibility and responsive behavior are release requirements

Keyboard operation, focus management, status announcements, reduced motion, mobile overflow, and print output are tested features rather than post-launch polish.
