import { useState, useEffect, useCallback } from 'react'
import { getTrades, getTradeHistory } from '@/api/trades'

export default function useTrades(pollInterval = 30000) {
  const [trades, setTrades] = useState(null)
  const [history, setHistory] = useState(null)
  const [loading, setLoading] = useState(false)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const [t, h] = await Promise.all([getTrades(), getTradeHistory()])
      setTrades(t)
      setHistory(h)
    } catch (e) { console.error(e) }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchAll()
    const interval = setInterval(fetchAll, pollInterval)
    return () => clearInterval(interval)
  }, [fetchAll, pollInterval])

  return { trades, history, loading, refresh: fetchAll }
}
