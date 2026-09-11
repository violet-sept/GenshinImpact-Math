import { useMemo, useState } from 'react'

import { GraphView } from '@/primitives'
import {
  bfsOrder,
  components,
  degrees,
  dfsOrder,
  makeGraph,
  neighbors,
  nodesOf,
  type Graph,
} from '@/kernels/graph'
import { circleLayout, type Positions } from '@/kernels/layout'
import { Btn, Callout, Card, PlainSpeak, SectionTitle, cx } from '@/ui'
import { Quiz } from '@/ui/Quiz'
import { useSolveOnce } from '../hooks'
import type { StageCtx, Topic } from '../types'

/* ================================================================
   固定几何：6 个点均匀摆在一圈上，所有关卡共用，位置永远一致
   ================================================================ */

const W = 340
const H = 300
const CX = W / 2
const CY = H / 2
const R = 92
const IDS = ['A', 'B', 'C', 'D', 'E', 'F']
const RING: Positions = circleLayout(IDS, CX, CY, R)

/** 讲解用的纯圆形节点：点小一点，边线头才不会扎出圆外 */
function CircleNode({ x, y, r, fill, label }: { x: number; y: number; r: number; fill: string; label: string }) {
  return (
    <g>
      <circle cx={x} cy={y} r={r} fill={fill} stroke="white" strokeWidth={2} />
      <text x={x} y={y} dy="0.35em" textAnchor="middle" className="dl-svg-text" fill="white" fontSize={14}>
        {label}
      </text>
    </g>
  )
}

/** 在圆环布局上按半径裁剪线段，画法要和 GraphView 保持一致 */
function ring() {
  const p = (id: string) => RING[id]
  const edgeLine = (
    id: string,
    u: string,
    v: string,
    r: number,
    opts: { stroke: string; width?: number; dash?: string } = { stroke: 'var(--color-dim-500)' },
  ) => {
    const a = p(u)
    const b = p(v)
    const dx = b.x - a.x
    const dy = b.y - a.y
    const len = Math.hypot(dx, dy) || 1
    const ux = dx / len
    const uy = dy / len
    return (
      <line
        key={id}
        x1={a.x + ux * (r + 1)}
        y1={a.y + uy * (r + 1)}
        x2={b.x - ux * (r + 3)}
        y2={b.y - uy * (r + 3)}
        stroke={opts.stroke}
        strokeWidth={opts.width ?? 2.5}
        strokeLinecap="round"
        strokeDasharray={opts.dash}
      />
    )
  }
  return { p, edgeLine }
}

const { p: ringPoint, edgeLine } = ring()

/* ================================================================ ① 看一看 */

/** 钩子用的图：A B C D E 连成一整块，F 一个邻居都没有 */
const HOOK_GRAPH: Graph = makeGraph(
  IDS,
  [
    ['A', 'B'],
    ['A', 'C'],
    ['B', 'D'],
    ['C', 'E'],
    ['D', 'E'],
  ],
)

const COMP_COLORS = ['var(--color-a-500)', 'var(--color-b-500)', 'var(--color-cur-500)']

