import { NavLink } from 'react-router-dom'

export default function AppLayout({ children }) {
  return (
    <div className="flex min-h-screen bg-main text-text-primary font-inter">
      {/* Sidebar */}
      <aside className="fixed top-0 left-0 z-50 h-full w-72 bg-card p-4 transition-transform duration-300 xl:translate-x-0 border-r border-white/5 hidden md:flex flex-col">
        <div className="flex items-center gap-3 px-2 pb-8 pt-4 border-b border-white/10 mb-6">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-lg font-bold text-black shadow-lg shadow-white/10">
            Q
          </div>
          <div className="flex flex-col">
            <h1 className="text-lg font-bold text-white tracking-tight">QuantDesk</h1>
            <span className="text-xs font-medium text-text-secondary">Trading Intelligence</span>
          </div>
        </div>

        <nav className="flex flex-col gap-2 flex-1 overflow-y-auto pr-1">
          <NavItem to="/" icon="fas fa-chart-pie" label="Dashboard" />
          <NavItem to="/scanner" icon="fas fa-bolt" label="Crypto Scanner" />
          <NavItem to="/trades" icon="fas fa-clipboard-list" label="Lệnh Hoạt Động" />
          <NavItem to="/strategies" icon="fas fa-chess-knight" label="Strategy Paper" />
          <NavItem to="/vn-stocks" icon="fas fa-chart-line" label="VN Stocks" />
          <NavItem to="/vn-funds" icon="fas fa-briefcase" label="VN Funds" />
          <NavItem to="/gold" icon="fas fa-coins" label="Metals Advisory" />
          <NavItem to="/models" icon="fas fa-layer-group" label="Models" />
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-4 md:ml-72 md:p-8 transition-all">
        {children}
      </main>
    </div>
  )
}

function NavItem({ to, icon, label }) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) =>
        `flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200 ${
          isActive
            ? 'bg-white text-black shadow-md shadow-white/10'
            : 'text-text-secondary hover:bg-white/5 hover:text-white'
        }`
      }
    >
      <span className="w-5 text-center"><i className={icon}></i></span>
      {label}
    </NavLink>
  )
}
