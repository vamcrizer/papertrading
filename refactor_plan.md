# Refactoring Plan: Frontend Architecture Standardization

**Objective:** Transform the current monolithic React 19 codebase into a maintainable, scalable architecture adhering to the project's Core Convention (adapted for non-Redux/non-Antd stack).

**Strategy:** Structure First → Abstraction (API/Hooks) → Optimization (Libraries).

---

## Phase 1: Structural Reorganization (The Foundation)
**Goal:** Align folder structure with `@convention.md` to eliminate "orphan" files and separate concerns.

### 1.1. Directory Setup
Create the standard directory tree:
```bash
src/
├── api/                  # API services (replacing direct fetch)
├── assets/               # Static assets
├── components/           # Shared UI components
│   ├── ui/               # Atoms/Molecules (Button, Badge, Card)
│   └── business/         # Organisms (TradeTable, SignalList)
├── hooks/                # Custom hooks (logic extraction)
├── layouts/              # Layout wrappers
├── pages/                # Page views
├── routes/               # Routing config
└── utils/                # Pure utility functions
```

### 1.2. Layout Extraction
- **Action:** Extract the Sidebar and Main Content wrapper from `App.jsx`.
- **Target:** Create `src/layouts/AppLayout/AppLayout.jsx` and `src/layouts/AppLayout/index.js`.
- **Refactor:** `App.jsx` should only contain the `BrowserRouter` and `Routes` definition, wrapping pages with `<AppLayout>`.

### 1.3. Component Extraction (UI Library)
Identify reusable UI elements currently hardcoded in pages and move them to `src/components/ui`.
- **`Card` / `StatCard`**: Extract the grid card styles and stat display logic.
- **`Badge`**: Create a `Badge` component that accepts `variant` (long, short, buy, sell) to replace the repetitive `<span className="badge...">` code.
- **`Button`**: Standardize buttons with `variant` (primary, secondary) and `isLoading` state.
- **`Table`**: Create a generic `Table` wrapper or standard CSS modules for tables to avoid repetitive class names.

### 1.4. Extras
- Folder: write barrier file index.js for each folder to simplify imports (e.g., `src/components/ui/index.js`).
- Modify vite config for @ aliasing if not already done.
---

## Phase 2: Logic Abstraction (The Clean-up)
**Goal:** Remove business logic and data fetching from Pages. Pages should only coordinate Components and Hooks.

### 2.1. API Layer Implementation
- **Action:** Create `src/api/apiClient.js` (or `callApi.js` per convention) to wrap `fetch` with base URL and error handling interceptors.
- **Feature Modules:** Create feature-specific API files:
    - `src/api/trades/index.js` (getTrades, closeTrade, etc.)
    - `src/api/signals/index.js` (getSignals)
    - `src/api/market/index.js` (getVNStocks, getModels)

### 2.2. Custom Hooks Extraction
Move logic from `useEffect` and event handlers into reusable hooks.
- **`src/hooks/useLivePrices.js`**: Encapsulate the `EventSource` (SSE) connection logic.
- **`src/hooks/useTrades.js`**: Handle fetching trades, polling, and PnL calculations.
- **`src/hooks/useAutoTrade.js`**: Manage auto-trade toggle and status fetching.
- **`src/hooks/useSignals.js`**: Fetch and filter crypto signals.

### 2.3. Utils Standardization
- **Action:** Move formatting logic to `src/utils/format.js`.
    - `formatCurrency(amount)`
    - `formatPercentage(value)`
    - `formatDate(dateString)`

---

## Phase 3: Library Recommendations (The Upgrade)
**Goal:** Reduce boilerplate and improve reliability using specialized libraries.

### 3.1. Data Fetching & Caching
*Problem:* Manual `useEffect` fetching, race conditions, and manual polling (`setInterval`).
*Recommendation:* **TanStack Query (React Query)**.
- **Why:** Replaces complex `useEffect` chains, handles caching, auto-refetching, and loading states automatically. Fits perfectly as a "Redux alternative" for server state.

### 3.2. Class Name Management
*Problem:* String concatenation for conditional classes (e.g., `active`, colors).
*Recommendation:* **clsx** or **classnames**.
- **Why:** Clean, readable conditional class composition.

### 3.3. Date Formatting
*Problem:* Manual `new Date().toLocaleString()`.
*Recommendation:* **date-fns**.
- **Why:** Lightweight, modular date manipulation and formatting.

### 3.4. Toast Notifications
*Problem:* Using `alert()` disrupts the user experience.
*Recommendation:* **react-hot-toast** or **sonner**.
- **Why:** Minimalist, beautiful toast notifications that don't block the UI.
`
---

## Execution Checklist

- [ ] **Step 1:** Create folder structure & move `App.jsx` layout logic to `src/layouts`.
- [ ] **Step 2:** Extract `src/utils/format.js`.
- [ ] **Step 3:** Refactor `src/api` layer (basic fetch wrapper first).
- [ ] **Step 4:** Refactor `Card`, `Badge`, `Button` to `src/components/ui`.
- [ ] **Step 5:** Create `useLivePrices` and `useTrades` hooks.
- [ ] **Step 6:** Refactor `Dashboard.jsx` to use hooks and components.
- [ ] **Step 7:** Refactor `Trades.jsx` to use hooks and components.
- [ ] **Step 8:** Refactor `Scanner.jsx` to use hooks and components.
