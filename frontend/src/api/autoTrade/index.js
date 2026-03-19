import callApi from '../apiClient'

export const getAutoTradeStatus = () => callApi('/api/auto-trade/status')
export const toggleAutoTrade = () => callApi('/api/auto-trade/toggle', { method: 'POST' })
export const runAutoTradeCycle = () => callApi('/api/auto-trade/run', { method: 'POST' })
