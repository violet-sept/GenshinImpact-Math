import { useState, type ReactNode } from 'react'

import { combinations, permutations } from '@/kernels/counting'
import { Btn, Callout, Card, PlainSpeak, SectionTitle, cx } from '@/ui'
import { Quiz } from '@/ui/Quiz'
import { useSolveOnce, useTriedSet } from '../hooks'
import type { StageCtx, Topic } from '../types'

/* ================================================================
   共用的「选择树」几何：四层台阶，每层都用同样的格子
   家 → 第一步的 2 个选择 → 第二步的 3 个选择 → 到底
   ================================================================ */

const NODE_W = 44
const NODE_H = 26
const TOP_Y = 26
const MID_Y = 128
const LEAF_Y = 198

const X_HOME = 294
const X_STEP1 = 228
const X_STEP2 = 134
const X_LEAF = 32

interface FlowNode {
  key: string
  label: string
  x: number
  y: number
}

const FLOW_NODES: FlowNode[] = [
  { key: 'home', label: '家', x: X_HOME, y: TOP_Y },
  { key: 'r1', label: '①小A', x: X_STEP1, y: MID_Y },
  { key: 'r2', label: '①小B', x: X_STEP1, y: MID_Y + 62 },
  { key: 'l1', label: '②小甲', x: X_STEP2, y: MID_Y - 62 },
  { key: 'l2', label: '②小乙', x: X_STEP2, y: MID_Y },
  { key: 'l3', label: '②小丙', x: X_STEP2, y: MID_Y + 62 },
  { key: 'd1', label: '到', x: X_LEAF, y: LEAF_Y },
  { key: 'd2', label: '到', x: X_LEAF, y: LEAF_Y + 62 },
  { key: 'd3', label: '到', x: X_LEAF, y: LEAF_Y + 124 },
]

const FLOW_POS: Record<string, { x: number; y: number }> = (() => {
  const out: Record<string, { x: number; y: number }> = {}
  for (const n of FLOW_NODES) out[n.key] = { x: n.x, y: n.y }
  return out
})()

interface FlowEdge {
  id: string
  from: string
  to: string
  step: 1 | 2
}

const FLOW_EDGES: FlowEdge[] = [
  { id: 'home-r1', from: 'home', to: 'r1', step: 1 },
  { id: 'home-r2', from: 'home', to: 'r2', step: 1 },
  { id: 'r1-l1', from: 'r1', to: 'l1', step: 2 },
  { id: 'r1-l2', from: 'r1', to: 'l2', step: 2 },
  { id: 'r1-l3', from: 'r1', to: 'l3', step: 2 },
  { id: 'r2-l1', from: 'r2', to: 'l1', step: 2 },
  { id: 'r2-l2', from: 'r2', to: 'l2', step: 2 },
  { id: 'r2-l3', from: 'r2', to: 'l3', step: 2 },
  { id: 'l1-d1', from: 'l1', to: 'd1', step: 2 },
  { id: 'l2-d2', from: 'l2', to: 'd2', step: 2 },
  { id: 'l3-d3', from: 'l3', to: 'd3', step: 2 },
]

const EDGE_BY_ID: Record<string, FlowEdge> = (() => {
  const out: Record<string, FlowEdge> = {}
  for (const e of FLOW_EDGES) out[e.id] = e
  return out
})()

interface RouteDef {
  id: string
  first: string
  second: string
  parts: string[]
}

const ROUTES: RouteDef[] = [
  { id: 'r1-l1', first: '小A', second: '小甲', parts: ['home-r1', 'r1-l1', 'l1-d1'] },
  { id: 'r1-l2', first: '小A', second: '小乙', parts: ['home-r1', 'r1-l2', 'l2-d2'] },
  { id: 'r1-l3', first: '小A', second: '小丙', parts: ['home-r1', 'r1-l3', 'l3-d3'] },
  { id: 'r2-l1', first: '小B', second: '小甲', parts: ['home-r2', 'r2-l1', 'l1-d1'] },
  { id: 'r2-l2', first: '小B', second: '小乙', parts: ['home-r2', 'r2-l2', 'l2-d2'] },
  { id: 'r2-l3', first: '小B', second: '小丙', parts: ['home-r2', 'r2-l3', 'l3-d3'] },
]

const FIRST_OPTIONS = ['小A', '小B'] as const
const SECOND_OPTIONS = ['小甲', '小乙', '小丙'] as const

