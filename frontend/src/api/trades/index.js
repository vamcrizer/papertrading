import callApi from '../apiClient'

export const getTrades = () => callApi('/api/trades')
export const getTradeHistory = () => callApi('/api/trades/history')
export const openTrade = (payload) => callApi('/api/trades', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload),
})
export const closeTrade = (id, exitPrice) =>
  callApi(`/api/trades/${id}?exit_price=${exitPrice}`, { method: 'DELETE' })
