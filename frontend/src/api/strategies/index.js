import callApi from '../apiClient'

export const getStrategies = () => callApi('/api/strategies')
export const getStrategyTrades = (sid) => callApi(`/api/strategies/${sid}/trades`)
export const getStrategyHistory = (sid) => callApi(`/api/strategies/${sid}/history`)
export const getStrategySignal = (sid) => callApi(`/api/strategies/${sid}/signal`)
export const runStrategyCycle = (sid) => callApi(`/api/strategies/${sid}/run-cycle`, { method: 'POST' })
export const closeStrategyTrade = (sid, tid, exitPrice) =>
  callApi(`/api/strategies/${sid}/trades/${tid}?exit_price=${exitPrice}`, { method: 'DELETE' })
