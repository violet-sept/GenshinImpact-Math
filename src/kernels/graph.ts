/**
 * 图论内核：表示、度数、连通性、欧拉判定、一笔画校验、Dijkstra、Kruskal。
 *
 * 边用 id 区分（而不是 (u,v) 对）—— 因为柯尼斯堡七桥是**多重图**，
 * 两座桥连接同两个岛时必须是两条不同的边，否则一笔画问题在数学上就错了。
 */
import type { Step } from './types'
import { clone } from './types'

export interface GEdge {
  id: string
  u: string
  v: string
  w: number
}

export interface Graph {
  nodes: string[]
  edges: GEdge[]
}

export function makeGraph(nodes: string[], raw: [string, string, number?][]): Graph {
  return {
    nodes,
    edges: raw.map(([u, v, w], i) => ({ id: `e${i}`, u, v, w: w ?? 1 })),
  }
}

export function nodesOf(g: Graph): string[] {
  const s = new Set(g.nodes)
  g.edges.forEach((e) => {
    s.add(e.u)
    s.add(e.v)
  })
  return [...s]
}

/* --------------------------------------------------------------- 表示 */

export function neighbors(g: Graph, v: string): { node: string; edge: GEdge }[] {
  const out: { node: string; edge: GEdge }[] = []
  for (const e of g.edges) {
    if (e.u === v) out.push({ node: e.v, edge: e })
    else if (e.v === v) out.push({ node: e.u, edge: e })
  }
  return out
}

export function degree(g: Graph, v: string): number {
  return neighbors(g, v).length
}

export function degrees(g: Graph): Record<string, number> {
  const out: Record<string, number> = {}
  for (const v of nodesOf(g)) out[v] = 0
  for (const e of g.edges) {
    out[e.u] = (out[e.u] ?? 0) + 1
    out[e.v] = (out[e.v] ?? 0) + 1
  }
  return out
}

export function degreeSequence(g: Graph): number[] {
  return Object.values(degrees(g)).sort((a, b) => b - a)
}

export function adjacencyMatrix(g: Graph): number[][] {
  const ns = nodesOf(g)
  const idx = new Map(ns.map((n, i) => [n, i]))
  const m = ns.map(() => ns.map(() => 0))
  for (const e of g.edges) {
    const i = idx.get(e.u)!
    const j = idx.get(e.v)!
    m[i][j] += 1
    if (i !== j) m[j][i] += 1
  }
  return m
}

export function adjacencyList(g: Graph): Record<string, string[]> {
  const out: Record<string, string[]> = {}
  for (const v of nodesOf(g)) out[v] = neighbors(g, v).map((x) => x.node)
  return out
}

/** 邻接表字符串（每个节点的邻居按字母序，便于阅读与测试） */
export function adjacencyListString(g: Graph): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, vs] of Object.entries(adjacencyList(g))) {
    out[k] = vs.length === 0 ? '∅' : vs.join(', ')
  }
  return out
}

/* --------------------------------------------------------------- 连通性 */

export function components(g: Graph): string[][] {
  const ns = nodesOf(g)
  const seen = new Set<string>()
  const out: string[][] = []
  for (const start of ns) {
    if (seen.has(start)) continue
    const stack = [start]
    const comp: string[] = []
    seen.add(start)
    while (stack.length) {
      const v = stack.pop()!
      comp.push(v)
      for (const { node } of neighbors(g, v)) {
        if (!seen.has(node)) {
          seen.add(node)
          stack.push(node)
        }
      }
    }
    out.push(comp.sort())
  }
  return out.sort((a, b) => b.length - a.length)
}

export function isConnected(g: Graph): boolean {
  const ns = nodesOf(g)
  if (ns.length === 0) return true
  return components(g).length === 1
}

/** 忽略孤立点后的连通性：欧拉回路判定要用这个（孤立点不影响一笔画） */
export function isConnectedIgnoringIsolated(g: Graph): boolean {
  const ns = nodesOf(g).filter((n) => degree(g, n) > 0)
  if (ns.length === 0) return true
  const sub: Graph = {
    nodes: ns,
    edges: g.edges.filter((e) => degree(g, e.u) > 0 && degree(g, e.v) > 0),
  }
  return isConnected(sub)
}

export function bfsOrder(g: Graph, start: string): string[] {
  const seen = new Set([start])
  const queue = [start]
  const out: string[] = []
  while (queue.length) {
    const v = queue.shift()!
    out.push(v)
    for (const { node } of neighbors(g, v)) {
      if (!seen.has(node)) {
        seen.add(node)
        queue.push(node)
      }
    }
  }
  return out
}

