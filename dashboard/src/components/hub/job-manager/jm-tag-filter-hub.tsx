import {
  classifyConfigKey,
  getTagColor,
  TAG_COLORS,
  tagStyle,
} from "@/components/job-manager/tag-filter"

export { classifyConfigKey, TAG_COLORS }

export function TagBadgeHub({ tag }: { tag: string }) {
  const color = getTagColor(tag)
  const s = tagStyle(color)

  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 font-mono text-[10px] font-medium leading-none"
      style={{
        backgroundColor: s.bg,
        color: s.text,
        border: `1px solid ${s.border}`,
      }}
    >
      {tag}
    </span>
  )
}

export function TagChipHub({
  tag,
  count,
  active,
  onClick,
}: {
  tag: string
  count: number
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`prop-chip ${active ? "active" : ""}`}
    >
      {tag}
      <span className="count">{count}</span>
    </button>
  )
}
