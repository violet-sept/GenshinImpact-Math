import { useCallback, useMemo, useState } from 'react'

import { GraphView, MatrixGrid } from '@/primitives'
import {
  adjacencyListString,
  degrees,
  degreeSequence,
  makeGraph,
  neighbors,
  type Graph,
} from '@/kernels/graph'
import { circleLayout, type Pt } from '@/kernels/layout'
import { Callout, Card, Chip, Math as Formula, PlainSpeak, SectionTitle, cx } from '@/ui'
import { Quiz } from '@/ui/Quiz'
import { useSolveOnce, useTriedSet } from '../hooks'
import type { StageCtx, Topic } from '../types'

const NODES = ['A', 'B', 'C', 'D', 'E']
const BASE_POS = circleLayout(NODES, 170, 152, 100)

/* ============================================================== ① 看一看 */

/** 朋友圈：每个人只和几个熟人来往，把这些「来往」连起来就是一张图 */
const FRIEND_EDGES: [string, string][] = [
  ['A', 'B'],
  ['B', 'C'],
  ['C', 'D'],
  ['D', 'E'],
  ['A', 'E'],
]

const FRIENDS: Record<string, string> = {
  A: '小安',
  B: '小博',
  C: '小成',
  D: '小丁',
  E: '小恩',
}

function HookStage({ ctx }: { ctx: StageCtx }) {
  const graph = useMemo(() => makeGraph(NODES, FRIEND_EDGES), [])
  const { tried, markTried } = useTriedSet()
  const [msg, setMsg] = useState('点一下每个人，看看他和谁有来往。')

  const onNodeClick = useCallback(
    (id: string) => {
      markTried(id)
      const ns = neighbors(graph, id).map((x) => FRIENDS[x.node])
      const text =
        ns.length === 0
          ? `${FRIENDS[id]} 现在谁也不认识。`
          : `${FRIENDS[id]} 和 ${ns.join('、')} 有来往（一共牵了 ${ns.length} 条线）。`
      setMsg(text)
      ctx.say(text)
      ctx.announce(text)
    },
    [ctx, graph, markTried],
  )

  const done = tried.size >= NODES.length
  useSolveOnce(ctx, done)

  return (
    <div className="flex flex-col gap-3">
      <PlainSpeak>
        一个班里有 5 个同学。两个人互相认识，就在他们之间画一条线。
        把所有这些线画出来，就是一张<b>图</b> —— 点一点同学，看看他牵着几条线。
      </PlainSpeak>

      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_15rem]">
        <div className="rounded-xl bg-slate-50 p-2 dark:bg-slate-800/40">
          <GraphView
            graph={graph}
            positions={BASE_POS}
            highlightNodes={[...tried]}
            nodeColors={Object.fromEntries(NODES.map((n) => [n, 'var(--color-b-500)']))}
            nodeLabels={FRIENDS}
            onNodeClick={onNodeClick}
            ariaLabel="五个同学的互相认识关系图"
            keyboardHint="用 Tab 选中一个同学，按 Enter 查看他和谁有来往。"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Callout tone={done ? 'ok' : 'info'} role="status">
            {done ? '五个人都看过了。这张「谁认识谁」的图，就是数学里的图。' : `已经看过 ${tried.size} / 5 个人。`}
          </Callout>

          <Card className="p-3">
            <p className="text-sm text-slate-700 dark:text-slate-200">{msg}</p>
          </Card>

          <p className="text-xs text-slate-500 dark:text-slate-400">
            同学是「点」，认识是「线」。地铁线路图、手机里的好友关系，画出来都是这个样子。
          </p>
        </div>
      </div>
    </div>
  )
}

/* ============================================================== ② 玩一玩 */

/** 任务一：连出一个环 —— 每个点的度数都等于 2 */
const TASKS = ['每个点的度数都是 2', '每个点的度数都是 3', '某个点的度数达到 4'] as const
type Task = (typeof TASKS)[number]

