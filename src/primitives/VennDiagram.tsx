import { useId, useMemo, useRef, type ReactNode } from 'react'
import { useSvgDrag } from '@/platform/useSvgDrag'
import type { Pt } from '@/kernels/layout'
import { cx } from '@/ui'
import { canvasSize, maskOf, type VennCircle } from './vennGeometry'

export interface VennItem {
  id: string
  label: string
  x: number
  y: number
}

export interface VennDiagramProps {
  circles: VennCircle[]
  items: VennItem[]
  /** 要高亮的区域，例如 ['AB'] —— 并集传 ['A','B','AB']，交集传 ['AB'] */
  highlightMasks?: string[]
  highlightItems?: string[]
  dimItems?: string[]
  /** 允许拖动元素；不传即为只读 */
  onMoveItem?: (id: string, pt: Pt) => void
  onItemClick?: (id: string) => void
  /** 在区域中心显示标签，例如 { AB: 'A ∩ B' } */
  regionLabels?: Record<string, string>
  /** 元素被拖到的新位置（用于实时播报「现在在哪个区域」） */
  describeItem?: (item: VennItem, mask: string) => string
  ariaLabel: string
  /** 键盘提示语，展示在画布下方 */
  keyboardHint?: ReactNode
}

const TONE_FILL: Record<VennCircle['tone'], string> = {
  a: 'var(--color-a-500)',
  b: 'var(--color-b-500)',
  c: 'var(--color-cur-500)',
}

const TONE_STROKE: Record<VennCircle['tone'], string> = {
  a: 'var(--color-a-600)',
  b: 'var(--color-b-600)',
  c: 'var(--color-cur-600)',
}

/**
 * 集合画布（交互原语 P1）。
 *
 * 支持 S1 子集判定、S2 四种集合运算、S3 幂集、S7 鸽巢。
 *
 * 区域填充用的是**「裁剪求交 + 遮罩求差」**这套纯 SVG 组合技，
 * 而不是近似图形 —— 因为学生要拿它和课本上的韦恩图逐像素对照，
 * 画错一点点就会怀疑是自己理解错了。
 */
