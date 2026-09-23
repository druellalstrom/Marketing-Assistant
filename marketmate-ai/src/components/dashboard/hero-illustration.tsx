/**
 * Flat vector illustration of a small-business marketing desk: laptop with a
 * growth chart, a "Plan / Create / Post / Grow" sticky note, an ideas notepad,
 * a mug and a phone. Pure SVG so it stays crisp at any resolution.
 */
export function HeroIllustration({ className = "" }: { className?: string }) {
  const hand = "'Segoe Print', 'Bradley Hand', 'Comic Sans MS', cursive";
  return (
    <svg viewBox="0 0 560 330" className={className} role="img" aria-labelledby="hero-illus-title">
      <title id="hero-illus-title">A small business desk with a laptop showing sales growing, marketing notes and a coffee mug</title>

      {/* soft backdrop */}
      <path d="M40 250 C 20 150, 110 40, 250 35 S 530 60, 540 170 S 470 320, 300 318 S 60 330, 40 250 Z" fill="#FCE7F3" />
      <circle cx="470" cy="70" r="36" fill="#FDF2F8" />
      <circle cx="92" cy="92" r="18" fill="#EDE9FE" />

      {/* desk */}
      <path d="M0 262 H560 V330 H0 Z" fill="#F5E6D8" />
      <path d="M0 262 H560" stroke="#E7CFBA" strokeWidth="3" />

      {/* laptop screen */}
      <g transform="translate(150 70)">
        <rect x="0" y="0" width="230" height="150" rx="12" fill="#172554" />
        <rect x="10" y="10" width="210" height="130" rx="6" fill="#1E3A8A" />
        {/* chart card */}
        <rect x="22" y="22" width="120" height="104" rx="8" fill="#ffffff" />
        <rect x="32" y="32" width="46" height="6" rx="3" fill="#CBD5E1" />
        <path d="M34 112 H132" stroke="#E2E8F0" strokeWidth="1.5" />
        <rect x="40" y="88" width="14" height="24" rx="3" fill="#C4B5FD" />
        <rect x="62" y="76" width="14" height="36" rx="3" fill="#F9A8D4" />
        <rect x="84" y="66" width="14" height="46" rx="3" fill="#EC4899" />
        <rect x="106" y="50" width="14" height="62" rx="3" fill="#7C3AED" />
        <path d="M38 84 L66 70 L90 60 L118 44" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M110 42 L119 43 L116 51" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        {/* social post card */}
        <rect x="152" y="22" width="58" height="60" rx="8" fill="#ffffff" />
        <circle cx="163" cy="33" r="5" fill="#F97316" />
        <rect x="172" y="30" width="30" height="5" rx="2.5" fill="#CBD5E1" />
        <rect x="158" y="42" width="46" height="26" rx="4" fill="#FCE7F3" />
        <path d="M175 60 c-4-3-7-6-7-9 a4 4 0 0 1 7-2 a4 4 0 0 1 7 2 c0 3-3 6-7 9z" fill="#EC4899" />
        <rect x="152" y="90" width="58" height="36" rx="8" fill="#ffffff" />
        <text x="160" y="106" fontSize="11" fontWeight="700" fill="#7C3AED" fontFamily="system-ui, sans-serif">#</text>
        <rect x="170" y="99" width="32" height="5" rx="2.5" fill="#DDD6FE" />
        <rect x="160" y="112" width="42" height="5" rx="2.5" fill="#E2E8F0" />
      </g>
      {/* laptop base */}
      <path d="M126 222 H404 L392 238 H138 Z" fill="#CBD5E1" />
      <path d="M126 222 H404" stroke="#94A3B8" strokeWidth="2" />
      <rect x="240" y="224" width="50" height="4" rx="2" fill="#94A3B8" />

      {/* sticky note on screen */}
      <g transform="translate(118 58) rotate(-8)">
        <rect x="0" y="0" width="84" height="84" rx="4" fill="#F9A8D4" />
        <rect x="30" y="-6" width="24" height="10" rx="2" fill="#FBCFE8" opacity="0.9" />
        <text x="12" y="24" fontSize="14" fill="#172554" fontFamily={hand}>Plan</text>
        <text x="12" y="40" fontSize="14" fill="#172554" fontFamily={hand}>Create</text>
        <text x="12" y="56" fontSize="14" fill="#172554" fontFamily={hand}>Post</text>
        <text x="12" y="72" fontSize="14" fill="#172554" fontFamily={hand}>Grow</text>
        <path d="M66 66 c-3-2-5-4-5-6 a3 3 0 0 1 5-1.5 a3 3 0 0 1 5 1.5 c0 2-2 4-5 6z" fill="#BE185D" />
      </g>

      {/* notepad */}
      <g transform="translate(418 58) rotate(4)">
        <rect x="0" y="0" width="118" height="170" rx="6" fill="#ffffff" stroke="#E2E8F0" strokeWidth="2" />
        <rect x="0" y="0" width="118" height="14" rx="6" fill="#172554" />
        <text x="10" y="36" fontSize="13" fill="#172554" fontFamily={hand}>Marketing ideas:</text>
        {[
          ["More engagement", 60],
          ["New customers", 84],
          ["Increase sales", 108],
          ["Build my brand", 132],
        ].map(([t, y]) => (
          <g key={t as string}>
            <path d={`M10 ${(y as number) - 4} l4 4 l7 -9`} fill="none" stroke="#EC4899" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            <text x="26" y={y as number} fontSize="11.5" fill="#1E293B" fontFamily={hand}>{t}</text>
          </g>
        ))}
        <path d="M58 152 c-4-3-7-6-7-9 a4 4 0 0 1 7-2 a4 4 0 0 1 7 2 c0 3-3 6-7 9z" fill="#7C3AED" />
      </g>

      {/* mug */}
      <g transform="translate(40 178)">
        <path d="M60 22 h8 a14 14 0 0 1 0 28 h-8" fill="none" stroke="#E2E8F0" strokeWidth="7" />
        <rect x="0" y="10" width="64" height="76" rx="10" fill="#ffffff" stroke="#E2E8F0" strokeWidth="2" />
        <ellipse cx="32" cy="12" rx="32" ry="6" fill="#7C2D12" opacity="0.85" />
        <text x="10" y="44" fontSize="12" fill="#172554" fontFamily={hand}>Good</text>
        <text x="10" y="58" fontSize="12" fill="#172554" fontFamily={hand}>things</text>
        <text x="10" y="72" fontSize="12" fill="#172554" fontFamily={hand}>take time</text>
        <path d="M20 -2 c-4 -8 4 -12 0 -20 M36 -2 c-4 -8 4 -12 0 -20" fill="none" stroke="#CBD5E1" strokeWidth="2.5" strokeLinecap="round" />
      </g>

      {/* phone */}
      <g transform="translate(420 268) rotate(-10)">
        <rect x="0" y="0" width="74" height="36" rx="7" fill="#172554" />
        <rect x="5" y="4" width="64" height="28" rx="4" fill="#312E81" />
        <circle cx="20" cy="18" r="6" fill="#EC4899" />
        <rect x="31" y="12" width="30" height="4" rx="2" fill="#A5B4FC" />
        <rect x="31" y="20" width="22" height="4" rx="2" fill="#A5B4FC" />
      </g>

      {/* plant */}
      <g transform="translate(508 200)">
        <path d="M14 58 C 4 30, -8 20, -2 4 M14 58 C 16 30, 30 18, 36 6 M14 58 C 14 36, 12 22, 16 0" fill="none" stroke="#1E3A8A" strokeWidth="3" strokeLinecap="round" />
        <ellipse cx="-2" cy="10" rx="8" ry="14" fill="#1E3A8A" transform="rotate(-25 -2 10)" />
        <ellipse cx="34" cy="12" rx="8" ry="14" fill="#1E3A8A" transform="rotate(30 34 12)" />
        <ellipse cx="16" cy="4" rx="7" ry="13" fill="#3B5BDB" />
        <path d="M0 56 H30 L26 76 H4 Z" fill="#F9A8D4" />
      </g>
    </svg>
  );
}
