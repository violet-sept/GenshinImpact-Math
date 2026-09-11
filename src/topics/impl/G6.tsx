import { useCallback, useEffect, useRef, useState } from 'react'

import { GraphView } from '@/primitives'
import { Btn, Callout, Card, Chip, PlainSpeak, SectionTitle, StepControls, cx } from '@/ui'
import { Quiz } from '@/ui/Quiz'
import {
  adjacencyList,
  degrees,
  kruskal,
  makeGraph,
  nodesOf,
  sortedEdges,
  wouldFormCycle,
  type GEdge,
  type Graph,
  type KruskalState,
} from '@/kernels/graph'
import { circleLayout, type Positions } from '@/kernels/layout'
import { useStepper } from '@/platform/useStepper'
import { useSolveOnce } from '../hooks'
import type { StageCtx, Topic } from '../types'

/* ============================================================== 三座城市（① 用） */

const HOOK_NODES = ['甲', '乙', '丙']
const HOOK_RAW: [string, string, number][] = [
  ['甲', '乙', 5],
  ['甲', '丙', 9],
  ['乙', '丙', 4],
]
const HOOK_GRAPH: Graph = makeGraph(HOOK_NODES, HOOK_RAW)
const HOOK_POS: Positions = circleLayout(HOOK_NODES, 170, 150, 92)
const HOOK_WEIGHT: Record<string, string> = Object.fromEntries(HOOK_GRAPH.edges.map((e) => [e.id, String(e.w)]))

/* ============================================================== 六个城市（②③⑤ 用） */

const NODES = ['A', 'B', 'C', 'D', 'E', 'F']
const RAW: [string, string, number][] = [
  ['A', 'B', 1],
  ['D', 'E', 2],
  ['B', 'C', 3],
  ['A', 'C', 4],
  ['C', 'D', 5],
  ['B', 'D', 6],
  ['E', 'F', 7],
  ['C', 'F', 8],
  ['A', 'F', 9],
]
const GRAPH: Graph = makeGraph(NODES, RAW)
const NODE_COUNT = nodesOf(GRAPH).length
const POS: Positions = circleLayout(NODES, 170, 150, 105)
/** 所有边按权重从小到大排好队 —— 这正是 Kruskal 的第一步 */
const QUEUE = sortedEdges(GRAPH)
const WEIGHT_LABEL: Record<string, string> = Object.fromEntries(GRAPH.edges.map((e) => [e.id, String(e.w)]))
const KRUSKAL_STEPS = kruskal(GRAPH)
const OPTIMAL = KRUSKAL_STEPS[KRUSKAL_STEPS.length - 1].snapshot

/**
 * ② 里用户亲手收下的边。
 *
 * 存在模块级而不是 React state，是因为 ⑤ 是另一个组件 —— 切步骤时 ② 会被卸载，
 * 用户的成绩不能跟着一起没掉。（Kruskal 的收边顺序是确定的，所以这份记录不会来回变。）
 */
let manualRun: { count: number; weight: number } | null = null

/* ============================================================== 小工具（都建立在图内核之上） */

/** 节点角标：没连边时每个点自己一片，收一条边就是把两片并成一片 */
function regionLabels(nodes: string[], edges: GEdge[]): Record<string, string> {
  const adj = adjacencyList({ nodes, edges })
  const label: Record<string, string> = {}
  let idx = 0
  for (const n of nodes) {
    if (label[n] !== undefined) continue
    idx += 1
    label[n] = String(idx)
    const queue: string[] = [n]
    while (queue.length > 0) {
      const v = queue.shift() as string
      for (const w of adj[v] ?? []) {
        if (label[w] === undefined) {
          label[w] = String(idx)
          queue.push(w)
        }
      }
    }
  }
  return label
}

