import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from 'sonner'
import AppLayout from '@/layouts/AppLayout'
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
      <Toaster position="top-right" theme="dark" richColors />
      <AppLayout>
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
      </AppLayout>
    </BrowserRouter>
  )
}

export default App