export function VennDiagram({
  circles,
  items,
  highlightMasks = [],
  highlightItems = [],
  dimItems = [],
  onMoveItem,
  onItemClick,
  regionLabels = {},
  describeItem,
  ariaLabel,
  keyboardHint,
}: VennDiagramProps) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const svgRef = useRef<SVGSVGElement>(null)
  const { width, height } = useMemo(() => canvasSize(circles), [circles])

  const positions = useMemo(() => {
    const out: Record<string, Pt> = {}
    items.forEach((i) => (out[i.id] = { x: i.x, y: i.y }))
    return out
  }, [items])

  const { dragging, bind } = useSvgDrag<SVGGElement>({
    svgRef,
    onMove: (id, pt) => onMoveItem?.(id, pt),
    getPoint: (id) => positions[id] ?? { x: 0, y: 0 },
    step: 8,
  })

  const maskId = (m: string): string => `venn-${uid}-mask-${m || 'none'}`

  // 被高亮的区域里，哪些圆要「排除」—— 用遮罩把不属于该区域的部分挖掉
  const excludeDefs = highlightMasks
    .map((m) => {
      const excluded = circles.filter((c) => !m.includes(c.id))
      if (excluded.length === 0 || m.length === 0) return null
      return (
        <mask key={`ex-${m}`} id={maskId(m)} maskUnits="userSpaceOnUse" x={0} y={0} width={width} height={height}>
          <rect x={0} y={0} width={width} height={height} fill="white" />
          {excluded.map((c) => (
            <circle key={c.id} cx={c.cx} cy={c.cy} r={c.r} fill="black" />
          ))}
        </mask>
      )
    })
    .filter(Boolean)

  const clipDefs = circles.map((c) => (
    <clipPath key={c.id} id={`venn-${uid}-clip-${c.id}`}>
      <circle cx={c.cx} cy={c.cy} r={c.r} />
    </clipPath>
  ))

  return (
    <div className="flex flex-col gap-2">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        className={cx('h-auto w-full touch-none select-none', onMoveItem && 'dl-canvas-touch')}
        role="img"
        aria-label={ariaLabel}
      >
        <defs>
          {clipDefs}
          {excludeDefs}
        </defs>

        {/* 圆本体：始终画出来，作为「集合的边界」 */}
        {circles.map((c) => (
          <g key={c.id}>
            <circle
              cx={c.cx}
              cy={c.cy}
              r={c.r}
              fill={TONE_FILL[c.tone]}
              fillOpacity={0.08}
              stroke={TONE_STROKE[c.tone]}
              strokeWidth={2.5}
              strokeDasharray="1 0"
            />
            <text
              x={c.cx + (c.id === 'B' ? c.r - 20 : -c.r + 20)}
              y={c.cy - c.r + 22}
              textAnchor="middle"
              className="dl-svg-text"
              fill={TONE_STROKE[c.tone]}
              fontSize={16}
            >
              {c.label}
            </text>
          </g>
        ))}

        {/* 高亮区域：先按「交集」裁剪，再用遮罩挖掉不属于该区域的圆 */}
        {highlightMasks.map((m) => {
          const included = circles.filter((c) => m.includes(c.id))
          if (included.length === 0) {
            // 空区域（补集落在所有圆外）用整块画布减去所有圆
            const outside = `venn-${uid}-outside`
            return (
              <g key={`hl-${m}`}>
                <mask id={outside} maskUnits="userSpaceOnUse" x={0} y={0} width={width} height={height}>
                  <rect x={0} y={0} width={width} height={height} fill="white" />
                  {circles.map((c) => (
                    <circle key={c.id} cx={c.cx} cy={c.cy} r={c.r} fill="black" />
                  ))}
                </mask>
                <rect
                  x={0}
                  y={0}
                  width={width}
                  height={height}
                  fill="var(--color-cur-500)"
                  fillOpacity={0.28}
                  mask={`url(#${outside})`}
                />
              </g>
            )
          }

          let node: ReactNode = (
            <rect x={0} y={0} width={width} height={height} fill="var(--color-cur-500)" fillOpacity={0.3} />
          )
          for (const c of included) {
            node = <g clipPath={`url(#venn-${uid}-clip-${c.id})`}>{node}</g>
          }
          const hasExcluded = circles.some((c) => !m.includes(c.id))
          if (hasExcluded) node = <g mask={`url(#${maskId(m)})`}>{node}</g>
          return <g key={`hl-${m}`}>{node}</g>
        })}

        {/* 区域标签 */}
        {Object.entries(regionLabels).map(([m, text]) => {
          const included = circles.filter((c) => m.includes(c.id))
          if (included.length === 0) return null
          const x = included.reduce((s, c) => s + c.cx, 0) / included.length
          const y = included.reduce((s, c) => s + c.cy, 0) / included.length
          return (
            <text key={`lbl-${m}`} x={x} y={y - 26} textAnchor="middle" className="dl-svg-text" fill="var(--color-cur-700)" fontSize={13}>
              {text}
            </text>
          )
        })}

        {/* 元素小球 */}
        {items.map((it) => {
          const mask = maskOf(circles, { x: it.x, y: it.y })
          const hi = highlightItems.includes(it.id)
          const dim = dimItems.includes(it.id)
          const isDragging = dragging === it.id
          const clickable = Boolean(onItemClick)
          const draggable = Boolean(onMoveItem)
          return (
            <g
              key={it.id}
              transform={`translate(${it.x},${it.y})`}
              className={cx(draggable && 'dl-grab', isDragging && 'dl-grabbing')}
              style={{ transition: isDragging ? 'none' : 'transform var(--dl-dur) var(--ease-dl)' }}
              tabIndex={draggable || clickable ? 0 : -1}
              role={clickable ? 'button' : 'img'}
              aria-label={
                describeItem
                  ? describeItem(it, mask)
                  : `${it.label}${mask ? `，属于 ${mask.split('').join(' 和 ')}` : '，不在任何集合里'}`
              }
              onClick={clickable ? () => onItemClick?.(it.id) : undefined}
              onKeyDown={
                clickable
                  ? (e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        onItemClick?.(it.id)
                      }
                    }
                  : undefined
              }
              {...(draggable ? bind(it.id) : {})}
            >
              <circle
                r={17}
                fill={hi ? 'var(--color-cur-500)' : mask ? 'var(--color-a-500)' : 'white'}
                stroke={hi ? 'var(--color-cur-700)' : mask ? 'var(--color-a-700)' : 'var(--color-dim-500)'}
                strokeWidth={2.5}
                opacity={dim ? 0.28 : 1}
                style={{ transition: 'fill var(--dl-dur) var(--ease-dl), opacity var(--dl-dur) var(--ease-dl)' }}
              />
              <text
                textAnchor="middle"
                dy="0.35em"
                className="dl-svg-text"
                fill={hi || mask ? 'white' : 'var(--color-slate-700)'}
                opacity={dim ? 0.4 : 1}
                fontSize={13}
              >
                {it.label}
              </text>
              {/* 拖动时给个放大光环，手指底下看得见 */}
              {isDragging ? <circle r={26} fill="none" stroke="var(--color-cur-500)" strokeWidth={2} opacity={0.7} /> : null}
            </g>
          )
        })}
      </svg>

      {keyboardHint ? <p className="text-xs text-slate-500 dark:text-slate-400">{keyboardHint}</p> : null}
    </div>
  )
}
