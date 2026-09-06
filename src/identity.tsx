export function ArgentineFlagMark() {
  return (
    <svg className="arg-flag-mark" viewBox="0 0 36 24" aria-hidden="true">
      <rect width="36" height="24" rx="3" fill="#74ACDF" />
      <rect y="8" width="36" height="8" fill="#fff" />
      <circle cx="18" cy="12" r="2.4" fill="#F6B40E" />
    </svg>
  )
}

export function IdentityBand() {
  return (
    <section className="identity-band" aria-label="Identidad argentina">
      <img
        className="identity-photo"
        src="/identidad-argentina.png"
        alt="Identidad argentina. Por argentinos, para argentinos."
      />
    </section>
  )
}
