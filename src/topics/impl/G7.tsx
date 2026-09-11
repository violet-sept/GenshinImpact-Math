import { useMemo, useState } from 'react'

import { GraphView } from '@/primitives'
import {
  COLOR_NAMES,
  conflictingEdges,
  degrees,
  greedyColoring,
  isProperColoring,
  makeGraph,
  nodesOf,
  type Graph,
} from '@/kernels/graph'
import { circleLayout, type Positions } from '@/kernels/layout'
import { Btn, Callout, Card, PlainSpeak, SectionTitle, cx } from '@/ui'
import { Quiz } from '@/ui/Quiz'
import { useSolveOnce, useTriedSet } from '../hooks'
import type { StageCtx, Topic } from '../types'

/* ================================================================
   颜色：前 4 个颜色配 4 个语义色，色号旁一直带颜色名字，不靠颜色单独传意
   ================================================================ */

const FILLS = [
  'var(--color-a-500)',
  'var(--color-b-500)',
  'var(--color-cur-500)',
  'var(--color-ok-500)',
]

const COLOR_LABEL = COLOR_NAMES.slice(0, 4).map((name, i) => `${name}色（${i + 1}号）`)
const COLOR_CHOICE = 'var(--color-slate-300)'

/** 颜色语义还要有冗余表达：每个色号配一个形状符号 */
const SHAPES = ['●', '▲', '◆', '■']

function ColorDots({ n, limit = 4 }: { n: number; limit?: number }) {
  if (n === 0) return <span className="text-xs text-slate-400 dark:text-slate-500">还没上色</span>
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      {Array.from({ length: Math.min(n, limit) }, (_, i) => (
        <span
          key={i}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-1.5 py-0.5 text-xs dark:border-slate-700"
        >
          <span aria-hidden="true" style={{ color: FILLS[i] }}>
            {SHAPES[i]}
          </span>
          <span className="text-slate-600 dark:text-slate-300">{COLOR_NAMES[i]}色</span>
        </span>
      ))}
    </span>
  )
}

/* ================================================================ ① 看一看 */

const W = 340
const H = 300

/** 上色六边形：a 是外接圆半径 */
const HEX_A = 44

function hexPath(cx: number, cy: number, a = HEX_A): string {
  const pts: string[] = []
  for (let i = 0; i < 6; i++) {
    const ang = (Math.PI / 180) * (60 * i)
    pts.push(`${Math.round((cx + a * Math.cos(ang)) * 10) / 10},${Math.round((cy + a * Math.sin(ang)) * 10) / 10}`)
  }
  return `M ${pts.join(' L ')} Z`
}

interface Region {
  id: string
  name: string
  cx: number
  cy: number
}

const REGIONS: Region[] = [
  { id: '西', name: '西区', cx: 120, cy: 60 },
  { id: '北', name: '北区', cx: 210, cy: 40.4 },
  { id: '中', name: '中区', cx: 210, cy: 147.2 },
  { id: '东', name: '东区', cx: 300, cy: 60 },
  { id: '南', name: '南区', cx: 120, cy: 147.2 },
  { id: '外', name: '外区', cx: 210, cy: 254 },
]

/** 只有真正挨着的两块之间才有连线。中区和南区共用一条边，所以它们也是邻居。 */
const MAP_GRAPH: Graph = makeGraph(
  ['西', '北', '中', '东', '南', '外'],
  [
    ['西', '北'],
    ['西', '中'],
    ['西', '南'],
    ['北', '中'],
    ['北', '东'],
    ['中', '东'],
    ['中', '南'],
    ['南', '外'],
  ],
)

/**
 * 两种颜色够不够？这就是「这张图能不能二色染色」。
 * 从任意一块出发，邻居必须换色 —— 如果走到某一步发现冲突，说明 2 色做不到。
 * （这个图很小，直接一层层往下涂即可，不需要更复杂的算法。）
 */
function twoColoring(g: Graph): { ok: boolean; color: Record<string, number> } {
  const color: Record<string, number> = {}
  const ns = nodesOf(g)
  for (const start of ns) {
    if (color[start] !== undefined) continue
    color[start] = 0
    const queue = [start]
    while (queue.length) {
      const v = queue.shift()!
      for (const e of g.edges) {
        const other = e.u === v ? e.v : e.v === v ? e.u : null
        if (!other) continue
        if (color[other] === undefined) {
          color[other] = 1 - color[v]
          queue.push(other)
        } else if (color[other] === color[v]) {
          return { ok: false, color }
        }
      }
    }
  }
  return { ok: true, color }
}

