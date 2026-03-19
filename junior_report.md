# Junior Dev Report: Frontend Codebase Analysis

## 1. Project Overview
The `frontend/` directory is a React 19 application built with Vite. It serves as a dashboard for a paper trading platform ("QuantDesk") featuring crypto signals, VN stock analysis, and trade management.

- **Stack**: React 19, React Router v7, Vite.
- **Styling**: Custom global CSS (`index.css`) with CSS variables. No CSS framework or preprocessor.
- **State Management**: Local component state (`useState`, `useEffect`). No global state management library.
- **Data Fetching**: Direct `fetch` calls within components. Real-time updates via `EventSource` (SSE).

## 2. Architecture Analysis

### Current Structure
The application follows a simple, page-centric structure:
- **Pages**: `Dashboard.jsx`, `Trades.jsx`, `Scanner.jsx`, etc., act as monolithic views.
- **Routing**: `App.jsx` handles routing and layout (Sidebar + Main Content).
- **Services**: There is **no dedicated service layer**. API logic is embedded directly in components.
- **Components**: There are **no reusable UI components**. Elements like Cards, Tables, Badges, and Buttons are repeated across pages.

### Key Observations
- **Monolithic Components**: Pages are large and handle everything: data fetching, business logic (PnL calculation), and UI rendering.
    - *Example*: `Trades.jsx` manages trade fetching, SSE connection, PnL calculation, and rendering of both active and closed trades.
- **Tight Coupling**: UI is tightly coupled to the API response structure. Changes in the backend API will require updates across multiple files.
- **Direct API Calls**: `fetch` is used everywhere with repetitive error handling (console.error or alert).
- **Hardcoded Logic**: Business logic, such as color coding for PnL (`text-green` vs `text-red`) or calculating percentages, is repeated in JSX.

## 3. Code Quality & Maintainability

### Strengths
- **Simplicity**: The codebase is easy to navigate for small features.
- **Modern React**: Uses functional components and hooks.
- **Performance**: Initial load is likely fast due to minimal dependencies.

### Weaknesses
- **Repetition (DRY Violation)**:
    - **UI**: Card styles, table structures, and badges are copy-pasted.
    - **Logic**: Formatting numbers (currency, percentages) and coloring logic is repeated.
- **Hardcoded Values**: API endpoints are constructed using `import.meta.env.VITE_API_URL` but paths like `/api/trades` are hardcoded in multiple places.
- **Error Handling**: Basic `alert()` for user feedback is disruptive and not user-friendly. `console.error` is used for silent failures.
- **No Type Safety**: Pure JavaScript makes it prone to runtime errors, especially with deeply nested API responses (e.g., `signals?.signals?.filter(...)`).

## 4. Scalability Concerns

- **UI Consistency**: As the app grows, maintaining consistent styling (e.g., changing the primary color or card border radius) will require finding and replacing CSS/JSX across many files.
- **Complex State**: Managing complex trade states (live updates + user actions) in `Trades.jsx` with multiple `useState` hooks is becoming unwieldy.
- **Testing**: Writing unit tests for components like `Dashboard.jsx` is difficult because they are responsible for side effects (fetching) and complex rendering.

## 5. Recommendations for Refactoring

To innovate and scale, I propose the following roadmap:

### Phase 1: Modularization (Immediate)
1.  **Extract API Layer**: Create `src/services/api.js` to centralize `fetch` calls.
    - *Benefit*: Single source of truth for endpoints and error handling.
2.  **Create UI Components**: Extract reusable parts to `src/components/ui/`.
    - `Card`, `StatCard`
    - `Table`
    - `Badge` (with variants: 'success', 'danger', 'warning')
    - `Button`
    - *Benefit*: Consistent design and reduced code duplication.
3.  **Utility Functions**: Move formatting logic to `src/utils/format.js`.
    - `formatCurrency(value)`
    - `formatPercentage(value)`
    - `formatDate(date)`

### Phase 2: Logic Abstraction (Short-term)
1.  **Custom Hooks**: Extract logic to `src/hooks/`.
    - `useTrades()`: Encapsulate fetching and polling logic.
    - `useLivePrices()`: Encapsulate SSE connection logic.
    - *Benefit*: Components become purely presentational; logic is reusable and testable.

### Phase 3: Modernization (Medium-term)
1.  **State Management**: Introduce a lightweight store (like **Zustand**) for shared state (e.g., user preferences, global market status) if needed.
2.  **Styling**: Consider migrating to **Tailwind CSS** (via utility classes or `apply`) to enforce the design system token usage and reduce custom CSS maintenance.
3.  **TypeScript**: Gradually adopt **TypeScript** to add type safety for API responses and component props.

## 6. Conclusion
The current codebase is functional but fragile. By refactoring into a component-based architecture and separating concerns (API, Logic, UI), we can significantly improve maintainability and make the platform ready for new features like advanced charting or automated trading strategies.