function HookStage({ ctx }: { ctx: StageCtx }) {
  const [revealed, setRevealed] = useState(false)

  const comps = useMemo(() => components(HOOK_GRAPH), [])
  const colorOf = useMemo(() => {
    const out: Record<string, string> = {}
    comps.forEach((c, i) => {
      for (const v of c) out[v] = COMP_COLORS[i % COMP_COLORS.length]
    })
    return out
  }, [comps])

  useSolveOnce(ctx, revealed)

  const revealText = `连虚线都没有，F 是单独的一块，所以从 A 走不到 F。`
  const compNames = comps.map((c) => c.join('')).join(' 和 ')

  return (
    <div className="flex flex-col gap-3">
      <PlainSpeak>
        图上有 6 个点。用眼睛看：从 <b>A</b> 出发，沿着线走，能走到 <b>F</b> 吗？
      </PlainSpeak>

      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_15rem]">
        <div className="rounded-xl bg-slate-50 p-2 dark:bg-slate-800/40">
          <GraphView
            graph={HOOK_GRAPH}
            positions={RING}
            width={W}
            height={H}
            ariaLabel="钩子用的图：A 到 E 连成一片，F 没有连线"
            keyboardHint={revealed ? undefined : '先别急着点，用眼睛看图自己判断。'}
            nodeColors={revealed ? colorOf : undefined}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Callout tone="cur" role="status">
            从 A 出发，最多能走到哪些点？先在心里过一遍。
          </Callout>
          <Btn
            variant="primary"
            aria-label="揭示答案：从 A 能不能走到 F"
            onClick={() => {
              setRevealed(true)
              ctx.announce(revealText)
            }}
            disabled={revealed}
          >
            {revealed ? '答案已经揭晓' : '揭晓答案'}
          </Btn>
          {revealed ? (
            <>
              <Callout tone="ok" role="status">
                从 A 能走到 B、C、D、E，但走不到 F —— F 一根线都没牵。
              </Callout>
              <Callout tone="info" title="为什么">
                F 一个邻居都没有，谁都没法走到它。所以这张图其实分成了两块：{compNames}。
              </Callout>
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}

/* ================================================================ ② 玩一玩 */

/** 探索用的图：刚好 6 个点、5 条边 —— 它是一棵树，每条边都是「关键的一条」 */
const EXPLORE_GRAPH: Graph = makeGraph(
  IDS,
  [
    ['A', 'B'],
    ['A', 'C'],
    ['B', 'D'],
    ['B', 'E'],
    ['C', 'F'],
  ],
)

function ComponentStrip({ comps, positions }: { comps: string[][]; positions: Positions }) {
  const width = 302
  const height = 146
  const pad = 12
  return (
    <div className="grid grid-cols-2 gap-2">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        role="img"
        aria-label={`连通分量的位置示意，一共 ${comps.length} 块`}
        className="h-auto w-full"
      >
        <rect x={0} y={0} width={width} height={height} rx={10} fill="var(--color-slate-50)" />
        {comps.map((comp, i) => {
          const q = comp.map((v) => positions[v])
          const minX = Math.min(...q.map((t) => t.x * 0.82))
          const maxX = Math.max(...q.map((t) => t.x * 0.82))
          const minY = Math.min(...q.map((t) => t.y * 0.48))
          const maxY = Math.max(...q.map((t) => t.y * 0.48))
          const x0 = Math.max(pad, minX - 20)
          const x1 = Math.min(width - pad, maxX + 20)
          const y0 = Math.max(pad, minY - 18)
          const y1 = Math.min(height - pad, maxY + 18)
          const color = COMP_COLORS[i % COMP_COLORS.length]
          return (
            <rect
              key={comp.join('')}
              x={x0}
              y={y0}
              width={Math.max(24, x1 - x0)}
              height={Math.max(24, y1 - y0)}
              rx={14}
              fill="none"
              stroke={color}
              strokeWidth={3}
              strokeDasharray="7 5"
            />
          )
        })}
        {Object.entries(positions).map(([id, t]) => {
          const idx = comps.findIndex((c) => c.includes(id))
          return (
            <CircleNode
              key={id}
              x={t.x * 0.82}
              y={t.y * 0.48}
              r={11}
              fill={COMP_COLORS[idx < 0 ? 0 : idx % COMP_COLORS.length]}
              label={id}
            />
          )
        })}
      </svg>

      <div>
        <div className="grid grid-cols-2 gap-2">
          {comps.map((comp, i) => (
            <div
              key={comp.join('')}
              className="rounded-lg border px-2 py-1.5 text-sm"
              style={{ borderColor: COMP_COLORS[i % COMP_COLORS.length] }}
            >
              <span className="mr-1 inline-block h-2.5 w-2.5 rounded-full align-middle" style={{ background: COMP_COLORS[i % COMP_COLORS.length] }} />
              <span className="font-mono text-slate-700 dark:text-slate-200">{comp.join('')}</span>
            </div>
          ))}
        </div>
        <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
          同色的点属于同一块 —— 块里的点互相都走得到，块和块之间走不过去。
        </p>
      </div>
    </div>
  )
}

function ExploreStage({ ctx }: { ctx: StageCtx }) {
  const [deleted, setDeleted] = useState<string[]>([])
  const [showComp, setShowComp] = useState(true)
  const [moved, setMoved] = useState<Positions | null>(null)

  const positions = moved ?? RING
  const liveGraph = useMemo(
    () => ({ nodes: EXPLORE_GRAPH.nodes, edges: EXPLORE_GRAPH.edges.filter((e) => !deleted.includes(e.id)) }),
    [deleted],
  )
  const deg = useMemo(() => degrees(liveGraph), [liveGraph])
  const badges = useMemo(() => {
    const out: Record<string, string> = {}
    for (const v of nodesOf(liveGraph)) out[v] = String(deg[v] ?? 0)
    return out
  }, [liveGraph, deg])

  const comps = useMemo(() => components(liveGraph), [liveGraph])
  const splitDone = deleted.length > 0 && comps.length === 2
  const tooMuch = comps.length > 2

  useSolveOnce(ctx, splitDone)

  const byId = (id: string) => EXPLORE_GRAPH.edges.find((e) => e.id === id)!

  const toggleEdge = (id: string): void => {
    const e = byId(id)
    if (deleted.includes(id)) {
      const restored = deleted.filter((x) => x !== id)
      const next = {
        nodes: EXPLORE_GRAPH.nodes,
        edges: EXPLORE_GRAPH.edges.filter((x) => !restored.includes(x.id)),
      }
      setDeleted(restored)
      ctx.announce(
        `把 ${e.u} 和 ${e.v} 之间的线接回去了，现在图分成 ${components(next).length} 块。`,
      )
      return
    }
    const after = { nodes: EXPLORE_GRAPH.nodes, edges: EXPLORE_GRAPH.edges.filter((x) => x.id !== id) }
    const n = components(after).length
    setDeleted((prev) => [...prev, id])
    ctx.announce(
      n > comps.length
        ? `剪断 ${e.u}–${e.v} 之后，图从 ${comps.length} 块变成了 ${n} 块 —— 这条线是关键的一条。`
        : `剪断 ${e.u}–${e.v}，块数还是 ${n} 块 —— 这条线不是关键的一条。`,
    )
  }

  const totalDeg = Object.values(deg).reduce((a, b) => a + b, 0)

  return (
    <div className="flex flex-col gap-3">
      <PlainSpeak>
        6 个点本来连成一整块。现在<b>点一条线就能把它剪断</b>，
        目标是剪出一条，让整张图分成 <b>2</b> 块。每个点右上角的小数字就是它的度数。
      </PlainSpeak>

      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_15rem]">
        <div className="rounded-xl bg-slate-50 p-2 dark:bg-slate-800/40">
          <GraphView
            graph={liveGraph}
            positions={positions}
            width={W}
            height={H}
            nodeBadges={badges}
            nodeColors={
              showComp
                ? Object.fromEntries(
                    nodesOf(liveGraph).map((v) => [
                      v,
                      COMP_COLORS[comps.findIndex((c) => c.includes(v)) % COMP_COLORS.length],
                    ]),
                  )
                : undefined
            }
            highlightEdges={splitDone ? deleted : []}
            onEdgeClick={toggleEdge}
            onMoveNode={(id, pt) => setMoved({ ...positions, [id]: { x: Math.round(pt.x), y: Math.round(pt.y) } })}
            ariaLabel="6 个点的连通性实验台，可以点线剪断它，也可以拖动点换位置"
            keyboardHint="键盘：Tab 走到某条线，按 Enter 剪断或接回；Tab 走到某个点，按方向键挪动它。"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Card className="p-3">
            <div className="flex flex-col gap-1.5 font-mono text-sm text-slate-700 dark:text-slate-200">
              <div>
                点的个数：{nodesOf(liveGraph).length} ｜ 线的条数：{liveGraph.edges.length}
              </div>
              <div>连通分量：{comps.length} 块</div>
              <div>所有度数加起来：{totalDeg}</div>
            </div>
            <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
              总数 {totalDeg} 刚好是线数 {liveGraph.edges.length} 的两倍 —— 每条线两头各算一次。
            </p>
          </Card>

          <div className="flex flex-wrap gap-2">
            <Btn
              variant={showComp ? 'primary' : 'outline'}
              size="sm"
              aria-pressed={showComp}
              aria-label="切换是否按连通分量给点上色"
              onClick={() => setShowComp((v) => !v)}
            >
              {showComp ? '正在显示连通分量' : '显示连通分量'}
            </Btn>
            <Btn
              variant="outline"
              size="sm"
              aria-label="把所有剪断的线接回来"
              onClick={() => {
                setDeleted([])
                ctx.announce('全部接回来了，图恢复成一开始的样子。')
              }}
              disabled={deleted.length === 0}
            >
              全部接回来
            </Btn>
          </div>

          {deleted.length > 0 ? (
            <Card className="p-3">
              <SectionTitle>剪断的线</SectionTitle>
              <ul className="flex flex-col gap-1.5">
                {deleted.map((id) => {
                  const e = byId(id)
                  return (
                    <li key={id} className="flex items-center justify-between gap-2 text-sm">
                      <span className="font-mono text-slate-700 dark:text-slate-200">
                        {e.u}–{e.v}
                      </span>
                      <button
                        type="button"
                        aria-label={`把 ${e.u} 和 ${e.v} 之间的线接回来`}
                        onClick={() => toggleEdge(id)}
                        className="min-h-9 rounded-lg border border-slate-300 px-2.5 text-xs dl-transition hover:border-a-500 dark:border-slate-600 dark:text-slate-200"
                      >
                        接回来
                      </button>
                    </li>
                  )
                })}
              </ul>
            </Card>
          ) : (
            <Callout tone="cur" role="status">
              点图上任意一条线，把它剪断，看看图会不会分成两块。
            </Callout>
          )}

          <Callout tone={splitDone ? 'ok' : tooMuch ? 'bad' : 'cur'} role="status">
            {splitDone
              ? `成功了：图现在是 ${comps.length} 块（${comps.map((c) => c.join('')).join(' 和 ')}）。你剪断的那条线，是这块图里唯一相连的通道。`
              : tooMuch
                ? `现在分成 ${comps.length} 块了，比 2 块多。先按「全部接回来」，只剪一条线试试。`
                : deleted.length === 0
                  ? '还是 1 块。挑一条线剪掉。'
                  : `现在还是 ${comps.length} 块。这条线虽然被剪了，但两端还绕得过去，所以图没有散。`}
          </Callout>
        </div>
      </div>

      {showComp && comps.length > 1 ? (
        <Card>
          <SectionTitle hint="上面是位置上色，下面是纯图示">图现在分成了这几块</SectionTitle>
          <ComponentStrip comps={comps} positions={positions} />
        </Card>
      ) : null}
    </div>
  )
}

/* ================================================================ ③ 起个名 */

const NAME_GRAPH: Graph = makeGraph(
  IDS,
  [
    ['A', 'B'],
    ['B', 'C'],
    ['C', 'D'],
    ['A', 'D'],
    ['D', 'E'],
  ],
)

function NameStage({ ctx }: { ctx: StageCtx }) {
  const [picked, setPicked] = useState<string | null>(null)
  const [shared, setShared] = useState(false)

  const deg = useMemo(() => degrees(NAME_GRAPH), [])
  const esum = Object.values(deg).reduce((a, b) => a + b, 0)

  useSolveOnce(ctx, picked !== null)

  const items: { id: string; word: string; text: string; right: boolean; why: string }[] = [
    {
      id: 'a',
      word: '路径',
      text: 'A → B → C 是一条路径',
      right: true,
      why: '对。路径就是一串「从哪儿到哪儿」的走法，每一步都得有线。',
    },
    {
      id: 'b',
      word: '度',
      text: 'D 的度数是 3',
      right: true,
      why: '对。D 身上牵着 B、C、E 三根线，所以度数是 3。',
    },
    {
      id: 'c',
      word: '孤立点',
      text: 'F 的度数是 1',
      right: false,
      why: '不对。F 一根线都没牵，度数是 0。度数为 0 的点叫孤立点。',
    },
    {
      id: 'd',
      word: '连通',
      text: '这张图是连通的',
      right: true,
      why: '对。除了落单的 F 之外，A 到 E 之间怎么走都走得通 —— 能走到所有点才叫连通。',
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <PlainSpeak>
        刚才你在图上做的事，只有这么几个词：路径、连通、连通分量、度数、孤立点。
        下面这张图里有 6 个点，其中 F 一根线都没牵。
      </PlainSpeak>

      <Card>
        <SectionTitle hint="点一句话，看它说得对不对">这一句说得对吗？</SectionTitle>
        <div className="grid gap-2 sm:grid-cols-2">
          {items.map((it) => (
            <button
              key={it.id}
              type="button"
              aria-pressed={picked === it.id}
              aria-label={`判断这一句：${it.text}`}
              onClick={() => {
                setPicked(it.id)
                ctx.announce(it.why)
              }}
              className={cx(
                'min-h-11 rounded-xl border p-3 text-left text-sm dl-transition',
                picked === it.id
                  ? it.right
                    ? 'border-ok-500 bg-ok-50 dark:bg-ok-500/10'
                    : 'border-bad-500 bg-bad-50 dark:bg-bad-500/10'
                  : 'border-slate-200 bg-white hover:border-a-500 dark:border-slate-700 dark:bg-slate-900',
              )}
            >
              <span className="mr-1.5 font-mono text-xs text-slate-500 dark:text-slate-400">{it.word}</span>
              <span className="text-slate-700 dark:text-slate-200">{it.text}</span>
            </button>
          ))}
        </div>
        {picked ? (
          <div className="mt-3">
            <Callout tone={items.find((i) => i.id === picked)!.right ? 'ok' : 'bad'} role="status">
              {items.find((i) => i.id === picked)!.why}
            </Callout>
          </div>
        ) : null}
      </Card>

      <Card>
        <SectionTitle hint="每个点右上角就是它的度数">数一数度数</SectionTitle>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="度数演示图" className="h-auto w-full">
          {NAME_GRAPH.edges.map((e) => {
            const isEdgeToE = e.u === 'E' || e.v === 'E'
            return edgeLine(e.id, e.u, e.v, 17, {
              stroke: isEdgeToE ? 'var(--color-cur-500)' : 'var(--color-dim-500)',
              width: isEdgeToE ? 4 : 2.5,
            })
          })}
          {Object.entries(deg).map(([id, d]) => {
            const q = ringPoint(id)
            return (
              <g key={id}>
                <CircleNode
                  x={q.x}
                  y={q.y}
                  r={17}
                  fill={id === 'F' ? 'var(--color-dim-500)' : d === 3 ? 'var(--color-cur-500)' : 'var(--color-a-500)'}
                  label={id}
                />
                <circle cx={q.x + 15} cy={q.y - 15} r={11} fill="white" stroke="var(--color-dim-300)" strokeWidth={1.5} />
                <text
                  x={q.x + 15}
                  y={q.y - 11}
                  textAnchor="middle"
                  className="dl-svg-text"
                  fill="var(--color-slate-700)"
                  fontSize={11}
                >
                  {d}
                </text>
              </g>
            )
          })}
        </svg>

        <div className="mt-2 flex flex-col gap-2 text-sm text-slate-700 dark:text-slate-200">
          <div className="font-mono">
            A {deg.A} ｜ B {deg.B} ｜ C {deg.C} ｜ D {deg.D} ｜ E {deg.E} ｜ F {deg.F}
          </div>
          <div className="font-mono">
            {Object.values(deg).join(' + ')} = {esum}，而线有 {NAME_GRAPH.edges.length} 条，2 × {NAME_GRAPH.edges.length} = {2 * NAME_GRAPH.edges.length}
          </div>
          <p>
            所有点的度数加起来，永远等于线数的两倍。因为每条线两头各算一次，所以它贡献了 2。
            F 的度数是 <b>0</b>，它是<b>孤立点</b>，也是单独的一个连通分量。
          </p>
        </div>

        <div className="mt-3">
          <Btn variant="outline" size="sm" aria-label="显示正式的说法" onClick={() => setShared((v) => !v)}>
            {shared ? '收起正式说法' : '给我正式说法'}
          </Btn>
          {shared ? (
            <div className="mt-2 flex flex-col gap-1 rounded-xl bg-slate-100 px-3 py-2.5 font-mono text-sm text-slate-700 dark:bg-slate-800/70 dark:text-slate-200">
              <div>路径：v₀ v₁ … vₖ，相邻两个点之间都有一条边</div>
              <div>连通：任意两个点之间都有一条路径</div>
              <div>连通分量：一块互相都走得到的点，且不能再加进任何点</div>
              <div>度数 deg(v)：点 v 身上连着几条边；deg(v) = 0 的点叫孤立点</div>
              <div>握手定理：Σ deg(v) = 2 |E|</div>
            </div>
          ) : null}
        </div>
      </Card>
    </div>
  )
}

/* ================================================================ ④ 练一练 */

function PracticeStage({ ctx }: { ctx: StageCtx }) {
  const [solvedCount, setSolvedCount] = useState(0)

  useSolveOnce(ctx, solvedCount >= 3)

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-slate-600 dark:text-slate-300">
        三道题，围着「度数」和「连通分量」转。选错了会告诉你为什么。
      </p>

      <Card>
        <Quiz
          question={<>一张图里，所有点的度数加起来，一定是偶数吗？</>}
          resetKey="g2-p1"
          onSolved={() => setSolvedCount((c) => c + 1)}
          choices={[
            {
              id: 'a',
              label: '一定，因为每条线两头各算一次',
              correct: true,
              why: '对。度数和 = 2 × 边数，边数是整数，所以度数和一定是偶数。这也说明奇度点的个数永远是偶数个。',
            },
            {
              id: 'b',
              label: '不一定，度数是奇数的时候总和就是奇数',
              correct: false,
              why: '不对。比如三个点两两相连，每个点度数都是 2，加起来 6；再比如一条线加一个点，度数是 1 + 1 + 0 = 2。不管怎么连，总和都是偶数。',
            },
            {
              id: 'c',
              label: '不一定，要看线画的顺序',
              correct: false,
              why: '不对。线怎么画、按什么顺序连，都不影响每个点连着几根线。',
            },
          ]}
        />
      </Card>

      <Card>
        <Quiz
          question={<>一个点一根线都没牵，它的度数是几？</>}
          resetKey="g2-p2"
          onSolved={() => setSolvedCount((c) => c + 1)}
          choices={[
            {
              id: 'a',
              label: '0，而且它自己就是单独的一个连通分量',
              correct: true,
              why: '对。没有任何邻居，度数是 0，这样的点叫孤立点。它自己单独成块，因为从它出发走不到任何地方。',
            },
            {
              id: 'b',
              label: '1，因为它也是一个点',
              correct: false,
              why: '不对。度数数的是「牵着几根线」，不是「有几个自己」。没有线就是 0。',
            },
            {
              id: 'c',
              label: '没有度数',
              correct: false,
              why: '不对。度数是 0，0 也是一个数。孤立点照样有点的度数，只是这个度数是 0。',
            },
          ]}
        />
      </Card>

      <Card>
        <Quiz
          question={<>在一张连通图上剪断一条边，连通分量的个数会怎么变？</>}
          resetKey="g2-p3"
          onSolved={() => setSolvedCount((c) => c + 1)}
          choices={[
            {
              id: 'a',
              label: '可能不变，也可能变多 —— 要看这条边是不是关键通道',
              correct: true,
              why: '对。如果这条边在某个环上，剪了还有别的路绕过去，块数不变；如果它是唯一通道（桥），剪了块数就会增加。',
            },
            {
              id: 'b',
              label: '一定变多，因为少了一条边',
              correct: false,
              why: '不对。环上的边剪了不算数：两端还能绕另一条路走，图照样是一块。你在实验台上试过这种情况。',
            },
            {
              id: 'c',
              label: '一定不变，剪一条边不影响连通性',
              correct: false,
              why: '不对。树（没有环的连通图）里每条边都是唯一通道，剪掉任何一条都会分成两块。',
            },
          ]}
        />
      </Card>
    </div>
  )
}

/* ================================================================ ⑤ 换个场景 */

/** 迁移用的图：点五边形 A-B-C-D-E 加上两条交叉捷径 */
const TRANSFER_GRAPH: Graph = makeGraph(
  IDS,
  [
    ['A', 'B'],
    ['B', 'C'],
    ['C', 'D'],
    ['D', 'E'],
    ['E', 'A'],
    ['A', 'C'],
    ['B', 'D'],
  ],
)

function TransferStage({ ctx }: { ctx: StageCtx }) {
  const [selected, setSelected] = useState<string[]>([])
  const [lastReject, setLastReject] = useState<string | null>(null)

  const target = useMemo(() => components(TRANSFER_GRAPH).find((c) => c.includes('A')) ?? [], [])
  const bfs = useMemo(() => bfsOrder(TRANSFER_GRAPH, 'A'), [])
  const dfs = useMemo(() => dfsOrder(TRANSFER_GRAPH, 'A'), [])

  const clickNode = (id: string): void => {
    const cur = selected[selected.length - 1]
    if (selected.includes(id)) {
      setLastReject(`${id} 已经走过了。一条路径里不重复踩同一个点，所以这里先不选它。`)
      ctx.announce(`${id} 已经走过了，换一个没走过的邻居。`)
      return
    }
    const isNeighbor = neighbors(TRANSFER_GRAPH, cur).some((n) => n.node === id)
    if (!isNeighbor) {
      setLastReject(`${cur} 和 ${id} 之间没有线，一步跨不过去。`)
      ctx.announce(`${cur} 到 ${id} 之间没有线，所以这一步走不通。`)
      return
    }
    setLastReject(null)
    setSelected((prev) => [...prev, id])
    ctx.announce(`走到 ${id} 了。`)
  }

  const visitedAll = target.every((v) => selected.includes(v))

  useSolveOnce(ctx, visitedAll)

  const done = (order: string[]) => order.filter((v) => selected.includes(v))

  return (
    <div className="flex flex-col gap-4">
      <PlainSpeak>
        同一张图，两种走法。从 <b>A</b> 出发点着走，
        边走边对比下面两行：<b>广度优先</b>是一圈一圈铺开，<b>深度优先</b>是一条道走到黑。
      </PlainSpeak>

      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_15rem]">
        <div className="rounded-xl bg-slate-50 p-2 dark:bg-slate-800/40">
          <GraphView
            graph={TRANSFER_GRAPH}
            positions={RING}
            width={W}
            height={H}
            highlightNodes={selected}
            nodeLabels={Object.fromEntries(nodesOf(TRANSFER_GRAPH).map((v) => [v, v]))}
            onNodeClick={clickNode}
            ariaLabel="五边形加两条捷径的图，点相邻的点可以一步步走过去"
            keyboardHint="键盘：Tab 选中一个点，按 Enter 走过去。"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Card className="p-3">
            <SectionTitle>你的路线</SectionTitle>
            <div className="font-mono text-sm text-slate-700 dark:text-slate-200">
              {selected.length ? selected.join(' → ') : '（还没出发）'}
            </div>
            <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
              从一个点走到另一个点，必须有线连着。连着走一串，就是一条路径。
            </p>
          </Card>

          <Card className="p-3">
            <SectionTitle hint="这就是两种遍历">完整的访问顺序</SectionTitle>
            <div className="flex flex-col gap-1.5 font-mono text-sm">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-a-700 dark:text-a-300">广度优先</span>
                {bfs.map((v) => (
                  <span
                    key={v}
                    className={cx(
                      'rounded-md border px-1.5',
                      selected.includes(v)
                        ? 'border-a-500 bg-a-50 text-a-700 dark:bg-a-500/10 dark:text-a-300'
                        : 'border-slate-200 text-slate-400 dark:border-slate-700 dark:text-slate-500',
                    )}
                  >
                    {v}
                  </span>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-b-700 dark:text-b-300">深度优先</span>
                {dfs.map((v) => (
                  <span
                    key={v}
                    className={cx(
                      'rounded-md border px-1.5',
                      selected.includes(v)
                        ? 'border-b-500 bg-b-50 text-b-700 dark:bg-b-500/10 dark:text-b-300'
                        : 'border-slate-200 text-slate-400 dark:border-slate-700 dark:text-slate-500',
                    )}
                  >
                    {v}
                  </span>
                ))}
              </div>
            </div>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              你走到 {done(bfs).length} / {target.length} 个点。两行里的点你都能走通，只是先后顺序不一样。
            </p>
          </Card>

          <Callout tone={visitedAll ? 'ok' : lastReject ? 'bad' : 'cur'} role="status">
            {visitedAll
              ? `你从 A 把 ${target.join('、')} 全走到了 —— 这说明它们是同一个连通分量。两种遍历的差别只在顺序：广度优先先啃完近的，深度优先先钻到底。`
              : lastReject ?? '先点 A 的邻居 B 或 C（也可以先点 E），一步步往外走。'}
          </Callout>

          <Btn
            variant="outline"
            size="sm"
            aria-label="清空路线，重新走一遍"
            onClick={() => {
              setSelected([])
              setLastReject(null)
            }}
            disabled={selected.length === 0}
          >
            从头再走一遍
          </Btn>

          <Callout tone="info" title="为什么 F 一直在外面">
            F 和谁都没连线，所以从一个点出发永远走不到它。
          </Callout>
        </div>
      </div>
    </div>
  )
}

/* ================================================================ 导出 */

const topic: Topic = {
  id: 'G2',
  title: '路径、连通性与度',
  moduleId: 'graph',
  oneLiner: '能走到吗？每个点牵着几根线？',
  outcome: '你能数出每个点的度数，判断一张图连通不连通，并说出它分成了几块。',
  prerequisites: ['G1'],
  bigIdea: '图就是把点和线摆在一起。线连着谁，就决定了谁能走到谁，也决定了每个点身上牵着几根线（度数）。',
  misconceptions: [
    {
      wrong: '只要图上有线，整张图就算连通',
      right: '连通要求「任意两个点之间都走得到」。只要有一个点谁都够不着（比如孤立点），这张图就不连通，它会分成好几块。',
    },
    {
      wrong: '剪断一条边，图一定会散成两块',
      right: '要看这条边在不在环上。环上的边剪了，两端还能绕另一条路走，块数不变；只有唯一通道（桥）被剪掉，块数才会增加。',
    },
    {
      wrong: '一个点一根线都没牵，它就不算图里的点',
      right: '它照样是图里的点，度数是 0，叫孤立点，而且它自己就是单独的一个连通分量。',
    },
  ],
  formalDefinition: (
    <>
      <p>
        <b>路径：</b>
        <span className="font-mono">点列 v₀ v₁ … vₖ，且每个 vᵢ 与 vᵢ₊₁ 之间有边</span>
      </p>
      <p>
        <b>连通：</b>
        <span className="font-mono">对任意两点 u、v，都存在一条从 u 到 v 的路径</span>
      </p>
      <p>
        <b>连通分量：</b>
        <span className="font-mono">一个极大的连通子图；分量之间没有任何边相连</span>
      </p>
      <p>
        <b>度数：</b>
        <span className="font-mono">deg(v) = 与 v 相连的边数</span>
      </p>
      <p>
        <b>握手定理：</b>
        <span className="font-mono">Σ deg(v) = 2 |E|</span>
      </p>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        握手定理的一个直接推论：奇度点的个数一定是偶数个。因为总和是偶数，奇数贡献的必须是偶数个。
      </p>
    </>
  ),
  glossary: [
    {
      term: '路径',
      plain: '从一点走到另一点，一路上每个点之间都有线连着。',
      formal: 'v₀ v₁ … vₖ，且 (vᵢ, vᵢ₊₁) ∈ E',
    },
    {
      term: '连通',
      plain: '图上随便挑两个点，都能沿着线走到。',
    },
    {
      term: '连通分量',
      plain: '图里的一块。块里的点互相都走得到，块和块之间走不过去。',
      formal: '极大的连通子图',
    },
    {
      term: '度',
      plain: '一个点身上牵着几根线。',
      formal: 'deg(v) = 与 v 关联的边数',
    },
    {
      term: '孤立点',
      plain: '一根线都没牵的点，度数是 0。它自己就是一个连通分量。',
    },
    {
      term: '桥',
      plain: '剪断它图就散架的那条边 —— 它是两块之间唯一的通道。',
      formal: '删去后连通分量个数增加的边',
    },
    {
      term: '握手定理',
      plain: '所有点的度数加起来 = 线数的两倍。因为每条线被两头各数了一次。',
      formal: 'Σ deg(v) = 2 |E|',
    },
    {
      term: '广度优先 / 深度优先',
      plain: '两种不同的走法：一种是先啃完近的一圈，一种是一条道走到底再回头。',
    },
  ],
  stages: [
    {
      label: '① 看一看',
      short: '看',
      narration: '图上有 6 个点。从 A 出发，能走到 F 吗？先用眼睛看，再揭晓。',
      requireSolve: true,
      hints: [
        '顺着线从 A 走，看最远能摸到哪些点。',
        '看看 F 身上有没有线。',
        '走不到 F。F 一根线都没牵，它自己单独成一块。这张图其实有 2 个连通分量。',
      ],
      render: (ctx) => <HookStage ctx={ctx} />,
    },
    {
      label: '② 玩一玩',
      short: '玩',
      narration: '6 个点、5 条线。点一条线剪断它，目标是让图分成正好 2 块。',
      requireSolve: true,
      hints: [
        '先看每个点右上角的度数，再随便剪一条线，盯着「连通分量」那一行的数字。',
        '这张图里没有环，所以每条线都是唯一通道 —— 随便剪一条，块数就会从 1 变成 2。',
        '剪断 A–B（或 A–C、B–D、B–E、C–F 中任意一条）都行。剪完之后图分成两块：一块含 A，一块含被剪掉的那个点。',
      ],
      render: (ctx) => <ExploreStage ctx={ctx} />,
    },
    {
      label: '③ 起个名',
      short: '名',
      narration: '给刚做的事起名字：路径、连通、连通分量、度数、孤立点。',
      requireSolve: true,
      hints: [
        '每个词都对着图上的一个具体东西，先找到它在图上对应哪儿。',
        '度数看「点上有几根线」；孤立点就是一根线都没有的那个点。',
        '四句话里只有「F 的度数是 1」是错的：F 的度数是 0，它是孤立点。其余三句都对。顺便记住握手定理：度数之和 = 2 × 边数。',
      ],
      render: (ctx) => <NameStage ctx={ctx} />,
    },
    {
      label: '④ 练一练',
      short: '练',
      narration: '三道题：度数和、孤立点的度数、剪断一条边会怎样。',
      requireSolve: true,
      hints: [
        '每道题都可以在脑子里画一张最小的图来验证。',
        '度数之和永远是 2 × 边数，所以一定是偶数；孤立点度数是 0。',
        '答案依次是：一定（每条线两头各算一次）；0，并且它自己就是单独一块；可能不变也可能变多，看这条边是不是唯一通道。',
      ],
      render: (ctx) => <PracticeStage ctx={ctx} />,
    },
    {
      label: '⑤ 换个场景',
      short: '变',
      narration: '换一张图，从 A 出发一步步走，边走边看两种走法的差别。',
      requireSolve: true,
      hints: [
        '只能走到有线相连的点，一步一步来。',
        '从 A 出发可以先走 B，也可以先走 C 或 E —— 挑一个没走过的邻居点下去。',
        '把 A、B、C、D、E 五个点都走到就通关了。注意两种顺序：广度优先是 A B C E D，深度优先是 A B C D E —— 点一样，顺序不同。',
      ],
      render: (ctx) => <TransferStage ctx={ctx} />,
    },
  ],
}

export default topic