/** 在「已经收下的边」里，从 from 走到 to 的一条路 —— 用来把「为什么成环」讲成人话 */
function pathIn(adj: Record<string, string[]>, from: string, to: string): string[] {
  const prev = new Map<string, string | null>([[from, null]])
  const queue: string[] = [from]
  while (queue.length > 0) {
    const v = queue.shift() as string
    if (v === to) break
    for (const w of adj[v] ?? []) {
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
    const p = prev.get(cur)
    cur = p === undefined ? null : p
  }
  return out
}

/** 被拒绝的那条边闪一下橙色（画在 GraphView 的 overlay 槽里，压在节点下面） */
function EdgeFlash({ edgeId }: { edgeId: string | null }) {
  if (!edgeId) return null
  const e = GRAPH.edges.find((x) => x.id === edgeId)
  if (!e) return null
  const a = POS[e.u]
  const b = POS[e.v]
  return (
    <line
      x1={a.x}
      y1={a.y}
      x2={b.x}
      y2={b.y}
      stroke="var(--color-bad-500)"
      strokeWidth={10}
      strokeLinecap="round"
      opacity={0.75}
      className="animate-pulse"
    />
  )
}

/* ============================================================== ① 看一看 */

interface HookEval {
  count: number
  total: number
  connected: boolean
  regions: number
  solved: boolean
  text: string
  tone: 'normal' | 'reject' | 'accept'
}

function evaluateHook(ids: string[]): HookEval {
  const chosen = HOOK_GRAPH.edges.filter((e) => ids.includes(e.id))
  const total = chosen.reduce((s, e) => s + e.w, 0)
  const regions = new Set(Object.values(regionLabels(HOOK_NODES, chosen))).size
  const connected = regions === 1
  const solved = connected && total <= 9

  let text: string
  if (chosen.length === 0) {
    text = '点一条边，就是在这两个城市之间铺一根网线。'
  } else if (!connected) {
    text = `还没连成一片：现在分成 ${regions} 片。至少得铺 ${HOOK_NODES.length - 1} 根线。`
  } else if (!solved) {
    text =
      chosen.length > HOOK_NODES.length - 1
        ? `连是连上了，可你铺了 ${chosen.length} 根线，花了 ${total}。路线绕成了一个圈 —— 圈上那条线其实白铺了。`
        : `连是连上了，但花了 ${total}，而最省只要 9。换一根更便宜的线试试。`
  } else {
    text = `成了！一共 ${total}。三个城市全连通，一根线都没多 —— 这就是「最省」。`
  }

  return { count: chosen.length, total, connected, regions, solved, text, tone: solved ? 'accept' : connected ? 'reject' : 'normal' }
}

function HookStage({ ctx }: { ctx: StageCtx }) {
  const [picked, setPicked] = useState<string[]>([])
  const info = evaluateHook(picked)

  const toggle = (id: string): void => {
    const next = picked.includes(id) ? picked.filter((x) => x !== id) : [...picked, id]
    setPicked(next)
    const e = HOOK_GRAPH.edges.find((x) => x.id === id)
    const after = evaluateHook(next)
    ctx.say(after.text, after.tone)
    if (e) {
      const verb = picked.includes(id) ? '撤掉' : '铺上'
      ctx.announce(`${verb} ${e.u}到${e.v} 这根线，权重 ${e.w}。${after.text}`)
    }
  }

  useSolveOnce(ctx, info.solved)

  return (
    <div className="flex flex-col gap-3">
      <PlainSpeak>
        甲、乙、丙三个城市要通网。图上每条边是一段可以铺的网线，边上的数字是<b>要花的钱</b>。
        点边就铺，再点一下撤掉。目标：<b>三个城市都能互相通到，而且花的钱最少</b>。
      </PlainSpeak>

      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_15rem]">
        <div className="rounded-xl bg-slate-50 p-2 dark:bg-slate-800/40">
          <GraphView
            graph={HOOK_GRAPH}
            positions={HOOK_POS}
            highlightEdges={picked}
            pendingEdges={HOOK_GRAPH.edges.filter((e) => !picked.includes(e.id)).map((e) => e.id)}
            edgeLabels={HOOK_WEIGHT}
            onEdgeClick={toggle}
            ariaLabel="三个城市之间可铺的网线，点一条边就铺上，再点一下撤掉"
            keyboardHint="用 Tab 选中一条边，按 Enter 铺上或撤掉。"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Card className="p-3">
            <div className="flex flex-col gap-1.5 font-mono text-sm">
              <div className="flex justify-between gap-2">
                <span className="text-slate-500 dark:text-slate-400">已铺</span>
                <span className="text-slate-700 dark:text-slate-200">{info.count} 根</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-slate-500 dark:text-slate-400">总花费</span>
                <span className="font-semibold text-a-700 dark:text-a-300">{info.total}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-slate-500 dark:text-slate-400">分成几片</span>
                <span className="text-slate-700 dark:text-slate-200">{info.regions}</span>
              </div>
            </div>
          </Card>

          <Callout tone={info.solved ? 'ok' : info.tone === 'reject' ? 'bad' : 'info'} role="status">
            {info.text}
          </Callout>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            注意：只要所有城市能互相通到就够了，<b>多铺的线只是白花钱</b>。
          </p>
        </div>
      </div>
    </div>
  )
}

/* ============================================================== ② 玩一玩 */

type Decision = 'take' | 'drop'