/** 一条边的曲线路径；lane 把同起点的多条边扇开，避免叠在一起看不清 */
function edgePath(e: FlowEdge, lane: number, out: number): string {
  const a = FLOW_POS[e.from]
  const b = FLOW_POS[e.to]
  const y1 = e.from === 'home' ? a.y : a.y + NODE_H / 2
  const y2 = b.y - NODE_H / 2
  const sx = a.x - NODE_W / 2
  const ex = b.x + NODE_W / 2 + out
  const cx1 = sx - 30
  const cx2 = ex + 30
  const cy = (y1 + y2) / 2 + lane
  return `M ${sx} ${y1} C ${cx1} ${cy}, ${cx2} ${cy}, ${ex} ${y2}`
}

const LANE: Record<string, number> = {
  'home-r1': -30,
  'home-r2': 30,
  'r1-l1': -40,
  'r1-l2': -13,
  'r1-l3': 14,
  'r2-l1': -14,
  'r2-l2': 13,
  'r2-l3': 40,
  'l1-d1': 0,
  'l2-d2': 0,
  'l3-d3': 0,
}

const EDGE_COLOR: Record<1 | 2, string> = {
  1: 'var(--color-a-500)',
  2: 'var(--color-b-500)',
}

/* ================================================================ ① 看一看 */

function GuessStage({ ctx }: { ctx: StageCtx }) {
  const [picked, setPicked] = useState<number | null>(null)

  const wrongWhy: Record<number, string> = {
    2: '这是「学校的 2 条路」或者「图书馆的 3 条路」里的一个数字。它只数了其中一段路，没把两段路接起来。',
    3: '这是从学校到图书馆的 3 条路，只是整条路线的一半。到了学校还要再选一次路。',
    5: '5 是把 2 和 3 直接加起来得到的。可你并不是「去学校」或者「去图书馆」二选一 —— 你是两段都要走完。',
    6: '对，就是 6。',
    9: '9 是把 3 和 3 或者别的数字凑出来的。先别急着找规律，等会儿在树上一条一条走一遍，答案自己会冒出来。',
  }

  const pick = (n: number): void => {
    setPicked(n)
    if (n === 6) ctx.announce('先记下这个数。往下走，你会在树上亲手把它数出来。')
    else ctx.announce('先记下你自己的答案。往下走，我们在树上一条一条走一遍。')
  }

  useSolveOnce(ctx, picked !== null)

  return (
    <div className="flex flex-col gap-3">
      <PlainSpeak>
        从家到学校有 <b>2</b> 条路，从学校到图书馆有 <b>3</b> 条路。
        从家出发，先经过学校，再到图书馆，一共几种走法？
      </PlainSpeak>

      <Card>
        <SectionTitle hint="凭感觉选一个，选完我们再去数">先猜一个</SectionTitle>
        <div className="flex flex-wrap gap-2">
          {[2, 3, 5, 6, 9].map((n) => (
            <button
              key={n}
              type="button"
              aria-pressed={picked === n}
              aria-label={`我猜答案是 ${n} 种`}
              onClick={() => pick(n)}
              className={cx(
                'min-h-11 min-w-14 rounded-xl border px-4 font-mono text-lg font-bold dl-transition',
                picked === n
                  ? n === 6
                    ? 'border-ok-500 bg-ok-50 text-ok-700 dark:bg-ok-500/15 dark:text-ok-500'
                    : 'border-bad-500 bg-bad-50 text-bad-700 dark:bg-bad-500/15 dark:text-bad-500'
                  : 'border-slate-300 bg-white text-slate-700 hover:border-a-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200',
              )}
            >
              {n}
            </button>
          ))}
        </div>

        {picked !== null ? (
          <div className="mt-3">
            <Callout tone={picked === 6 ? 'ok' : 'cur'} role="status">
              {wrongWhy[picked]} 先往下走，在树上亲手数一遍 —— 数完再回来看你猜得对不对。
            </Callout>
          </div>
        ) : (
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
            选一个数就好，猜错不扣分。下一步会给你一棵树，让你一条路一条路走。
          </p>
        )}
      </Card>
    </div>
  )
}

/* ================================================================ ② 玩一玩 */

