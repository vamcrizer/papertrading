import callApi from '../apiClient'

export const getSignals = () => callApi('/api/signals')