export function dfsOrder(g: Graph, start: string): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  const walk = (v: string): void => {
    if (seen.has(v)) return
    seen.add(v)
    out.push(v)
    for (const { node } of neighbors(g, v)) walk(node)
  }
  walk(start)
  return out
}

/* --------------------------------------------------------------- 欧拉 */

export function oddDegreeNodes(g: Graph): string[] {
  const d = degrees(g)
  return Object.keys(d)
    .filter((v) => d[v] % 2 === 1)
    .sort()
}

export interface EulerVerdict {
  odd: string[]
  connected: boolean
  hasCircuit: boolean
  hasPath: boolean
  title: string
  plain: string
}

/**
 * 欧拉路径 / 回路的判定。
 * 判据（无向图）：连通（忽略孤立点）且奇度点个数为 0（回路）或 2（路径）。
 */
export function eulerVerdict(g: Graph): EulerVerdict {
  const odd = oddDegreeNodes(g)
  const connected = isConnectedIgnoringIsolated(g)
  const hasCircuit = connected && odd.length === 0 && g.edges.length > 0
  const hasPath = connected && (odd.length === 0 || odd.length === 2) && g.edges.length > 0

  let title: string
  let plain: string
  if (g.edges.length === 0) {
    title = '还没有边'
    plain = '先连几座桥再看看。'
  } else if (!connected) {
    title = '不连通，走不完'
    plain = '有些地方根本走不到，所以不可能一笔画走完所有边。'
  } else if (odd.length === 0) {
    title = '存在欧拉回路'
    plain = '所有点的度数都是偶数 —— 可以一笔画走完每座桥恰好一次，最后回到出发点。'
  } else if (odd.length === 2) {
    title = '存在欧拉路径（但没有回路）'
    plain = `恰好有 2 个奇度点（${odd.join(' 和 ')}）—— 一笔画能走完每条边一次，但必须从其中一个奇度点出发，在另一个结束，回不到起点。`
  } else {
    title = '不存在一笔画走法'
    plain = `有 ${odd.length} 个奇度点。只要奇度点不是 0 个或 2 个，就一定画不出来。`
  }
  return { odd, connected, hasCircuit, hasPath, title, plain }
}

export interface TrailCheck {
  ok: boolean
  failedAt: number | null
  reason: string
  usedEdgeIds: string[]
  visited: string[]
}

/** 校验用户画出的一条「一笔画」路径：每步都必须是没用过的真实边 */
export function checkTrail(g: Graph, sequence: string[]): TrailCheck {
  const used = new Set<string>()
  const visited: string[] = sequence.length ? [sequence[0]] : []
  for (let i = 1; i < sequence.length; i++) {
    const a = sequence[i - 1]
    const b = sequence[i]
    const edge = g.edges.find((e) => !used.has(e.id) && ((e.u === a && e.v === b) || (e.u === b && e.v === a)))
    if (!edge) {
      const exists = g.edges.some((e) => (e.u === a && e.v === b) || (e.u === b && e.v === a))
      return {
        ok: false,
        failedAt: i,
        reason: exists ? `这条边（${a}–${b}）刚才已经走过了，不能重复走。` : `${a} 和 ${b} 之间没有桥，走不过去。`,
        usedEdgeIds: [...used],
        visited,
      }
    }
    used.add(edge.id)
    visited.push(b)
  }
  return {
    ok: true,
    failedAt: null,
    reason:
      used.size === g.edges.length
        ? '每条边都恰好走了一次 —— 这就是一条欧拉路径！'
        : `目前走对了，但还剩 ${g.edges.length - used.size} 条边没走过。`,
    usedEdgeIds: [...used],
    visited,
  }
}

/* ----------------------------------------------------------- Dijkstra */

export interface DijkstraState {
  dist: Record<string, number>
  prev: Record<string, string | null>
  settled: string[]
  current: string | null
  checking: { u: string; v: string } | null
  done: boolean
}

export const fmtDist = (d: number | undefined): string =>
  d === undefined || d === Infinity ? '∞' : String(d)

/**
 * Dijkstra 单源最短路。
 * 返回完整步骤序列，UI 按索引播放即可获得「单步 / 回退 / 时间旅行」。
 */
