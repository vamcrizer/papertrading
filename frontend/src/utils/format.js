export const formatCurrency = (amount, currency = 'USD') => {
  if (amount == null) return '—'
  if (currency === 'VND') return amount.toLocaleString('vi-VN') + ' ₫'
  return '$' + amount.toLocaleString()
}

export const formatPercentage = (value, decimals = 2) => {
  if (value == null) return '—'
  const prefix = value > 0 ? '+' : ''
  return `${prefix}${value.toFixed(decimals)}%`
}

export const formatDate = (dateString, locale = 'vi-VN') => {
  if (!dateString) return '—'
  return new Date(dateString).toLocaleString(locale)
}

export const formatPnl = (value, decimals = 2) => {
  if (value == null) return '—'
  const prefix = value >= 0 ? '+' : ''
  return `${prefix}${value.toFixed(decimals)}`
}
