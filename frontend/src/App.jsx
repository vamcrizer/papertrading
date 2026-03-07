import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import Scanner from './pages/Scanner'
import VNStocks from './pages/VNStocks'
import Models from './pages/Models'
import Trades from './pages/Trades'
import Gold from './pages/Gold'
import VNFunds from './pages/VNFunds'
import StrategyTrades from './pages/StrategyTrades'
import './index.css'

function App() {
  return (
    <BrowserRouter>
      <div className="app">
        <aside className="sidebar">
          <div className="sidebar-logo">
            <div className="logo-icon">Q</div>
            <div>
              <h1>QuantDesk</h1>
              <span>Trading Intelligence</span>
            </div>
          </div>
          <nav className="nav-links">
            <NavLink to="/" className={({ isActive }) => isActive ? 'active' : ''} end>
              <span className="nav-icon">📊</span> Dashboard
            </NavLink>
            <NavLink to="/scanner" className={({ isActive }) => isActive ? 'active' : ''}>
              <span className="nav-icon">⚡</span> Crypto Scanner
            </NavLink>
            <NavLink to="/trades" className={({ isActive }) => isActive ? 'active' : ''}>
              <span className="nav-icon">📋</span> Lệnh Hoạt Động
            </NavLink>
            <NavLink to="/strategies" className={({ isActive }) => isActive ? 'active' : ''}>
              <span className="nav-icon">🤖</span> Strategy Paper
            </NavLink>
            <NavLink to="/vn-stocks" className={({ isActive }) => isActive ? 'active' : ''}>
              <span className="nav-icon">🇻🇳</span> VN Stocks
            </NavLink>
            <NavLink to="/vn-funds" className={({ isActive }) => isActive ? 'active' : ''}>
              <span className="nav-icon">💼</span> VN Funds
            </NavLink>
            <NavLink to="/gold" className={({ isActive }) => isActive ? 'active' : ''}>
              <span className="nav-icon">🥇</span> Metals Advisory
            </NavLink>
            <NavLink to="/models" className={({ isActive }) => isActive ? 'active' : ''}>
              <span className="nav-icon">📈</span> Models
            </NavLink>
          </nav>
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16, marginTop: 'auto' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', padding: '0 12px' }}>
              <div>Ensemble V2 · Multi-Factor</div>
              <div style={{ marginTop: 4 }}>Built with research data</div>
            </div>
          </div>
        </aside>
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/scanner" element={<Scanner />} />
            <Route path="/trades" element={<Trades />} />
            <Route path="/strategies" element={<StrategyTrades />} />
            <Route path="/vn-stocks" element={<VNStocks />} />
            <Route path="/vn-funds" element={<VNFunds />} />
            <Route path="/gold" element={<Gold />} />
            <Route path="/models" element={<Models />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}

export default App
