/**
 * 布局内核：把「谁和谁有关系」算成「画在哪儿」。
 *
 * 刻意不用 d3-force：一是能省掉一个依赖，二是**确定性**对教学产品很重要
 * —— 同一张图每次打开必须长得一模一样，否则用户会以为图变了，
 * 视觉回归测试也无法建立基线。
 */
import type { Graph } from './graph'
import { nodesOf } from './graph'

export interface Pt {
  x: number
  y: number
}

export type Positions = Record<string, Pt>

/** 圆周布局：最规整，适合 3–7 个点的关系图与状态机 */
export function circleLayout(ids: string[], cx = 170, cy = 150, r = 105, startAngle = -Math.PI / 2): Positions {
  const out: Positions = {}
  const n = ids.length
  ids.forEach((id, i) => {
    const a = startAngle + (i * 2 * Math.PI) / Math.max(n, 1)
    out[id] = { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) }
  })
  return out
}

/**
 * 力导向布局（确定性版本）。
 * 用「固定的初始圆周 + 固定迭代次数」代替随机初始化，保证结果可复现。
 */
export function forceLayout(
  ids: string[],
  edges: [string, string][],
  opts: { width?: number; height?: number; iterations?: number; linkDistance?: number } = {},
): Positions {
  const { width = 340, height = 300, iterations = 260, linkDistance = 78 } = opts
  const cx = width / 2
  const cy = height / 2

  const pos: Positions = circleLayout(ids, cx, cy, Math.min(width, height) * 0.34)
  const vel: Positions = {}
  ids.forEach((id) => (vel[id] = { x: 0, y: 0 }))

  const linkSet = edges.filter(([a, b]) => pos[a] && pos[b])
  const repulsion = linkDistance * linkDistance * 0.9

  let temp = linkDistance * 0.55
  for (let step = 0; step < iterations; step++) {
    // 斥力：所有点两两互斥
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const a = ids[i]
        const b = ids[j]
        let dx = pos[a].x - pos[b].x
        let dy = pos[a].y - pos[b].y
        let d2 = dx * dx + dy * dy
        if (d2 < 1e-6) {
          dx = (i - j) * 0.01 + 0.01
          dy = 0.01
          d2 = dx * dx + dy * dy
        }
        const d = Math.sqrt(d2)
        const f = repulsion / d2
        const fx = (dx / d) * f
        const fy = (dy / d) * f
        vel[a].x += fx
        vel[a].y += fy
        vel[b].x -= fx
        vel[b].y -= fy
      }
    }
    // 引力：有边的点互相拉近
    for (const [a, b] of linkSet) {
      const dx = pos[b].x - pos[a].x
      const dy = pos[b].y - pos[a].y
      const d = Math.hypot(dx, dy) || 1
      const f = (d - linkDistance) * 0.06
      const fx = (dx / d) * f
      const fy = (dy / d) * f
      vel[a].x += fx
      vel[a].y += fy
      vel[b].x -= fx
      vel[b].y -= fy
    }
    // 向心力 + 位移限幅（温度退火）
    for (const id of ids) {
      vel[id].x += (cx - pos[id].x) * 0.012
      vel[id].y += (cy - pos[id].y) * 0.012
      const len = Math.hypot(vel[id].x, vel[id].y) || 1
      const limited = Math.min(len, temp)
      pos[id].x += (vel[id].x / len) * limited
      pos[id].y += (vel[id].y / len) * limited
      pos[id].x = clamp(pos[id].x, 34, width - 34)
      pos[id].y = clamp(pos[id].y, 34, height - 34)
      vel[id].x *= 0.82
      vel[id].y *= 0.82
    }
    temp *= 0.985
  }
  return round(pos)
}

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v))

const round = (p: Positions): Positions => {
  const out: Positions = {}
  for (const [k, v] of Object.entries(p)) out[k] = { x: Math.round(v.x), y: Math.round(v.y) }
  return out
}

/**
 * 层次树布局：叶子按顺序横向排开，父节点居中于子节点之上。
 * 用于二叉树遍历（T2）与决策树。
 */
export function treeLayout(
  root: string,
  childrenOf: (id: string) => string[],
  opts: { width?: number; levelHeight?: number; padding?: number } = {},
): Positions {
  const { width = 340, levelHeight = 74, padding = 30 } = opts
  const out: Positions = {}
  let cursor = padding
  const span = width - padding * 2

  const leaves = countLeaves(root, childrenOf)
  const step = leaves > 1 ? span / (leaves - 1) : 0

  const walk = (id: string, depth: number): number => {
    const kids = childrenOf(id)
    const y = padding + 12 + depth * levelHeight
    if (kids.length === 0) {
      const x = leaves > 1 ? cursor : padding + span / 2
      cursor += step
      out[id] = { x, y }
      return x
    }
    const xs = kids.map((k) => walk(k, depth + 1))
    const x = xs.reduce((a, b) => a + b, 0) / xs.length
    out[id] = { x, y }
    return x
  }
  walk(root, 0)
  return round(out)
}

function countLeaves(id: string, childrenOf: (id: string) => string[]): number {
  const kids = childrenOf(id)
  if (kids.length === 0) return 1
  return kids.reduce((s, k) => s + countLeaves(k, childrenOf), 0)
}

/** 给整张图选一个合适的布局：连通性差 / 点少的用圆周，稠密的用力导向 */
export function autoLayout(g: Graph, width = 340, height = 300): Positions {
  const ns = nodesOf(g)
  if (ns.length <= 7) return circleLayout(ns, width / 2, height / 2, Math.min(width, height) * 0.34)
  return forceLayout(
    ns,
    g.edges.map((e) => [e.u, e.v] as [string, string]),
    { width, height },
  )
}