function HookStage({ ctx }: { ctx: StageCtx }) {
  const [tints, setTints] = useState<Record<string, number>>({})
  const [showGraph, setShowGraph] = useState(false)

  const allTinted = REGIONS.every((r) => tints[r.id] !== undefined)
  const check = useMemo(() => twoColoring(MAP_GRAPH), [])
  const conflicts = useMemo(() => {
    const color: Record<string, number> = {}
    for (const [k, v] of Object.entries(tints)) color[k] = v
    return conflictingEdges(MAP_GRAPH, color)
  }, [tints])

  const done = allTinted && conflicts.length > 0

  useSolveOnce(ctx, done)

  const cycle = (id: string): void => {
    setTints((prev) => {
      const cur = prev[id]
      const next = { ...prev }
      if (cur === undefined) next[id] = 0
      else if (cur === 0) next[id] = 1
      else delete next[id]
      return next
    })
    ctx.announce(`给${REGIONS.find((r) => r.id === id)!.name}换了颜色。`)
  }

  const firstConflict = conflicts.length
    ? MAP_GRAPH.edges.find((e) => e.id === conflicts[0])!
    : null

  return (
    <div className="flex flex-col gap-3">
      <PlainSpeak>
        这是一张分成 6 块的地图。规则只有一条：<b>挨着的两块不能同色</b>。
        只给你 2 种颜色，能涂完吗？点一块地就能换色。
      </PlainSpeak>

      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_15rem]">
        <div className="rounded-xl bg-slate-50 p-2 dark:bg-slate-800/40">
          <svg viewBox="0 0 340 300" width="100%" role="img" aria-label="可以点着上色的六块地图" className="h-auto w-full">
            {REGIONS.map((r) => {
              const t = tints[r.id]
              return (
                <g key={r.id}>
                  <path
                    d={hexPath(r.cx, r.cy)}
                    fill={t === undefined ? COLOR_CHOICE : FILLS[t % FILLS.length]}
                    stroke="white"
                    strokeWidth={3}
                    style={{ cursor: 'pointer' }}
                    tabIndex={0}
                    role="button"
                    aria-label={`${r.name}，${t === undefined ? '还没上色' : `现在是${COLOR_NAMES[t]}色`}，点一下换色`}
                    onClick={() => cycle(r.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        cycle(r.id)
                      }
                    }}
                  />
                  <text
                    x={r.cx}
                    y={r.cy}
                    dy="0.35em"
                    textAnchor="middle"
                    className="dl-svg-text"
                    fill={t === undefined ? 'var(--color-slate-600)' : 'white'}
                    fontSize={16}
                    aria-hidden="true"
                  >
                    {r.id}
                  </text>
                  {showGraph
                    ? REGIONS.filter(
                        (o) =>
                          o.id !== r.id &&
                          MAP_GRAPH.edges.some(
                            (e) => (e.u === r.id && e.v === o.id) || (e.u === o.id && e.v === r.id),
                          ),
                      ).map((o) => (
                        <line
                          key={`${r.id}-${o.id}`}
                          x1={r.cx}
                          y1={r.cy}
                          x2={o.cx}
                          y2={o.cy}
                          stroke="var(--color-slate-600)"
                          strokeWidth={2}
                          strokeDasharray="6 4"
                          opacity={0.75}
                        />
                      ))
                    : null}
                </g>
              )
            })}
          </svg>
        </div>

        <div className="flex flex-col gap-2">
          <Card className="p-3">
            <div className="text-sm text-slate-700 dark:text-slate-200">只许用这两种颜色：</div>
            <div className="mt-1.5">
              <ColorDots n={2} />
            </div>
            <div className="mt-2 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span className="inline-block h-3 w-3 rounded" style={{ background: COLOR_CHOICE }} />
              灰色 = 还没上色
            </div>
          </Card>

          <Btn
            variant="outline"
            size="sm"
            aria-label="试着用两种颜色自动涂一遍，看会不会撞"
            onClick={() => setShowGraph((v) => !v)}
          >
            {showGraph ? '收起相邻关系' : '显示相邻关系'}
          </Btn>

          <Btn
            variant="outline"
            size="sm"
            aria-label="机器试着用两种颜色涂一遍"
            onClick={() => {
              setTints(Object.fromEntries(REGIONS.map((r) => [r.id, check.color[r.id] ?? 0])))
              ctx.announce(
                check.ok
                  ? '机器涂完了，两种颜色居然没撞 —— 不过你再仔细看看。'
                  : '机器也涂不满：涂到一半就撞上了，说明 2 种颜色真的不够。',
              )
            }}
          >
            让机器试着涂 2 种颜色
          </Btn>

          {showGraph ? (
            <Callout tone="info" title="这就是一张图">
              每一块地是一个点，挨着就在两点之间连一条线。
              给地图上色，就是给这张图的点上色 —— 相邻不能同色。
            </Callout>
          ) : null}

          <Callout tone={done ? 'bad' : 'cur'} role="status">
            {done ? (
              <>
                涂满了，但有冲突：{firstConflict!.u} 和 {firstConflict!.v} 挨着却同色。
                换一个颜色试试 —— 你会发现怎么换都会撞上。
              </>
            ) : allTinted ? (
              '六块都上色了，而且暂时没发现冲突。不过这张图里有三块互相都挨着，试着把它们涂好看看。'
            ) : (
              '点地图上的地块换颜色。先用这两种颜色尽量涂满，看什么时候会撞。'
            )}
          </Callout>

          <Btn
            variant="outline"
            size="sm"
            aria-label="把所有颜色清空，重来"
            onClick={() => setTints({})}
            disabled={Object.keys(tints).length === 0}
          >
            全部清空重来
          </Btn>
        </div>
      </div>
    </div>
  )
}