export function dijkstra(g: Graph, start: string): Step<DijkstraState>[] {
  const ns = nodesOf(g)
  const dist: Record<string, number> = {}
  const prev: Record<string, string | null> = {}
  for (const n of ns) {
    dist[n] = Infinity
    prev[n] = null
  }
  dist[start] = 0

  const settled: string[] = []
  const base: DijkstraState = { dist, prev, settled, current: null, checking: null, done: false }
  const steps: Step<DijkstraState>[] = [
    {
      snapshot: clone(base),
      explanation: `起点 ${start} 到自己当然是 0；到别的地方还不知道，先都记成 ∞（无穷大）。`,
      highlight: [start],
      label: '初始化',
    },
  ]

  for (;;) {
    let u: string | null = null
    let best = Infinity
    for (const n of ns) {
      if (!settled.includes(n) && dist[n] < best) {
        best = dist[n]
        u = n
      }
    }
    if (u === null || best === Infinity) break

    settled.push(u)
    steps.push({
      snapshot: clone({ ...base, dist: { ...dist }, prev: { ...prev }, settled: [...settled], current: u }),
      explanation: `在所有没确定的点里，${u} 的当前距离最小（${fmtDist(dist[u])}），所以它的最短距离已经可以确定了。`,
      highlight: [u],
      label: `确定 ${u}`,
    })

    for (const { node: v, edge } of neighbors(g, u)) {
      if (settled.includes(v)) continue
      const before = dist[v]
      const candidate = dist[u] + edge.w
      const improved = candidate < before
      if (improved) {
        dist[v] = candidate
        prev[v] = u
      }
      steps.push({
        snapshot: clone({
          ...base,
          dist: { ...dist },
          prev: { ...prev },
          settled: [...settled],
          current: u,
          checking: { u, v },
        }),
        explanation: improved
          ? `从 ${u} 绕到 ${v} 要 ${fmtDist(dist[u])} + ${edge.w} = ${candidate}，比原来的 ${fmtDist(before)} 更近，所以更新它。`
          : `从 ${u} 绕到 ${v} 要 ${candidate}，不比如今的 ${fmtDist(before)} 更近，不改。`,
        highlight: [u, v, edge.id],
        label: improved ? `更新 ${v}` : `跳过 ${v}`,
        tone: improved ? 'accept' : 'reject',
      })
    }
  }

  steps.push({
    snapshot: clone({ ...base, dist: { ...dist }, prev: { ...prev }, settled: [...settled], done: true }),
    explanation: '所有能到的点都确定了。表格里现在的数字，就是起点到每个点的最短距离。',
    highlight: [],
    label: '完成',
    tone: 'accept',
  })
  return steps
}

/** 从 Dijkstra 的 prev 表还原 start → target 的路径 */
export function reconstructPath(state: DijkstraState, start: string, target: string): string[] {
  const out: string[] = []
  let cur: string | null = target
  const guard = Object.keys(state.prev).length + 1
  while (cur && out.length <= guard) {
    out.unshift(cur)
    if (cur === start) break
    cur = state.prev[cur] ?? null
  }
  return cur === start ? out : []
}

/* ------------------------------------------------------------- Kruskal */

export interface KruskalState {
  sorted: GEdge[]
  cursor: number
  accepted: GEdge[]
  rejected: { edge: GEdge; reason: string }[]
  components: string[][]
  totalWeight: number
  done: boolean
}

export function sortedEdges(g: Graph): GEdge[] {
  return [...g.edges].sort((a, b) => a.w - b.w || a.id.localeCompare(b.id))
}

function componentOf(comps: string[][], v: string): number {
  return comps.findIndex((c) => c.includes(v))
}

/** 加入 edge 后是否成环（在已经接受的边集上判断） */
export function wouldFormCycle(nodes: string[], accepted: GEdge[], edge: GEdge): boolean {
  const comps = buildComponents(nodes, accepted)
  return componentOf(comps, edge.u) === componentOf(comps, edge.v)
}

function buildComponents(nodes: string[], edges: GEdge[]): string[][] {
  const adj = new Map<string, string[]>()
  nodes.forEach((n) => adj.set(n, []))
  for (const e of edges) {
    adj.get(e.u)?.push(e.v)
    adj.get(e.v)?.push(e.u)
  }
  const seen = new Set<string>()
  const comps: string[][] = []
  for (const n of nodes) {
    if (seen.has(n)) continue
    const stack = [n]
    const comp: string[] = []
    seen.add(n)
    while (stack.length) {
      const v = stack.pop()!
      comp.push(v)
      for (const w of adj.get(v) ?? []) {
        if (!seen.has(w)) {
          seen.add(w)
          stack.push(w)
        }
      }
    }
    comps.push(comp)
  }
  return comps
}

