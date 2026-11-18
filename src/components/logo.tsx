/** Tradelog mark: three rising candlesticks on a violet tile. The same drawing is the site icon (`app/icon.svg`). */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <defs>
        <linearGradient id="tradelog-logo" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#8b6cf7" />
          <stop offset="1" stopColor="#5a3dd6" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill="url(#tradelog-logo)" />
      <g stroke="#fff" strokeWidth="1.6" strokeLinecap="round">
        <path d="M9 14v11M16 9v12M23 6v12" />
      </g>
      <g fill="#fff">
        <rect x="6.5" y="17" width="5" height="6" rx="1.2" fillOpacity="0.6" />
        <rect x="13.5" y="12" width="5" height="7" rx="1.2" fillOpacity="0.8" />
        <rect x="20.5" y="8" width="5" height="8" rx="1.2" />
      </g>
    </svg>
  )
}
