export default function Button({ variant = 'primary', isLoading, children, className = '', ...props }) {
  const base = "inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
  
  const variants = {
    primary: "bg-white text-black hover:bg-gray-200 shadow-lg shadow-white/10 hover:shadow-white/20",
    secondary: "bg-white/5 text-white hover:bg-white/10 border border-white/5",
    danger: "bg-red-600 text-white hover:bg-red-700 shadow-lg shadow-red-600/20",
    success: "bg-emerald-600 text-white hover:bg-emerald-700 shadow-lg shadow-emerald-600/20",
  }

  return (
    <button
      className={`${base} ${variants[variant] || variants.primary} ${className}`}
      disabled={isLoading || props.disabled}
      {...props}
    >
      {isLoading ? (
        <>
          <i className="fas fa-circle-notch fa-spin text-sm"></i>
          Processing...
        </>
      ) : children}
    </button>
  )
}