/* ================================================================ ② 玩一玩 */

const G7_IDS = ['A', 'B', 'C', 'D', 'E', 'F']
const G7_POS: Positions = circleLayout(G7_IDS, W / 2, H / 2, 100)

/** 6 个点，里面有 A-B-C 这个三角形，所以至少得 3 种颜色 */
const COLOR_GRAPH: Graph = makeGraph(
  G7_IDS,
  [
    ['A', 'B'],
    ['B', 'C'],
    ['A', 'C'],
    ['A', 'D'],
    ['B', 'D'],
    ['C', 'E'],
    ['D', 'F'],
  ],
)

/** 这个矩阵我一道一道验过：每个点的邻居颜色互不相同，而且只用了 3 种色 */
const THREE_COLORING: Record<string, number> = { A: 0, B: 1, C: 2, D: 2, E: 0, F: 1 }

/** 兜底自检：上面这份答案确实合法，而且真的只用了 3 种颜色 */
const THREE_OK =
  isProperColoring(COLOR_GRAPH, THREE_COLORING) && new Set(Object.values(THREE_COLORING)).size === 3

function ExploreStage({ ctx }: { ctx: StageCtx }) {
  const [color, setColor] = useState<Record<string, number>>({})
  const [used, setUsed] = useState<Set<string>>(() => new Set())
  const { tried, markTried } = useTriedSet()

  const conflicts = useMemo(() => conflictingEdges(COLOR_GRAPH, color), [color])
  const proper = useMemo(() => isProperColoring(COLOR_GRAPH, color), [color])
  const colorCount = useMemo(() => new Set(Object.values(color)).size, [color])
  const allColored = G7_IDS.every((v) => color[v] !== undefined)
  const solved = allColored && proper && colorCount <= 3

  useSolveOnce(ctx, solved)

  const key = conflicts.join('|')

  const cycle = (id: string): void => {
    markTried(id)
    setColor((prev) => {
      const cur = prev[id]
      const next = { ...prev }
      if (cur === undefined) next[id] = 0
      else if (cur < 3) next[id] = cur + 1
      else delete next[id]
      return next
    })
    ctx.announce(`把 ${id} 换成了下一个颜色。`)
  }

  const conflictText = (() => {
    if (conflicts.length === 0) return null
    const e = COLOR_GRAPH.edges.find((x) => x.id === conflicts[0])!
    return `${e.u} 和 ${e.v} 挨着，却涂了同一个颜色（${COLOR_NAMES[color[e.u]]}色），冲突了。`
  })()

  const target = G7_IDS[Math.min(tried.size, G7_IDS.length - 1)]

  return (
    <div className="flex flex-col gap-3">
      <PlainSpeak>
        这次有 4 种颜色可以轮换。点一个点就换一种颜色，规则还是那一条：
        <b>有连线的两个点不能同色</b>。目标：用<b>尽量少</b>的颜色把 6 个点都涂好。
      </PlainSpeak>

      <Callout tone="info" title="顺便回忆一下">
        每个点右上角的小数字是它的度数 —— 也就是它牵着几根线。度数越大的点，颜色越容易被邻居占掉。
      </Callout>

      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_16rem]">
        <div className="rounded-xl bg-slate-50 p-2 dark:bg-slate-800/40">
          <GraphView
            graph={COLOR_GRAPH}
            positions={G7_POS}
            width={W}
            height={H}
            nodeColors={Object.fromEntries(
              G7_IDS.filter((v) => color[v] !== undefined).map((v) => [v, FILLS[color[v]]]),
            )}
            nodeBadges={Object.fromEntries(
              Object.entries(degrees(COLOR_GRAPH)).map(([v, d]) => [v, String(d)]),
            )}
            highlightEdges={conflicts}
            onNodeClick={cycle}
            ariaLabel="6 个点的着色实验台，点一个点就换一种颜色"
            keyboardHint="键盘：Tab 选中一个点，按 Enter 换色。"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Card className="p-3">
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="text-slate-600 dark:text-slate-300">已经用了几种颜色</span>
              <span className="font-mono font-bold text-slate-800 dark:text-slate-100">{colorCount}</span>
            </div>
            <div className="mt-2">
              <ColorDots n={colorCount} />
            </div>
          </Card>

          <Callout
            key={key}
            tone={conflictText ? 'bad' : solved ? 'ok' : 'cur'}
            role="status"
          >
            {conflictText
              ? conflictText
              : solved
                ? `涂好了！只用了 ${colorCount} 种颜色，而且没有一条线的两端同色。`
                : allColored
                  ? '都涂上了，但没有冲突吗？再看看有没有漏掉哪个点。'
                  : `还没涂完。先点 ${target} 试试。`}
          </Callout>

          <div className="flex flex-wrap gap-2">
            <Btn
              variant="outline"
              size="sm"
              aria-label="清空所有颜色"
              onClick={() => setColor({})}
              disabled={Object.keys(color).length === 0}
            >
              清空颜色
            </Btn>
            <Btn
              variant="outline"
              size="sm"
              aria-label="用贪心法给出一种参考着色"
              onClick={() => {
                setUsed((prev) => new Set(prev).add('shown'))
                setColor({ ...(THREE_OK ? THREE_COLORING : greedyColoring(COLOR_GRAPH)) })
                ctx.announce('这是一种可行方案。看看它用了几种颜色。')
              }}
            >
              给我一种可行方案
            </Btn>
          </div>

          {used.has('shown') ? (
            <Callout tone="info" title="这个方案是怎么来的">
              从图里第一个点开始，每个点都挑一个「邻居没用过」的颜色。这样涂出来用了 3 种颜色，
              而且确实没有冲突 —— 说明 3 种颜色够用。
            </Callout>
          ) : null}

          <Card className="p-3">
            <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">四个颜色</div>
            <ul className="mt-1.5 flex flex-col gap-1 font-mono text-xs text-slate-600 dark:text-slate-300">
              {COLOR_LABEL.map((label, i) => (
                <li key={label}>
                  {i + 1} 号：{label}
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  )
}

/* ================================================================ ③ 起个名 */

function NameStage({ ctx }: { ctx: StageCtx }) {
  const [picked, setPicked] = useState<string | null>(null)

  const treeDemo = makeGraph(
    ['r', 'a', 'b', 'c', 'd'],
    [
      ['r', 'a'],
      ['r', 'b'],
      ['a', 'c'],
      ['a', 'd'],
    ],
  )
  const treeColor = greedyColoring(treeDemo)
  const treePos: Positions = {
    r: { x: 170, y: 40 },
    a: { x: 100, y: 120 },
    b: { x: 240, y: 120 },
    c: { x: 60, y: 205 },
    d: { x: 145, y: 205 },
  }

  useSolveOnce(ctx, picked !== null)

  const cards: { id: string; question: string; right: boolean; why: string }[] = [
    {
      id: 'a',
      question: '一个三角形（三个点两两相连）要几种颜色？',
      right: true,
      why: '要 3 种。三个点两两都相邻，任意两个都不能同色，所以三种颜色缺一不可。',
    },
    {
      id: 'b',
      question: '一条路径（点排成一串）要几种颜色？',
      right: true,
      why: '要 2 种。从一头开始，红、蓝、红、蓝交替涂下去就行，永远不会撞。',
    },
    {
      id: 'c',
      question: '「四色定理」说的是「任何图都只要 4 种颜色」',
      right: false,
      why: '不对。四色定理说的是平面地图（画在平面上、边界不乱穿的地图）只要 4 种颜色。随便一张图可能要很多种颜色。',
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <PlainSpeak>
        你刚才做的事有了名字：<b>给图着色</b>。相邻不能同色，最少需要几种颜色，
        这个数叫<b>色数</b>。下面用两张小图把它说清楚。
      </PlainSpeak>

      <Card>
        <SectionTitle hint="点一句话，看它说得对不对">这一句说得对吗？</SectionTitle>
        <div className="flex flex-col gap-2">
          {cards.map((c) => (
            <button
              key={c.id}
              type="button"
              aria-pressed={picked === c.id}
              aria-label={`判断这一句：${c.question}`}
              onClick={() => {
                setPicked(c.id)
                ctx.announce(c.why)
              }}
              className={cx(
                'min-h-11 rounded-xl border p-3 text-left text-sm dl-transition',
                picked === c.id
                  ? c.right
                    ? 'border-ok-500 bg-ok-50 dark:bg-ok-500/10'
                    : 'border-bad-500 bg-bad-50 dark:bg-bad-500/10'
                  : 'border-slate-200 bg-white hover:border-a-500 dark:border-slate-700 dark:bg-slate-900',
              )}
            >
              <span className="text-slate-700 dark:text-slate-200">{c.question}</span>
            </button>
          ))}
        </div>
        {picked ? (
          <div className="mt-3">
            <Callout tone={cards.find((c) => c.id === picked)!.right ? 'ok' : 'bad'} role="status">
              {cards.find((c) => c.id === picked)!.why}
            </Callout>
          </div>
        ) : null}
      </Card>

      <Card>
        <SectionTitle hint="一棵树，只用两种颜色就能涂好">为什么树只要 2 种颜色</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]">
          <GraphView
            graph={treeDemo}
            positions={treePos}
            width={300}
            height={240}
            nodeColors={Object.fromEntries(
              nodesOf(treeDemo).map((v) => [v, FILLS[treeColor[v] ?? 0]]),
            )}
            nodeLabels={{ r: '根', a: '甲', b: '乙', c: '丙', d: '丁' }}
            ariaLabel="一棵小树，用两种颜色交替涂好的样子"
          />
          <div className="flex flex-col gap-2 text-sm text-slate-700 dark:text-slate-200">
            <p>
              树里没有环。从根出发，一层一层往下涂：根涂 1 号色，儿子涂 2 号色，孙子再涂 1 号色。
            </p>
            <p>每一层只和自己的上一层相连，所以两种颜色交替着用，永远撞不上。这也是为什么色数最多只要 2。</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              反过来看三角形：三个点两两相连，是个「环」。环的长度要是奇数，2 种颜色就不够用了。
            </p>
          </div>
        </div>
      </Card>

      <Card>
        <SectionTitle>几个词</SectionTitle>
        <div className="flex flex-col gap-1.5 rounded-xl bg-slate-100 px-3 py-2.5 font-mono text-sm text-slate-700 dark:bg-slate-800/70 dark:text-slate-200">
          <div>正常着色：每条边的两端颜色都不相同</div>
          <div>色数 χ(G)：能正常着色所需的最少颜色数</div>
          <div>三角形：χ = 3 ｜ 树（2 个点以上）：χ = 2 ｜ 孤立点：χ = 1</div>
          <div>四色定理：平面地图都能用 4 种颜色涂好，3 种不一定够</div>
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
        三道题，都是刚才那两条规则的应用。选错了会告诉你为什么。
      </p>

      <Card>
        <Quiz
          question={<>三个点两两相连（一个三角形），要几种颜色才能涂好？</>}
          resetKey="g7-p1"
          onSolved={() => setSolvedCount((c) => c + 1)}
          choices={[
            {
              id: 'a',
              label: '3 种',
              correct: true,
              why: '对。三个点两两相邻，任意两个都不能同色：第一个用 1 号色，第二个用 2 号，第三个只能再用一种新的，所以是 3 种。而且 3 种确实够用。',
            },
            {
              id: 'b',
              label: '2 种',
              correct: false,
              why: '不对。2 种颜色涂三个两两相邻的点，必然有两个点同色，它们又相邻，就冲突了。',
            },
            {
              id: 'c',
              label: '4 种',
              correct: false,
              why: '不对。4 种当然也涂得好，但不是「最少」。题目问的是最少要几种。',
            },
          ]}
        />
      </Card>

      <Card>
        <Quiz
          question={<>一条路径（几个点排成一串，像 A—B—C—D—E），要几种颜色？</>}
          resetKey="g7-p2"
          onSolved={() => setSolvedCount((c) => c + 1)}
          choices={[
            {
              id: 'a',
              label: '2 种',
              correct: true,
              why: '对。红、蓝、红、蓝交替涂下去，每个点只和前后两个点相邻，永远不会撞。1 种不行，因为相邻的两点不能同色。',
            },
            {
              id: 'b',
              label: '3 种',
              correct: false,
              why: '不对。排成一串时每个点最多只有两个邻居，用两种颜色交替涂就够了，不需要第三种。',
            },
            {
              id: 'c',
              label: '1 种',
              correct: false,
              why: '不对。只要有线，两端的点就不能同色。1 种颜色意味着所有点同色，一条线都画不了。',
            },
          ]}
        />
      </Card>

      <Card>
        <Quiz
          question={<>「四色定理」讲的是什么？</>}
          resetKey="g7-p3"
          onSolved={() => setSolvedCount((c) => c + 1)}
          choices={[
            {
              id: 'a',
              label: '平面地图用 4 种颜色一定够，而且 3 种有时不够',
              correct: true,
              why: '对。平面地图（画在平面上、边界不乱穿）都可以用 4 种颜色涂好，相邻区域不同色；而且确实存在必须用满 4 种的地图。',
            },
            {
              id: 'b',
              label: '任何一张图都只要 4 种颜色',
              correct: false,
              why: '不对。随便一张图可能要很多种。比如 5 个点两两相连，每个点都得用不同的颜色，要 5 种。四色定理只保证平面地图。',
            },
            {
              id: 'c',
              label: '4 种颜色是最少的，用 3 种一定不行',
              correct: false,
              why: '不对。很多地图 3 种甚至 2 种就够了（比如我们的地图就只要 3 种）。四色定理说的是「4 种一定够」，不是说「一定要 4 种」。',
            },
          ]}
        />
      </Card>
    </div>
  )
}

/* ================================================================ ⑤ 换个场景 */

interface Course {
  id: string
  name: string
  students: string
}

const COURSES: Course[] = [
  { id: '高数', name: '高等数学', students: '小明、小红、小刚' },
  { id: '线代', name: '线性代数', students: '小明、小刚' },
  { id: '英语', name: '大学英语', students: '小明、小红' },
  { id: '体育', name: '体育', students: '小红' },
]

/** 两个人及以上同时上这两门课，就是「有冲突」 */
const CONFLICT_PAIRS: [string, string, string][] = [
  ['高数', '线代', '小明、小刚'],
  ['高数', '英语', '小明、小红'],
  ['高数', '体育', '小红'],
  ['线代', '英语', '小明'],
  ['英语', '体育', '小红'],
]

const CONFLICT_GRAPH: Graph = makeGraph(
  COURSES.map((c) => c.id),
  CONFLICT_PAIRS.map(([a, b]) => [a, b] as [string, string]),
)

function TransferStage({ ctx }: { ctx: StageCtx }) {
  const [found, setFound] = useState<string[]>([])
  const [rejects, setRejects] = useState<string[]>([])
  const [coloring, setColoring] = useState(false)

  const liveGraph: Graph = useMemo(
    () => makeGraph(COURSES.map((c) => c.id), found.map((k) => k.split('|') as [string, string])),
    [found],
  )

  const pos: Positions = {
    高数: { x: 170, y: 44 },
    线代: { x: 80, y: 158 },
    英语: { x: 262, y: 158 },
    体育: { x: 170, y: 250 },
  }

  const pairKey = (a: string, b: string): string => [a, b].sort().join('|')

  const allFound = found.length >= CONFLICT_PAIRS.length
  const solved = allFound && coloring

  useSolveOnce(ctx, solved)

  const toggle = (a: string, b: string): void => {
    if (a === b) return
    const k = pairKey(a, b)
    const pair = CONFLICT_PAIRS.find(([x, y]) => pairKey(x, y) === k)
    if (!pair) {
      setRejects((prev) => (prev.includes(k) ? prev : [...prev, k]))
      ctx.announce(`${a} 和 ${b} 没有共同的学生，不需要连这条线。`)
      return
    }
    if (found.includes(k)) {
      setFound((prev) => prev.filter((x) => x !== k))
      ctx.announce(`把 ${a}–${b} 这条线去掉了。`)
      return
    }
    setFound((prev) => [...prev, k])
    ctx.announce(`${a} 和 ${b} 有共同学生（${pair[2]}），不能同一时段，连一条线。`)
  }

  const pairs: [string, string][] = []
  for (let i = 0; i < COURSES.length; i++) {
    for (let j = i + 1; j < COURSES.length; j++) pairs.push([COURSES[i].id, COURSES[j].id])
  }

  const greedy = greedyColoring(CONFLICT_GRAPH)

  return (
    <div className="flex flex-col gap-4">
      <PlainSpeak>
        排课表的难题：<b>有共同学生的两门课不能排在同一个时段</b>。
        挨个点课程名，把「有冲突的两门课」连起来。
      </PlainSpeak>

      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_16rem]">
        <div className="rounded-xl bg-slate-50 p-2 dark:bg-slate-800/40">
          <GraphView
            graph={liveGraph}
            positions={pos}
            width={W}
            height={H}
            nodeLabels={Object.fromEntries(COURSES.map((c) => [c.id, c.name.slice(0, 2)]))}
            nodeColors={coloring ? Object.fromEntries(Object.entries(greedy).map(([k, v]) => [k, FILLS[v]])) : undefined}
            ariaLabel="课程冲突图，点课程名可以连线或去掉线"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Card className="p-3">
            <SectionTitle hint="点两门课，就会试连一条线">课程表</SectionTitle>
            <div className="grid grid-cols-2 gap-2">
              {pairs.map(([a, b]) => {
                const k = pairKey(a, b)
                const on = found.includes(k)
                const rejected = rejects.includes(k)
                return (
                  <button
                    key={k}
                    type="button"
                    aria-pressed={on}
                    aria-label={`把 ${a} 和 ${b} 连起来或者去掉连线`}
                    onClick={() => toggle(a, b)}
                    className={cx(
                      'min-h-11 rounded-xl border px-2 text-xs dl-transition',
                      on
                        ? 'border-bad-500 bg-bad-50 text-bad-700 dark:bg-bad-500/10 dark:text-bad-500'
                        : rejected
                          ? 'border-slate-200 bg-slate-100 text-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-500'
                          : 'border-slate-300 bg-white text-slate-700 hover:border-a-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200',
                    )}
                  >
                    {a} — {b}
                  </button>
                )
              })}
            </div>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              每门课都有哪些学生：{COURSES.map((c) => `${c.name}：${c.students}`).join('；')}。
            </p>
          </Card>

          <Callout tone={allFound ? 'ok' : 'cur'} role="status">
            {allFound
              ? '冲突图建好了：高数—线代、高数—英语、高数—体育、线代—英语、英语—体育，一共 5 条线。'
              : `已经连了 ${found.length} / ${CONFLICT_PAIRS.length} 条。哪两门课有学生同时在上，它们之间就该有一条线。`}
          </Callout>

          {rejects.length > 0 ? (
            <Callout tone="info" title="这几对不用连">
              {rejects
                .map((k) => {
                  const [a, b] = k.split('|')
                  return `${a} 和 ${b}`
                })
                .join('、')}
              ：它们没有共同的学生，同一个时段上也不会有学生撞课。
            </Callout>
          ) : null}

          <Btn
            variant="primary"
            size="sm"
            aria-label="给冲突图上色，排出时段"
            disabled={!allFound}
            onClick={() => {
              setColoring(true)
              ctx.announce('给每个点涂一个颜色，同色的课可以放在同一时段。')
            }}
          >
            给冲突图上色，排出时段
          </Btn>

          {coloring ? (
            <>
              <Card className="p-3">
                <div className="text-sm text-slate-700 dark:text-slate-200">
                  每个颜色 = 一个时段：
                </div>
                <ul className="mt-1.5 flex flex-col gap-1 text-sm">
                  {Array.from(new Set(Object.values(greedy))).map((c) => (
                    <li key={c} className="flex items-center gap-2">
                      <span aria-hidden="true" style={{ color: FILLS[c % FILLS.length] }}>
                        {SHAPES[c % SHAPES.length]}
                      </span>
                      <span className="text-slate-700 dark:text-slate-200">
                        第 {c + 1} 时段：
                        {Object.entries(greedy)
                          .filter(([, v]) => v === c)
                          .map(([k]) => k)
                          .join('、')}
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
              <Callout tone="ok" role="status">
                一共 3 个时段就够了。注意：互相冲突的三门课（高数、线代、英语）确实需要 3 个不同时段，
                所以 3 个时段已经是最少的了。
              </Callout>
            </>
          ) : null}
        </div>
      </div>

      <Card>
        <Quiz
          question={<>为什么「排课表」能当成一道着色题来做？</>}
          resetKey="g7-t1"
          onSolved={() => setColoring(true)}
          choices={[
            {
              id: 'a',
              label: '课是点、冲突是线，时段是颜色 —— 相邻不同色就等于冲突的课不同时段',
              correct: true,
              why: '对。有共同学生的两门课之间连一条线，给点上色就相当于分配时段，而「相邻不能同色」正好就是「有冲突的课不能同时段」。',
            },
            {
              id: 'b',
              label: '因为课程和颜色都能编号',
              correct: false,
              why: '不对。能编号只是方便，关键是对应关系：点 = 课，线 = 冲突，颜色 = 时段。没有这个对应，着色帮不上忙。',
            },
            {
              id: 'c',
              label: '因为一张课表最多只有 4 个时段',
              correct: false,
              why: '不对。时段有几天几节是可以自己定的，不一定是 4 个。能不能排开，取决于冲突图最少要几种颜色。',
            },
          ]}
        />
      </Card>
    </div>
  )
}

/* ================================================================ 导出 */

const topic: Topic = {
  id: 'G7',
  title: '图的着色',
  moduleId: 'graph',
  oneLiner: '相邻不能同色，最少要几种颜色？',
  outcome: '你能给一张图涂色并找出冲突，说出一张图的色数大概由什么决定，也能把排课这类问题翻译成着色。',
  prerequisites: ['G1'],
  bigIdea: '「谁和谁不能一样」这件事，可以画成一张图：不能一样的两个东西之间连一条线，然后给点涂颜色 —— 相邻不同色，最少要几种颜色，就是问题的答案。',
  misconceptions: [
    {
      wrong: '颜色越多越保险，所以随便涂涂就行',
      right: '题目问的通常是「最少几种」。颜色数少了排得下（时段少、考场少），少了排不下。所以既要撞不上，又要用得少。',
    },
    {
      wrong: '任何图 2 种颜色都够，实在不行再加',
      right: '三角形就要 3 种。三个点两两相邻，每种颜色只能给其中一个点，2 种必然不够。奇数长度的环都需要 3 种。',
    },
    {
      wrong: '4 种颜色对任何图都够',
      right: '四色定理只保证平面地图（画在平面上、边界不乱穿）4 种够用。随便一张图可能要更多，比如 5 个点两两相连就要 5 种。',
    },
  ],
  formalDefinition: (
    <>
      <p>
        <b>正常着色：</b>
        <span className="font-mono">对每条边 uv，都有 c(u) ≠ c(v)</span>
      </p>
      <p>
        <b>色数：</b>
        <span className="font-mono">χ(G) = 正常着色所需的最少颜色数</span>
      </p>
      <p>
        <b>下界：</b>
        <span className="font-mono">χ(G) ≥ 最大团的点数；也总有 χ(G) ≤ Δ(G) + 1</span>
        <span className="ml-1 text-xs text-slate-500 dark:text-slate-400">Δ 是最大度数</span>
      </p>
      <p>
        <b>四色定理：</b>
        <span className="font-mono">平面图的色数不超过 4</span>
      </p>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        三角形是三点的团，所以 χ ≥ 3；而三个点各给一色就够了，所以正好是 3。树没有环，两种颜色交替涂得开，χ ≤ 2。
      </p>
    </>
  ),
  glossary: [
    {
      term: '着色',
      plain: '给每个点分一个颜色。',
    },
    {
      term: '正常着色',
      plain: '有连线的两个点颜色不一样，也就是「相邻不同色」。',
      formal: '∀ uv ∈ E：c(u) ≠ c(v)',
    },
    {
      term: '色数 χ(G)',
      plain: '能正常着色所需的最少颜色数。',
      formal: 'χ(G) = min{ k | G 存在 k 种颜色的正常着色 }',
    },
    {
      term: '冲突边',
      plain: '两端涂了同一个颜色的那条线。看到它就说明还没涂好。',
    },
    {
      term: '团',
      plain: '一堆两两都相邻的点。团越大，需要的颜色越多。',
    },
    {
      term: '四色定理',
      plain: '平面地图用 4 种颜色一定够；而 3 种有时不够。',
      formal: '平面图的色数 ≤ 4',
    },
    {
      term: '贪心着色',
      plain: '从第一个点开始，每个点都挑一个「邻居没用过」的颜色。涂得快，但用的颜色数不一定最少。',
    },
  ],
  stages: [
    {
      label: '① 看一看',
      short: '看',
      narration: '6 块地。挨着不能同色，只给你 2 种颜色，能涂完吗？',
      requireSolve: true,
      hints: [
        '一块一块涂，注意别让挨着的两块一样。',
        '重点看中间那三块：中区既挨着西区，又挨着北区、东区、南区。',
        '涂不满。中区、北区、西区这三块两两都挨着（可以点「显示相邻关系」看到连线），它们必须用三种不同的颜色，所以 2 色不够。',
      ],
      render: (ctx) => <HookStage ctx={ctx} />,
    },
    {
      label: '② 玩一玩',
      short: '玩',
      narration: '现在给你 4 种颜色。用最少的颜色把这张 6 个点的图涂好。',
      requireSolve: true,
      hints: [
        '先找那三个两两相连的点，它们必须先占掉三种颜色。',
        '图里 A、B、C 三点两两相连。先把它们的冲突消掉，再看别的点能不能借用已经出现的颜色。',
        '一种解法：A 红、B 蓝、C 黄；D 只挨着 A 和 B，可以借 C 的黄；E 只挨着 C，借 A 的红；F 只挨着 D，借 B 的蓝。这样只用 3 种颜色。',
      ],
      render: (ctx) => <ExploreStage ctx={ctx} />,
    },
    {
      label: '③ 起个名',
      short: '名',
      narration: '刚才做的事叫「给图着色」，最少要用的颜色数叫「色数」。',
      requireSolve: true,
      hints: [
        '想一想：一个点只和它的邻居冲突，跟远处的点没关系。',
        '树没有环，一层一层交替涂就行；三角形是个三点两两相连的环，必须三色。',
        '三句话里第一、二句是对的（三角形要 3 色，路径要 2 色）；第三句错了：四色定理说的是平面地图 4 色一定够，不是任意图都只要 4 色。',
      ],
      render: (ctx) => <NameStage ctx={ctx} />,
    },
    {
      label: '④ 练一练',
      short: '练',
      narration: '三道题：三角形、一条路径、四色定理。',
      requireSolve: true,
      hints: [
        '每道题都先问：有没有两两都相邻的点？有没有环？',
        '两点相连就至少要 2 色；三点两两相连就至少要 3 色。',
        '答案依次是：三角形 3 种；一条路径 2 种；四色定理说的是平面地图 4 种一定够，而 3 种有时不够。',
      ],
      render: (ctx) => <PracticeStage ctx={ctx} />,
    },
    {
      label: '⑤ 换个场景',
      short: '变',
      narration: '换成排课表：有共同学生的两门课不能同一时段。先把冲突连成图。',
      requireSolve: true,
      hints: [
        '两门课只要有同一个学生，它们之间就要连一条线。',
        '先看小明：他上高数、线代、英语，所以这三门课两两都要连线；小红上高数、英语和体育。',
        '5 条线：高数—线代、高数—英语、高数—体育、线代—英语、英语—体育。连完之后点「给冲突图上色」，会看到 3 个时段就够了。',
      ],
      render: (ctx) => <TransferStage ctx={ctx} />,
    },
  ],
}

export default topic