function ExploreStage({ ctx }: { ctx: StageCtx }) {
  const [cursor, setCursor] = useState(0)
  const [accepted, setAccepted] = useState<GEdge[]>([])
  const [rejected, setRejected] = useState<GEdge[]>([])
  const [flash, setFlash] = useState<string | null>(null)
  const [tip, setTip] = useState<{ text: string; tone: 'normal' | 'reject' | 'accept' }>({
    text: '从最便宜的那条边开始。先猜猜：它会不会成环？',
    tone: 'normal',
  })
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => () => window.clearTimeout(timer.current), [])

  const flashEdge = (id: string): void => {
    setFlash(id)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setFlash(null), 1500)
  }

  const done = accepted.length === NODE_COUNT - 1
  const current = !done && cursor < QUEUE.length ? QUEUE[cursor] : null
  const acceptedIds = accepted.map((e) => e.id)
  const rejectedIds = rejected.map((e) => e.id)
  const total = accepted.reduce((s, e) => s + e.w, 0)
  const labels = regionLabels(NODES, accepted)
  const regions = new Set(Object.values(labels)).size

  const decide = (take: Decision): void => {
    if (!current) return
    const e = current
    const cycle = wouldFormCycle(NODES, accepted, e)
    const adj = adjacencyList({ nodes: NODES, edges: accepted })
    const path = cycle ? pathIn(adj, e.u, e.v).join(' → ') : ''
    const cycleWhy = `${e.u} 和 ${e.v} 已经通过 ${path} 连通了，再加这条就成环。`

    if (take === 'take' && cycle) {
      setTip({ text: `不行。${cycleWhy}环里的边不带来新的连通，只会加钱。`, tone: 'reject' })
      ctx.say(`收不了：${e.u} 和 ${e.v} 早就连通了，加上就成环。`, 'reject')
      ctx.announce(`权重 ${e.w} 的边 ${e.u} 到 ${e.v} 被拒绝。${cycleWhy}`)
      flashEdge(e.id)
      return
    }

    if (take === 'drop' && !cycle) {
      setTip({
        text: `可惜。${e.u} 和 ${e.v} 还没连通，这条又不会成环 —— 它是最便宜的一条，扔掉它，以后只能用更贵的线去接这两片，总花费一定变大。`,
        tone: 'reject',
      })
      ctx.say('这条不会成环，扔掉就亏了。', 'reject')
      ctx.announce(`权重 ${e.w} 的边不该扔掉：它连接了两片还没打通的区域。`)
      flashEdge(e.id)
      return
    }

    if (cycle) {
      setRejected((prev) => [...prev, e])
      setTip({ text: `对，扔掉它。${cycleWhy}`, tone: 'accept' })
      ctx.say(`扔掉权重 ${e.w}：${e.u} 和 ${e.v} 早就连通了。`, 'reject')
      ctx.announce(`扔掉权重 ${e.w} 的边。${cycleWhy}`)
    } else {
      const next = [...accepted, e]
      setAccepted(next)
      manualRun = { count: next.length, weight: next.reduce((s, x) => s + x.w, 0) }
      setTip({
        text: `收下权重 ${e.w}。它把两块还没打通的区域接成了一块，现在还剩 ${NODE_COUNT - next.length} 片要并。`,
        tone: 'accept',
      })
      ctx.say(`权重 ${e.w} 已收下。`, 'accept')
      ctx.announce(`收下权重 ${e.w} 的边 ${e.u} 到 ${e.v}。`)
    }
    setCursor((c) => c + 1)
  }

  const tryEdgeInGraph = (id: string): void => {
    if (!current) {
      setTip({ text: '已经收够了，剩下的边不用再看。', tone: 'accept' })
      return
    }
    if (id !== current.id) {
      const e = QUEUE.find((x) => x.id === id)
      setTip({
        text: `还没轮到它。Kruskal 的规矩是：每次只看最便宜的那条 —— 现在轮到 ${current.u}–${current.v}（权重 ${current.w}）。`,
        tone: 'reject',
      })
      ctx.say(`还没轮到它，先看 ${current.u}–${current.v}。`, 'reject')
      if (e) ctx.announce(`权重 ${e.w} 的边还没轮到，现在应该处理权重 ${current.w} 的边。`)
      return
    }
    decide('take')
  }

  useSolveOnce(ctx, done && total === OPTIMAL.totalWeight)

  return (
    <div className="flex flex-col gap-3">
      <PlainSpeak>
        六个城市要连成一片。左边每条边都标着价钱，右边那串边已经<b>按价钱从低到高排好了队</b>。
        你一次只看排头那条，决定<b>收下</b>还是<b>扔掉</b>：收下它，两个城市就通了；扔掉它，就永远不用它。
        目标：<b>总共只收 {NODE_COUNT - 1} 条边，把六个城市全连上，花的总钱数最少</b>。
      </PlainSpeak>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex flex-col gap-2">
          <div className="rounded-xl bg-slate-50 p-2 dark:bg-slate-800/40">
            <GraphView
              graph={GRAPH}
              positions={POS}
              highlightEdges={acceptedIds}
              dimEdges={rejectedIds}
              pendingEdges={QUEUE.filter((e) => !acceptedIds.includes(e.id) && !rejectedIds.includes(e.id)).map((e) => e.id)}
              edgeLabels={WEIGHT_LABEL}
              nodeBadges={labels}
              onEdgeClick={tryEdgeInGraph}
              overlay={<EdgeFlash edgeId={flash} />}
              ariaLabel={`六个城市的带权图，已收下 ${accepted.length} 条边，当前分成 ${regions} 片`}
              keyboardHint="直接点图中的边就等于「收下它」；也可以用右边两个按钮来决定。"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Chip tone="ok" showGlyph={false}>
              已收 {accepted.length} / {NODE_COUNT - 1}
            </Chip>
            <Chip tone="dim" showGlyph={false}>
              已扔 {rejected.length}
            </Chip>
            <Chip tone={total === OPTIMAL.totalWeight && done ? 'ok' : 'cur'} showGlyph={false}>
              总花费 {total}
            </Chip>
            <span className="text-slate-500 dark:text-slate-400">节点角标 = 它现在属于第几片</span>
          </div>

          <Callout tone={tip.tone === 'accept' ? 'ok' : tip.tone === 'reject' ? 'bad' : 'info'} role="status">
            {tip.text}
          </Callout>

          <div className="flex flex-wrap gap-2">
            <Btn variant="primary" onClick={() => decide('take')} disabled={!current}>
              收下这条
            </Btn>
            <Btn variant="outline" onClick={() => decide('drop')} disabled={!current}>
              扔掉这条
            </Btn>
            <Btn
              variant="ghost"
              size="sm"
              onClick={() => {
                setCursor(0)
                setAccepted([])
                setRejected([])
                setFlash(null)
                manualRun = null
                setTip({ text: '重来一遍。还是从最便宜的那条开始。', tone: 'normal' })
              }}
            >
              重新开始
            </Btn>
          </div>
        </div>

        <aside className="flex flex-col gap-3">
          <Card>
            <SectionTitle hint="排头那条就是现在要决定的">按价钱排好队的边</SectionTitle>
            {done ? (
              <Callout tone="ok" title="够了，可以停">
                已经收满 {NODE_COUNT - 1} 条，六个城市连成一片了。剩下 {QUEUE.length - cursor} 条不用再看 ——
                再看也只能成环。
              </Callout>
            ) : null}
            <ol className="mt-2 flex flex-col gap-1">
              {QUEUE.map((e, i) => {
                const isAccepted = acceptedIds.includes(e.id)
                const isRejected = rejectedIds.includes(e.id)
                const isCurrent = current?.id === e.id
                return (
                  <li
                    key={e.id}
                    className={cx(
                      'flex items-center justify-between gap-2 rounded-lg border px-2 py-1 font-mono text-xs dl-transition',
                      isCurrent
                        ? 'border-cur-500 bg-cur-50 dark:bg-cur-500/10'
                        : isAccepted
                          ? 'border-ok-500 bg-ok-50 dark:bg-ok-500/10'
                          : isRejected
                            ? 'border-slate-200 bg-slate-50 opacity-60 dark:border-slate-700 dark:bg-slate-800/50'
                            : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900',
                    )}
                  >
                    <span className="text-slate-500 dark:text-slate-400">{i + 1}</span>
                    <span className="text-slate-700 dark:text-slate-200">
                      {e.u}–{e.v}
                    </span>
                    <span className="text-slate-700 dark:text-slate-200">权重 {e.w}</span>
                    <span
                      className={cx(
                        'ml-auto',
                        isAccepted
                          ? 'text-ok-700 dark:text-ok-500'
                          : isRejected
                            ? 'text-slate-400'
                            : isCurrent
                              ? 'text-cur-700 dark:text-cur-500'
                              : 'text-slate-400',
                      )}
                    >
                      {isAccepted ? '✓ 收下' : isRejected ? '× 扔掉' : isCurrent ? '← 轮到它' : '待定'}
                    </span>
                  </li>
                )
              })}
            </ol>
          </Card>

          <Card>
            <SectionTitle hint="同一个算法的答案">对照：算法会这样收</SectionTitle>
            <ol className="flex flex-col gap-1 font-mono text-xs">
              {OPTIMAL.accepted.map((e, i) => (
                <li key={e.id} className="flex justify-between gap-2">
                  <span className="text-slate-500 dark:text-slate-400">第 {i + 1} 条</span>
                  <span className="text-slate-700 dark:text-slate-200">
                    {e.u}–{e.v}
                  </span>
                  <span className="text-slate-500 dark:text-slate-400">权重 {e.w}</span>
                </li>
              ))}
            </ol>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              {OPTIMAL.accepted.length} 条边，总花费 <b>{OPTIMAL.totalWeight}</b>。这就是最省的那个数。
            </p>
          </Card>
        </aside>
      </div>
    </div>
  )
}

