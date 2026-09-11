import { useMemo, useRef, type ReactNode } from 'react'
import type { Graph } from '@/kernels/graph'
import { nodesOf } from '@/kernels/graph'
import type { Positions, Pt } from '@/kernels/layout'
import { useSvgDrag } from '@/platform/useSvgDrag'
import { cx } from '@/ui'

export interface GraphViewProps {
  graph: Graph
  positions: Positions
  width?: number
  height?: number
  /** 有向图：画箭头；自环也会被正确画成小圈 */
  directed?: boolean
  highlightNodes?: string[]
  highlightEdges?: string[]
  dimNodes?: string[]
  dimEdges?: string[]
  /** 排除/待选中的边（虚线灰） */
  pendingEdges?: string[]
  /** 节点角标：度数、距离等 */
  nodeBadges?: Record<string, string>
  /** 节点填充色（语义色名或 CSS 变量） */
  nodeColors?: Record<string, string>
  /** 节点显示文本，默认用 id */
  nodeLabels?: Record<string, string>
  edgeLabels?: Record<string, string>
  onNodeClick?: (id: string) => void
  onEdgeClick?: (id: string) => void
  onMoveNode?: (id: string, pt: Pt) => void
  ariaLabel: string
  keyboardHint?: ReactNode
  /** 额外叠加层（例如一笔画的轨迹） */
  overlay?: ReactNode
}

const HL_NODE = 'var(--color-cur-500)'
const BASE_NODE = 'var(--color-a-500)'
const HL_EDGE = 'var(--color-cur-500)'
const BASE_EDGE = 'var(--color-dim-500)'

/**
 * 图视图 / 图编辑器（交互原语 P2）。
 *
 * 被 G1–G8、T1–T4、R1–R2 复用。三个设计要点：
 *  1. **节点位置由父组件传入**（来自 layout 内核的确定性布局），本组件不做布局决策；
 *  2. **自环必须画对** —— 关系的自反性完全依赖它，画不出来学生就没法理解；
 *  3. 节点可拖动，但拖动只是「换个看得清的位置」，不改变图的结构。
 */
