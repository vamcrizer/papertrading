import callApi from '../apiClient'

export const getVNStocks = () => callApi('/api/vn-stocks')
export const getModels = () => callApi('/api/models')
export const getGold = () => callApi('/api/gold')
export const getVNFunds = () => callApi('/api/vn-funds')