/* ============================================================== ③ 起个名 */

interface GreedyQuestion {
  id: string
  scene: string
  answer: Decision
  why: string
}

const GREEDY_QUESTIONS: GreedyQuestion[] = [
  {
    id: 'q1',
    scene: '现在轮到权重 4 的 A–C。可是 A 和 C 已经通过 A → B → C 连通了。',
    answer: 'drop',
    why: '扔掉。两个端点已经能互相走到，收下它就只多出一个圈，一分钱不省，还白花 4。',
  },
  {
    id: 'q2',
    scene: '现在轮到权重 5 的 C–D。C 这一片和 D 这一片还没打通。',
    answer: 'take',
    why: '收下。它把两片并成一片，正是我们需要的；而且它是眼下最便宜的一条，以后不会再有更便宜的能接上这两片。',
  },
  {
    id: 'q3',
    scene: '已经收满 5 条边，六个城市连成一片了，队列里还剩 2 条边没看。',
    answer: 'drop',
    why: '不用再看了。你已经有了连通且无环的方案，再看下去每一条都会成环 —— 收一条就多花一条的钱。',
  },
]

function NameStage({ ctx }: { ctx: StageCtx }) {
  const [answers, setAnswers] = useState<Record<string, Decision>>({})
  const allRight = GREEDY_QUESTIONS.every((q) => answers[q.id] === q.answer)

  const finalEdges = OPTIMAL.accepted
  const deg = degrees({ nodes: NODES, edges: finalEdges })
  const degreeSum = Object.values(deg).reduce((s, d) => s + d, 0)

  useSolveOnce(ctx, allRight)

  return (
    <div className="flex flex-col gap-4">
      <PlainSpeak>
        你刚才做的事有名字了：<b>Kruskal 算法</b>。规矩只有三句 ——
        <b>边按价钱排队</b>、<b>每次只看最便宜的那条</b>、<b>不成环就收，收满 n−1 条就停</b>。
        这种「每步都挑眼下最好的」的做法，叫<b>贪心</b>。
      </PlainSpeak>

      <Card>
        <SectionTitle hint="点一下选「收下」或「扔掉」，选错会说清为什么">轮到你决定</SectionTitle>
        <ul className="flex flex-col gap-3">
          {GREEDY_QUESTIONS.map((q) => {
            const picked = answers[q.id]
            const right = picked === q.answer
            return (
              <li key={q.id} className="flex flex-col gap-2">
                <p className="text-sm text-slate-700 dark:text-slate-200">{q.scene}</p>
                <div className="flex flex-wrap items-center gap-2">
                  {(['take', 'drop'] as const).map((d) => {
                    const active = picked === d
                    const good = active && right
                    const bad = active && !right
                    return (
                      <button
                        key={d}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setAnswers((a) => ({ ...a, [q.id]: d }))}
                        className={cx(
                          'min-h-11 rounded-xl border px-4 text-sm font-medium dl-transition',
                          good
                            ? 'border-ok-500 bg-ok-50 text-ok-700 dark:bg-ok-500/15 dark:text-ok-500'
                            : bad
                              ? 'border-bad-500 bg-bad-50 text-bad-700 dark:bg-bad-500/15 dark:text-bad-500'
                              : 'border-slate-300 bg-white text-slate-700 hover:border-a-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200',
                        )}
                      >
                        {d === 'take' ? '收下' : '扔掉'}
                      </button>
                    )
                  })}
                  {picked ? (
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {right ? '✓ 对，' : '✗ 再想想：'}
                      {q.why}
                    </span>
                  ) : null}
                </div>
              </li>
            )
          })}
        </ul>
      </Card>

      <Card>
        <SectionTitle hint="为什么这样挑不会错过最省的方案">贪心的那点直觉</SectionTitle>
        <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-200">
          设想最省的方案里偏偏不用这条最便宜的边。那它总得用别的线把边两头这两片地方打通 ——
          而那些线要么更贵，要么一样贵。把手上这条更便宜的换进去，总花费只会降、不会升。
          所以「能收就收眼下最便宜的」永远不亏 —— 这就是贪心在这里行得通的道理。
        </p>
        <ul className="mt-3 flex flex-col gap-1.5 text-sm text-slate-600 dark:text-slate-300">
          <li>
            · 收下的边一共 <b>{finalEdges.length}</b> 条 = 点数 {NODE_COUNT} 减 1（树的性质）。
          </li>
          <li>
            · 把每个点的度数加起来是 <b>{degreeSum}</b>，正好等于 2 × {finalEdges.length} —— 每条边被两头各数了一次。
          </li>
          <li>· 收下的边里没有任何环，扔掉的两条都是「本来就已经连通」的边。</li>
        </ul>
      </Card>
    </div>
  )
}

