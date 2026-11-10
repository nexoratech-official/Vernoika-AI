export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <span className={`brand-lockup${compact ? " brand-lockup-compact" : ""}`}>
      <span className="brand-symbol" aria-hidden="true">
        <svg viewBox="0 0 40 40" fill="none">
          <path d="M20 5.5 31.7 12v13.5L20 32 8.3 25.5V12L20 5.5Z" />
          <path d="m13.5 24 6.5-11 6.5 11M16.2 19.5h7.6" />
          <circle cx="20" cy="5.5" r="2" />
          <circle cx="31.7" cy="12" r="2" />
          <circle cx="8.3" cy="12" r="2" />
          <circle cx="31.7" cy="25.5" r="2" />
          <circle cx="8.3" cy="25.5" r="2" />
          <circle cx="20" cy="32" r="2" />
        </svg>
      </span>
      <span className="brand-wordmark">VORNOKIA <span>AI</span></span>
    </span>
  );
}
