import { useCallback, useMemo, useState } from 'react'

import { GraphView } from '@/primitives'
import {
  checkTrail,
  degree,
  degrees,
  eulerVerdict,
  isConnectedIgnoringIsolated,
  makeGraph,
  nodesOf,
  oddDegreeNodes,
  type Graph,
} from '@/kernels/graph'
import { circleLayout, type Positions } from '@/kernels/layout'
import { Btn, Callout, Card, Chip, Math as Formula, PlainSpeak, SectionTitle, cx } from '@/ui'
import { Quiz } from '@/ui/Quiz'
import { useSolveOnce, useTriedSet } from '../hooks'
import type { StageCtx, Topic } from '../types'

const W = 340
const H = 300

/**
 * 柯尼斯堡：四块陆地，七座桥。A–C 之间两座、B–C 之间两座、A–D 之间两座 —— 这是**多重图**。
 * 各点度数是 A=5、B=4、C=4、D=3，全是奇数，所以怎么走都走不完。
 */
const KONIGSBERG = makeGraph(
  ['A', 'B', 'C', 'D'],
  [
    ['A', 'C'],
    ['A', 'C'],
    ['B', 'C'],
    ['B', 'C'],
    ['A', 'B'],
    ['A', 'D'],
    ['A', 'D'],
  ],
)
const KONIGSBERG_POS: Positions = {
  A: { x: 90, y: 88 },
  B: { x: 250, y: 88 },
  C: { x: 170, y: 208 },
  D: { x: 170, y: 26 },
}

/** 换成一张能走通的图：只有 A、D 两个奇度点 */
const EULER_GRAPH = makeGraph(
  ['A', 'B', 'C', 'D'],
  [
    ['A', 'B'],
    ['B', 'C'],
    ['C', 'D'],
    ['D', 'A'],
    ['A', 'C'],
  ],
)
const EULER_POS = circleLayout(['A', 'B', 'C', 'D'], 170, 150, 100)

const ODD_COLOR = 'var(--color-bad-500)'
const EVEN_COLOR = 'var(--color-a-500)'

const oddColors = (g: Graph): Record<string, string> => {
  const odd = new Set(oddDegreeNodes(g))
  const out: Record<string, string> = {}
  for (const n of nodesOf(g)) out[n] = odd.has(n) ? ODD_COLOR : EVEN_COLOR
  return out
}

const badgeOf = (g: Graph): Record<string, string> => {
  const d = degrees(g)
  const out: Record<string, string> = {}
  for (const n of nodesOf(g)) out[n] = String(d[n] ?? 0)
  return out
}

/* ------------------------------------------------- 多重图渲染（桥可以并排） */

/**
 * 柯尼斯堡是多重图：A–C 与 B–C 各有两座桥。
 * 普通 GraphView 会把两条边画成同一条线，看不出「两座桥」，
 * 所以这里把重边弯成两条弧，分别落在连线两侧。
 */
