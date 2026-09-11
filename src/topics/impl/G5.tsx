import { useCallback, useMemo, useState } from 'react'

import { GraphView } from '@/primitives'
import {
  dijkstra,
  fmtDist,
  makeGraph,
  reconstructPath,
  type DijkstraState,
  type Graph,
} from '@/kernels/graph'
import { circleLayout, type Positions } from '@/kernels/layout'
import { useStepper } from '@/platform/useStepper'
import {
  Btn,
  Callout,
  Card,
  Chip,
  Math as Formula,
  NarratorBar,
  PlainSpeak,
  SectionTitle,
  SliderRow,
  StepControls,
  cx,
} from '@/ui'
import { Quiz } from '@/ui/Quiz'
import { useSolveOnce } from '../hooks'
import type { StageCtx, Topic } from '../types'

const NODES = ['A', 'B', 'C', 'D', 'E', 'F']
const POS: Positions = circleLayout(NODES, 170, 152, 108)

const BASE_PAIRS: [string, string, number][] = [
  ['A', 'B', 4],
  ['A', 'C', 2],
  ['B', 'C', 1],
  ['B', 'D', 5],
  ['C', 'D', 8],
  ['C', 'E', 10],
  ['D', 'E', 2],
  ['E', 'F', 3],
]

const START = 'A'
const HOOK_TARGET = 'E'

const badgeFrom = (dist: Record<string, number> | undefined): Record<string, string> => {
  const out: Record<string, string> = {}
  for (const n of NODES) out[n] = fmtDist(dist?.[n])
  return out
}

/** 一条边的两个端点（无向） */
const endsOf = (p: [string, string, number]): [string, string] => [p[0], p[1]]

/* ============================================================== ① 看一看 */

function HookStage({ ctx }: { ctx: StageCtx }) {
  const graph = useMemo(() => makeGraph(NODES, BASE_PAIRS), [])
  const trueDist = useMemo(() => dijkstra(graph, START), [graph])
  const best = useMemo(() => {
    const steps = trueDist
    const last = steps[steps.length - 1]?.snapshot as DijkstraState | undefined
    return last?.dist[HOOK_TARGET] ?? Infinity
  }, [trueDist])

  const [path, setPath] = useState<[string, string][]>([])
  const [msg, setMsg] = useState(`从 ${START} 出发，沿着边一路点到 ${HOOK_TARGET}，看看你走出来的总代价是多少。`)
  const [tone, setTone] = useState<'normal' | 'reject' | 'accept'>('normal')
  const [finished, setFinished] = useState(false)

  const at = path.length === 0 ? START : path[path.length - 1][1]
  const total = path.reduce((s, [u, v]) => {
    const e = BASE_PAIRS.find(([a, b]) => (a === u && b === v) || (a === v && b === u))
    return s + (e?.[2] ?? 0)
  }, 0)

  const visited = useMemo(() => {
    const s = new Set<string>([START])
    for (const [u, v] of path) {
      s.add(u)
      s.add(v)
    }
    return [...s]
  }, [path])

  const edgeIds = useMemo(
    () =>
      path
        .map(([u, v]) => {
          const i = BASE_PAIRS.findIndex(([a, b]) => (a === u && b === v) || (a === v && b === u))
          return i >= 0 ? `e${i}` : null
        })
        .filter((x): x is string => x !== null),
    [path],
  )

  const talk = useCallback(
    (text: string, t: 'normal' | 'reject' | 'accept') => {
      setMsg(text)
      setTone(t)
      ctx.say(text, t)
    },
    [ctx],
  )

  const clickEdge = useCallback(
    (id: string) => {
      const i = Number(id.slice(1))
      const pair = BASE_PAIRS[i]
      if (!pair) return
      const [u, v] = endsOf(pair)
      if (finished) {
        talk('已经走到 E 了。点「重新走」可以再试一条别的路。', 'normal')
        return
      }
      if (u !== at && v !== at) {
        talk(`这条边是 ${u}–${v}，接不上你现在的落脚点 ${at}。下一段路必须从 ${at} 出发。`, 'reject')
        return
      }
      const next = v === at ? u : v
      const e = BASE_PAIRS[i]
      const nextPath = [...path, [at, next] as [string, string]]
      const nextTotal = total + e[2]
      setPath(nextPath)
      if (next === HOOK_TARGET) {
        setFinished(true)
        const close = nextTotal === best
        talk(
          `你走的这条路一共花了 ${nextTotal}。${close ? '这就是最省的那条！' : `其实还有更省的路，最省只要 ${best}。`}`,
          close ? 'accept' : 'reject',
        )
        ctx.announce(`走到 E 了，总代价 ${nextTotal}，最短是 ${best}。`)
      } else {
        talk(`走到 ${next} 了，目前花了 ${nextTotal}。接着从 ${next} 出发往下走。`, 'normal')
      }
    },
    [at, best, ctx, finished, path, talk, total],
  )

  const reset = (): void => {
    setPath([])
    setFinished(false)
    talk(`重新从 ${START} 出发。`, 'normal')
  }

  useSolveOnce(ctx, finished)

  return (
    <div className="flex flex-col gap-3">
      <PlainSpeak>
        手机导航在算「从 A 到 E 怎么走最近」。每条路上标的数字是走这段要花的代价。
        你先用眼睛估一条路：点边的标签，点出一条从 <b>A</b> 到 <b>E</b> 的通路。
      </PlainSpeak>

      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_16rem]">
        <div className="rounded-xl bg-slate-50 p-2 dark:bg-slate-800/40">
          <GraphView
            graph={graph}
            positions={POS}
            highlightNodes={visited}
            highlightEdges={edgeIds}
            nodeBadges={badgeFrom(undefined)}
            edgeLabels={Object.fromEntries(graph.edges.map((e) => [e.id, String(e.w)]))}
            onEdgeClick={clickEdge}
            ariaLabel="带代价的地图，点边可以走一段路"
            keyboardHint="用 Tab 选中一条边，按 Enter 走这一段。"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Card className="p-3">
            <SectionTitle>你走的路</SectionTitle>
            <p className="font-mono text-sm text-slate-700 dark:text-slate-200">
              {path.length === 0 ? `还在 ${START}` : [START, ...path.map((x) => x[1])].join(' → ')}
            </p>
            <p className="mt-1 text-sm">
              目前总代价：<b className="font-mono">{total}</b>
            </p>
            <div className="mt-2 flex gap-2">
              <Btn size="sm" variant="ghost" onClick={reset} disabled={path.length === 0} aria-label="清空重新走一条路">
                重新走
              </Btn>
            </div>
          </Card>

          <Callout tone={tone === 'accept' ? 'ok' : tone === 'reject' ? 'bad' : 'info'} role="status">
            {msg}
          </Callout>

          <Callout tone="cur" title="先别急着算">
            靠眼睛估，很容易漏掉「绕远反而更省」的路。下一步我们用算法一步一步算给你看。
          </Callout>
        </div>
      </div>
    </div>
  )
}

