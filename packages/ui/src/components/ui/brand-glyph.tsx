/** FlinkReactor concentric-rings brand glyph — coral SVG, scales by `size`. */
"use client"

interface BrandGlyphProps {
  size?: number
  className?: string
}

/** Three concentric coral circles. Outer ring + faded middle ring + filled center.
 *  Scaling logic mirrors console-v2/shared/icons.js exactly. */
function BrandGlyph({ size = 22, className }: BrandGlyphProps) {
  const sw = (size / 22) * 1.5
  const sw2 = (size / 22) * 1.2
  const r1 = size / 2 - 1
  const r2 = size * (6 / 22)
  const r3 = size * (2.2 / 22)
  const c = size / 2
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <circle cx={c} cy={c} r={r1} stroke="#e78a4e" strokeWidth={sw} />
      <circle
        cx={c}
        cy={c}
        r={r2}
        stroke="#e78a4e"
        strokeWidth={sw2}
        opacity={0.6}
      />
      <circle cx={c} cy={c} r={r3} fill="#e78a4e" />
    </svg>
  )
}

export type { BrandGlyphProps }
export { BrandGlyph }
