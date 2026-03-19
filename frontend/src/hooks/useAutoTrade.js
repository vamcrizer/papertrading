import { useState, useEffect } from 'react'
import { getAutoTradeStatus, toggleAutoTrade as apiToggle, runAutoTradeCycle } from '@/api/autoTrade'

export default function useAutoTrade(onCycleComplete) {
  const [enabled, setEnabled] = useState(false)
  const [running, setRunning] = useState(false)

  useEffect(() => {
    getAutoTradeStatus().then(d => setEnabled(d.enabled)).catch(() => { })
  }, [])

  const toggle = async () => {
    try {
      const d = await apiToggle()
      setEnabled(d.enabled)
    } catch (e) { console.error(e) }
  }

  const runNow = async () => {
    setRunning(true)
    try {
      await runAutoTradeCycle()
      if (onCycleComplete) await onCycleComplete()
    } catch (e) { console.error(e) }
    setRunning(false)
  }

  return { enabled, running, toggle, runNow }
}