/* ============================================================== ② 玩一玩 */

/** 两次「你来选下一个」的检查点：分别在第 1 个点和第 4 个点确定之后 */
const CHECKPOINTS: { id: string; settledAt: number; need: number }[] = [
  { id: 'k1', settledAt: 0, need: 1 },
  { id: 'k2', settledAt: 3, need: 4 },
  { id: 'k3', settledAt: 4, need: 5 },
]

function ExploreStage({ ctx }: { ctx: StageCtx }) {
  const steps = useMemo(() => dijkstra(makeGraph(NODES, BASE_PAIRS), START), [])
  const stepper = useStepper<DijkstraState>(steps, `dijkstra-${START}`)
  const snap = stepper.step?.snapshot
  const settledCount = snap?.settled.length ?? 0

  const [picked, setPicked] = useState<Record<string, string>>({})
  const [okSet, setOkSet] = useState<string[]>([])
  const [doneSet, setDoneSet] = useState<string[]>([])
  const [msg, setMsg] = useState(
    '在还没确定的点里，挑一个你认为「距离最小」的点确定下来。选完算法会告诉你对不对。',
  )
  const [tone, setTone] = useState<'normal' | 'reject' | 'accept'>('normal')

  /** 每个检查点对应的「算法确定下一个点」那一步 */
  const settleIndexes = useMemo(
    () => steps.map((s, i) => ({ i, current: s.snapshot.current })).filter((x) => x.current !== null).map((x) => x.i),
    [steps],
  )

  const threshold = (need: number): number => settleIndexes[Math.min(need - 1, settleIndexes.length - 1)] ?? 0

  const nextCheck =
    CHECKPOINTS.find((c) => !doneSet.includes(c.id) && settledCount >= c.settledAt) ?? null

  const targetIndex = nextCheck ? threshold(nextCheck.need) : 0
  const targetSnap = steps[targetIndex]?.snapshot
  const expected = targetSnap?.current ?? null
  const candidates = NODES.filter((n) => !(snap?.settled ?? []).includes(n))

  const talk = useCallback(
    (text: string, t: 'normal' | 'reject' | 'accept') => {
      setMsg(text)
      setTone(t)
      ctx.say(text, t)
    },
    [ctx],
  )

  const choose = (id: string): void => {
    if (!nextCheck || !expected) return
    setPicked((p) => ({ ...p, [nextCheck.id]: id }))
    if (id === expected) {
      const d = targetSnap?.dist[id] ?? Infinity
      setOkSet((s) => (s.includes(nextCheck.id) ? s : [...s, nextCheck.id]))
      setDoneSet((s) => [...s, nextCheck.id])
      stepper.goTo(targetIndex)
      talk(`对，就是 ${id}（距离 ${fmtDist(d)}），把它确定下来。接着往下看算法怎么更新它的邻居。`, 'accept')
      ctx.announce(`选对了，下一个确定 ${id}。`)
      return
    }
    const yourD = targetSnap?.dist[id] ?? Infinity
    const bestD = targetSnap?.dist[expected] ?? Infinity
    talk(
      `现在还不能确定 ${id}：它的当前距离是 ${fmtDist(yourD)}，而 ${expected} 只有 ${fmtDist(bestD)}。` +
        `在所有没确定的点里，${id} 不是最近的那个。先确定它不是「错」，只是没有意义 —— ` +
        `因为后面很可能从 ${expected} 绕过去，把 ${id} 的距离改小。所以算法每次都挑最小的那个。`,
      'reject',
    )
    ctx.announce(`先选 ${id} 不合适：它的距离是 ${fmtDist(yourD)}，比 ${expected} 的 ${fmtDist(bestD)} 大。`)
  }

  useSolveOnce(ctx, okSet.length >= CHECKPOINTS.length)

  const highlightEdges = (stepper.step?.highlight ?? []).filter((h) => h.startsWith('e'))
  const finalSnap = steps[steps.length - 1]?.snapshot

  return (
    <div className="flex flex-col gap-3">
      <PlainSpeak>
        算法每一步只做一件事：<b>在还没确定的点里，挑当前距离最小的那个，把它定下来</b>。
        这次让你来挑。点下面的点，算法会告诉你挑得对不对、为什么。
      </PlainSpeak>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="rounded-xl bg-slate-50 p-2 dark:bg-slate-800/40">
          <GraphView
            graph={makeGraph(NODES, BASE_PAIRS)}
            positions={POS}
            highlightNodes={snap?.settled ?? []}
            highlightEdges={highlightEdges}
            nodeBadges={badgeFrom(snap?.dist)}
            edgeLabels={Object.fromEntries(makeGraph(NODES, BASE_PAIRS).edges.map((e) => [e.id, String(e.w)]))}
            ariaLabel="Dijkstra 执行中的图，角标是起点到它的当前最短距离"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Card>
            <SectionTitle hint="角标 = 当前最短距离">距离表</SectionTitle>
            <ul className="flex flex-col gap-1 font-mono text-sm">
              {NODES.map((n) => {
                const settled = (snap?.settled ?? []).includes(n)
                return (
                  <li key={n} className="flex items-center justify-between gap-2">
                    <span className={cx('w-14', settled ? 'text-ok-600 dark:text-ok-500' : 'text-slate-500')}>
                      {n}
                      {settled ? ' ✓' : n === START ? ' 起点' : ''}
                    </span>
                    <span className="flex-1 text-right text-slate-800 dark:text-slate-100">
                      {fmtDist(snap?.dist?.[n])}
                    </span>
                    <span className="w-16 text-right text-xs text-slate-400">
                      {snap?.prev?.[n] ? `从 ${snap.prev[n]} 来` : ''}
                    </span>
                  </li>
                )
              })}
            </ul>
          </Card>

          <Card>
            <SectionTitle hint="选错了会解释为什么">你来选下一个</SectionTitle>
            {nextCheck ? (
              <>
                <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">
                  已经确定：{(snap?.settled ?? []).join('、') || '（还没有）'}
                </p>
                <div className="flex flex-wrap gap-2" role="group" aria-label="选一个要确定的点">
                  {candidates.map((n) => (
                    <button
                      key={n}
                      type="button"
                      aria-label={`确定点 ${n}`}
                      onClick={() => choose(n)}
                      className={cx(
                        'min-h-11 min-w-11 rounded-xl border px-3 font-mono text-sm font-semibold dl-transition',
                        picked[nextCheck.id] === n
                          ? okSet.includes(nextCheck.id)
                            ? 'border-ok-500 bg-ok-50 text-ok-700 dark:bg-ok-500/10 dark:text-ok-500'
                            : 'border-bad-500 bg-bad-50 text-bad-700 dark:bg-bad-500/10 dark:text-bad-500'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-a-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200',
                      )}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-sm text-slate-600 dark:text-slate-300">
                三步都选对了！剩下的交给算法，用下面的播放条继续看完就行。
              </p>
            )}
          </Card>

          <Callout tone={tone === 'accept' ? 'ok' : tone === 'reject' ? 'bad' : 'info'} role="status">
            {msg}
          </Callout>
        </div>
      </div>

      <NarratorBar tone={stepper.step?.tone === 'reject' ? 'reject' : stepper.step?.tone === 'accept' ? 'accept' : 'normal'}>
        {stepper.step?.explanation ?? ''}
      </NarratorBar>

      <Card>
        <StepControls api={stepper} label="最短路" />
      </Card>

      <div className="flex flex-wrap gap-1.5">
        <Chip tone="ok">绿点 = 已经确定</Chip>
        <Chip tone="dim" showGlyph={false}>
          角标 ∞ 表示还没找到路
        </Chip>
        <Chip tone="cur">黄线 = 本步在看的边</Chip>
      </div>

      {okSet.length >= CHECKPOINTS.length && finalSnap ? (
        <Callout tone="ok" title="选完了，看看最终结果">
          起点 {START} 到各点的最短距离：
          {NODES.map((n) => `${n}=${fmtDist(finalSnap.dist[n])}`).join('，')}
          。用上面播放条上的进度条，你可以任意往前拖、往回拖，把每一步都重新看一遍。
        </Callout>
      ) : null}
    </div>
  )
}

/* ============================================================== ③ 起个名 */

interface Sentence {
  id: string
  front: string
  options: [string, string]
  answer: 0 | 1
  why: string
}

const SENTENCES: Sentence[] = [
  {
    id: 's1',
    front: '每一轮，算法从「还没确定的点」里挑哪个？',
    options: ['当前距离最小的那个', '编号最小的那个'],
    answer: 0,
    why: '挑距离最小的那个。因为距离最小的点不可能再被别人绕近 —— 别人要绕过去，先得自己有个更小的距离。',
  },
  {
    id: 's2',
    front: '一个点被确定下来之后，它的距离还会变吗？',
    options: ['不会，它的最短距离已经定死了', '会，后面可能发现更近的路'],
    answer: 0,
    why: '不会再变。要把它改小，就得经过某个「还没确定且距离更大」的点，那条路只会更长。这就是贪心的正确性。',
  },
  {
    id: 's3',
    front: '边上的数字可以是负数吗？',
    options: ['不行，Dijkstra 要求非负权', '可以，负数也能算'],
    answer: 0,
    why: '不行。如果有负权，「先确定最小的」这个理由就不成立了：先确定大的点，后面反而可能通过负边绕出更短的路，已经确定的值就错了。',
  },
  {
    id: 's4',
    front: '起点到它自己的最短距离是多少？',
    options: ['0', '边里最大的那个数字'],
    answer: 0,
    why: '是 0。站在原地什么都不用走，代价就是 0。其余的点一开始都不知道有多远，先记成 ∞。',
  },
]

function NameStage({ ctx }: { ctx: StageCtx }) {
  const [picked, setPicked] = useState<Record<string, number>>({})
  const rightCount = SENTENCES.filter((s) => picked[s.id] === s.answer).length
  useSolveOnce(ctx, rightCount === SENTENCES.length)

  return (
    <div className="flex flex-col gap-4">
      <PlainSpeak>
        你刚才做的事，Dijkstra 在 1956 年想出来的时候就写成了一句话：
        <b>每次从还没确定的点里，挑当前距离最小的那个，把它确定下来，然后看看能不能借它把别人变近。</b>
      </PlainSpeak>

      <Card>
        <SectionTitle hint="四句话，每句选一个说法">把它说准确</SectionTitle>
        <ul className="flex flex-col gap-4">
          {SENTENCES.map((s) => {
            const p = picked[s.id]
            return (
              <li key={s.id} className="flex flex-col gap-2">
                <p className="text-sm text-slate-700 dark:text-slate-200">{s.front}</p>
                <div className="flex flex-wrap gap-2">
                  {s.options.map((o, i) => {
                    const active = p === i
                    const good = active && i === s.answer
                    const bad = active && i !== s.answer
                    return (
                      <button
                        key={o}
                        type="button"
                        aria-pressed={active}
                        aria-label={o}
                        onClick={() => setPicked((prev) => ({ ...prev, [s.id]: i }))}
                        className={cx(
                          'min-h-11 rounded-xl border px-3 text-left text-sm dl-transition',
                          good
                            ? 'border-ok-500 bg-ok-50 text-ok-700 dark:bg-ok-500/10 dark:text-ok-500'
                            : bad
                              ? 'border-bad-500 bg-bad-50 text-bad-700 dark:bg-bad-500/10 dark:text-bad-500'
                              : 'border-slate-200 bg-white text-slate-700 hover:border-a-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200',
                        )}
                      >
                        {o}
                      </button>
                    )
                  })}
                </div>
                {p !== undefined ? (
                  <Callout tone={p === s.answer ? 'ok' : 'bad'}>{s.why}</Callout>
                ) : null}
              </li>
            )
          })}
        </ul>
      </Card>

      <Callout tone={rightCount === SENTENCES.length ? 'ok' : 'info'} role="status">
        四句里已经有 {rightCount} 句说对了。
      </Callout>

      <Card>
        <SectionTitle hint="算法只有这几行">算法在做什么</SectionTitle>
        <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-sm text-slate-700 dark:text-slate-200">
          <li>
            起点到自己是 <Formula>0</Formula>，其它点先都记成 <Formula>∞</Formula>（还不知道有多远）。
          </li>
          <li>在没确定的点里，挑当前距离最小的那个，把它标成「确定」。</li>
          <li>看它的每个邻居：如果「绕过来」更近，就把邻居的距离改小，并记下「是从它来的」。</li>
          <li>重复第 2、3 步，直到所有能到的点都被确定。</li>
        </ol>
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          为什么第 2 步挑最小的一定对？因为别的还没确定的点距离都更大，而所有边的代价都不是负数 ——
          从更远的点绕过去，只会更远，不可能更近。
        </p>
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
          question={<>Dijkstra 为什么不能处理负权边？</>}
          resetKey="g5p1"
          onSolved={bump}
          choices={[
            {
              id: 'a',
              label: '因为「先确定距离最小的点」这个理由会失效：后面可能通过负边绕出一条更短的路',
              correct: true,
              why: '对。算法的正确性全靠「距离最小的点不可能再被绕近」。有负权时这句话就不成立了 —— 一条负边能让绕远的路反而变短，已经确定的值就被推翻了。',
            },
            {
              id: 'b',
              label: '因为负数没法参与加法',
              correct: false,
              why: '不对。负数当然能相加。问题不在算术上，而在于贪心的理由失效了。',
            },
            {
              id: 'c',
              label: '因为距离表里存不下负数',
              correct: false,
              why: '不对。表格存负数毫无问题。',
            },
            {
              id: 'd',
              label: '其实可以处理负边，只是慢一点',
              correct: false,
              why: '不对。不是慢的问题，是会算错。要处理负权得换成 Bellman-Ford 这类算法。',
            },
          ]}
        />
      </Card>

      <Card>
        <Quiz
          question={<>一个点已经被「确定」了。后面的步骤里，它到起点的最短距离还可能变小吗？</>}
          resetKey="g5p2"
          onSolved={bump}
          choices={[
            {
              id: 'a',
              label: '不会。它能被确定，就是因为当时没有更近的路了',
              correct: true,
              why: '对。它被挑中时，是所有没确定的点里距离最小的。想让它变小，就得从别的没确定的点绕过去，可那些点的距离都比它大，加上非负的边只会更大。所以确定之后就锁死了。',
            },
            {
              id: 'b',
              label: '会。后面可能发现有更近的路',
              correct: false,
              why: '不对。如果会变小，那说明算法挑错了 —— 而这正是在没有负权的前提下不会发生的事。',
            },
            {
              id: 'c',
              label: '要看这个点的度数大不大',
              correct: false,
              why: '不对。度数与「确定之后还会不会变」没有关系，决定这件事的是边权非负。',
            },
          ]}
        />
      </Card>

      <Card>
        <Quiz
          question={<>起点 A 到它自己的最短距离是多少？为什么？</>}
          resetKey="g5p3"
          onSolved={bump}
          choices={[
            {
              id: 'a',
              label: '0，因为站在原地什么都不用走',
              correct: true,
              why: '对。距离衡量的是「从起点走到那儿要花多少代价」，哪儿都不去代价自然就是 0。这也是算法一开始就把起点设成 0 的原因。',
            },
            {
              id: 'b',
              label: '∞，因为 A 到 A 没有边',
              correct: false,
              why: '不对。∞ 只用来表示「暂时还不知道怎么过去」。起点当然到得了自己。',
            },
            {
              id: 'c',
              label: '最小那条边的权重',
              correct: false,
              why: '不对。那是从 A 走到邻居的代价，不是走到自己。',
            },
          ]}
        />
      </Card>
    </div>
  )
}

/* ============================================================== ⑤ 换个场景 */

function TransferStage({ ctx }: { ctx: StageCtx }) {
  const [pairs, setPairs] = useState<[string, string, number][]>(BASE_PAIRS.map((p) => [p[0], p[1], p[2]]))
  const [target, setTarget] = useState<string | null>(null)
  const [changed, setChanged] = useState(false)
  const [msg, setMsg] = useState('先点一个终点，看看从 A 到它的最短路线和总代价。')

  const graph: Graph = useMemo(() => makeGraph(NODES, pairs), [pairs])
  const steps = useMemo(() => dijkstra(graph, START), [graph])
  const final = steps[steps.length - 1]?.snapshot as DijkstraState | undefined
  const path = useMemo(
    () => (target && final ? reconstructPath(final, START, target) : []),
    [final, target],
  )

  const pathEdges = useMemo(() => {
    const ids: string[] = []
    for (let i = 1; i < path.length; i++) {
      const e = graph.edges.find(
        (x) => (x.u === path[i - 1] && x.v === path[i]) || (x.v === path[i - 1] && x.u === path[i]),
      )
      if (e) ids.push(e.id)
    }
    return ids
  }, [graph, path])

  const totalWeight = pathEdges.reduce((s, id) => s + (graph.edges.find((e) => e.id === id)?.w ?? 0), 0)

  const setWeight = (id: string, w: number): void => {
    setPairs((prev) => prev.map(([a, b, ow], i) => (id === `e${i}` ? [a, b, w] : [a, b, ow])))
    setChanged(true)
    setMsg(`把这条边的代价改成了 ${w}。看看最短路线变了没有 —— 有时候绕远反而更省。`)
    ctx.say('代价改了，重新算一遍。')
  }

  const pick = (id: string): void => {
    setTarget(id)
    setMsg(`终点选 ${id}。图中高亮的就是从 A 到它的最短路线。`)
    ctx.say(`终点 ${id}，最短路线已经画出来了。`)
  }

  useSolveOnce(ctx, target !== null && target !== START && changed)

  return (
    <div className="flex flex-col gap-3">
      <PlainSpeak>
        换个用法：算法跑完之后，可以<b>顺着「从谁来」的记录倒着走回来</b>，把整条最短路线还原出来。
        你指定终点，它就给你路线；你改一条边的代价，路线会跟着变。
      </PlainSpeak>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="rounded-xl bg-slate-50 p-2 dark:bg-slate-800/40">
          <GraphView
            graph={graph}
            positions={POS}
            highlightNodes={path}
            highlightEdges={pathEdges}
            nodeBadges={badgeFrom(final?.dist)}
            edgeLabels={Object.fromEntries(graph.edges.map((e) => [e.id, String(e.w)]))}
            ariaLabel="最短路径还原图，角标是起点到各点的最短距离"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Card>
            <SectionTitle hint="点一个点当终点">从 A 出发，要去哪？</SectionTitle>
            <div className="flex flex-wrap gap-2">
              {NODES.filter((n) => n !== START).map((n) => (
                <button
                  key={n}
                  type="button"
                  aria-pressed={target === n}
                  aria-label={`终点选 ${n}`}
                  onClick={() => pick(n)}
                  className={cx(
                    'min-h-11 min-w-11 rounded-xl border px-3 font-mono text-sm font-semibold dl-transition',
                    target === n
                      ? 'border-a-500 bg-a-50 text-a-700 dark:bg-a-500/20 dark:text-a-300'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-a-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200',
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
          </Card>

          <Callout tone={target ? 'ok' : 'info'} role="status">
            {target ? (
              path.length > 0 ? (
                <>
                  <b>A → {target}</b>：<span className="font-mono">{path.join(' → ')}</span>
                  <br />
                  总代价 <b className="font-mono">{totalWeight}</b>
                  {final ? (
                    <>
                      ，和距离表里的 <span className="font-mono">{fmtDist(final.dist[target])}</span> 一致。
                    </>
                  ) : null}
                </>
              ) : (
                <>从 A 到 {target} 没有路（距离表里是 ∞）。</>
              )
            ) : (
              '还没选终点。点上面的点选一个。'
            )}
          </Callout>

          <p className="text-xs text-slate-500 dark:text-slate-400">{msg}</p>

          <Card>
            <SectionTitle hint="改完立刻重算">改一条边的代价</SectionTitle>
            {pathEdges.length > 0 ? (
              pathEdges.slice(0, 2).map((id) => {
                const e = graph.edges.find((x) => x.id === id)
                if (!e) return null
                return (
                  <div key={id} className="mb-2">
                    <SliderRow
                      label={`${e.u}–${e.v} 的代价（这条边在最短路上）`}
                      min={1}
                      max={9}
                      value={e.w}
                      onChange={(v) => setWeight(id, v)}
                      hint="改完马上能看到路线是否发生变化"
                    />
                  </div>
                )
              })
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-400">先选一个终点，这里会列出这条路线上可以改的边。</p>
            )}
          </Card>

          {changed ? (
            <Callout tone="ok" title="算法的价值在这里">
              你自己改一条边的代价，算法就重新算一遍 —— 这就是导航能实时重算路线的原因。
            </Callout>
          ) : null}
        </div>
      </div>

      <Callout tone={target && changed ? 'ok' : 'cur'} role="status">
        {target && changed
          ? '选了终点、也改过一条边的代价 —— 你已经完整用了一遍最短路径。'
          : '先选一个终点，再改一条边的代价，这一步就算走完了。'}
      </Callout>
    </div>
  )
}

/* ============================================================== 导出 */

const topic: Topic = {
  id: 'G5',
  title: '最短路径 Dijkstra',
  moduleId: 'graph',
  oneLiner: '一步步「确定」每个点，最后拿到最短路线',
  outcome: '你能说清 Dijkstra 每一步在挑哪个点、为什么这么挑，并能读懂它算出的距离表。',
  prerequisites: ['G1'],
  bigIdea:
    'Dijkstra 的全部思想是一句贪心：每次从还没确定的点里挑距离最小的那个，它就再也不可能被绕近了。挑对了，剩下的只是重复。',
  misconceptions: [
    {
      wrong: '每次应该挑离起点「步数最少」的点',
      right: '挑的是「当前距离最小」（按边的代价加权），不是边数最少。一条 3 步但很便宜的路，胜过一条 1 步但很贵的路。',
    },
    {
      wrong: '以后可能发现更短的路，所以确定的点要留个反悔的余地',
      right: '不用。被挑中时它是所有未确定点里距离最小的，而边权都非负，从更远的点绕过来只会更远。所以确定之后就锁死了。',
    },
    {
      wrong: 'Dijkstra 可以处理负权边，只是慢一点',
      right: '不能。有负权时「挑最小的」这个理由失效，已经确定的值会被推翻，结果就是错的。',
    },
    {
      wrong: '距离表里的 ∞ 表示真正的无穷远',
      right: '∞ 只是「暂时还不知道怎么走过去」。随着算法推进，它会一个个变成具体数字。',
    },
  ],
  formalDefinition: (
    <>
      <p>
        <b>松弛（relax）：</b>对边 <Formula>(u, v, w)</Formula>，若 <Formula>dist[u] + w &lt; dist[v]</Formula>，
        则令 <Formula>dist[v] = dist[u] + w</Formula>、<Formula>prev[v] = u</Formula>。
      </p>
      <p>
        <b>初始化：</b>
        <Formula>dist[start] = 0</Formula>，其余 <Formula>dist[v] = ∞</Formula>。
      </p>
      <p>
        <b>循环：</b>在未确定的点中取 <Formula>dist</Formula> 最小者 u，标记为已确定，对 u 的所有邻边做松弛。
      </p>
      <p>
        <b>前提：</b>所有边权 <Formula>w ≥ 0</Formula>。
      </p>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        正确性直觉：被挑中时 u 已是未确定点里距离最小的；任何别的路径要到达 u，都必须先经过某个未确定的点，
        而那个点的距离不小于 <Formula>dist[u]</Formula>，再加上非负的边权，只会更长。所以 <Formula>dist[u]</Formula> 就是最终答案。
      </p>
    </>
  ),
  glossary: [
    { term: '距离 dist[v]', plain: '从起点走到 v，目前知道的最省花法。', formal: '起点到 v 的当前最短距离上界' },
    { term: '已确定 / settled', plain: '这个点的最短距离已经定死了，不会再变。', formal: '已加入最短路集合 S' },
    { term: '松弛 relax', plain: '试着「绕一下」看能不能更近，能就更近。', formal: 'dist[v] = min(dist[v], dist[u] + w)' },
    { term: 'prev 表', plain: '记下「这个点是从谁那儿过来的」，用来倒着还原路线。', formal: '前驱数组' },
    { term: '非负权', plain: '每条边的代价都不小于 0 —— Dijkstra 成立的前提。', formal: '∀e ∈ E, w(e) ≥ 0' },
    { term: '∞', plain: '「还不知道怎么走过去」，不是真的无穷远。', formal: '未发现路径时的初始值' },
  ],
  stages: [
    {
      label: '① 看一看',
      short: '看',
      narration: '先当一回导航：从 A 出发，自己点出一条到 E 的路，看看要花多少。',
      requireSolve: true,
      hints: [
        '第一条边必须接着 A；之后每一条都要接在你现在所在的那个点上。',
        '边上的数字就是这段路的代价，把走过的数字加起来就是总代价。比如 A→C→B→D→E 是 2+1+5+2=10。',
        '一路点边走到 E 就算完成。参考答案：A→C→B→D→E，总代价 10 —— 这就是最省的那条路。',
      ],
      render: (ctx) => <HookStage ctx={ctx} />,
    },
    {
      label: '② 玩一玩',
      short: '玩',
      narration: '这次由你来决定下一个确定哪个点。选错了，算法会告诉你为什么现在还不能选它。',
      requireSolve: true,
      hints: [
        '看看「距离表」里每个点的当前距离，在还没确定的点里挑数字最小的那个。',
        '第一轮距离最小的是 C（距离 2）；再往后要比较的是还没确定的那几个点的当前距离。',
        '三次都挑「当前距离最小的未确定点」就通关。被挑中的点会变成绿点，黄线是本步正在检查的边。',
      ],
      render: (ctx) => <ExploreStage ctx={ctx} />,
    },
    {
      label: '③ 起个名',
      short: '名',
      narration: '你刚才挑点的规则，就是 Dijkstra 的全部思想。四句话，每句选一个说法。',
      requireSolve: true,
      hints: [
        '每一句都在问「算法凭什么这么做」，答案都跟「距离最小的那个」有关。',
        '想想看：已经确定的点为什么以后不会再变小？提醒 —— 所有边的代价都不是负数。',
        '四句都选第一个：挑距离最小的；确定后不会再变；不能有负权边；起点到自己是 0。',
      ],
      render: (ctx) => <NameStage ctx={ctx} />,
    },
    {
      label: '④ 练一练',
      short: '练',
      narration: '三道小题。选错了没有惩罚，会直接告诉你错在哪。',
      requireSolve: true,
      hints: [
        '每题都在问同一件事：为什么「挑最小的」这个做法是站得住的。',
        '关键在于：一旦某点被确定，其它还没确定的点距离都比它大，而边权非负，绕过去只会更远。',
        '三道题的答案依次是：负权会让贪心失效；确定后不会变小；起点到自己是 0。',
      ],
      render: (ctx) => <PracticeStage ctx={ctx} />,
    },
    {
      label: '⑤ 换个场景',
      short: '变',
      narration: '最后反过来用：你指定终点，算法把最短路线还原给你；你改一条边的代价，路线会跟着变。',
      requireSolve: true,
      hints: [
        '先在「从 A 出发，要去哪」里点一个终点，高亮的路线就是最短路。',
        '选完终点后，右边会列出这条路线上可以改的边 —— 拖一下滑块，代价就变了。',
        '随便点一个终点（比如 E），再把路上任意一条边的代价拖一下，这一步就完成了。',
      ],
      render: (ctx) => <TransferStage ctx={ctx} />,
    },
  ],
}

export default topic