/* ============================================================== ④ 练一练 */

function PracticeStage({ ctx }: { ctx: StageCtx }) {
  const [solvedCount, setSolvedCount] = useState(0)
  useSolveOnce(ctx, solvedCount >= 3)

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-slate-600 dark:text-slate-300">
        三道题，随便选。选错了会告诉你为什么错 —— 不限次数，也不扣分。
      </p>

      <Card>
        <Quiz
          question={<>有 6 个城市，要把它们连成一片，为什么<b>只要 5 条</b>线就够了？</>}
          resetKey="g6p1"
          onSolved={() => setSolvedCount((c) => c + 1)}
          choices={[
            {
              id: 'a',
              label: '因为每收一条边，最多把两片地方并成一片；从 6 片并到 1 片，正好要并 5 次',
              correct: true,
              why: '对。一开始 6 个城市各是一片，每收一条能连上两片的边，片数就少 1。6 减到 1，正好 5 次，所以 n 个点要 n−1 条边。',
            },
            {
              id: 'b',
              label: '因为是规定，最少就是 5 条',
              correct: false,
              why: '不对。这不是规定，而是从「片数每次最多减 1」推出来的。少于 5 条，一定还有城市连不上。',
            },
            {
              id: 'c',
              label: '因为 6 个城市一共只能铺 5 条线',
              correct: false,
              why: '不对。能铺的线远不止 5 条（这张图上就有 9 条可铺）。5 是「够用」的条数，不是「能铺」的条数。',
            },
            {
              id: 'd',
              label: '其实凑够 5 条就一定能连通',
              correct: false,
              why: '不对。5 条也可能连不成一片：比如在三个城市之间绕出一个圈，就会有城市被漏在外面。所以要一边收一边看是不是真把两片接上了。',
            },
          ]}
        />
      </Card>

      <Card>
        <Quiz
          question={<>收边的时候，碰到一条<b>会成环</b>的边，为什么必须扔掉？</>}
          resetKey="g6p2"
          onSolved={() => setSolvedCount((c) => c + 1)}
          choices={[
            {
              id: 'a',
              label: '因为它的两个端点本来就能绕过去，这条边不带来新的连通，只会让总花费变大',
              correct: true,
              why: '对。环意味着两个端点之间已经有一条路了。多加这条边，能通的地方一个没多，钱却多花了。',
            },
            {
              id: 'b',
              label: '因为图里不能有环',
              correct: false,
              why: '不对。原图里本来就有环，环本身没问题。只是我们要的是「连通 + 无环」的生成树，所以在这个目标下环上的边不要。',
            },
            {
              id: 'c',
              label: '因为会成环的边一定是权重最大的那条',
              correct: false,
              why: '不对。权重小的边照样可能成环 —— 这张图里权重 4 的 A–C 就被扔掉了，它并不最大。',
            },
          ]}
        />
      </Card>

      <Card>
        <Quiz
          question={<>最省的那个连通方案（最小生成树）是<b>唯一</b>的吗？</>}
          resetKey="g6p3"
          onSolved={() => setSolvedCount((c) => c + 1)}
          choices={[
            {
              id: 'a',
              label: '不一定唯一；如果有几条边权重一样，可能有好几种花一样多钱的方案',
              correct: true,
              why: '对。比如两个城市之间有几条一样便宜的线，选哪条都行。这张图的 9 条边权重各不相同，所以它这题的答案唯一。',
            },
            {
              id: 'b',
              label: '一定唯一',
              correct: false,
              why: '不对。只要有权重相同的边，就可能出现两棵总花费相同、但边不完全一样的生成树。',
            },
            {
              id: 'c',
              label: '一定不唯一',
              correct: false,
              why: '不对。这张图九条边的权重两两不同，最小生成树就是唯一的那一棵。',
            },
          ]}
        />
      </Card>
    </div>
  )
}

