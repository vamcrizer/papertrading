const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8006'

export const callApi = async (path, options = {}) => {
  const res = await fetch(`${BASE_URL}${path}`, options)
  if (!res.ok) throw new Error(`API error ${res.status}: ${path}`)
  return res.json()
}

export const getStreamUrl = (path) => `${BASE_URL}${path}`

export default callApi