export function GraphView({
  graph,
  positions,
  width = 340,
  height = 300,
  directed = false,
  highlightNodes = [],
  highlightEdges = [],
  dimNodes = [],
  dimEdges = [],
  pendingEdges = [],
  nodeBadges = {},
  nodeColors = {},
  nodeLabels = {},
  edgeLabels = {},
  onNodeClick,
  onEdgeClick,
  onMoveNode,
  ariaLabel,
  keyboardHint,
  overlay,
}: GraphViewProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const R = 17

  const pos = useMemo(() => {
    const out: Positions = {}
    for (const id of nodesOf(graph)) out[id] = positions[id] ?? { x: width / 2, y: height / 2 }
    return out
  }, [graph, positions, width, height])

  const { dragging, bind } = useSvgDrag<SVGGElement>({
    svgRef,
    onMove: (id, pt) => onMoveNode?.(id, pt),
    getPoint: (id) => pos[id] ?? { x: 0, y: 0 },
    step: 8,
  })

  return (
    <div className="flex flex-col gap-2">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        className={cx('h-auto w-full touch-none select-none', onMoveNode && 'dl-canvas-touch')}
        role="img"
        aria-label={ariaLabel}
      >
        <defs>
          <marker id="gv-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="context-stroke" />
          </marker>
        </defs>

        {/* 边 */}
        {graph.edges.map((e) => {
          const a = pos[e.u]
          const b = pos[e.v]
          if (!a || !b) return null
          const hi = highlightEdges.includes(e.id)
          const dim = dimEdges.includes(e.id)
          const pend = pendingEdges.includes(e.id)
          const stroke = hi ? HL_EDGE : pend ? 'var(--color-dim-300)' : BASE_EDGE
          const label = edgeLabels[e.id] ?? (e.w !== 1 ? String(e.w) : '')

          if (e.u === e.v) {
            // 自环：从节点正上方绕一圈
            const d = `M ${a.x - 11} ${a.y - 13} A 13 13 0 1 1 ${a.x + 11} ${a.y - 13}`
            return (
              <g key={e.id}>
                <path d={d} fill="none" stroke={stroke} strokeWidth={hi ? 4 : 2.5} opacity={dim ? 0.25 : 1} markerEnd={directed ? 'url(#gv-arrow)' : undefined} />
                <path
                  d={d}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={20}
                  style={{ cursor: onEdgeClick ? 'pointer' : undefined }}
                  onClick={onEdgeClick ? () => onEdgeClick(e.id) : undefined}
                  tabIndex={onEdgeClick ? 0 : -1}
                  role={onEdgeClick ? 'button' : undefined}
                  aria-label={onEdgeClick ? `边 ${e.u} 到 ${e.v}` : undefined}
                  onKeyDown={
                    onEdgeClick
                      ? (ev) => {
                          if (ev.key === 'Enter' || ev.key === ' ') {
                            ev.preventDefault()
                            onEdgeClick(e.id)
                          }
                        }
                      : undefined
                  }
                />
                <text x={a.x} y={a.y - 32} textAnchor="middle" className="dl-svg-text" fill={stroke} fontSize={11}>
                  {label}
                </text>
              </g>
            )
          }

          // 直线边：按半径裁掉两端，避免线头扎进圆里
          const dx = b.x - a.x
          const dy = b.y - a.y
          const len = Math.hypot(dx, dy) || 1
          const ux = dx / len
          const uy = dy / len
          const x1 = a.x + ux * R
          const y1 = a.y + uy * R
          const x2 = b.x - ux * (R + 3)
          const y2 = b.y - uy * (R + 3)
          const mx = (x1 + x2) / 2
          const my = (y1 + y2) / 2

          return (
            <g key={e.id}>
              <line
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={stroke}
                strokeWidth={hi ? 4 : 2.5}
                strokeLinecap="round"
                opacity={dim ? 0.25 : 1}
                strokeDasharray={pend ? '6 5' : undefined}
                markerEnd={directed ? 'url(#gv-arrow)' : undefined}
                style={{ transition: 'stroke var(--dl-dur) var(--ease-dl), stroke-width var(--dl-dur) var(--ease-dl)' }}
              />
              {onEdgeClick ? (
                <line
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke="transparent"
                  strokeWidth={20}
                  style={{ cursor: 'pointer' }}
                  onClick={() => onEdgeClick(e.id)}
                  tabIndex={0}
                  role="button"
                  aria-label={`边 ${e.u} 到 ${e.v}${label ? `，权重 ${label}` : ''}`}
                  onKeyDown={(ev) => {
                    if (ev.key === 'Enter' || ev.key === ' ') {
                      ev.preventDefault()
                      onEdgeClick(e.id)
                    }
                  }}
                />
              ) : null}
              {label ? (
                <>
                  <rect x={mx - 11} y={my - 10} width={22} height={18} rx={5} fill="white" opacity={0.92} />
                  <text x={mx} y={my + 3} textAnchor="middle" className="dl-svg-text" fill={hi ? HL_EDGE : 'var(--color-slate-600)'} fontSize={12}>
                    {label}
                  </text>
                </>
              ) : null}
            </g>
          )
        })}

        {overlay}

        {/* 节点 */}
        {nodesOf(graph).map((id) => {
          const p = pos[id]
          const hi = highlightNodes.includes(id)
          const dim = dimNodes.includes(id)
          const isDragging = dragging === id
          const fill = hi ? HL_NODE : (nodeColors[id] ?? BASE_NODE)
          const clickable = Boolean(onNodeClick)
          const draggable = Boolean(onMoveNode)
          return (
            <g
              key={id}
              transform={`translate(${p.x},${p.y})`}
              className={cx(draggable && 'dl-grab', isDragging && 'dl-grabbing')}
              style={{ transition: isDragging ? 'none' : 'transform var(--dl-dur) var(--ease-dl)' }}
              tabIndex={draggable || clickable ? 0 : -1}
              role={clickable ? 'button' : 'img'}
              aria-label={`节点 ${nodeLabels[id] ?? id}${nodeBadges[id] ? `，${nodeBadges[id]}` : ''}`}
              onClick={clickable ? () => onNodeClick?.(id) : undefined}
              onKeyDown={
                clickable
                  ? (e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        onNodeClick?.(id)
                      }
                    }
                  : undefined
              }
              {...(draggable ? bind(id) : {})}
            >
              {isDragging ? <circle r={R + 9} fill="none" stroke={HL_NODE} strokeWidth={2} opacity={0.65} /> : null}
              <circle
                r={R}
                fill={fill}
                stroke={hi ? 'var(--color-cur-700)' : 'white'}
                strokeWidth={hi ? 3 : 2}
                opacity={dim ? 0.28 : 1}
                style={{ transition: 'fill var(--dl-dur) var(--ease-dl), opacity var(--dl-dur) var(--ease-dl)' }}
              />
              <text
                textAnchor="middle"
                dy="0.35em"
                className="dl-svg-text"
                fill="white"
                opacity={dim ? 0.4 : 1}
                fontSize={14}
              >
                {nodeLabels[id] ?? id}
              </text>
              {nodeBadges[id] ? (
                <>
                  <circle cx={R - 2} cy={-R + 2} r={11} fill="white" stroke="var(--color-dim-300)" strokeWidth={1.5} />
                  <text x={R - 2} y={-R + 6} textAnchor="middle" className="dl-svg-text" fill="var(--color-slate-700)" fontSize={11}>
                    {nodeBadges[id]}
                  </text>
                </>
              ) : null}
            </g>
          )
        })}
      </svg>
      {keyboardHint ? <p className="text-xs text-slate-500 dark:text-slate-400">{keyboardHint}</p> : null}
    </div>
  )
}