/* ============================================================== ⑤ 换个场景 */

function TransferStage({ ctx }: { ctx: StageCtx }) {
  const stepper = useStepper<KruskalState>(KRUSKAL_STEPS, 'g6-kruskal')
  const snap = stepper.step?.snapshot
  const acceptedIds = (snap?.accepted ?? []).map((e) => e.id)
  const rejectedIds = (snap?.rejected ?? []).map((e) => e.edge.id)
  const processed = snap?.cursor ?? 0
  const atFinal = stepper.count > 1 && stepper.index === stepper.count - 1
  const manual = manualRun

  const onStep = useCallback(
    (i: number) => {
      const s = KRUSKAL_STEPS[i]
      if (s) ctx.say(s.explanation, s.tone ?? 'normal')
    },
    [ctx],
  )

  useSolveOnce(ctx, manual !== null && atFinal)

  return (
    <div className="flex flex-col gap-3">
      <PlainSpeak>
        换个场景：这一次不用你动手，<b>让算法自己走一遍</b>。用下面的 ▶ 或 ⟩ 一步步看，
        它每一步都在说「为什么收这条 / 为什么扔这条」。
      </PlainSpeak>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex flex-col gap-2">
          <div className="rounded-xl bg-slate-50 p-2 dark:bg-slate-800/40">
            <GraphView
              graph={GRAPH}
              positions={POS}
              highlightEdges={acceptedIds}
              dimEdges={rejectedIds}
              pendingEdges={QUEUE.filter((_, i) => i >= processed).map((e) => e.id)}
              edgeLabels={WEIGHT_LABEL}
              overlay={<EdgeFlash edgeId={stepper.step?.highlight[0] ?? null} />}
              ariaLabel={`Kruskal 第 ${stepper.index + 1} 步，共 ${stepper.count} 步`}
              keyboardHint="下面的步骤条可以直接拖到任意一步。"
            />
          </div>

          <StepControls api={stepper} label="Kruskal" onStepChange={onStep} />

          <Callout tone={stepper.step?.tone === 'accept' ? 'ok' : stepper.step?.tone === 'reject' ? 'bad' : 'info'} role="status">
            {stepper.step?.explanation ?? '点 ▶ 开始。'}
          </Callout>
        </div>

        <aside className="flex flex-col gap-3">
          <Card>
            <SectionTitle hint="并排比一比">谁花的钱更少？</SectionTitle>
            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="rounded-xl border border-a-300 bg-a-50 px-2 py-3 dark:border-a-500/40 dark:bg-a-500/10">
                <div className="text-xs text-slate-500 dark:text-slate-400">你亲手收的</div>
                <div className="mt-1 font-mono text-lg font-bold text-a-700 dark:text-a-300">
                  {manual ? manual.weight : '—'}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {manual ? `${manual.count} 条边` : '还没收过'}
                </div>
              </div>
              <div className="rounded-xl border border-b-300 bg-b-50 px-2 py-3 dark:border-b-500/40 dark:bg-b-500/10">
                <div className="text-xs text-slate-500 dark:text-slate-400">算法收的</div>
                <div className="mt-1 font-mono text-lg font-bold text-b-700 dark:text-b-300">{OPTIMAL.totalWeight}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">{OPTIMAL.accepted.length} 条边</div>
              </div>
            </div>

            {manual ? (
              <Callout tone={manual.weight === OPTIMAL.totalWeight ? 'ok' : 'bad'}>
                {manual.weight === OPTIMAL.totalWeight
                  ? `两个数一样，都是 ${manual.weight} —— 因为你每一步都在做和算法相同的判断，收下的也是同一批边。`
                  : `你的 ${manual.weight} 和算法的 ${OPTIMAL.totalWeight} 不一样。先回第②步把 5 条边收齐，再来比一次。`}
              </Callout>
            ) : (
              <Callout tone="cur" title="先动手再来比">
                你还没在②里亲手收过边。先回到第②步收满 5 条，这里才能并排对照。
              </Callout>
            )}
          </Card>

          <Card>
            <SectionTitle>算法一路上的结论</SectionTitle>
            <ul className="flex flex-col gap-1 font-mono text-xs">
              {KRUSKAL_STEPS.map((s, i) => {
                if (!s.label || (!s.label.startsWith('接受') && !s.label.startsWith('拒绝'))) return null
                return (
                  <li
                    key={i}
                    className={cx(
                      'flex justify-between gap-2 rounded-md px-1.5 py-0.5 dl-transition',
                      i === stepper.index ? 'bg-cur-50 dark:bg-cur-500/10' : '',
                    )}
                  >
                    <span className="text-slate-700 dark:text-slate-200">{s.label}</span>
                    <span className={s.tone === 'reject' ? 'text-bad-700 dark:text-bad-500' : 'text-ok-700 dark:text-ok-500'}>
                      {s.tone === 'reject' ? '扔掉' : '收下'}
                    </span>
                  </li>
                )
              })}
            </ul>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              整棵树的总花费 = {OPTIMAL.accepted.map((e) => e.w).join(' + ')} = {OPTIMAL.totalWeight}。
            </p>
          </Card>
        </aside>
      </div>
    </div>
  )
}