function TreeBoard({
  activeIds,
  onPick,
  ariaLabel,
}: {
  activeIds: string[]
  onPick: (routeId: string) => void
  ariaLabel: string
}) {
  return (
    <svg
      viewBox="0 0 340 380"
      width="100%"
      role="img"
      aria-label={ariaLabel}
      className="h-auto w-full touch-none select-none"
    >
      {FLOW_EDGES.map((e) => (
        <path
          key={e.id}
          d={edgePath(e, LANE[e.id] ?? 0, 0)}
          fill="none"
          stroke={EDGE_COLOR[e.step]}
          strokeWidth={2}
          opacity={0.55}
        />
      ))}

      {ROUTES.map((r) =>
        activeIds.includes(r.id)
          ? r.parts.map((part) => {
              const e = EDGE_BY_ID[part]
              return (
                <path
                  key={`hi-${r.id}-${part}`}
                  d={edgePath(e, LANE[part] ?? 0, 4)}
                  fill="none"
                  stroke="var(--color-cur-500)"
                  strokeWidth={5}
                  strokeLinecap="round"
                />
              )
            })
          : null,
      )}

      {ROUTES.map((r) =>
        r.parts.map((part) => {
          const e = EDGE_BY_ID[part]
          return (
            <path
              key={`hit-${r.id}-${part}`}
              d={edgePath(e, LANE[part] ?? 0, 0)}
              fill="none"
              stroke="transparent"
              strokeWidth={18}
              style={{ cursor: 'pointer' }}
              tabIndex={0}
              role="button"
              aria-label={`走法：先走${r.first}，再走${r.second}`}
              onClick={() => onPick(r.id)}
              onKeyDown={(ev) => {
                if (ev.key === 'Enter' || ev.key === ' ') {
                  ev.preventDefault()
                  onPick(r.id)
                }
              }}
            />
          )
        }),
      )}

      {FLOW_NODES.map((n) => (
        <g key={n.key}>
          <rect
            x={n.x - NODE_W / 2}
            y={n.y - NODE_H / 2}
            width={NODE_W}
            height={NODE_H}
            rx={9}
            fill="white"
            stroke="var(--color-dim-500)"
            strokeWidth={1.5}
          />
          <text
            x={n.x}
            y={n.y + 4}
            textAnchor="middle"
            className="dl-svg-text"
            fill="var(--color-slate-700)"
            fontSize={12}
          >
            {n.label}
          </text>
        </g>
      ))}
    </svg>
  )
}