function ExploreStage({ ctx }: { ctx: StageCtx }) {
  const [pairs, setPairs] = useState<[string, string][]>([])
  const [task, setTask] = useState<Task>('每个点的度数都是 2')
  const [positions, setPositions] = useState(BASE_POS)
  const [msg, setMsg] = useState('在左边的矩阵里点一个格子，两个点之间就长出一条边。')

  const graph: Graph = useMemo(() => makeGraph(NODES, pairs), [pairs])
  const deg = useMemo(() => degrees(graph), [graph])
  const seq = useMemo(() => degreeSequence(graph), [graph])
  const list = useMemo(() => adjacencyListString(graph), [graph])

  const matrix = useMemo(
    () => NODES.map((r) => NODES.map((c) => pairs.some(([u, v]) => (u === r && v === c) || (u === c && v === r)))),
    [pairs],
  )

  const talk = useCallback(
    (text: string) => {
      setMsg(text)
      ctx.say(text)
    },
    [ctx],
  )

  const toggle = useCallback(
    (i: number, j: number) => {
      const u = NODES[i]
      const v = NODES[j]
      if (u === v) {
        talk('同一行同一列的格子表示「自己连自己」。这种边叫自环，这里先不管它。')
        return
      }
      const existed = pairs.some(([a, b]) => (a === u && b === v) || (a === v && b === u))
      setPairs((prev) => {
        const idx = prev.findIndex(([a, b]) => (a === u && b === v) || (a === v && b === u))
        if (idx >= 0) return prev.filter((_, k) => k !== idx)
        return [...prev, [u, v] as [string, string]]
      })
      const n = existed ? pairs.length - 1 : pairs.length + 1
      talk(
        existed
          ? `删掉了 ${u}–${v} 这条边，现在还剩 ${n} 条边。`
          : `加上了 ${u}–${v} 这条边。矩阵里 (${u},${v}) 和 (${v},${u}) 两个格子会同时亮 —— 无向图就是这样成对的。`,
      )
    },
    [pairs, talk],
  )

  const onMoveNode = useCallback((id: string, pt: Pt) => {
    setPositions((prev) => ({ ...prev, [id]: { x: Math.round(pt.x), y: Math.round(pt.y) } }))
  }, [])

  const degOK = (d: number): boolean => seq.length === NODES.length && seq.every((x) => x === d)
  const done =
    (task === '每个点的度数都是 2' && degOK(2)) ||
    (task === '每个点的度数都是 3' && degOK(3)) ||
    (task === '某个点的度数达到 4' && NODES.some((n) => (deg[n] ?? 0) >= 4))

  useSolveOnce(ctx, done)

  return (
    <div className="flex flex-col gap-3">
      <PlainSpeak>
        三个面板说的是<b>同一张图</b>，所以改一个，另外两个立刻跟着变。
        先点任务，再在矩阵里点格子连边。
      </PlainSpeak>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-slate-500 dark:text-slate-400">任务：</span>
        {TASKS.map((t) => (
          <button
            key={t}
            type="button"
            aria-pressed={task === t}
            aria-label={`任务：${t}`}
            onClick={() => {
              setTask(t)
              setMsg(`新任务：${t}。`)
            }}
            className={cx(
              'min-h-9 rounded-xl border px-3 text-xs font-medium dl-transition',
              task === t
                ? 'border-a-500 bg-a-50 text-a-700 dark:bg-a-500/20 dark:text-a-300'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300',
            )}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <Card>
          <SectionTitle hint="点格子 = 加边 / 删边">① 邻接矩阵</SectionTitle>
          <MatrixGrid
            rows={NODES}
            cols={NODES}
            data={matrix}
            onToggle={toggle}
            ariaLabel="邻接矩阵：行和列都是 A 到 E，点一下格子就在这两个点之间加一条边或删一条边"
            rowTitle="点"
            colTitle="点"
          />
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            注意看：格子总是<b>成对</b>亮的。A 连着 B，B 也就连着 A —— 所以这个矩阵左右对称。
          </p>
        </Card>

        <Card>
          <SectionTitle hint="角标 = 这个点牵着几条线">② 图</SectionTitle>
          <div className="rounded-xl bg-slate-50 p-1 dark:bg-slate-800/40">
            <GraphView
              graph={graph}
              positions={positions}
              onMoveNode={onMoveNode}
              nodeBadges={Object.fromEntries(NODES.map((n) => [n, String(deg[n] ?? 0)]))}
              ariaLabel={`当前图：${NODES.length} 个点，${graph.edges.length} 条边`}
              keyboardHint="节点可以用 Tab 聚焦后用方向键挪位置，换个看得清的摆法。"
            />
          </div>
          <button
            type="button"
            aria-label="把节点位置恢复成圆形布局"
            onClick={() => setPositions(BASE_POS)}
            className="mt-1 min-h-9 rounded-xl border border-slate-200 px-3 text-xs text-slate-600 dl-transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            位置摆乱了？恢复圆形
          </button>
        </Card>

        <Card>
          <SectionTitle hint="每个点后面列出它牵着的点">③ 邻接表</SectionTitle>
          <ul className="flex flex-col gap-1 font-mono text-sm">
            {NODES.map((n) => (
              <li key={n} className="flex gap-2">
                <span className="w-4 text-slate-500 dark:text-slate-400">{n}</span>
                <span className="text-slate-700 dark:text-slate-200">→ {list[n]}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            「→ ∅」表示这个点谁也不连，一条边都没牵。
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <Chip tone="a" showGlyph={false}>
              {graph.edges.length} 条边
            </Chip>
            <Chip tone="dim" showGlyph={false}>
              度数正好是 {seq.join(' + ')} = {2 * graph.edges.length}
            </Chip>
          </div>
        </Card>
      </div>

      <Callout tone={done ? 'ok' : 'cur'} role="status">
        {done
          ? `${task} —— 做到了！${
              task === '每个点的度数都是 2' ? '这张图就是一个「环」：从任一点出发顺着边走，能绕一圈回到自己。' : ''
            }`
          : `${msg} 当前度数从大到小排是 (${seq.join(', ')})。`}
      </Callout>
    </div>
  )
}

/* ============================================================== ③ 起个名 */

const TERMS: { id: string; term: string; plain: string }[] = [
  { id: 't1', term: '顶点（也叫节点）', plain: '图里的「点」，就是一个人、一座车站、一台电脑。' },
  { id: 't2', term: '边', plain: '两点之间的一条线，表示这两点「有关系」。' },
  { id: 't3', term: '度数', plain: '一个点牵着几条线，它的度数就是几。' },
  { id: 't4', term: '邻接矩阵', plain: '一张方格表。第 u 行第 v 列写 1，就表示 u 和 v 之间有边。' },
  { id: 't5', term: '邻接表', plain: '每一个点后面，直接列出它认识的所有点。' },
]

function NameStage({ ctx }: { ctx: StageCtx }) {
  const [pick, setPick] = useState<string | null>(null)
  const [matched, setMatched] = useState<string[]>([])
  const [wrongRow, setWrongRow] = useState<string | null>(null)

  const current = TERMS.find((t) => !matched.includes(t.id))

  const choose = (id: string): void => {
    if (matched.includes(id)) return
    if (pick === null) {
      setPick(id)
      setWrongRow(null)
      ctx.announce(`选中了「${TERMS.find((t) => t.id === id)?.term}」，再去右边挑它的意思。`)
      return
    }
    const term = TERMS.find((t) => t.id === pick)
    if (!term || !current) return
    if (term.id === current.id) {
      setMatched((m) => [...m, term.id])
      setPick(null)
      setWrongRow(null)
      ctx.say('配上了。')
    } else {
      setPick(null)
      setWrongRow(id)
      ctx.say('这两个配不上，换一个再试。', 'reject')
      ctx.announce('这两个配不上。左边那行的名字，说的不是右边这句话的意思。')
    }
  }

  const done = matched.length === TERMS.length
  useSolveOnce(ctx, done)

  return (
    <div className="flex flex-col gap-4">
      <PlainSpeak>
        你刚才点格子、看图、读表，做的其实是同一件事。
        数学给这件事的每个零件都起了名字 —— 左边点名字，右边点它的意思，配对了它就会亮。
      </PlainSpeak>

      <div className="grid gap-3 sm:grid-cols-2">
        <Card>
          <SectionTitle hint="先点左边，再点右边">名字与意思配对</SectionTitle>
          <div className="flex flex-col gap-2">
            {TERMS.map((t) => {
              const ok = matched.includes(t.id)
              return (
                <button
                  key={t.id}
                  type="button"
                  aria-pressed={pick === t.id}
                  aria-label={`术语：${t.term}`}
                  disabled={ok}
                  onClick={() => choose(t.id)}
                  className={cx(
                    'min-h-11 rounded-xl border px-3 text-left text-sm font-semibold dl-transition',
                    ok
                      ? 'border-ok-500 bg-ok-50 text-ok-700 dark:bg-ok-500/10 dark:text-ok-500'
                      : pick === t.id
                        ? 'border-a-500 bg-a-50 text-a-700 dark:bg-a-500/20 dark:text-a-300'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-a-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200',
                  )}
                >
                  {t.term}
                  {ok ? ' ✓' : ''}
                </button>
              )
            })}
          </div>
        </Card>

        <Card>
          <SectionTitle hint="配对成功的那一行会变绿">它们的说法</SectionTitle>
          <div className="flex flex-col gap-2">
            {TERMS.map((t) => {
              const ok = matched.includes(t.id)
              return (
                <button
                  key={t.id}
                  type="button"
                  aria-label="把这句话和左边的名字配对"
                  disabled={ok}
                  onClick={() => choose(t.id)}
                  className={cx(
                    'min-h-11 rounded-xl border px-3 py-2 text-left text-sm dl-transition',
                    ok
                      ? 'border-ok-500 bg-ok-50 text-ok-700 dark:bg-ok-500/10 dark:text-ok-500'
                      : wrongRow === t.id
                        ? 'border-bad-500 bg-bad-50 text-bad-700 dark:bg-bad-500/10 dark:text-bad-500'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-a-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200',
                  )}
                >
                  {t.plain}
                </button>
              )
            })}
          </div>
        </Card>
      </div>

      <Callout tone={done ? 'ok' : 'info'} role="status">
        {done ? (
          <>
            全部配对完成。最后补一句最要紧的：<b>矩阵是对称的</b>。
            因为「A 认识 B」和「B 认识 A」本来就是同一件事，所以格子里写 1 的地方一定成对出现。
            另外，把每一行里的 1 数一遍，正好就是那个点的度数。
          </>
        ) : (
          <>
            还剩 {TERMS.length - matched.length} 个没配上。
            {wrongRow ? '红色那一行配错了 —— 点左边的名字重新选一次。' : '配错了它会告诉你这两个不是一回事。'}
          </>
        )}
      </Callout>

      <Card>
        <SectionTitle hint="这是后面每个知识点都要用的记法">顺便记住写法</SectionTitle>
        <div className="flex flex-col gap-1.5 text-sm text-slate-700 dark:text-slate-200">
          <p>
            一张图记作 <Formula>G = (V, E)</Formula>，V 是点集，E 是边集。
          </p>
          <p>
            无向图的边 <Formula>{'{u, v}'}</Formula> 没有方向；有向图的边写成 <Formula>(u, v)</Formula> 并且带箭头。
          </p>
          <p>
            所有点的度数加起来，永远等于边数的两倍 —— 这条下一题就要用。
          </p>
        </div>
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
          question={
            <>
              一张无向图有 <b>7 条边</b>。把所有点的度数加起来，等于多少？
            </>
          }
          resetKey="g1p1"
          onSolved={bump}
          choices={[
            {
              id: 'a',
              label: '7',
              correct: false,
              why: '不对。7 是边数。每一条边有两个端点，它给两端的度数各加了 1，所以边数要再乘 2。',
            },
            {
              id: 'b',
              label: '14',
              correct: true,
              why: '对。每条边被两个端点各算一次，所以度数之和 = 2 × 边数 = 2 × 7 = 14。这叫「握手定理」。',
            },
            {
              id: 'c',
              label: '不一定，得看点怎么连',
              correct: false,
              why: '不对。不管怎么连，每条边都正好贡献 2 —— 所以总和永远是边数的两倍，跟连法无关。',
            },
            {
              id: 'd',
              label: '3.5',
              correct: false,
              why: '不对。度数之和一定是整数，而且一定是偶数，不可能出现 3.5。',
            },
          ]}
        />
      </Card>

      <Card>
        <Quiz
          question={<>无向图的邻接矩阵，一定有什么特征？</>}
          resetKey="g1p2"
          onSolved={bump}
          choices={[
            {
              id: 'a',
              label: '关于主对角线对称',
              correct: true,
              why: '对。A 行 B 列是 1 就说明 A 连着 B，那 B 行 A 列也必须是 1。两边互换位置数字不变，这叫矩阵对称。',
            },
            {
              id: 'b',
              label: '主对角线上全是 1',
              correct: false,
              why: '不对。主对角线上的格子表示「自己连自己」，只有带自环的点才是 1。多数图的对角线是 0。',
            },
            {
              id: 'c',
              label: '每一行数字加起来都一样',
              correct: false,
              why: '不对。第 v 行加起来是这个点的度数，不同点的度数通常不一样。',
            },
            {
              id: 'd',
              label: '所有数字加起来等于边数',
              correct: false,
              why: '不对。所有数字加起来等于度数之和，也就是边数的 2 倍。',
            },
          ]}
        />
      </Card>

      <Card>
        <Quiz
          question={<>一个 5 个点的图，每个点的度数都是 2。它一共有几条边？</>}
          resetKey="g1p3"
          onSolved={bump}
          choices={[
            {
              id: 'a',
              label: '5 条',
              correct: true,
              why: '对。度数之和 = 5 × 2 = 10，而度数之和 = 2 × 边数，所以边数 = 10 ÷ 2 = 5。这张图就是一个五边形（环）。',
            },
            {
              id: 'b',
              label: '10 条',
              correct: false,
              why: '不对。10 是度数之和，不是边数。要把度数之和再除以 2 才是边数。',
            },
            {
              id: 'c',
              label: '2 条',
              correct: false,
              why: '不对。2 是每个点的度数，不是总边数。',
            },
            {
              id: 'd',
              label: '4 条',
              correct: false,
              why: '不对。4 条边的话，度数之和只有 8，5 个点分不平（每个点要 2 就是 10）。',
            },
          ]}
        />
      </Card>
    </div>
  )
}

/* ============================================================== ⑤ 换个场景 */

const SIX_NODES = ['A', 'B', 'C', 'D', 'E', 'F']
const SIX_PAIRS: [string, string][] = [
  ['A', 'B'],
  ['A', 'C'],
  ['A', 'D'],
  ['A', 'F'],
  ['B', 'C'],
  ['B', 'D'],
  ['C', 'D'],
  ['C', 'E'],
  ['D', 'E'],
]
const SIX_POS = circleLayout(SIX_NODES, 170, 150, 105)

function TransferStage({ ctx }: { ctx: StageCtx }) {
  const graph = useMemo(() => makeGraph(SIX_NODES, SIX_PAIRS), [])
  const deg = useMemo(() => degrees(graph), [graph])
  /** 各点度数之和 = 2 × 边数 —— 这里顺手算出来，供答题后核对 */
  const handshake = useMemo(() => 2 * graph.edges.length, [graph])
  const [solvedCount, setSolvedCount] = useState(0)
  const bump = (): void => setSolvedCount((c) => c + 1)
  useSolveOnce(ctx, solvedCount >= 2)

  const oddCount = SIX_NODES.filter((n) => (deg[n] ?? 0) % 2 === 1).length

  return (
    <div className="flex flex-col gap-4">
      <PlainSpeak>
        换个场景：这是一张 6 个点的图，角标上是每个点的度数。
        先照着数一数，再回答下面两个问题。
      </PlainSpeak>

      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_16rem]">
        <div className="rounded-xl bg-slate-50 p-2 dark:bg-slate-800/40">
          <GraphView
            graph={graph}
            positions={SIX_POS}
            nodeBadges={Object.fromEntries(SIX_NODES.map((n) => [n, String(deg[n] ?? 0)]))}
            ariaLabel={`六点九边的图，各点度数分别是 ${SIX_NODES.map((n) => `${n} 是 ${deg[n] ?? 0}`).join('，')}`}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Card className="p-3">
            <div className="flex flex-col gap-1 font-mono text-sm">
              {SIX_NODES.map((n) => (
                <div key={n} className="flex justify-between gap-2">
                  <span className="text-slate-500 dark:text-slate-400">deg({n})</span>
                  <span
                    className={cx(
                      'font-semibold',
                      (deg[n] ?? 0) % 2 === 1
                        ? 'text-bad-600 dark:text-bad-500'
                        : 'text-slate-700 dark:text-slate-200',
                    )}
                  >
                    {deg[n] ?? 0}
                  </span>
                </div>
              ))}
            </div>
          </Card>
          <Callout tone="info" role="status">
            度数是奇数的点，用橙色标出来了，一共 <b>{oddCount}</b> 个。
          </Callout>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            数字不确定的时候可以偷看一眼：所有点的度数加起来一定是 {handshake}（也就是 2 × {graph.edges.length} 条边）。
          </p>
        </div>
      </div>

      <Card>
        <Quiz
          question={<>这张图的度序列（把各点度数从大到小排成一列）是？</>}
          resetKey="g1t1"
          onSolved={bump}
          choices={[
            {
              id: 'a',
              label: '(4, 4, 4, 3, 2, 1)',
              correct: true,
              why: '对。各点度数是 A=4、B=3、C=4、D=4、E=2、F=1，从大到小排就是 (4, 4, 4, 3, 2, 1)。顺手验证：加起来是 18，正好等于 2 × 9 条边。',
            },
            {
              id: 'b',
              label: '(9, 9, 9, 9, 9, 9)',
              correct: false,
              why: '不对。9 是边数，不是度数。度数说的是「一个点自己牵着几条线」，不是整张图有几条线。',
            },
            {
              id: 'c',
              label: '(4, 3, 3, 3, 2, 1)',
              correct: false,
              why: '不对。这个序列加起来只有 16，而这张图有 9 条边，度数之和必须是 18。而且 C 和 D 都是 4，不只是 A 一个 4。',
            },
            {
              id: 'd',
              label: '(4, 4, 4, 3, 2, 1) 里 E 应该是 3',
              correct: false,
              why: '不对。E 只连着 C 和 D 两个点，所以度数是 2，不是 3。',
            },
          ]}
        />
      </Card>

      <Card>
        <Quiz
          question={
            <>为什么「度数为奇数的点」一定是偶数个？这张图里有 2 个奇度点（B 和 F），为什么不可能只有 1 个？</>
          }
          resetKey="g1t2"
          onSolved={bump}
          choices={[
            {
              id: 'a',
              label: '因为度数之和 = 2 × 边数，一定是个偶数；偶数度数的点加起来的贡献全是偶数，所以剩下的奇度点必须成对出现',
              correct: true,
              why: '对。度数之和是 18，是偶数。偶度点的贡献都是偶数，把这些偶数去掉，剩下的部分（每个奇度点贡献一个奇数）还得是偶数。而若干个奇数相加要是偶数，奇数的个数就必须是偶数 —— 所以奇度点只能成对出现。',
            },
            {
              id: 'b',
              label: '因为图必须是连通的',
              correct: false,
              why: '不对。不连通的图也一样成立。这条规律跟连不连通没关系，它只跟「每条边贡献 2」有关。',
            },
            {
              id: 'c',
              label: '因为奇度点总是两两配对成一条边',
              correct: false,
              why: '不对。奇度点之间不一定有边，甚至可能离得很远。数量是偶数，并不要求它们两两相连。',
            },
            {
              id: 'd',
              label: '这只是经验，有的图确实有 3 个奇度点',
              correct: false,
              why: '不对。这样的图根本不存在。你可以试着造一张：度数之和会变成奇数，而它必须等于 2 × 边数，矛盾。',
            },
          ]}
        />
      </Card>

      <Callout tone="ok" title="一句话带走">
        度数之和 = 2 × 边数。于是奇度点的个数只能是 0、2、4、6…… 这个结论下一步讲「一笔画」时会派上大用场。
      </Callout>
    </div>
  )
}

/* ============================================================== 导出 */

const topic: Topic = {
  id: 'G1',
  title: '图的基本概念与表示',
  moduleId: 'graph',
  oneLiner: '邻接矩阵、邻接表、图形 —— 同一张图的三种记法',
  outcome: '你能在矩阵、列表、图形之间自由切换，并一眼说出每个点的度数。',
  prerequisites: ['S1'],
  bigIdea:
    '图就是「一堆点 + 一些连线」。把点编上号，连线就可以写成一张方格表（矩阵）或者一串名单（邻接表）—— 三者说的是同一件事，只是记法不同。',
  misconceptions: [
    {
      wrong: '度数之和等于边数',
      right: '度数之和等于边数的两倍。每条边有两个端点，给两端的度数各加了 1，所以每条边被数了两次。',
    },
    {
      wrong: '邻接矩阵的主对角线应该全是 1',
      right: '主对角线上的格子表示「自己连自己」（自环）。普通图没有自环，对角线就是 0。',
    },
    {
      wrong: '邻接表每一行的长度应该一样',
      right: '每个点后面列出的是它自己的邻居，度数不同长度就不同。只有每个点度数都相等时，长度才会一样。',
    },
  ],
  formalDefinition: (
    <>
      <p>
        <b>图：</b>
        <Formula>G = (V, E)</Formula>，V 是非空的点集，E 是边集。
      </p>
      <p>
        <b>无向边：</b>
        <Formula>e = {'{u, v}'}</Formula>，其中 <Formula>u, v ∈ V</Formula> 且 <Formula>u ≠ v</Formula>。
      </p>
      <p>
        <b>度数：</b>
        <Formula>deg(v) = |{'{ e ∈ E : v ∈ e }'}|</Formula>
      </p>
      <p>
        <b>握手定理：</b>
        <Formula>Σ deg(v) = 2|E|</Formula>
      </p>
      <p>
        <b>邻接矩阵：</b>
        <Formula>A[i][j] = 1 ⟺ {'{vᵢ, vⱼ}'} ∈ E</Formula>；无向图满足 <Formula>A = Aᵗ</Formula>。
      </p>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        推论：度数为奇数的点，个数一定是偶数 —— 因为奇数之和要是偶数，奇数就得有偶数个。
      </p>
    </>
  ),
  glossary: [
    { term: '顶点 / 节点', plain: '图里的点点，可以是一个人、一座车站、一台电脑。', formal: 'V 中的元素' },
    { term: '边', plain: '两点之间的一条线，表示这两个点有关系。', formal: "{u, v} ∈ E" },
    { term: '度数 deg(v)', plain: '一个点牵着几条线，它的度数就是几。', formal: '与 v 关联的边数' },
    { term: '邻接矩阵', plain: '一张方格表。第 u 行第 v 列是 1 就表示 u 和 v 之间有边。', formal: 'A[i][j] = 1 ⟺ {vᵢ, vⱼ} ∈ E' },
    { term: '邻接表', plain: '每个点后面直接列出它认识的所有点。', formal: 'v ↦ N(v)' },
    { term: '握手定理', plain: '所有点的度数加起来等于边数的两倍。', formal: 'Σ deg(v) = 2|E|' },
    { term: '度序列', plain: '把每个点的度数从大到小排成一列。', formal: '把 deg(v) 排序后的序列' },
  ],
  stages: [
    {
      label: '① 看一看',
      short: '看',
      narration: '先不看符号。五个同学之间谁认识谁，画出来就是一张图 —— 点一点，看看每个人牵着几条线。',
      requireSolve: true,
      hints: [
        '挨个点一下五个同学，每点一个，系统就会告诉你他和谁有来往。',
        '注意看那个连着两条线的人，以及连着一条线的人 —— 线的条数是不一样的。',
        '五个人都点一遍就算看完。小安认识小博和小恩（2 条线），小成认识小博和小丁（2 条线）。',
      ],
      render: (ctx) => <HookStage ctx={ctx} />,
    },
    {
      label: '② 玩一玩',
      short: '玩',
      narration: '现在自己造一张图。在矩阵里点格子加边，另外两个面板会立刻跟着变。',
      requireSolve: true,
      hints: [
        '先想好要连哪两个点，再去矩阵里找到「行是它、列是它」的那两个对称格子点一下。',
        '目标是每个点的度数都变成 2。看图上每个点右上角的角标，那个数字就是度数。',
        '点这五对格子（顺序无所谓）：A–B、B–C、C–D、D–E、E–A。连完每个点的角标都变成 2，就是一个五边形。',
      ],
      render: (ctx) => <ExploreStage ctx={ctx} />,
    },
    {
      label: '③ 起个名',
      short: '名',
      narration: '你刚才做的事，数学上都起了名字。左边点名字，右边点它的意思。',
      requireSolve: true,
      hints: [
        '先读左边的名字，在心里想「它大概是说哪件事」，再去右边找最贴切的那句。',
        '「度数」说的是线的条数；「邻接矩阵」是一张方格表；「邻接表」是一串名单。',
        '配对依次是：顶点—图里的点；边—两点之间的连线；度数—牵着几条线；邻接矩阵—写 1 的方格表；邻接表—每个点后面列出邻居。',
      ],
      render: (ctx) => <NameStage ctx={ctx} />,
    },
    {
      label: '④ 练一练',
      short: '练',
      narration: '三道小题。选错了没有惩罚，会直接告诉你错在哪。',
      requireSolve: true,
      hints: [
        '凡是问「度数之和」，先想每条边被数了几次。',
        '每条边有两个端点，所以每条边给度数之和贡献 2。',
        '三道题的答案依次是：14；关于主对角线对称；5 条边。',
      ],
      render: (ctx) => <PracticeStage ctx={ctx} />,
    },
    {
      label: '⑤ 换个场景',
      short: '变',
      narration: '最后换个图：照着角标数出每个点的度数，再想一个「为什么一定有偶数个奇度点」的问题。',
      requireSolve: true,
      hints: [
        '先照着图上每个点右上角的角标，把 6 个数字都抄下来，再从大到小排。',
        'A 连着 B、C、D、F，所以是 4；F 只连着 A，所以是 1。',
        '度序列是 (4, 4, 4, 3, 2, 1)。第二题选第一项：度数之和是偶数，偶度点贡献全是偶数，剩下的奇度点必须成对，所以奇度点个数是偶数。',
      ],
      render: (ctx) => <TransferStage ctx={ctx} />,
    },
  ],
}

export default topic
