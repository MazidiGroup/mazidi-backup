// The one illustration on the site: what the system actually does.
// Office computers back up to the box automatically; an optional copy is
// held offsite; a restore is tested with the customer. Nothing here is a
// screenshot or a claim — it is a map of the service.
export default function HeroDiagram() {
  const ink = 'var(--ink)';
  const green = 'var(--green)';
  const muted = 'var(--muted)';
  const line = 'var(--line-strong)';
  return (
    <svg
      className="diagram"
      viewBox="0 0 560 420"
      role="img"
      aria-labelledby="diagram-title diagram-desc"
      xmlns="http://www.w3.org/2000/svg"
    >
      <title id="diagram-title">How the Business Backup Box works</title>
      <desc id="diagram-desc">
        Three office computers back up automatically to a backup appliance on the network.
        An optional second copy is held offsite. A restore route runs back to the computers and is
        tested with you.
      </desc>
      <defs>
        <marker id="ah-ink" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
          <path d="M1 1 L9 5 L1 9" fill="none" stroke={ink} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </marker>
        <marker id="ah-green" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
          <path d="M1 1 L9 5 L1 9" fill="none" stroke={green} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </marker>
      </defs>

      <g fontFamily="inherit" fontSize="15" fill={muted}>
        <text x="90" y="40" textAnchor="middle" fill={ink} fontWeight="600">Your office computers</text>
        <text x="290" y="76" textAnchor="middle" fill={ink} fontWeight="600">Business Backup Box</text>
        <text x="290" y="96" textAnchor="middle">On your network, every day</text>
        <text x="472" y="180" textAnchor="middle" fill={ink} fontWeight="600">Offsite copy</text>
        <text x="472" y="200" textAnchor="middle">Optional, held elsewhere</text>
        <text x="196" y="410" textAnchor="middle" fill={green} fontWeight="600">Restore, tested with you</text>
      </g>

      {/* Office computers */}
      <g fill="#fff" stroke={ink} strokeWidth="2">
        <rect x="42" y="66" width="96" height="62" rx="7" />
        <rect x="42" y="166" width="96" height="62" rx="7" />
        <rect x="42" y="266" width="96" height="62" rx="7" />
      </g>
      <g stroke={ink} strokeWidth="2" strokeLinecap="round">
        <path d="M78 136 h24 M90 128 v8" /><path d="M78 236 h24 M90 228 v8" /><path d="M78 336 h24 M90 328 v8" />
      </g>
      <g stroke={line} strokeWidth="2" strokeLinecap="round">
        <path d="M58 86 h44 M58 98 h64 M58 110 h30" />
        <path d="M58 186 h64 M58 198 h36 M58 210 h52" />
        <path d="M58 286 h36 M58 298 h64 M58 310 h44" />
      </g>

      {/* Backup box */}
      <rect x="248" y="112" width="84" height="212" rx="12" fill="#fff" stroke={ink} strokeWidth="2.2" />
      <g fill={line}>
        <rect x="264" y="164" width="52" height="12" rx="3" />
        <rect x="264" y="188" width="52" height="12" rx="3" />
        <rect x="264" y="212" width="52" height="12" rx="3" />
        <rect x="264" y="236" width="52" height="12" rx="3" />
      </g>
      <circle cx="270" cy="136" r="5" fill={green} />
      <path d="M286 136 h30" stroke={line} strokeWidth="2" strokeLinecap="round" />
      <path d="M264 296 h20" stroke={ink} strokeWidth="2" strokeLinecap="round" />
      <path d="M296 296 h20" stroke={ink} strokeWidth="2" strokeLinecap="round" />

      {/* Computers -> box */}
      <g fill="none" stroke={ink} strokeWidth="1.8" markerEnd="url(#ah-ink)">
        <path d="M140 97 C 196 97, 200 200, 244 202" />
        <path d="M140 197 C 190 197, 200 214, 244 216" />
        <path d="M140 297 C 196 297, 200 232, 244 230" />
      </g>

      {/* Box -> offsite (dashed: optional) */}
      <g fill="none" stroke={ink} strokeWidth="1.8" strokeDasharray="6 6" markerEnd="url(#ah-ink)">
        <path d="M334 160 C 380 160, 390 128, 424 126" />
      </g>
      <rect x="428" y="104" width="88" height="46" rx="9" fill="#fff" stroke={ink} strokeWidth="2" strokeDasharray="6 6" />
      <g fill={line}>
        <rect x="444" y="119" width="56" height="7" rx="2" />
        <rect x="444" y="132" width="36" height="7" rx="2" />
      </g>

      {/* Restore path, back to the computers */}
      <g fill="none" stroke={green} strokeWidth="2.2" markerEnd="url(#ah-green)">
        <path d="M270 328 C 270 372, 200 386, 150 386 C 100 386, 92 362, 92 346" />
      </g>
      <g stroke={green} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" fill="none">
        <circle cx="352" cy="300" r="16" fill="var(--tint)" stroke="none" />
        <path d="M344 300 l6 6 l10 -12" />
      </g>
      <text x="376" y="305" fontFamily="inherit" fontSize="15" fill={ink} fontWeight="600">Backups completing</text>
    </svg>
  );
}