/* ============================================================== 导出 */

const topic: Topic = {
  id: 'G6',
  title: '最小生成树 Kruskal',
  moduleId: 'graph',
  oneLiner: '用最省的线把所有点连成一片',
  outcome: '你能看着一张带权图，自己按「最便宜的优先、不成环就收」一步步挑出最省的连通方案，并说清每条被扔掉的边为什么必须扔。',
  prerequisites: ['G1'],
  bigIdea: '连通所有点的最少线数固定是 n−1 条；剩下的问题只是「这 n−1 条该挑哪几条」—— 每次都挑最便宜又不制造环的那条，答案就是最省的。',
  misconceptions: [
    {
      wrong: '要把所有能连的线都连上，网络才够稳',
      right: '把所有线都连上一定会绕出很多圈。圈上的线不带来新的连通，只是白花钱。连通 n 个点只需要 n−1 条边。',
    },
    {
      wrong: '把边按价钱从小到大依次收下就行了，一条也不落',
      right: '还要多看一眼：两个端点是不是已经能互相走到了。已经能走到，收下就会成环，必须扔掉。',
    },
    {
      wrong: '最省的方案只有一种',
      right: '有相同权重的边时，可能有好几种花一样多钱的方案。权重两两不同时，最省方案才唯一。',
    },
  ],
  formalDefinition: (
    <>
      <p>
        <b>生成树：</b>
        <span className="font-mono">包含全部结点、连通而且没有环的子图</span>
        —— 恰好有 n−1 条边。
      </p>
      <p>
        <b>最小生成树：</b>
        <span className="font-mono">所有生成树里，边权总和最小的那一棵</span>
      </p>
      <p>
        <b>Kruskal 算法：</b>
      </p>
      <ol className="ml-4 list-decimal text-sm">
        <li>把所有的边按权重从小到大排好队；</li>
        <li>依次看每一条边：两个端点如果还没连通，就收下它；已经连通就扔掉；</li>
        <li>收满 n−1 条边就停下来。</li>
      </ol>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        第 2 步的判断，等价于「这条边会不会和已经收下的边构成环」。
      </p>
    </>
  ),
  glossary: [
    { term: '生成树', plain: '把图上所有点都连起来、又一点圈都不绕的那几条边。', formal: '连通、无环、含全部顶点的生成子图，边数恰为 n−1' },
    { term: '最小生成树', plain: '所有连通方案里，花的总钱数最少的那个。', formal: 'min{ Σw(e) | T 是生成树 }' },
    { term: '权重', plain: '边上标的那个数字：铺这根线要花多少。', formal: 'w: E → ℝ' },
    { term: '成环', plain: '两个点之间除了这条边，还能绕别的路走通。' },
    { term: '贪心', plain: '每一步都不管以后，只挑眼下最好的那个。' },
    { term: '连通', plain: '图上任意两个点之间都能走得到。' },
  ],
  stages: [
    {
      label: '① 看一看',
      short: '看',
      narration: '几个城市要铺网线，怎么铺最省钱？',
      requireSolve: true,
      hints: [
        '先别急着铺满，注意每铺一根线都要花钱。',
        '三个城市只要 2 根线就够连成一片了，从便宜的挑起。',
        '铺甲–乙（5）和乙–丙（4），一共 9。第三根甲–丙（9）只会让路线绕成一个圈，白花 9。',
      ],
      render: (ctx) => <HookStage ctx={ctx} />,
    },
    {
      label: '② 玩一玩',
      short: '玩',
      narration: '一条一条地收边，收错了会说清为什么',
      requireSolve: true,
      hints: [
        '永远盯住最便宜的那条没处理的边，先问自己：它会不会成环？',
        '看成环的办法：把已经收下的边当成一条条路，看这条边的两个端点能不能互相走到。',
        '按权重 1、2、3、5、7 依次收下 A–B、D–E、B–C、C–D、E–F；A–C（4）和 B–D（6）会成环，要扔掉；收满 5 条就停，总花费 18。',
      ],
      render: (ctx) => <ExploreStage ctx={ctx} />,
    },
    {
      label: '③ 起个名',
      short: '名',
      narration: '你刚做的事，名字叫 Kruskal 算法',
      requireSolve: true,
      hints: [
        '口诀：最便宜的优先；两个端点还没连通就收，已经连通就扔。',
        '「已经连通」就是：沿着已经收下的边走，能不能从一个端点走到另一个端点。',
        '三问的答案依次是：扔掉、收下、不用再看了。',
      ],
      render: (ctx) => <NameStage ctx={ctx} />,
    },
    {
      label: '④ 练一练',
      short: '练',
      narration: '三道题，选错会说明为什么错',
      requireSolve: true,
      hints: [
        '想不清楚就回到图上数一数：现在有几片、几条边、有没有圈。',
        'n 个点连成一片，就像几支队伍合并：每收一条边，最多让队伍数少 1。',
        '三道题的正确选项依次是：一条边最多把两片并成一片；环上的边不带来新连通；权重相同时可能不唯一。',
      ],
      render: (ctx) => <PracticeStage ctx={ctx} />,
    },
    {
      label: '⑤ 换个场景',
      short: '变',
      narration: '再看一遍算法的每一步，和你手工的比一比',
      requireSolve: true,
      hints: [
        '用下面的 ▶ 自动播，或者点 ⟩ 一步一步看。',
        '每一步都在告诉你：这条边的两个端点当时是不是已经连通了。',
        '算法收下的和你手工收下的是同一批：A–B、D–E、B–C、C–D、E–F，总花费都是 18。',
      ],
      render: (ctx) => <TransferStage ctx={ctx} />,
    },
  ],
}

export default topic
