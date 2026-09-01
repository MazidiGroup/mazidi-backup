// Brand mark: a solid square with an offset outlined copy behind it —
// the original and its backup. Reads at 20px, scales to signage.
export function Mark({ size = 30, ink = 'var(--ink)', accent = 'var(--green)', title = 'Mazidi Group' }) {
  return (
    <svg
      className="mark"
      width={size}
      height={size}
      viewBox="0 0 32 32"
      role="img"
      aria-label={title}
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect x="10" y="3" width="19" height="19" rx="5" fill="none" stroke={accent} strokeWidth="2.4" />
      <rect x="3" y="10" width="19" height="19" rx="5" fill={ink} />
    </svg>
  );
}

export default function Logo({ tagline = true, size = 30, ...props }) {
  return (
    <span className="brand-inner" style={{ display: 'inline-flex', alignItems: 'center', gap: 11 }}>
      <Mark size={size} {...props} />
      <span className="wordmark">
        Mazidi Group
        {tagline && <small>Business backup and recovery</small>}
      </span>
    </span>
  );
}