/**
 * Kruskal 最小生成树。每一步要么「接受这条边」，要么「拒绝并说明为什么」。
 * 拒绝的理由必须是人话（铁律 R3），因此这里把成环的具体路径也找出来。
 */
export function kruskal(g: Graph): Step<KruskalState>[] {
  const ns = nodesOf(g)
  const sorted = sortedEdges(g)
  let accepted: GEdge[] = []
  const rejected: { edge: GEdge; reason: string }[] = []
  const steps: Step<KruskalState>[] = [
    {
      snapshot: clone({
        sorted,
        cursor: 0,
        accepted: [],
        rejected: [],
        components: ns.map((n) => [n]),
        totalWeight: 0,
        done: false,
      }),
      explanation: '先把所有边从小到大排好队 —— 每次只看最便宜的那条。',
      highlight: [],
      label: '排序',
    },
  ]

  for (let i = 0; i < sorted.length; i++) {
    const e = sorted[i]
    const comps = buildComponents(ns, accepted)
    const same = componentOf(comps, e.u) === componentOf(comps, e.v)
    if (same) {
      const path = findPath(ns, accepted, e.u, e.v)
      rejected.push({ edge: e, reason: `${e.u} 和 ${e.v} 已经通过 ${path.join('→')} 连通了，再加这条就成环。` })
    } else {
      accepted = [...accepted, e]
    }
    const newComps = buildComponents(ns, accepted)
    const done = accepted.length === ns.length - 1 || i === sorted.length - 1
    steps.push({
      snapshot: clone({
        sorted,
        cursor: i + 1,
        accepted: [...accepted],
        rejected: [...rejected],
        components: newComps,
        totalWeight: accepted.reduce((s, x) => s + x.w, 0),
        done,
      }),
      explanation: same
        ? `边 ${e.u}–${e.v}（权重 ${e.w}）会成环，只能扔掉。`
        : `边 ${e.u}–${e.v}（权重 ${e.w}）连接了两个还没打通的区域，收下它。`,
      highlight: [e.id],
      label: same ? `拒绝 ${e.u}–${e.v}` : `接受 ${e.u}–${e.v}`,
      tone: same ? 'reject' : 'accept',
    })
  }

  steps.push({
    snapshot: clone({
      sorted,
      cursor: sorted.length,
      accepted,
      rejected,
      components: buildComponents(ns, accepted),
      totalWeight: accepted.reduce((s, x) => s + x.w, 0),
      done: true,
    }),
    explanation: `收够了 ${ns.length - 1} 条边就把所有点连成一片了，总代价 ${accepted.reduce((s, x) => s + x.w, 0)}，这就是最小生成树。`,
    highlight: accepted.map((e) => e.id),
    label: '完成',
    tone: 'accept',
  })
  return steps
}

function findPath(nodes: string[], edges: GEdge[], from: string, to: string): string[] {
  const adj = new Map<string, string[]>()
  nodes.forEach((n) => adj.set(n, []))
  for (const e of edges) {
    adj.get(e.u)?.push(e.v)
    adj.get(e.v)?.push(e.u)
  }
  const prev = new Map<string, string | null>([[from, null]])
  const queue = [from]
  while (queue.length) {
    const v = queue.shift()!
    if (v === to) break
    for (const w of adj.get(v) ?? []) {
      if (!prev.has(w)) {
        prev.set(w, v)
        queue.push(w)
      }
    }
  }
  const out: string[] = []
  let cur: string | null = to
  while (cur) {
    out.unshift(cur)
    cur = prev.get(cur) ?? null
  }
  return out
}

/* --------------------------------------------------------------- 着色 */

export const COLOR_NAMES = ['红', '蓝', '黄', '绿', '紫', '橙'] as const

export function greedyColoring(g: Graph): Record<string, number> {
  const ns = nodesOf(g)
  const color: Record<string, number> = {}
  for (const v of ns) {
    const used = new Set(neighbors(g, v).map((x) => color[x.node]).filter((c) => c !== undefined))
    let c = 0
    while (used.has(c)) c++
    color[v] = c
  }
  return color
}

export function isProperColoring(g: Graph, color: Record<string, number>): boolean {
  return g.edges.every((e) => color[e.u] !== color[e.v] || color[e.u] === undefined)
}

/** 找出所有冲突边（两端同色），供 G7 的实时闪烁提示 */
export function conflictingEdges(g: Graph, color: Record<string, number>): string[] {
  return g.edges.filter((e) => color[e.u] !== undefined && color[e.u] === color[e.v]).map((e) => e.id)
}
