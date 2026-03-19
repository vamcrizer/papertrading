import { useState, useEffect, useRef } from 'react'
import { getStreamUrl } from '@/api/apiClient'

export default function useLivePrices() {
  const [prices, setPrices] = useState({})
  const [connected, setConnected] = useState(false)
  const sseRef = useRef(null)

  useEffect(() => {
    const connect = () => {
      const sse = new EventSource(getStreamUrl('/api/prices/stream'))
      sseRef.current = sse

      sse.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          setPrices(data.prices || {})
          setConnected(true)
        } catch { }
      }

      sse.onerror = () => {
        setConnected(false)
        sse.close()
        setTimeout(connect, 3000)
      }
    }

    connect()
    return () => { if (sseRef.current) sseRef.current.close() }
  }, [])

  return { prices, connected }
}