function MultiEdgeView({
  graph,
  positions,
  usedEdges,
  highlightNodes,
  lastNode,
  extraLabels,
}: {
  graph: Graph
  positions: Positions
  usedEdges: string[]
  highlightNodes: string[]
  lastNode: string | null
  extraLabels?: Record<string, string>
}) {
  const R = 17
  const ns = nodesOf(graph)

  const pairIndex = useMemo(() => {
    const counter: Record<string, number> = {}
    const key = (a: string, b: string): string => [a, b].sort().join('~')
    const idx: Record<string, number> = {}
    for (const e of graph.edges) {
      const k = key(e.u, e.v)
      const c = counter[k] ?? 0
      idx[e.id] = c
      counter[k] = c + 1
    }
    return idx
  }, [graph])

  /** 奇数度数的点画成橙色，偶数画成蓝色 —— 颜色之外还有角标上的数字兜底 */
  const nodeColors = useMemo(() => oddColors(graph), [graph])

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full select-none" role="img" aria-label="桥的示意图">
      {graph.edges.map((e) => {
        const a = positions[e.u]
        const b = positions[e.v]
        if (!a || !b) return null
        const dx = b.x - a.x
        const dy = b.y - a.y
        const len = Math.hypot(dx, dy) || 1
        const ux = dx / len
        const uy = dy / len
        const k = pairIndex[e.id] ?? 0
        const off = k === 0 ? 16 : -16
        const nx = -uy * off
        const ny = ux * off
        const x1 = a.x + ux * R
        const y1 = a.y + uy * R
        const x2 = b.x - ux * R
        const y2 = b.y - uy * R
        const mx = (x1 + x2) / 2 + nx * 0.78
        const my = (y1 + y2) / 2 + ny * 0.78
        const used = usedEdges.includes(e.id)
        const hi = highlightNodes.includes(e.u) && highlightNodes.includes(e.v)
        const stroke = used ? 'var(--color-cur-500)' : hi ? 'var(--color-ok-500)' : 'var(--color-dim-500)'
        // 重边的中点再分摊一点，避免两座桥的线挤在一起
        const spread = k === 0 ? -7 : 7
        return (
          <g key={e.id}>
            <path
              d={`M ${x1} ${y1} Q ${mx} ${my} ${x2} ${y2}`}
              fill="none"
              stroke={stroke}
              strokeWidth={used ? 4.5 : 2.6}
              strokeLinecap="round"
            />
            <text
              x={mx + spread}
              y={my - 4}
              textAnchor="middle"
              className="dl-svg-text"
              fill={used ? 'var(--color-cur-700)' : 'var(--color-cur-600)'}
              fontSize={10}
            >
              {extraLabels?.[e.id] ?? ''}
            </text>
          </g>
        )
      })}

      {ns.map((id) => {
        const p = positions[id]
        const hi = highlightNodes.includes(id)
        const fill = nodeColors[id] ?? EVEN_COLOR
        return (
          <g key={id} transform={`translate(${p.x},${p.y})`}>
            {lastNode === id ? (
              <circle r={R + 8} fill="none" stroke="var(--color-ok-500)" strokeWidth={3} />
            ) : null}
            <circle r={R} fill={hi ? 'var(--color-ok-500)' : fill} stroke="white" strokeWidth={2} />
            <text textAnchor="middle" dy="0.35em" className="dl-svg-text" fill="white" fontSize={14}>
              {id}
            </text>
            <circle cx={R - 4} cy={-R + 2} r={11} fill="white" stroke="var(--color-dim-300)" strokeWidth={1.5} />
            <text x={R - 4} y={-R + 6} textAnchor="middle" className="dl-svg-text" fill="var(--color-slate-700)" fontSize={11}>
              {degree(graph, id)}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

/* ============================================================== ① 看一看 */

function HookStage({ ctx }: { ctx: StageCtx }) {
  const { tried, markTried } = useTriedSet()
  const [msg, setMsg] = useState('点一下每块陆地，看看它连出去几座桥。')

  const verdict = useMemo(() => eulerVerdict(KONIGSBERG), [])
  const done = tried.size >= 4

  const onNodeClick = useCallback(
    (id: string) => {
      markTried(id)
      const d = degree(KONIGSBERG, id)
      const text = `${id} 连出去 ${d} 座桥，${d % 2 === 1 ? '是奇数' : '是偶数'}。`
      setMsg(text)
      ctx.say(text)
      ctx.announce(text)
    },
    [ctx, markTried],
  )

  useSolveOnce(ctx, done)

  return (
    <div className="flex flex-col gap-3">
      <PlainSpeak>
        两百多年前的柯尼斯堡城，河中间有两座岛，河两岸是陆地，一共架了 <b>7 座桥</b>。
        市民们的消遣是：能不能走一趟，把每座桥都恰好走一次？
        点一点每块陆地，先数数它连出去几座桥。
      </PlainSpeak>

      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_15rem]">
        <div className="rounded-xl bg-slate-50 p-2 dark:bg-slate-800/40">
          <MultiEdgeView
            graph={KONIGSBERG}
            positions={KONIGSBERG_POS}
            usedEdges={[]}
            highlightNodes={[...tried]}
            lastNode={null}
            extraLabels={Object.fromEntries(KONIGSBERG.edges.map((e, i) => [e.id, `桥${i + 1}`]))}
          />
          <div className="flex justify-center">
            <button
              type="button"
              aria-label="点这里换一种方式点选陆地"
              onClick={() => {
                const next = ['A', 'B', 'C', 'D'].find((n) => !tried.has(n))
                if (next) onNodeClick(next)
              }}
              className="min-h-11 rounded-xl border border-slate-200 px-3 text-sm text-slate-600 dl-transition hover:bg-white dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              键盘也可以用：点这里依次查看四块陆地
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Callout tone={done ? 'ok' : 'info'} role="status">
            {done ? '四块陆地的桥数都数出来了：A 是 5，B 是 4，C 是 4，D 是 3。' : `已经看过 ${tried.size} / 4 块陆地。`}
          </Callout>
          <Card className="p-3">
            <p className="text-sm text-slate-700 dark:text-slate-200">{msg}</p>
          </Card>
          <Callout tone={done ? 'cur' : 'info'}>
            {done
              ? `四块陆地连出去的桥数全是奇数。欧拉当年就盯住了这一点，得出了「走不通」的结论 —— 下一步你自己去试。`
              : `把四块陆地挨个点一遍，再看结论。`}
          </Callout>
          {done ? <Chip tone="cur">{verdict.title}</Chip> : null}
        </div>
      </div>
    </div>
  )
}

/* ============================================================== ② 玩一玩 */

type Board = 'koenigsberg' | 'euler'

function ExploreStage({ ctx }: { ctx: StageCtx }) {
  const [board, setBoard] = useState<Board>('koenigsberg')
  const [seq, setSeq] = useState<string[]>([])
  const [msg, setMsg] = useState('从任意一块陆地出发，点相邻的陆地往前走一步。')
  const [tone, setTone] = useState<'normal' | 'reject' | 'accept'>('normal')
  const [koenigsbergTried, setKoenigsbergTried] = useState(false)

  const graph = board === 'koenigsberg' ? KONIGSBERG : EULER_GRAPH
  const positions = board === 'koenigsberg' ? KONIGSBERG_POS : EULER_POS

  const check = useMemo(() => checkTrail(graph, seq), [graph, seq])
  const verdict = useMemo(() => eulerVerdict(graph), [graph])
  const odd = useMemo(() => oddDegreeNodes(graph), [graph])

  const talk = useCallback(
    (text: string, t: 'normal' | 'reject' | 'accept') => {
      setMsg(text)
      setTone(t)
      ctx.say(text, t)
    },
    [ctx],
  )

  const at = seq.length ? seq[seq.length - 1] : null

  const clickNode = (id: string): void => {
    if (!at) {
      setSeq([id])
      talk(`从 ${id} 出发了。接着点一个和它相邻的点，就能往前走一步。`, 'normal')
      ctx.announce(`从 ${id} 出发。`)
      return
    }
    if (id === at) {
      talk(`${at} 到 ${at} 之间没有桥，自己走不到自己。换一个相邻的点。`, 'reject')
      return
    }
    const next = [...seq, id]
    const c = checkTrail(graph, next)
    if (!c.ok) {
      talk(c.reason, 'reject')
      ctx.announce(c.reason)
      return
    }
    setSeq(next)
    if (c.usedEdgeIds.length === graph.edges.length) {
      talk(c.reason, 'accept')
      ctx.announce(c.reason)
    } else {
      talk(
        `${at} → ${id} 走通了，还剩 ${graph.edges.length - c.usedEdgeIds.length} 座桥没走。`,
        'normal',
      )
    }
    if (board === 'koenigsberg') setKoenigsbergTried(true)
  }

  const undo = (): void => {
    setSeq((s) => s.slice(0, -1))
    talk('退回上一步。', 'normal')
  }

  const reset = (): void => {
    setSeq([])
    talk('重新来。记住：这次是从头开始。', 'normal')
  }

  const won = check.ok && check.usedEdgeIds.length === graph.edges.length && graph.edges.length > 0
  const solved = board === 'euler' && won && koenigsbergTried
  useSolveOnce(ctx, solved)

  return (
    <div className="flex flex-col gap-3">
      <PlainSpeak>
        规则只有一条：<b>每座桥只能走一次</b>。点相邻的陆地就往前走一步，走错了会告诉你为什么走不过去。
        先试七桥，再试右边的第二张图。
      </PlainSpeak>

      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            ['koenigsberg', '柯尼斯堡 · 七座桥'],
            ['euler', '第二张图 · 五座桥'],
          ] as [Board, string][]
        ).map(([b, label]) => (
          <button
            key={b}
            type="button"
            aria-pressed={board === b}
            onClick={() => {
              setBoard(b)
              setSeq([])
              setTone('normal')
              const v = eulerVerdict(b === 'koenigsberg' ? KONIGSBERG : EULER_GRAPH)
              setMsg(`换到「${label}」。${v.plain}`)
            }}
            className={cx(
              'min-h-11 rounded-xl border px-3 text-sm font-medium dl-transition',
              board === b
                ? 'border-a-500 bg-a-50 text-a-700 dark:bg-a-500/20 dark:text-a-300'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_17rem]">
        <div className="rounded-xl bg-slate-50 p-2 dark:bg-slate-800/40">
          <MultiEdgeView
            graph={graph}
            positions={positions}
            usedEdges={check.usedEdgeIds}
            highlightNodes={at ? [at] : []}
            lastNode={at}
            extraLabels={Object.fromEntries(graph.edges.map((e, i) => [e.id, `桥${i + 1}`]))}
          />
          <div className="flex flex-wrap justify-center gap-2">
            {nodesOf(graph).map((id) => (
              <Btn
                key={id}
                size="sm"
                variant={id === at ? 'primary' : 'outline'}
                aria-label={`走到 ${id}`}
                onClick={() => clickNode(id)}
              >
                走到 {id}
              </Btn>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Card className="p-3">
            <SectionTitle>你的路线</SectionTitle>
            <p className="font-mono text-sm text-slate-700 dark:text-slate-200">
              {seq.length ? seq.join(' → ') : '还没出发'}
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              已走 {check.usedEdgeIds.length} / {graph.edges.length} 座桥
            </p>
            <div className="mt-2 flex gap-2">
              <Btn size="sm" variant="outline" onClick={undo} disabled={seq.length === 0} aria-label="退回上一步">
                退回一步
              </Btn>
              <Btn size="sm" variant="ghost" onClick={reset} disabled={seq.length === 0} aria-label="清空路线重新开始">
                重来
              </Btn>
            </div>
          </Card>

          <Callout tone={tone === 'accept' ? 'ok' : tone === 'reject' ? 'bad' : 'info'} role="status">
            {msg}
          </Callout>

          <Card className="p-3">
            <SectionTitle hint="实时算给你看">奇度点体检</SectionTitle>
            <p className="text-sm text-slate-700 dark:text-slate-200">
              奇度点：{odd.length === 0 ? '一个都没有' : odd.join('、')}（共 {odd.length} 个）
            </p>
            <p className="mt-1 text-sm text-slate-700 dark:text-slate-200">
              忽略孤立点后连通：{isConnectedIgnoringIsolated(graph) ? '是' : '不是'}
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-800 dark:text-slate-100">{verdict.title}</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{verdict.plain}</p>
          </Card>

          <div className="flex flex-wrap gap-1.5 text-xs">
            <Chip tone="bad">橙点 = 度数是奇数</Chip>
            <Chip tone="a">蓝点 = 度数是偶数</Chip>
            <Chip tone="cur" showGlyph={false}>
              黄线 = 已经走过
            </Chip>
          </div>
        </div>
      </div>

      {won ? (
        <Callout tone="ok" title="走完了！">
          {check.reason}
        </Callout>
      ) : null}

      {verdict.hasPath === false && seq.length > 0 && !won ? (
        <Callout tone="bad" title="这上面是走不完的">
          {verdict.plain} 不过你可以继续试，试到自己服气为止 —— 试的过程比结论值钱。
        </Callout>
      ) : null}
    </div>
  )
}

/* ============================================================== ③ 起个名 */

const SCENARIOS: { id: string; text: string }[] = [
  { id: 's0', text: '奇度点 0 个' },
  { id: 's2', text: '奇度点 2 个' },
  { id: 's4', text: '奇度点 4 个（或更多）' },
  { id: 'sx', text: '图不连通，分成两片' },
]

const ANSWERS: { id: string; text: string }[] = [
  { id: 'a0', text: '有欧拉回路：能一笔画走完，还能回到出发点' },
  { id: 'a2', text: '有欧拉路径（没有回路）：能一笔画走完，但回不到出发点' },
  { id: 'a4', text: '没有一笔画走法' },
  { id: 'ax', text: '也没有一笔画走法：有的边根本走不到' },
]

const MATCH: Record<string, string> = { s0: 'a0', s2: 'a2', s4: 'a4', sx: 'ax' }

function NameStage({ ctx }: { ctx: StageCtx }) {
  const [pick, setPick] = useState<string | null>(null)
  const [done, setDone] = useState<string[]>([])
  const [lastBad, setLastBad] = useState<string | null>(null)

  const choose = (id: string): void => {
    if (done.includes(id)) return
    if (pick === null) {
      setPick(id)
      return
    }
    if (MATCH[pick] === id) {
      setDone((d) => [...d, pick])
      setPick(null)
      setLastBad(null)
      ctx.say('配上了。')
    } else {
      const s = SCENARIOS.find((x) => x.id === pick)?.text ?? ''
      const a = ANSWERS.find((x) => x.id === id)?.text ?? ''
      setLastBad(`${s} 配「${a}」不对。奇度点的个数直接决定了能不能画：0 个是回路，2 个是路径，别的个数都不行；不连通就更不用说了。`)
      setPick(null)
      ctx.say('这两个配不上，再想想。', 'reject')
    }
  }

  useSolveOnce(ctx, done.length === 4)

  const G = EULER_GRAPH
  const v = eulerVerdict(G)

  return (
    <div className="flex flex-col gap-4">
      <PlainSpeak>
        欧拉把七桥这件事想透了，结论只有两句：<b>先看奇度点有几个</b>，<b>再看图连不连通</b>。
        把左边的情况和右边的结论配起来。
      </PlainSpeak>

      <div className="grid gap-3 sm:grid-cols-2">
        <Card>
          <SectionTitle hint="先点左边，再点右边">图长什么样</SectionTitle>
          <div className="flex flex-col gap-2">
            {SCENARIOS.map((s) => {
              const ok = done.includes(s.id)
              return (
                <button
                  key={s.id}
                  type="button"
                  aria-pressed={pick === s.id}
                  aria-label={`情况：${s.text}`}
                  disabled={ok}
                  onClick={() => choose(s.id)}
                  className={cx(
                    'min-h-11 rounded-xl border px-3 text-left text-sm font-semibold dl-transition',
                    ok
                      ? 'border-ok-500 bg-ok-50 text-ok-700 dark:bg-ok-500/10 dark:text-ok-500'
                      : pick === s.id
                        ? 'border-a-500 bg-a-50 text-a-700 dark:bg-a-500/20 dark:text-a-300'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-a-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200',
                  )}
                >
                  {s.text}
                  {ok ? ' ✓' : ''}
                </button>
              )
            })}
          </div>
        </Card>

        <Card>
          <SectionTitle hint="配对成功会变绿">结论</SectionTitle>
          <div className="flex flex-col gap-2">
            {ANSWERS.map((a) => {
              const ok = Object.entries(MATCH).some(([s, ans]) => ans === a.id && done.includes(s))
              return (
                <button
                  key={a.id}
                  type="button"
                  aria-label={`结论：${a.text}`}
                  disabled={ok}
                  onClick={() => choose(a.id)}
                  className={cx(
                    'min-h-11 rounded-xl border px-3 py-2 text-left text-sm dl-transition',
                    ok
                      ? 'border-ok-500 bg-ok-50 text-ok-700 dark:bg-ok-500/10 dark:text-ok-500'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-a-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200',
                  )}
                >
                  {a.text}
                </button>
              )
            })}
          </div>
        </Card>
      </div>

      {lastBad ? <Callout tone="bad">{lastBad}</Callout> : null}

      <Callout tone={done.length === 4 ? 'ok' : 'info'} role="status">
        还剩 {4 - done.length} 组没配上。
      </Callout>

      <Card>
        <SectionTitle hint="这就是欧拉判据">正式说法</SectionTitle>
        <div className="flex flex-col gap-1.5 text-sm text-slate-700 dark:text-slate-200">
          <p>
            <b>欧拉路径</b>：一条走遍每一条边、且每条边只走一次的走法。
          </p>
          <p>
            <b>欧拉回路</b>：欧拉路径，而且最后回到出发点。
          </p>
          <p>
            判据（无向图）：先<b>把孤立点扔到一边</b>，剩下的部分要是连通的，再看奇度点个数 ——
            0 个就有回路，2 个就有路径但没有回路，其它个数都没有。
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            为什么孤立点不算？因为它本来就没有边，走不走到它都无所谓，不影响「每条边走一次」。
          </p>
        </div>
        <p className="mt-2">
          <Formula block>奇度点个数 = 0 → 欧拉回路；= 2 → 欧拉路径；≥ 4 → 无解</Formula>
        </p>
      </Card>

      <Card>
        <SectionTitle hint="用一张现成的图验一遍">拿第二张图对一遍判据</SectionTitle>
        <ul className="flex flex-col gap-1 text-sm text-slate-700 dark:text-slate-200">
          <li>
            各点度数：{' '}
            {nodesOf(G)
              .map((n) => `${n}=${degree(G, n)}`)
              .join('，')}
          </li>
          <li>奇度点：{oddDegreeNodes(G).join('、')}，一共 {oddDegreeNodes(G).length} 个</li>
          <li>忽略孤立点后连通：{isConnectedIgnoringIsolated(G) ? '是' : '不是'}</li>
          <li className="font-semibold">{v.title}</li>
        </ul>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{v.plain}</p>
      </Card>
    </div>
  )
}

/* ============================================================== ④ 练一练 */

function PracticeStage({ ctx }: { ctx: StageCtx }) {
  const [solvedCount, setSolvedCount] = useState(0)
  const bump = (): void => setSolvedCount((c) => c + 1)
  useSolveOnce(ctx, solvedCount >= 3)

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-slate-600 dark:text-slate-300">
        三道题，随便选，选错了会告诉你为什么错 —— 没有次数限制，也没有扣分。
      </p>

      <Card>
        <Quiz
          question={<>柯尼斯堡的七座桥，为什么走不通？</>}
          resetKey="g3p1"
          onSolved={bump}
          choices={[
            {
              id: 'a',
              label: '四块陆地的桥数都是奇数，奇度点有 4 个',
              correct: true,
              why: '对。A、B、C、D 连出去的桥数分别是 5、4、4、3，四个全是奇数。奇度点不是 0 个也不是 2 个，所以一笔画走不出来。这就是欧拉当年的理由。',
            },
            {
              id: 'b',
              label: '桥太多了，人走不完',
              correct: false,
              why: '不对。只有 7 座桥，走是肯定走得完的。问题不在于累不累，而在于「每条桥恰好走一次」这个要求做不到。',
            },
            {
              id: 'c',
              label: '河北岸和南岸之间没有桥',
              correct: false,
              why: '不对。两岸之间是有桥的（A 连着 D 两座）。就算把桥的位置重新摆一遍，只要奇度点还是 4 个，照样走不通。',
            },
            {
              id: 'd',
              label: '因为图不连通',
              correct: false,
              why: '不对。柯尼斯堡这四块陆地是连成一片的。它走不通的原因完全是奇度点太多。',
            },
          ]}
        />
      </Card>

      <Card>
        <Quiz
          question={<>什么样的图一定有欧拉回路（能一笔画走完，还回到出发点）？</>}
          resetKey="g3p2"
          onSolved={bump}
          choices={[
            {
              id: 'a',
              label: '忽略孤立点后连通，而且每个点的度数都是偶数',
              correct: true,
              why: '对。每个点度数都是偶数，意味着进去几次就能出来几次，一路上不会「卡死」，最后自然回到出发点。',
            },
            {
              id: 'b',
              label: '每个点的度数都相等',
              correct: false,
              why: '不对。度数都相等不一定都是偶数。比如三个点两两相连，每个点度数都是 3（奇数），就没有欧拉回路。',
            },
            {
              id: 'c',
              label: '点数比边数少',
              correct: false,
              why: '不对。点数和边数的多少跟能不能一笔画没关系。',
            },
            {
              id: 'd',
              label: '只要连通就够了',
              correct: false,
              why: '不对。连通只是条件之一。还得看奇度点：2 个的话只能走路径、回不到起点；4 个根本走不出来。',
            },
          ]}
        />
      </Card>

      <Card>
        <Quiz
          question={<>一张连通的图有 4 个奇度点，会怎么样？</>}
          resetKey="g3p3"
          onSolved={bump}
          choices={[
            {
              id: 'a',
              label: '一定没有一笔画走法',
              correct: true,
              why: '对。一笔画的过程里，除了起点和终点，每经过一个点都是「进去一次、出来一次」，用的是两条边。所以奇度点只可能是起点和终点 —— 最多 2 个。4 个就注定走不完。',
            },
            {
              id: 'b',
              label: '可以从其中一个奇度点出发，剩下 3 个随便',
              correct: false,
              why: '不对。起点和终点最多各承担一个奇度点，第三个奇度点进去就出不来了。',
            },
            {
              id: 'c',
              label: '可以走一条欧拉回路',
              correct: false,
              why: '不对。欧拉回路要求 0 个奇度点，4 个差得远。',
            },
            {
              id: 'd',
              label: '要看边的条数是奇数还是偶数',
              correct: false,
              why: '不对。判据只看奇度点的个数，不看边数是几。',
            },
          ]}
        />
      </Card>
    </div>
  )
}

/* ============================================================== ⑤ 换个场景 */

interface Case {
  id: string
  name: string
  graph: Graph
  positions: Positions
  note: string
}

const CASES: Case[] = [
  {
    id: 'c1',
    name: '一个三角形',
    graph: makeGraph(['A', 'B', 'C'], [
      ['A', 'B'],
      ['B', 'C'],
      ['C', 'A'],
    ]),
    positions: circleLayout(['A', 'B', 'C'], 170, 150, 84),
    note: '每个点度数都是 2，全是偶数。',
  },
  {
    id: 'c2',
    name: '一条折线',
    graph: makeGraph(['A', 'B', 'C', 'D'], [
      ['A', 'B'],
      ['B', 'C'],
      ['C', 'D'],
    ]),
    positions: circleLayout(['A', 'B', 'C', 'D'], 170, 150, 90),
    note: '端点 A、D 的度数是 1（奇数），中间的点是偶数。',
  },
  {
    id: 'c3',
    name: '四角星（一个点连四个点）',
    graph: makeGraph(['A', 'B', 'C', 'D', 'E'], [
      ['A', 'B'],
      ['A', 'C'],
      ['A', 'D'],
      ['A', 'E'],
    ]),
    positions: circleLayout(['A', 'B', 'C', 'D', 'E'], 170, 150, 92),
    note: '中心点连了 4 条，四个外点各连 1 条 —— 奇度点有 4 个。',
  },
  {
    id: 'c4',
    name: '两条分开的线',
    graph: makeGraph(['A', 'B', 'C', 'D'], [
      ['A', 'B'],
      ['C', 'D'],
    ]),
    positions: circleLayout(['A', 'B', 'C', 'D'], 170, 150, 95),
    note: '四个点的度数都是 1，但图分成了两片，走完一片就过不去了。',
  },
  {
    id: 'c5',
    name: '五边形加一条小尾巴',
    graph: makeGraph(['A', 'B', 'C', 'D', 'E', 'F'], [
      ['A', 'B'],
      ['B', 'C'],
      ['C', 'D'],
      ['D', 'E'],
      ['E', 'A'],
      ['A', 'F'],
    ]),
    positions: circleLayout(['A', 'B', 'C', 'D', 'E', 'F'], 170, 150, 100),
    note: 'A 连了 3 条，F 连了 1 条，正好两个奇度点。',
  },
]

function TransferStage({ ctx }: { ctx: StageCtx }) {
  const [idx, setIdx] = useState(0)
  const [guess, setGuess] = useState<Record<string, boolean>>({})
  const [revealed, setRevealed] = useState<string[]>([])

  const c = CASES[idx]
  const verdict = useMemo(() => eulerVerdict(c.graph), [c])
  const odd = useMemo(() => oddDegreeNodes(c.graph), [c])

  const answer = (v: boolean): void => {
    setGuess((g) => ({ ...g, [c.id]: v }))
    ctx.say('先记住你猜的答案，再点「揭晓」看看对不对。')
  }

  const reveal = (): void => {
    setRevealed((r) => (r.includes(c.id) ? r : [...r, c.id]))
    const text = `你猜${guess[c.id] ? '能' : '不能'}，实际是${verdict.hasPath ? '能' : '不能'}。${verdict.plain}`
    ctx.say(text, verdict.hasPath === guess[c.id] ? 'accept' : 'reject')
    ctx.announce(text)
  }

  const right = (k: Case): boolean => {
    const v = eulerVerdict(k.graph)
    return k.id in guess && guess[k.id] === v.hasPath
  }

  useSolveOnce(ctx, CASES.every(right))

  return (
    <div className="flex flex-col gap-3">
      <PlainSpeak>
        换五种图。先只看着图<b>猜</b>能不能一笔画，再点「揭晓」看判据怎么说 ——
        这样才知道你是真的会用判据，还是在靠感觉。
      </PlainSpeak>

      <div className="flex flex-wrap gap-2">
        {CASES.map((k, i) => (
          <button
            key={k.id}
            type="button"
            aria-pressed={idx === i}
            aria-label={`第 ${i + 1} 张图：${k.name}${right(k) ? '，已答对' : ''}`}
            onClick={() => setIdx(i)}
            className={cx(
              'min-h-11 rounded-xl border px-3 text-sm font-medium dl-transition',
              idx === i
                ? 'border-a-500 bg-a-50 text-a-700 dark:bg-a-500/20 dark:text-a-300'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300',
            )}
          >
            {i + 1}. {k.name}
            {right(k) ? ' ✓' : ''}
          </button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_17rem]">
        <div className="rounded-xl bg-slate-50 p-2 dark:bg-slate-800/40">
          <GraphView
            graph={c.graph}
            positions={c.positions}
            nodeBadges={badgeOf(c.graph)}
            nodeColors={oddColors(c.graph)}
            ariaLabel={`${c.name}：${nodesOf(c.graph).map((n) => `${n} 的度数是 ${degree(c.graph, n)}`).join('，')}`}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Card className="p-3">
            <SectionTitle hint="先数奇度点，再下结论">你的预测</SectionTitle>
            <div className="flex gap-2">
              <Btn
                variant={guess[c.id] === true ? 'primary' : 'outline'}
                size="sm"
                aria-label="我猜能一笔画"
                onClick={() => answer(true)}
              >
                我猜能
              </Btn>
              <Btn
                variant={guess[c.id] === false ? 'primary' : 'outline'}
                size="sm"
                aria-label="我猜不能一笔画"
                onClick={() => answer(false)}
              >
                我猜不能
              </Btn>
            </div>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              {c.id in guess ? '已经记下你的猜测。' : '先猜一个，再揭晓。'}
            </p>
            <div className="mt-2">
              <Btn variant="primary" size="sm" onClick={reveal} disabled={!(c.id in guess) || revealed.includes(c.id)}>
                {revealed.includes(c.id) ? '已经揭晓' : '揭晓'}
              </Btn>
            </div>
          </Card>

          <Callout tone="info">{c.note}</Callout>

          {revealed.includes(c.id) ? (
            <Callout tone={verdict.hasPath === guess[c.id] ? 'ok' : 'bad'} role="status">
              <b>{verdict.title}</b>
              <br />
              {verdict.plain}
            </Callout>
          ) : null}

          <Card className="p-3">
            <SectionTitle>判据算出来的</SectionTitle>
            <p className="text-sm text-slate-700 dark:text-slate-200">
              奇度点：{odd.length === 0 ? '0 个' : `${odd.join('、')}（${odd.length} 个）`}
            </p>
            <p className="text-sm text-slate-700 dark:text-slate-200">
              连通（忽略孤立点）：{isConnectedIgnoringIsolated(c.graph) ? '是' : '不是'}
            </p>
          </Card>

          <div className="flex flex-wrap gap-1.5">
            {CASES.map((k) => (
              <Chip key={k.id} tone={right(k) ? 'ok' : 'dim'} showGlyph={false}>
                {k.id === c.id ? '当前 ' : ''}
                {right(k) ? '✓' : '·'}
              </Chip>
            ))}
          </div>
        </div>
      </div>

      <Callout tone={CASES.every(right) ? 'ok' : 'cur'} role="status">
        {CASES.every(right)
          ? '五张图全猜对了 —— 说明你是在用判据，不是在靠感觉。'
          : `已经答对 ${CASES.filter(right).length} / 5 张。猜错也没关系，看看判据是怎么算的就明白了。`}
      </Callout>

      <Card>
        <SectionTitle hint="一句话本质">为什么奇度点决定了一切</SectionTitle>
        <PlainSpeak>
          一笔画的过程里，除了出发点和终点，每到一个点都必须「进去、再出来」，用的是两条边 ——
          所以这些点的度数一定是偶数。能当例外的只有出发点和终点，最多两个。这就是判据的全部秘密。
        </PlainSpeak>
      </Card>
    </div>
  )
}

/* ============================================================== 导出 */

const topic: Topic = {
  id: 'G3',
  title: '欧拉路径与七桥问题',
  moduleId: 'graph',
  oneLiner: '一笔画走完所有桥，到底行不行？',
  outcome: '你能数出奇度点的个数，并据此判断一张图能不能一笔画走完。',
  prerequisites: ['G2'],
  bigIdea:
    '能不能一笔画走遍所有的边，只取决于一件事：奇度点有几个。0 个能走成回路，2 个能走成路径，再多就走不了。',
  misconceptions: [
    {
      wrong: '欧拉路径要「不重复经过点」',
      right: '欧拉路径要求的是一条边都不重复，点可以反复经过（比如十字路口就得走两次）。「点不重复」是另一回事，叫哈密顿路径。',
    },
    {
      wrong: '只要图是连通的就一定能一笔画',
      right: '连通只是条件之一。还要看奇度点：4 个或更多就画不出来了，柯尼斯堡就是例子。',
    },
    {
      wrong: '柯尼斯堡有 7 座桥，所以奇度点是 7 个',
      right: '奇度点看的是「每块陆地连出去几座桥」：A 连 5 座，B 连 4 座，C 连 4 座，D 连 3 座，所以是 4 个奇度点 —— 跟桥的总数没有关系。',
    },
    {
      wrong: '孤立点会让图不连通，于是不能一笔画',
      right: '孤立点一条边都没有，走不走到它都不影响。判断连通性时要先把孤立点去掉，只看有边的部分。',
    },
  ],
  formalDefinition: (
    <>
      <p>
        <b>欧拉路径：</b>经过每条边<b>恰好一次</b>的迹（点可以重复）。
      </p>
      <p>
        <b>欧拉回路：</b>首尾相接的欧拉路径。
      </p>
      <p>
        <b>判据（无向图）：</b>设 G 去掉孤立点后连通，则
        <Formula block>
          G 有欧拉回路 ⟺ 所有点的度数都是偶数；G 有欧拉路径 ⟺ 恰有 2 个奇度点
        </Formula>
      </p>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        理由：一笔画中除起点和终点外的每个点都「进一次、出一次」，度数是偶数；只有起点和终点可以例外，
        所以奇度点最多 2 个。又由握手定理，奇度点个数一定是偶数。
      </p>
    </>
  ),
  glossary: [
    { term: '奇度点', plain: '连出去的边数是奇数的点。', formal: 'deg(v) 为奇数的 v' },
    { term: '迹 / 一笔画', plain: '沿着边一路走下去，每条边最多走一次。', formal: 'edges 两两不同的 walk' },
    { term: '欧拉路径', plain: '把每一条边都恰好走一次的走法。', formal: '包含 G 全部边的 trail' },
    { term: '欧拉回路', plain: '欧拉路径，而且还回到了出发点。', formal: '闭合的欧拉迹' },
    { term: '连通（忽略孤立点）', plain: '把一条边都没有的点先扔掉，剩下的部分还能互相走到。', formal: '非孤立点诱导子图连通' },
    { term: '多重图', plain: '两个点之间可以有好几条边。柯尼斯堡的两座桥就是两条边。', formal: '允许平行边的图' },
  ],
  stages: [
    {
      label: '① 看一看',
      short: '看',
      narration: '先不看公式。柯尼斯堡有 7 座桥，点一点每块陆地，数数它连出去几座桥。',
      requireSolve: true,
      hints: [
        '点一下每块陆地，系统会告诉你它连出去几座桥。',
        '注意桥数的奇偶：有的陆地连出去 5 座，有的连出去 3 座。',
        'A 连 5 座、B 连 4 座、C 连 4 座、D 连 3 座 —— 四块陆地全是奇数。',
      ],
      render: (ctx) => <HookStage ctx={ctx} />,
    },
    {
      label: '② 玩一玩',
      short: '玩',
      narration: '亲手去走一遍。每座桥只能走一次，走错了会告诉你为什么。',
      requireSolve: true,
      hints: [
        '从任意一块陆地出发，点一个和它相邻的陆地就走一步。规则是每座桥只能用一次。',
        '七桥那张图你会走不动 —— 那是正常的。换成「第二张图」再试，那张能走完。',
        '第二张图从 A（或 D）出发：A → B → C → D → A → C，五座桥各走一次，正好走完。',
      ],
      render: (ctx) => <ExploreStage ctx={ctx} />,
    },
    {
      label: '③ 起个名',
      short: '名',
      narration: '你试出来的规律，欧拉两百年前就写成了两句话。把它们配上对。',
      requireSolve: true,
      hints: [
        '先数奇度点，再判断图连不连通 —— 这两件事决定一切。',
        '奇度点 0 个能走回起点；奇度点 2 个只能走成一条路；奇度点 4 个走不出来。',
        '配对依次是：奇度点 0 个—有欧拉回路；2 个—有欧拉路径但没回路；4 个—没有一笔画走法；不连通—也没有。',
      ],
      render: (ctx) => <NameStage ctx={ctx} />,
    },
    {
      label: '④ 练一练',
      short: '练',
      narration: '三道小题。选错了没有惩罚，会直接告诉你错在哪。',
      requireSolve: true,
      hints: [
        '每题都先问自己：奇度点有几个？图连通吗？',
        '一笔画里除起点终点外，每个点都要「进一次、出一次」，所以度数必须是偶数。',
        '三道题的答案依次是：奇度点有 4 个；忽略孤立点连通且全是偶度点；一定没有一笔画走法。',
      ],
      render: (ctx) => <PracticeStage ctx={ctx} />,
    },
    {
      label: '⑤ 换个场景',
      short: '变',
      narration: '五张不同的图。先猜能不能一笔画，再点揭晓 —— 看看你是真会用判据还是靠感觉。',
      requireSolve: true,
      hints: [
        '别急着看图的样子。先在心里把每个点的度数数出来。',
        '度数是奇数的点有 0 个还是 2 个？超过 2 个就没戏；还要看是不是分成两片。',
        '五张图的答案：三角形能（0 个奇度点）；折线能（A、D 两个奇度点）；四角星不能（4 个奇度点）；两条分开的线不能（不连通）；五边形加尾巴能（A、F 两个奇度点）。',
      ],
      render: (ctx) => <TransferStage ctx={ctx} />,
    },
  ],
}

export default topic
