import { useState } from 'react'
import { getSignals } from '@/api/signals'

export default function useSignals() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [lastUpdate, setLastUpdate] = useState(null)

  const refresh = async () => {
    setLoading(true)
    try {
      const result = await getSignals()
      setData(result)
      setLastUpdate(new Date())
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  return { data, loading, lastUpdate, refresh }
}