function ExploreStage({ ctx }: { ctx: StageCtx }) {
  const { tried, markTried } = useTriedSet()
  const [active, setActive] = useState<string[]>([])
  const [last, setLast] = useState<string | null>(null)

  const pick = (routeId: string): void => {
    const r = ROUTES.find((x) => x.id === routeId)!
    const first = !tried.has(routeId)
    markTried(routeId)
    setLast(routeId)
    setActive((prev) => (prev.includes(routeId) ? prev.filter((x) => x !== routeId) : [...prev, routeId]))
    ctx.announce(
      first
        ? `新的一种走法：先走${r.first}，再走${r.second}。`
        : `又点了一次「先${r.first}，再${r.second}」——这一种已经记过了。`,
    )
  }

  const all = tried.size >= ROUTES.length

  useSolveOnce(ctx, all)

  return (
    <div className="flex flex-col gap-3">
      <PlainSpeak>
        这棵树就是你的全部走法。左边先点第一步，再点第二步 —— 每点亮一条完整路线，
        它就变粗变亮，并被记一笔。
      </PlainSpeak>

      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_15rem]">
        <div className="rounded-xl bg-slate-50 p-2 dark:bg-slate-800/40">
          <TreeBoard
            activeIds={active}
            onPick={pick}
            ariaLabel="从家到学校再到图书馆的选择树，点亮其中一条完整路线即可记录一种走法"
          />
          <p className="px-1 pb-1 text-xs text-slate-500 dark:text-slate-400">
            键盘：用 Tab 走到某条路线，按 Enter 点亮它。
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <Card className="p-3">
            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold text-a-700 dark:text-a-300">第一步：家 → 学校</span>
              <div className="flex flex-wrap gap-2">
                {FIRST_OPTIONS.map((f) => (
                  <button
                    key={f}
                    type="button"
                    aria-label={`第一步走${f}`}
                    className="min-h-11 rounded-xl border border-a-300 bg-a-50 px-3 text-sm font-medium text-a-700 dark:border-a-500/40 dark:bg-a-500/10 dark:text-a-300"
                    onClick={() => {
                      const target = ROUTES.find((r) => r.first === f)!
                      pick(target.id)
                    }}
                  >
                    {f}
                  </button>
                ))}
              </div>
              <span className="text-xs font-semibold text-b-700 dark:text-b-300">第二步：学校 → 图书馆</span>
              <div className="flex flex-wrap gap-2">
                {SECOND_OPTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    aria-label={`第二步走${s}`}
                    className="min-h-11 rounded-xl border border-b-300 bg-b-50 px-3 text-sm font-medium text-b-700 dark:border-b-500/40 dark:bg-b-500/10 dark:text-b-300"
                    onClick={() => {
                      const target = ROUTES.find((r) => r.second === s)!
                      pick(target.id)
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                上面两个按钮是「第一步的选择」，下面三个是「第二步的选择」。点树上任意一段路也算数。
              </p>
            </div>
          </Card>

          <Card className="p-3">
            <div className="font-mono text-sm text-slate-700 dark:text-slate-200">
              已找到的走法数：{tried.size} / {ROUTES.length}
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {ROUTES.map((r) => (
                <span
                  key={r.id}
                  className={cx(
                    'rounded-lg border px-2 py-0.5 text-xs font-mono',
                    tried.has(r.id)
                      ? 'border-ok-500 bg-ok-50 text-ok-700 dark:bg-ok-500/10 dark:text-ok-500'
                      : 'border-slate-200 text-slate-400 dark:border-slate-700 dark:text-slate-500',
                  )}
                >
                  {tried.has(r.id) ? `${r.first}→${r.second}` : '?→?'}
                </span>
              ))}
            </div>
          </Card>

          <Callout tone={all ? 'ok' : 'cur'} role="status">
            {all
              ? '六条都走到了。2 条 × 3 条 = 6 条 —— 每个「第一步」都配上 3 个「第二步」。'
              : last
                ? `刚才走的是「先${ROUTES.find((r) => r.id === last)!.first}，再${ROUTES.find((r) => r.id === last)!.second}」。继续，把别的也走一遍。`
                : '还没走出一条完整路线。点树上的任意一段，或者点右边的按钮。'}
          </Callout>
        </div>
      </div>
    </div>
  )
}

/* ================================================================ ③ 起个名 */

function NameStage({ ctx }: { ctx: StageCtx }) {
  const [revealed, setRevealed] = useState(false)
  const [picked, setPicked] = useState<string | null>(null)

  const pick = (id: string): void => {
    setPicked(id)
    if (id === 'b') ctx.announce('对。3 + 2 是「分类相加」的数字，不是「分步」的数字。')
    else if (id === 'c') ctx.announce('这一句里两个动作都要做，是分步，该用乘法。')
    else ctx.announce('再把这四个字读一遍：分类相加、分步相乘。')
  }

  const threeCards: { id: string; word: string; text: ReactNode; why: string }[] = [
    {
      id: 'a',
      word: '分步 → 相乘',
      text: (
        <>
          先到学校、<b>再</b>到图书馆，两个动作都做完才算一条完整走法。
        </>
      ),
      why: '对。分步做的事，每一步都有几种选法，乘起来就是全部走法。',
    },
    {
      id: 'b',
      word: '分类 → 相加',
      text: (
        <>
          从家到学校，可以走大路或者走小路，<b>只用走其中一条</b>。
        </>
      ),
      why: '对。分类是把互不重叠的几种情况加起来，走大路和走小路不会同时发生。',
    },
    {
      id: 'c',
      word: '分步 → 相加',
      text: (
        <>
          先穿衣服、<b>再</b>穿鞋，两个都要做。
        </>
      ),
      why: '不对。两个都做 = 分步，分步要用乘法。用加法等于说「穿衣服和穿鞋只要做一件」。',
    },
  ]

  useSolveOnce(ctx, picked !== null)

  return (
    <div className="flex flex-col gap-4">
      <PlainSpeak>
        你刚才做的事，只有两句话：<b>分类用加法，分步用乘法</b>。
        「或者」用加法，「然后」用乘法。
      </PlainSpeak>

      <Card>
        <SectionTitle hint="点一下，看你有没有分清">下面这两句话，该用加法还是乘法？</SectionTitle>
        <ul className="flex flex-col gap-2">
          {[
            ['从甲地到乙地，可以坐 3 趟火车，或者坐 2 趟飞机。一共有几种去法？', '加法：3 + 2 = 5'],
            ['从甲地到乙地，先坐大巴（4 种），再从乙地转高铁（5 种）。一共有几种走法？', '乘法：4 × 5 = 20'],
          ].map(([q, a]) => (
            <li key={q} className="text-sm text-slate-700 dark:text-slate-200">
              <p>{q}</p>
              <p className="mt-0.5 font-mono text-xs text-ok-700 dark:text-ok-500">{a}</p>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          看关键词：「或者」是分类，「然后 / 再」是分步。
        </p>
      </Card>

      <Card>
        <SectionTitle hint="点一张卡，会告诉你对不对">把走法归类</SectionTitle>
        <div className="grid gap-2 sm:grid-cols-3">
          {threeCards.map((c) => (
            <button
              key={c.id}
              type="button"
              aria-pressed={picked === c.id}
              aria-label={`这张卡说的是：${c.word}`}
              onClick={() => pick(c.id)}
              className={cx(
                'flex min-h-11 flex-col gap-1.5 rounded-xl border p-3 text-left text-sm dl-transition',
                picked === c.id
                  ? c.id === 'c'
                    ? 'border-bad-500 bg-bad-50 dark:bg-bad-500/10'
                    : 'border-ok-500 bg-ok-50 dark:bg-ok-500/10'
                  : 'border-slate-200 bg-white hover:border-a-500 dark:border-slate-700 dark:bg-slate-900',
              )}
            >
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">这一张</span>
              <span className="text-slate-700 dark:text-slate-200">{c.text}</span>
            </button>
          ))}
        </div>
        {picked ? (
          <div className="mt-3">
            <Callout tone={picked === 'c' ? 'bad' : 'ok'} role="status">
              {threeCards.find((c) => c.id === picked)!.why}
            </Callout>
          </div>
        ) : null}
      </Card>

      <Card>
        <SectionTitle>两条公式</SectionTitle>
        <div className="flex flex-col gap-2 text-sm">
          <p className="text-slate-700 dark:text-slate-200">
            <b>分步（乘法原理）：</b>第一步有 <span className="font-mono">m</span> 种，第二步有{' '}
            <span className="font-mono">n</span> 种，两步都要做完，一共 <span className="font-mono">m × n</span> 种。
          </p>
          <p className="text-slate-700 dark:text-slate-200">
            <b>分类（加法原理）：</b>几类做法互不重叠，做其中任意一类就够了，一共把它们加起来。
          </p>
          <p className="font-mono text-sm text-slate-700 dark:text-slate-200">
            |A × B| = |A| · |B|
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            这条式子读作：把两个集合的所有搭配都列出来（这叫笛卡尔积），搭配的个数就是两边个数的乘积。
            我们这一关就是 2 × 3 = 6。
          </p>
        </div>
      </Card>

      <Card>
        <SectionTitle hint="顺手验算一下，看看乘法原理和组合数对不对得上">顺手验算</SectionTitle>
        <p className="text-sm text-slate-700 dark:text-slate-200">
          从 4 样东西里挑 2 样，不管顺序，一共有 <span className="font-mono">C(4, 2)</span> 种。
          点一下，看它和你数的 6 对不对得上。
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <Btn variant="outline" size="sm" aria-label="显示组合数的计算过程" onClick={() => setRevealed(true)}>
            算给我看
          </Btn>
          {revealed ? (
            <span className="font-mono text-sm text-slate-700 dark:text-slate-200">
              C(4, 2) = {combinations(4, 2)}
            </span>
          ) : null}
        </div>
        {revealed ? (
          <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">
            挑东西时顺序不算数，所以 4 × 3 = 12 要走两趟，除以 2 得 6 —— 和你在树上数出来的 6 一样。
          </p>
        ) : null}
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
        三道题。选错了会告诉你为什么错，可以马上再选。
      </p>

      <Card>
        <Quiz
          question={<>从甲地到乙地，可以坐 3 趟火车，也可以坐 2 趟飞机。一共有几种去法？</>}
          resetKey="c1-p1"
          onSolved={() => setSolvedCount((c) => c + 1)}
          choices={[
            {
              id: 'a',
              label: '3 + 2 = 5 种',
              correct: true,
              why: '对。火车和飞机是两类互不重叠的方式，你只坐其中一种就到了 —— 分类用加法。',
            },
            {
              id: 'b',
              label: '3 × 2 = 6 种',
              correct: false,
              why: '不对。乘法要用在「先……再……」的分步里。这里你不需要先坐火车再坐飞机，只选一样就够。',
            },
            {
              id: 'c',
              label: '6 − 5 = 1 种',
              correct: false,
              why: '不对。两种方式加起来只会变多，不会相减。相减要用在「重叠的部分要去掉」的场合。',
            },
          ]}
        />
      </Card>

      <Card>
        <Quiz
          question={<>从甲地到乙地有 4 条路，从乙地到丙地有 5 条路。从甲地经乙地到丙地，有几种走法？</>}
          resetKey="c1-p2"
          onSolved={() => setSolvedCount((c) => c + 1)}
          choices={[
            {
              id: 'a',
              label: '4 × 5 = 20 种',
              correct: true,
              why: '对。先到乙地、再到丙地，两段都要走完 —— 分步用乘法。第一步 4 种，每一种后面都配 5 种。',
            },
            {
              id: 'b',
              label: '4 + 5 = 9 种',
              correct: false,
              why: '不对。加法用在「只走一段就够」的分类里。这里你两段都要走，所以要用乘法。',
            },
            {
              id: 'c',
              label: '5 − 4 = 1 种',
              correct: false,
              why: '不对。多条路不会互相抵消，只会互相搭配。',
            },
          ]}
        />
      </Card>

      <Card>
        <Quiz
          question={<>从甲地到乙地有 3 趟火车，从乙地到丙地有 3 趟汽车。「甲→乙→丙」的走法有几种？</>}
          resetKey="c1-p3"
          onSolved={() => setSolvedCount((c) => c + 1)}
          choices={[
            {
              id: 'a',
              label: '3 × 3 = 9 种',
              correct: true,
              why: '对。两段都要走完，就是分步：3 × 3 = 9。火车和汽车各有各的 3 种，互相搭配。',
            },
            {
              id: 'b',
              label: '3 + 3 = 6 种',
              correct: false,
              why: '不对。3 + 3 的意思是「只坐火车或者只坐汽车」。可你两段都要坐，不能这么加。',
            },
            {
              id: 'c',
              label: '3 种',
              correct: false,
              why: '不对。3 只是其中一段的选择数。另一段也有 3 种，两边要乘起来。',
            },
          ]}
        />
      </Card>
    </div>
  )
}

/* ================================================================ ⑤ 换个场景 */

const TOPS = ['黄上衣', '蓝上衣', '白上衣']
const PANTS = ['牛仔裤', '运动裤', '短裤', '长裙']
const SHOES = ['球鞋', '凉鞋']
const PAIR_LIMIT = 4

function TransferStage({ ctx }: { ctx: StageCtx }) {
  const [ti, setTi] = useState(0)
  const [pi, setPi] = useState(0)
  const [withShoes, setWithShoes] = useState(false)
  const [si, setSi] = useState(0)
  const [tried, setTried] = useState<Set<string>>(() => new Set())
  const [practiceDone, setPracticeDone] = useState(false)

  const totalFull = TOPS.length * PANTS.length
  const key = `${TOPS[ti]}+${PANTS[pi]}`

  const record = (): void => {
    setTried((prev) => (prev.has(key) ? prev : new Set(prev).add(key)))
    ctx.announce(`记下一套：${TOPS[ti]} + ${PANTS[pi]}。`)
  }

  const enoughPairs = tried.size >= PAIR_LIMIT
  const solved = withShoes && enoughPairs && practiceDone

  useSolveOnce(ctx, solved)

  const completed = totalFull * SHOES.length

  return (
    <div className="flex flex-col gap-3">
      <PlainSpeak>
        3 件上衣、4 条裤子。先随便配出几套（不用全配），再打开「加上鞋子」，看总数变成多少。
      </PlainSpeak>

      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_15rem]">
        <Card className="flex flex-col gap-3">
          <div className="rounded-xl bg-slate-100 px-3 py-4 text-center dark:bg-slate-800/60">
            <div className="font-mono text-lg font-bold text-slate-800 dark:text-slate-100">
              {TOPS[ti]} ＋ {PANTS[pi]}
              {withShoes ? ` ＋ ${SHOES[si]}` : ''}
            </div>
            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {withShoes ? '第三步：鞋子有 2 种' : '现在只配上衣和裤子，第一步 3 种、第二步 4 种'}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Btn
              variant="outline"
              size="sm"
              aria-label="换下一件上衣"
              onClick={() => setTi((v) => (v + 1) % TOPS.length)}
            >
              换上衣（3 种）
            </Btn>
            <Btn
              variant="outline"
              size="sm"
              aria-label="换下一条裤子"
              onClick={() => setPi((v) => (v + 1) % PANTS.length)}
            >
              换裤子（4 种）
            </Btn>
            <Btn
              variant="outline"
              size="sm"
              aria-label={withShoes ? '去掉鞋子这一步' : '再加上鞋子'}
              onClick={() => {
                setWithShoes((v) => !v)
                ctx.announce(withShoes ? '把鞋子这一步去掉了。' : '加上鞋子这一步，又多了一次选择。')
              }}
            >
              {withShoes ? '去掉鞋子' : '再加上鞋子'}
            </Btn>
            {withShoes ? (
              <Btn
                variant="outline"
                size="sm"
                aria-label="换一双鞋"
                onClick={() => setSi((v) => (v + 1) % SHOES.length)}
              >
                换鞋（2 种）
              </Btn>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Btn variant="primary" size="sm" aria-label="把这一套记下来" onClick={record}>
              就这套，记下来
            </Btn>
            <span className="font-mono text-sm text-slate-600 dark:text-slate-300">
              已经配过 {tried.size} 套
            </span>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {TOPS.flatMap((t) => PANTS.map((p) => `${t}+${p}`)).map((k) => (
              <span
                key={k}
                className={cx(
                  'rounded-lg border px-2 py-0.5 font-mono text-xs',
                  tried.has(k)
                    ? 'border-ok-500 bg-ok-50 text-ok-700 dark:bg-ok-500/10 dark:text-ok-500'
                    : 'border-slate-200 text-slate-400 dark:border-slate-700 dark:text-slate-500',
                )}
              >
                {tried.has(k) ? k : '?＋?'}
              </span>
            ))}
          </div>
        </Card>

        <div className="flex flex-col gap-2">
          <Card className="p-3">
            <div className="flex flex-col gap-1.5 font-mono text-sm text-slate-700 dark:text-slate-200">
              <div>上衣 × 裤子 = {TOPS.length} × {PANTS.length} = {totalFull}</div>
              <div className={withShoes ? '' : 'text-slate-400 dark:text-slate-500'}>
                再加鞋子 = {totalFull} × {SHOES.length} = {completed}
              </div>
            </div>
          </Card>

          <Callout tone={solved ? 'ok' : 'cur'} role="status">
            {solved
              ? `一共 ${completed} 套。每多一步就多乘一次，所以是从 3 × 4 = 12 变成 3 × 4 × 2 = 24。`
              : !enoughPairs
                ? `先随便配出 ${PAIR_LIMIT} 套（点「就这套，记下来」），不用全配完。`
                : !withShoes
                  ? '现在打开「再加上鞋子」这一步，看看总数会怎么变。'
                  : '还差最后一题，做完就算通关。'}
          </Callout>

          <Callout tone="info" title="顺便验算">
            <span className="font-mono">
              3 × {permutations(4, 1)} = {TOPS.length * PANTS.length}
            </span>
            {' '}—— 每一件上衣都配上 4 条裤子，一共 12 套。再加上 2 双鞋，就是 {totalFull} × {SHOES.length} = {completed} 套。
          </Callout>
        </div>
      </div>

      <Card>
        <Quiz
          question={<>有 5 件上衣和 3 条裤子，能配出几套？</>}
          resetKey="c1-t1"
          onSolved={() => setPracticeDone(true)}
          choices={[
            {
              id: 'a',
              label: '5 × 3 = 15 套',
              correct: true,
              why: '对。先挑上衣（5 种），再挑裤子（3 种），两件都要穿 —— 分步用乘法。',
            },
            {
              id: 'b',
              label: '5 + 3 = 8 套',
              correct: false,
              why: '不对。加法会变成「只穿上衣或者只穿裤子」。一套衣服必须两件都有，所以要用乘法。',
            },
            {
              id: 'c',
              label: '5³ = 125 套',
              correct: false,
              why: '不对。125 是「每件上衣都可以配 5 条裤子」才会有的数。裤子只有 3 条。',
            },
          ]}
        />
      </Card>
    </div>
  )
}

/* ================================================================ 导出 */

const topic: Topic = {
  id: 'C1',
  title: '加法与乘法原理',
  moduleId: 'counting',
  oneLiner: '「分类」用加法，「分步」用乘法',
  outcome: '你能一眼看出什么该加、什么该乘，并用乘法原理算出「搭配类」问题的总数。',
  prerequisites: [],
  bigIdea: '几个选择要是「只用挑一个」（分类），就把数目加起来；几个选择要是「全都要做完」（分步），就把数目乘起来。',
  misconceptions: [
    {
      wrong: '只要题目里出现好几个数字，就该把它们乘起来',
      right: '先看这些选择是「或者」还是「然后」。从甲地坐火车或者坐飞机，是分类，要加；先到乙地再到丙地，是分步，要乘。',
    },
    {
      wrong: '分步计数就是把每一步的数目加起来',
      right: '分步要乘。第一步有 2 种、第二步有 3 种，那么第一步的每一种后面都接着 3 种，一共 2 × 3 = 6 种，不是 5 种。',
    },
    {
      wrong: '搭配的数目跟顺序有关，所以还要再乘一次',
      right: '上衣配裤子是「一件上衣加一条裤子」，换个先后还是同一套，顺序不算数。只有当顺序真的产生不同结果（比如排列、排队）时，才需要额外考虑顺序。',
    },
  ],
  formalDefinition: (
    <>
      <p>
        <b>加法原理（分类计数）：</b>
        <span className="font-mono">若 A ∩ B = ∅，则 |A ∪ B| = |A| + |B|</span>
      </p>
      <p>
        <b>乘法原理（分步计数）：</b>
        <span className="font-mono">|A × B| = |A| · |B|</span>
      </p>
      <p>
        <b>笛卡尔积：</b>
        <span className="font-mono">A × B = {'{ (a, b) | a ∈ A, b ∈ B }'}</span>
      </p>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        第一条要求「几类做法互不重叠」，否则重叠的部分会被算两次，需要先把重叠减掉。
      </p>
    </>
  ),
  glossary: [
    {
      term: '加法原理（分类）',
      plain: '几类做法里挑一类做就够了，把每类的数目加起来。',
      formal: 'A ∩ B = ∅ 时，|A ∪ B| = |A| + |B|',
    },
    {
      term: '乘法原理（分步）',
      plain: '几步都做完才算一种结果，把每一步的数目乘起来。',
      formal: '|A × B| = |A| · |B|',
    },
    {
      term: '分类',
      plain: '互相不重叠的几种情况，你只走其中一种。看到「或者」就是这个。',
    },
    {
      term: '分步',
      plain: '一件接一件都要做。看到「先……再……」就是这个。',
    },
    {
      term: '笛卡尔积',
      plain: '把所有搭配两两列出来得到的东西。搭配的个数就是两边个数的乘积。',
      formal: 'A × B = { (a, b) | a ∈ A, b ∈ B }',
    },
    {
      term: '互斥',
      plain: '两件事不可能同时发生。只有互斥的几类才能直接相加。',
    },
  ],
  stages: [
    {
      label: '① 看一看',
      short: '看',
      narration: '两个数字摆在这儿：2 条路、3 条路。先猜一共几种走法。',
      requireSolve: true,
      hints: [
        '先别算，凭感觉选一个数就好。',
        '注意：5 是硬把 2 和 3 加起来的，可你两段路都要走完。',
        '真正的答案是 6。不过先别急着信，下一步在树上亲手数一遍。',
      ],
      render: (ctx) => <GuessStage ctx={ctx} />,
    },
    {
      label: '② 玩一玩',
      short: '玩',
      narration: '这棵树画出了全部走法。一条一条走，走满六条再回头看看规律。',
      requireSolve: true,
      hints: [
        '从树的左边「家」出发，一段一段往下走，每走通一条完整路线就记下一种走法。',
        '第一步有 2 个岔口，每个岔口下面又各有 3 条路 —— 先把这两组都点一遍。',
        '六条走法是：小A小甲、小A小乙、小A小丙、小B小甲、小B小乙、小B小丙。全点完后你会看到 2 × 3 = 6。',
      ],
      render: (ctx) => <ExploreStage ctx={ctx} />,
    },
    {
      label: '③ 起个名',
      short: '名',
      narration: '刚才你不知不觉用了两条规则。现在给它们起名字：分类相加、分步相乘。',
      requireSolve: true,
      hints: [
        '先判断这句话里的几件事，是「只用挑一件」还是「全都要做」。',
        '看见「或者」就想加法，看见「然后 / 再」就想乘法。',
        '两条公式是：分类相加（互不重叠时直接加）；分步相乘 |A × B| = |A| · |B|。点最右边那张「分步 → 相加」的卡，它会告诉你为什么错。',
      ],
      render: (ctx) => <NameStage ctx={ctx} />,
    },
    {
      label: '④ 练一练',
      short: '练',
      narration: '三道题。第一道全是加法，后两道是分步乘法，注意别加错。',
      requireSolve: true,
      hints: [
        '每道题先问自己一句：这些选择是「或者」还是「然后」。',
        '3 趟火车和 2 趟飞机是「或者」，用加法；甲→乙→丙是「然后」，用乘法。',
        '三道题的答案依次是：3 + 2 = 5 种；4 × 5 = 20 种；3 × 3 = 9 种。',
      ],
      render: (ctx) => <PracticeStage ctx={ctx} />,
    },
    {
      label: '⑤ 换个场景',
      short: '变',
      narration: '换成穿衣服：3 件上衣、4 条裤子，能配出几套？',
      requireSolve: true,
      hints: [
        '每一件上衣都能配上每一条裤子，这就是「都要做」的分步。',
        '先只算上衣和裤子：3 × 4。然后打开「再加上鞋子」，看要不要再乘一次。',
        '3 × 4 = 12 套。加上 2 双鞋，每一套衣服都还能选鞋，所以 12 × 2 = 24 套。最后那题的答案是 5 × 3 = 15 套。',
      ],
      render: (ctx) => <TransferStage ctx={ctx} />,
    },
  ],
}

export default topic
