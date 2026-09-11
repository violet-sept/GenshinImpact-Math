import { useCallback, useMemo, useState } from 'react'

import { GraphView, MatrixGrid } from '@/primitives'
import type { Graph } from '@/kernels/graph'
import { circleLayout } from '@/kernels/layout'
import {
  hasPair,
  relationToString,
  toMatrix,
  togglePair,
  type Relation,
} from '@/kernels/relations'
import { Btn, Callout, Card, Chip, Math, PlainSpeak, SectionTitle, cx } from '@/ui'
import { Quiz } from '@/ui/Quiz'
import { useSolveOnce, useTriedSet } from '../hooks'
import type { StageCtx, Topic } from '../types'

/* ============================================================ 共用小工具 */

/** 有序对的稳定 id，也直接当作有向图的边 id（同一个有序对只会出现一次） */
const E = (a: string, b: string): string => `${a}->${b}`

/** 「谁认识谁」的三种写法都从这一份关系派生：换掉它，三个面板一起变 */
const HOOK_PEOPLE = ['小明', '小红', '小刚']

const HOOK_RELATION: Relation = {
  domain: HOOK_PEOPLE,
  pairs: [
    ['小明', '小明'],
    ['小明', '小红'],
    ['小红', '小红'],
    ['小红', '小刚'],
    ['小刚', '小刚'],
  ],
}

function pairsToGraph(relation: Relation): Graph {
  return {
    nodes: relation.domain,
    edges: relation.pairs.map(([a, b]) => ({ id: E(a, b), u: a, v: b, w: 1 })),
  }
}

/** 把「谁认识谁」写成一句人话 */
function factsOf(r: Relation, person: string): string {
  const out = r.pairs.filter(([a]) => a === person).map(([, b]) => b)
  if (out.length === 0) return `${person}：一个人都不认识。`
  return `${person} 认识：${out.join('、')}`
}

function PersonCard({
  name,
  active,
  facts,
  seen,
  onPick,
}: {
  name: string
  active: boolean
  facts: string
  seen: boolean
  onPick: () => void
}) {
  return (
    <li>
      <button
        type="button"
        aria-pressed={active}
        aria-label={`看看 ${name} 认识谁${seen ? '（已经看过）' : ''}`}
        onClick={onPick}
        className={cx(
          'flex min-h-14 w-full flex-col items-start gap-1 rounded-xl border px-3 py-2 text-left dl-transition',
          active
            ? 'border-a-500 bg-a-50 dark:bg-a-500/20'
            : 'border-slate-200 bg-white hover:border-a-300 dark:border-slate-700 dark:bg-slate-900',
        )}
      >
        <span className="flex w-full items-center justify-between gap-2">
          <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">{name}</span>
          {seen ? <Chip tone="ok">看过</Chip> : null}
        </span>
        <span className="font-mono text-xs text-slate-600 dark:text-slate-300">{facts}</span>
      </button>
    </li>
  )
}

/** 三视图联动面板：有序对集合 / 关系矩阵 / 有向图，全部从同一个 relation 派生 */
function RelationPanels({
  relation,
  ariaPrefix,
  onToggle,
  highlightPairs = [],
}: {
  relation: Relation
  ariaPrefix: string
  onToggle?: (a: string, b: string) => void
  highlightPairs?: string[]
}) {
  const graph = useMemo(() => pairsToGraph(relation), [relation])
  const positions = useMemo(
    () => circleLayout(relation.domain, 170, 150, 105),
    [relation.domain],
  )
  const matrix = toMatrix(relation)
  const hi = new Set(highlightPairs)

  const highlightEdges = graph.edges.filter((e) => hi.has(`E:${e.u},${e.v}`)).map((e) => e.id)

  const handleToggle = (i: number, j: number): void => {
    if (!onToggle) return
    onToggle(relation.domain[i], relation.domain[j])
  }

  return (
    <div className="grid gap-3 lg:grid-cols-3">
      <Card className="p-3">
        <SectionTitle hint="点格子就是加/删一个有序对">① 关系矩阵</SectionTitle>
        <MatrixGrid
          rows={relation.domain}
          cols={relation.domain}
          data={matrix}
          onToggle={onToggle ? handleToggle : undefined}
          rowTitle="行 a"
          colTitle="列 b"
          ariaLabel={`${ariaPrefix}的关系矩阵：第 i 行第 j 列表示 i 到 j 有没有关系`}
        />
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          第 i 行第 j 列是 1，就表示「i 和 j 有关系」。行列都是 {relation.domain.join('、')}。
        </p>
      </Card>

      <Card className="p-3">
        <SectionTitle hint="箭头从出发的指到到达的">② 有向图</SectionTitle>
        <div className="rounded-xl bg-slate-50 p-1 dark:bg-slate-800/40">
          <GraphView
            graph={graph}
            positions={positions}
            directed
            highlightEdges={highlightEdges}
            ariaLabel={`${ariaPrefix}的有向图：${graph.edges.length} 条边`}
            keyboardHint="箭头从谁出发、指向谁，就是有序对 (谁, 谁)。"
          />
        </div>
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          有几个箭头，就有几个有序对。
        </p>
      </Card>

      <Card className="p-3">
        <SectionTitle hint="集合写法就是课本上的写法">③ 有序对集合</SectionTitle>
        <p className="break-all font-mono text-sm font-semibold text-a-700 dark:text-a-300">
          R = {relationToString(relation)}
        </p>
        <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="逐个列出的有序对">
          {relation.pairs.length === 0 ? (
            <li className="text-xs text-slate-500 dark:text-slate-400">
              空关系：一个有序对都没有（记作 ∅）。
            </li>
          ) : (
            relation.pairs.map(([a, b]) => (
              <li
                key={`${a}-${b}`}
                className="rounded-lg bg-slate-100 px-2 py-1 font-mono text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                ({a},{b})
                <span className="ml-1 text-slate-400">= {a} → {b}</span>
              </li>
            ))
          )}
        </ul>
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          数一数：这里一共 {relation.pairs.length} 个有序对，图上就该有 {relation.pairs.length} 个箭头。
        </p>
      </Card>
    </div>
  )
}

/* ============================================================== ① 看一看 */

function HookStage({ ctx }: { ctx: StageCtx }) {
  const [active, setActive] = useState<string | null>(null)
  const { tried, markTried } = useTriedSet()

  const pick = useCallback(
    (name: string) => {
      markTried(name)
      setActive(name)
      ctx.say(factsOf(HOOK_RELATION, name), 'normal')
    },
    [ctx, markTried],
  )

  useSolveOnce(ctx, tried.size >= HOOK_PEOPLE.length)

  return (
    <div className="flex flex-col gap-3">
      <PlainSpeak>
        三个人：小明、小红、小刚。「谁认识谁」就是一堆<b>带方向的配对</b>。
        挨个点一下，看看每个人认识的是谁。
      </PlainSpeak>

      <div className="grid gap-3 sm:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]">
        <Card className="p-3">
          <SectionTitle hint="点名字，右边三个面板一起变">点一点</SectionTitle>
          <ul className="flex flex-col gap-2">
            {HOOK_PEOPLE.map((p) => (
              <PersonCard
                key={p}
                name={p}
                active={active === p}
                facts={factsOf(HOOK_RELATION, p)}
                seen={tried.has(p)}
                onPick={() => pick(p)}
              />
            ))}
          </ul>
        </Card>

        <div className="flex flex-col gap-2">
          <RelationPanels
            relation={HOOK_RELATION}
            ariaPrefix="谁认识谁"
            highlightPairs={
              active
                ? HOOK_RELATION.pairs.filter(([a]) => a === active).map(([a, b]) => `E:${a},${b}`)
                : []
            }
          />
          <Callout tone={tried.size >= HOOK_PEOPLE.length ? 'ok' : 'info'} role="status">
            {tried.size >= HOOK_PEOPLE.length
              ? '「认识」是有方向的：小明认识小红，不代表小红也认识小明。'
              : `已经看过 ${tried.size} / ${HOOK_PEOPLE.length} 个人，把三个都点一遍。`}
          </Callout>
        </div>
      </div>
    </div>
  )
}

/* ============================================================== ② 玩一玩 */

const EXPLORE_DOMAIN = ['1', '2', '3']

const EXPLORE_START: Relation = {
  domain: EXPLORE_DOMAIN,
  pairs: [
    ['1', '1'],
    ['1', '2'],
  ],
}

function ExploreStage({ ctx }: { ctx: StageCtx }) {
  const [relation, setRelation] = useState<Relation>(EXPLORE_START)

  const graph = useMemo(() => pairsToGraph(relation), [relation])
  const right = relation.pairs.length === 4
  const over = relation.pairs.length > 4

  const onToggle = useCallback(
    (a: string, b: string) => {
      setRelation((prev) => togglePair(prev, a, b))
    },
    [],
  )

  const onEdgeClick = useCallback(
    (edgeId: string) => {
      const e = graph.edges.find((x) => x.id === edgeId)
      if (!e) return
      setRelation((prev) => togglePair(prev, e.u, e.v))
    },
    [graph],
  )

  useSolveOnce(ctx, right)

  return (
    <div className="flex flex-col gap-3">
      <PlainSpeak>
        下面三个面板说的是<b>同一件事</b>：改任何一个，另外两个立刻跟着变。
        你的任务：做出一个「3 个元素上<b>恰好 4 个有序对</b>」的关系。
      </PlainSpeak>

      <ExplorePanels
        relation={relation}
        graph={graph}
        onToggle={onToggle}
        onEdgeClick={onEdgeClick}
      />

      <Callout tone={right ? 'ok' : over ? 'cur' : 'info'} role="status">
        {right
          ? '正好 4 个！矩阵里 4 个 1、图上 4 个箭头、集合里 4 个有序对 —— 三处一模一样。'
          : over
            ? `现在有 ${relation.pairs.length} 个，超过 4 了。再点一下同一个格子/箭头就能取消。`
            : `现在有 ${relation.pairs.length} 个有序对，还差 ${4 - relation.pairs.length} 个。`}
      </Callout>
    </div>
  )
}

function ExplorePanels({
  relation,
  graph,
  onToggle,
  onEdgeClick,
}: {
  relation: Relation
  graph: Graph
  onToggle: (a: string, b: string) => void
  onEdgeClick: (edgeId: string) => void
}) {
  const positions = useMemo(() => circleLayout(relation.domain, 170, 150, 105), [relation.domain])
  const matrix = toMatrix(relation)

  return (
    <div className="grid gap-3 lg:grid-cols-3">
      <Card className="p-3">
        <SectionTitle hint="点格子切换 0 / 1">① 关系矩阵</SectionTitle>
        <MatrixGrid
          rows={relation.domain}
          cols={relation.domain}
          data={matrix}
          onToggle={(i, j) => onToggle(relation.domain[i], relation.domain[j])}
          rowTitle="行"
          colTitle="列"
          ariaLabel="关系矩阵编辑器：点格子切换有没有关系"
        />
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          {(relation.domain.join('、'))} 各占一行一列。
        </p>
      </Card>

      <Card className="p-3">
        <SectionTitle hint="点箭头也能删掉它">② 有向图</SectionTitle>
        <div className="rounded-xl bg-slate-50 p-1 dark:bg-slate-800/40">
          <GraphView
            graph={graph}
            positions={positions}
            directed
            onEdgeClick={onEdgeClick}
            ariaLabel={`有向图：现在有 ${graph.edges.length} 条边`}
            keyboardHint="点一下箭头就能删掉这条边，矩阵里对应的格子会同时变成 0。"
          />
        </div>
      </Card>

      <Card className="p-3">
        <SectionTitle hint="课本上就写成这样">③ 有序对集合</SectionTitle>
        <p
          className="break-all font-mono text-sm font-semibold text-a-700 dark:text-a-300"
          aria-live="polite"
        >
          R = {relationToString(relation)}
        </p>
        <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="逐个列出的有序对">
          {relation.pairs.length === 0 ? (
            <li className="text-xs text-slate-500 dark:text-slate-400">还是空的（∅）。</li>
          ) : (
            relation.pairs.map(([a, b]) => (
              <li
                key={`${a}-${b}`}
                className="rounded-lg bg-slate-100 px-2 py-1 font-mono text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                ({a},{b})
              </li>
            ))
          )}
        </ul>
        <p className="mt-3 text-sm font-semibold text-slate-700 dark:text-slate-200">
          一共 <span className="font-mono text-a-700 dark:text-a-300">{relation.pairs.length}</span> 个
        </p>
      </Card>
    </div>
  )
}

/* ============================================================== ③ 起个名 */

interface NameQuestion {
  id: string
  q: string
  choices: { id: string; label: string; correct: boolean; why: string }[]
}

const NAME_QUESTIONS: NameQuestion[] = [
  {
    id: 'n1',
    q: '「有序对」里的「有序」是什么意思？',
    choices: [
      {
        id: 'a',
        label: '(a, b) 和 (b, a) 是两个不同的东西',
        correct: true,
        why: '对。谁在前、谁在后是配对的一部分。(小明, 小红) 和 (小红, 小明) 是两个不同的有序对 —— 就像「小明→小红」和「小红→小明」是两个不同的箭头。',
      },
      {
        id: 'b',
        label: '有序对必须按大小排好',
        correct: false,
        why: '不对。「有序」说的不是数字大小，而是「谁写在前面是定死的」。(3, 1) 完全合法。',
      },
      {
        id: 'c',
        label: '(a, b) 和 (b, a) 是同一个',
        correct: false,
        why: '不对。如果是同一个，那么「1 认识 2」就等于「2 认识 1」了 —— 这和事实不符。',
      },
    ],
  },
  {
    id: 'n2',
    q: '关系 R = { (1,2), (2,3) }，它的定义域是什么？',
    choices: [
      {
        id: 'a',
        label: '{1, 2}',
        correct: true,
        why: '对。定义域只看「左边那些位置」出现过谁：(1,2) 里有 1，(2,3) 里有 2，所以定义域是 {1, 2}。',
      },
      {
        id: 'b',
        label: '{2, 3}',
        correct: false,
        why: '不对。{2, 3} 是「值域」—— 右边那些位置出现过谁。你把定义域和值域看反了。',
      },
      {
        id: 'c',
        label: '{1, 2, 3}',
        correct: false,
        why: '不对。3 只出现在右边，它是值域里的成员，不是定义域里的。',
      },
    ],
  },
  {
    id: 'n3',
    q: '「关系矩阵」里的第 i 行第 j 列，记录的是什么？',
    choices: [
      {
        id: 'a',
        label: '第 i 个元素有没有和第 j 个元素配成有序对',
        correct: true,
        why: '对。格子是 1 就是「(第 i 个, 第 j 个) 在关系里」，是 0 就是不在。',
      },
      {
        id: 'b',
        label: '第 i 个元素和第 j 个元素之间有没有双向箭头',
        correct: false,
        why: '不对。矩阵的格子只管一个方向。双向要两个格子都是 1，也就是对称。(1,2) 有、(2,1) 没有时，第 1 行第 2 列是 1，第 2 行第 1 列是 0。',
      },
      {
        id: 'c',
        label: '第 i 个元素一共连了多少条线',
        correct: false,
        why: '不对。「连了多少条线」是度数，要数整行整列。一个格子只回答「这一对有没有关系」。',
      },
    ],
  },
]

function NameStage({ ctx }: { ctx: StageCtx }) {
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const answeredCount = Object.keys(answers).length

  return (
    <div className="flex flex-col gap-4">
      <PlainSpeak>
        你刚搭的那个东西有四个名字要记：有序对、关系、定义域、矩阵与图。
        先自己选一选，选错会告诉你错在哪。
      </PlainSpeak>

      {NAME_QUESTIONS.map((item) => (
        <Card key={item.id}>
          <p className="mb-2 text-sm font-medium text-slate-800 dark:text-slate-100">{item.q}</p>
          <ul className="flex flex-col gap-2" role="radiogroup" aria-label={item.q}>
            {item.choices.map((c) => {
              const picked = answers[`${item.id}:${c.id}`] === 'yes'
              const isRight = picked && c.correct
              const isWrong = picked && !c.correct
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={picked}
                    onClick={() => setAnswers((prev) => ({ ...prev, [`${item.id}:${c.id}`]: 'yes' }))}
                    className={cx(
                      'flex min-h-11 w-full items-start gap-2 rounded-xl border px-3 py-2 text-left text-sm dl-transition',
                      isRight
                        ? 'border-ok-500 bg-ok-50 dark:bg-ok-500/10'
                        : isWrong
                          ? 'border-bad-500 bg-bad-50 dark:bg-bad-500/10'
                          : 'border-slate-200 bg-white hover:border-a-300 dark:border-slate-700 dark:bg-slate-900',
                    )}
                  >
                    <span aria-hidden="true" className="font-mono text-xs text-slate-400">
                      {isRight ? '✓' : isWrong ? '!' : '○'}
                    </span>
                    <span className="min-w-0 flex-1 text-slate-700 dark:text-slate-200">{c.label}</span>
                  </button>
                  {picked ? (
                    <div className="mt-1.5 pl-6">
                      <Callout tone={c.correct ? 'ok' : 'bad'}>{c.why}</Callout>
                    </div>
                  ) : null}
                </li>
              )
            })}
          </ul>
        </Card>
      ))}

      <Card>
        <SectionTitle hint="点开看课本原话">四个词，一句大白话</SectionTitle>
        <ul className="grid gap-2 text-sm sm:grid-cols-2">
          <li className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800/50">
            <b>有序对 (a, b)</b>：把 a 和 b 按顺序配在一起。顺序算数，(a,b) ≠ (b,a)。
          </li>
          <li className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800/50">
            <b>a R b</b>：读作「a 和 b 有关系」，意思就是 (a, b) 在这个关系里。
          </li>
          <li className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800/50">
            <b>定义域</b>：所有有序对里「左边出现过」的元素凑成的集合。
          </li>
          <li className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800/50">
            <b>值域</b>：所有有序对里「右边出现过」的元素凑成的集合。
          </li>
          <li className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800/50">
            <b>关系矩阵</b>：行列排好元素，第 i 行第 j 列写 1 / 0，表示 (i, j) 在不在。
          </li>
          <li className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800/50">
            <b>关系图</b>：元素画成点，有序对 (a,b) 画成 a 指向 b 的箭头。
          </li>
        </ul>
        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
          三样东西说的是同一件事，所以改一个，另两个必然跟着变。
        </p>
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        <Btn
          variant={answeredCount >= 3 ? 'primary' : 'outline'}
          disabled={answeredCount < 3}
          onClick={ctx.solve}
          aria-label="三道小题都选完了，标记这一步完成"
        >
          三道小题都选完了
        </Btn>
        <span className="text-xs text-slate-500 dark:text-slate-400">
          已经选过 {answeredCount} / 3 道小题。
        </span>
      </div>
    </div>
  )
}

/* ============================================================== ④ 练一练 */

function PracticeStage({ ctx }: { ctx: StageCtx }) {
  const [solvedCount, setSolvedCount] = useState(0)
  useSolveOnce(ctx, solvedCount >= 3)
  const onSolved = useCallback(() => setSolvedCount((c) => c + 1), [])

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-slate-600 dark:text-slate-300">
        三道题，选错了会告诉你为什么错，可以无限重试。
      </p>

      <Card>
        <Quiz
          resetKey="r1p1"
          onSolved={onSolved}
          question={
            <>
              有序对 <Math>(1, 2)</Math> 和 <Math>(2, 1)</Math> 是同一个吗？
            </>
          }
          choices={[
            {
              id: 'a',
              label: '不是，它们是两个不同的有序对',
              correct: true,
              why: '对。(1,2) 是「1 指向 2」，(2,1) 是「2 指向 1」，方向反了。矩阵里它们分别在第 1 行第 2 列和第 2 行第 1 列，是两个格子。',
            },
            {
              id: 'b',
              label: '是，只是写法不同',
              correct: false,
              why: '不对。写成 (b,a) 就不是同一个。只有在 a = b 时（比如 (1,1)）它们才重合。',
            },
            {
              id: 'c',
              label: '要看 a 和 b 的大小，有时相同',
              correct: false,
              why: '不对。大小完全不影响：(1,2) 和 (2,1) 永远是两个不同的有序对。',
            },
            {
              id: 'd',
              label: '集合里的元素不能重复，所以它们被合并成一个',
              correct: false,
              why: '不对。(1,2) 和 (2,1) 是两个不同的元素，没有重复，不会被合并。',
            },
          ]}
        />
      </Card>

      <Card>
        <Quiz
          resetKey="r1p2"
          onSolved={onSolved}
          question={<>在 {'{1, 2, 3}'} 上，哪个关系矩阵<b>不是</b>「沿对角线翻过来一模一样」？</>}
          choices={[
            {
              id: 'a',
              label: '只有第 1 行第 2 列是 1（其余都是 0）的矩阵',
              correct: true,
              why: '对。它表示 R = { (1,2) }，有 (1,2) 却没有 (2,1)。格子 (1,2) 是 1、(2,1) 是 0，所以翻过来不一样。',
            },
            {
              id: 'b',
              label: '对角线上全是 1 的矩阵',
              correct: false,
              why: '不对。这个矩阵是 { (1,1), (2,2), (3,3) }，只有对角线有 1，翻过来还是它自己。',
            },
            {
              id: 'c',
              label: '全是 0 的矩阵',
              correct: false,
              why: '不对。空关系翻过来一样是空的：没有边，就找不到「有去无回」的反例。',
            },
          ]}
        />
      </Card>

      <Card>
        <Quiz
          resetKey="r1p3"
          onSolved={onSolved}
          question={<>矩阵的第 2 行第 3 列是 1，这说明什么？</>}
          choices={[
            {
              id: 'a',
              label: '有序对 (第 2 个元素, 第 3 个元素) 在关系里，图上有这条箭头',
              correct: true,
              why: '对。矩阵的一个格子正好对应一个有序对、也正好对应图上的一个箭头 —— 这就是三视图联动的原因。',
            },
            {
              id: 'b',
              label: '第 2 个元素和第 3 个元素互相有关系',
              correct: false,
              why: '不对。「互相」要求第 3 行第 2 列也是 1。现在只看到一个方向。',
            },
            {
              id: 'c',
              label: '第 2 个元素一共和 3 个元素有关系',
              correct: false,
              why: '不对。那是第 2 行里 1 的个数，要整行一起数，不是看单个格子。',
            },
          ]}
        />
      </Card>
    </div>
  )
}

/* ============================================================== ⑤ 换个场景 */

const TRANSFER_DOMAIN = ['1', '2', '3', '4', '6', '12']

/** a 是 b 的因数 ⟺ b ÷ a 是整数（每个数都是自己的因数，所以对角线全满） */
const isFactorPair = (a: string, b: string): boolean =>
  Number(b) % Number(a) === 0

const TRANSFER_FACTS: Relation = {
  domain: TRANSFER_DOMAIN,
  pairs: TRANSFER_DOMAIN.filter((a) => isFactorPair(a, '12')).map((a): [string, string] => [a, '12']),
}

const TRANSFER_TOTAL = TRANSFER_DOMAIN.reduce(
  (sum, a) => sum + TRANSFER_DOMAIN.filter((b) => isFactorPair(a, b)).length,
  0,
)

const TRANSFER_START: Relation = {
  domain: TRANSFER_DOMAIN,
  pairs: [
    ['1', '12'],
    ['2', '4'],
  ],
}

function TransferStage({ ctx }: { ctx: StageCtx }) {
  const [relation, setRelation] = useState<Relation>(TRANSFER_START)
  const [pickedCount, setPickedCount] = useState<string | null>(null)

  const countCorrect = pickedCount === String(TRANSFER_TOTAL)
  const done =
    relation.pairs.length === TRANSFER_TOTAL &&
    relation.pairs.every(([a, b]) => isFactorPair(a, b))

  useSolveOnce(ctx, countCorrect && done)

  const onToggle = useCallback((a: string, b: string) => {
    setRelation((prev) => togglePair(prev, a, b))
  }, [])

  const reveal = useCallback(() => {
    setRelation({
      domain: TRANSFER_DOMAIN,
      pairs: TRANSFER_DOMAIN.flatMap((a) =>
        TRANSFER_DOMAIN.filter((b) => isFactorPair(a, b)).map((b): [string, string] => [a, b]),
      ),
    })
    setPickedCount(String(TRANSFER_TOTAL))
  }, [])

  const positions = useMemo(() => circleLayout(TRANSFER_DOMAIN, 170, 150, 108), [])
  const graph = useMemo(() => pairsToGraph(relation), [relation])
  const [lastWrong, setLastWrong] = useState<[string, string] | null>(null)

  return (
    <div className="flex flex-col gap-3">
      <PlainSpeak>
        换个场景：在 {'{1, 2, 3, 4, 6, 12}'} 上定义「a 是 b 的因数」。
        先猜一共几个有序对，再在矩阵里把它<b>点出来</b>。
      </PlainSpeak>

      <Card>
        <SectionTitle hint="先猜，猜错也没关系">第一问：「a 是 b 的因数」一共有几个有序对？</SectionTitle>
        <div className="flex flex-wrap gap-2" role="group" aria-label="猜有序对的个数">
          {['6', '12', '24', '36'].map((v) => {
            const picked = pickedCount === v
            const right = picked && v === String(TRANSFER_TOTAL)
            const wrong = picked && v !== String(TRANSFER_TOTAL)
            return (
              <button
                key={v}
                type="button"
                aria-pressed={picked}
                onClick={() => setPickedCount(v)}
                className={cx(
                  'min-h-11 min-w-16 rounded-xl border px-4 font-mono text-base font-bold dl-transition',
                  right
                    ? 'border-ok-500 bg-ok-50 text-ok-700 dark:bg-ok-500/15 dark:text-ok-500'
                    : wrong
                      ? 'border-bad-500 bg-bad-50 text-bad-700 dark:bg-bad-500/15 dark:text-bad-500'
                      : 'border-slate-300 bg-white text-slate-700 hover:border-a-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200',
                )}
              >
                {v}
              </button>
            )
          })}
        </div>
        {pickedCount ? (
          <div className="mt-2">
            <Callout tone={countCorrect ? 'ok' : 'bad'}>
              {countCorrect
                ? `对，正好 ${TRANSFER_TOTAL} 个：每个数都要配一次「自己是自己的因数」，所以 6 个对角线格子一个都不能少。`
                : pickedCount === '6'
                  ? '少了。6 只是「自己除以自己」那一类 —— 每个数都是自己的因数，光这一条就有 6 个有序对。别忘了 (1,1)、(2,2) 这种。'
                  : pickedCount === '24'
                    ? '多了。24 是「能整除的格子数」翻倍算的结果：每个数能整除的数只有一个方向，不存在反向的那一半。'
                    : '多了。36 = 6 × 6 是「所有可能的配对」，但因数只是其中一部分 —— 比如 4 和 6 互不整除，这两个格子该是 0。'}
            </Callout>
          </div>
        ) : null}
      </Card>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
        <Card className="p-3">
          <SectionTitle hint="点格子切换 0 / 1">第二问：把关系点出来</SectionTitle>
          <MatrixGrid
            rows={relation.domain}
            cols={relation.domain}
            data={toMatrix(relation)}
            onToggle={(i, j) => {
              const a = relation.domain[i]
              const b = relation.domain[j]
              if (!hasPair(relation, a, b) && !isFactorPair(a, b)) setLastWrong([a, b])
              else setLastWrong(null)
              onToggle(a, b)
            }}
            rowTitle="行 a"
            colTitle="列 b"
            ariaLabel="因数关系的矩阵：第 a 行第 b 列表示 a 是不是 b 的因数"
          />
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            现在是 {relation.pairs.length} / {TRANSFER_TOTAL} 个。
          </p>
          {lastWrong ? (
            <div className="mt-2">
              <Callout tone="bad" role="status">
                ({lastWrong[0]}, {lastWrong[1]}) 不该有：{lastWrong[0]} 不能整除 {lastWrong[1]}
                （{lastWrong[1]} ÷ {lastWrong[0]} 不是整数）。
              </Callout>
            </div>
          ) : null}
        </Card>

        <div className="flex flex-col gap-2">
          <Card className="p-3">
            <SectionTitle hint="箭头方向 = 谁是谁的因数">同一件事，画成图</SectionTitle>
            <div className="rounded-xl bg-slate-50 p-1 dark:bg-slate-800/40">
              <GraphView
                graph={graph}
                positions={positions}
                directed
                ariaLabel={`因数关系的有向图：现在有 ${graph.edges.length} 条边`}
                keyboardHint="每个数都有一条指向自己的箭头（自环），因为每个数都是自己的因数。"
              />
            </div>
          </Card>

          <Card className="p-3">
            <SectionTitle hint="示例：1 是 12 的因数">参考</SectionTitle>
            <p className="font-mono text-xs text-slate-600 dark:text-slate-300">
              R 里已经有：{relationToString(TRANSFER_FACTS).slice(0, 60)}…
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              1 能整除所有的数，所以第 1 行应该整行都是 1。
            </p>
          </Card>

          {(ctx.hintLevel as number) >= 3 ? (
            <Btn variant="outline" size="sm" onClick={reveal} aria-label="直接把这个关系的答案填好">
              直接填好给我看
            </Btn>
          ) : null}

          <Callout tone={done ? 'ok' : 'info'} role="status">
            {done
              ? `对了！${TRANSFER_TOTAL} 个有序对，而且 6 个自己配自己的有序对都在 —— 这就叫「自反」。`
              : `还差一点：应该有 ${TRANSFER_TOTAL} 个，现在 ${relation.pairs.length} 个。`}
          </Callout>
        </div>
      </div>
    </div>
  )
}

/* ============================================================== 导出 */

const topic: Topic = {
  id: 'R1',
  title: '二元关系与三种表示',
  moduleId: 'relations',
  oneLiner: '有序对、矩阵、有向图 —— 同一件事的三种画法',
  outcome: '你能给一个「元素之间的关系」写出有序对集合，并且立刻画出它的矩阵和箭头图。',
  prerequisites: ['S1'],
  bigIdea: '关系就是一堆「谁和谁配对」的有序对。把这堆有序对换个摆法，就得到矩阵或箭头图 —— 三种写法说的是同一件事，所以改一个，另两个必然跟着动。',
  misconceptions: [
    {
      wrong: '有序对 (a, b) 和 (b, a) 是一回事',
      right: '不是。顺序是配对的一部分：(1,2) 和 (2,1) 是两个不同的有序对，矩阵里也是两个不同的格子。只有当 a = b 时它们才重合。',
    },
    {
      wrong: '矩阵的每个格子算「两个元素之间的关系」',
      right: '一个格子只算一个方向：(第 i 行, 第 j 列) 说的是 (i, j) 在不在。要判断「互相有关系」，得第 i 行第 j 列和第 j 行第 i 列同时是 1。',
    },
    {
      wrong: '定义域和值域是同一个集合',
      right: '定义域收集有序对左边的元素，值域收集右边的。R = { (1,2), (2,3) } 的定义域是 {1,2}，值域是 {2,3}。',
    },
    {
      wrong: '关系图里的箭头可以随便画双向',
      right: '有向图按有序对画：有几个有序对就有几个箭头。想让它双向，就得两个有序对都在。',
    },
  ],
  formalDefinition: (
    <>
      <p>
        <b>二元关系：</b>
        <Math block>R ⊆ A × B，即 R 是一堆有序对</Math>
      </p>
      <p>
        <b>a R b 的含义：</b>
        <Math block>(a, b) ∈ R</Math>
      </p>
      <p>
        <b>关系矩阵：</b>
        <Math block>M[i][j] = 1 ⟺ (aᵢ, aⱼ) ∈ R</Math>
      </p>
      <p>
        <b>关系图：</b>
        <Math block>(a, b) ∈ R ⟺ 图上有一条从 a 指向 b 的箭头</Math>
      </p>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        这三种写法之间能互相翻译：矩阵的第 i 行第 j 列是 1，等价于图上有那条箭头，也等价于 (aᵢ, aⱼ)
        在关系里。
      </p>
    </>
  ),
  glossary: [
    { term: '二元关系', plain: '一堆「谁和谁有关系」的配对，配对的顺序算数。', formal: 'R ⊆ A × B' },
    { term: '有序对 (a, b)', plain: '把 a 和 b 按顺序配在一起。(a,b) 和 (b,a) 不是同一个。', formal: '(a, b) ∈ R' },
    { term: 'a R b', plain: '读作「a 和 b 有关系」，意思就是 (a, b) 在关系里。' },
    { term: '定义域', plain: '有序对左边出现过的元素凑成的集合。', formal: 'dom(R) = { a | ∃b, (a,b) ∈ R }' },
    { term: '值域', plain: '有序对右边出现过的元素凑成的集合。', formal: 'ran(R) = { b | ∃a, (a,b) ∈ R }' },
    { term: '关系矩阵', plain: '行列排好元素，有关系的格子写 1，没关系写 0。' },
    { term: '关系图', plain: '元素是点，有序对是箭头，自己配自己的画成一个自环。' },
    { term: '空关系', plain: '一个有序对都没有的关系，记作 ∅。它上面的矩阵全是 0。' },
  ],
  stages: [
    {
      label: '① 看一看',
      short: '看',
      narration: '先不看符号。「谁认识谁」其实就是一堆带方向的配对。',
      requireSolve: true,
      hints: [
        '把小明、小红、小刚三个都点一遍，看清每个人认识的是谁。',
        '注意小刚那一栏：他一个人都不认识。所以配上名字的有序对里，没有以小刚开头的。',
        '三个人都点完后你会看到：认识是一堆两两配对，方向很重要 —— 小明认识小红，但小红并不认识小明。',
      ],
      render: (ctx) => <HookStage ctx={ctx} />,
    },
    {
      label: '② 玩一玩',
      short: '玩',
      narration: '三个面板说的是同一件事。点矩阵格子或图上的箭头，三个面板会一起变。',
      requireSolve: true,
      hints: [
        '目标是 4 个有序对。三个面板里的数字应该始终一样，数一个就够了。',
        '现在有 2 个，再点两个格子就够。也可以先点掉一个已有的，再补三个别的。',
        '点亮 (1,1)、(1,2)、(2,2)、(3,3) 这四个格子：矩阵里 4 个 1，图上 4 个箭头（其中 3 个是自环），集合里 { (1,1), (1,2), (2,2), (3,3) } 正好 4 个有序对。',
      ],
      render: (ctx) => <ExploreStage ctx={ctx} />,
    },
    {
      label: '③ 起个名',
      short: '名',
      narration: '刚才那些东西，数学上都有正式名字。先自己选一选。',
      requireSolve: true,
      hints: [
        '关键是分清「左边」和「右边」：定义域看左边，值域看右边。',
        '矩阵的一个格子只回答一个方向的问题：(第 i 行, 第 j 列) 说的是 (i, j) 在不在。',
        '三题的正确答案依次是：有序对顺序算数，所以 (a,b) 与 (b,a) 不同；定义域是 {1,2}；矩阵格子表示第 i 个和第 j 个元素有没有配成有序对。三道小题都选一个选项后，点最下面的按钮继续。',
      ],
      render: (ctx) => <NameStage ctx={ctx} />,
    },
    {
      label: '④ 练一练',
      short: '练',
      narration: '三道小题，选错会告诉你为什么错，可以一直重试。',
      requireSolve: true,
      hints: [
        '遇到有序对就默念一遍「谁指向谁」，方向反了就是另一个有序对。',
        '矩阵不对称，意思是有个格子是 1，而它关于对角线对称的那个格子是 0。',
        '三题的正确答案依次是：不是，它们是两个不同的有序对；只有第 1 行第 2 列是 1 的矩阵；说明有序对 (第 2 个, 第 3 个) 在关系里。',
      ],
      render: (ctx) => <PracticeStage ctx={ctx} />,
    },
    {
      label: '⑤ 换个场景',
      short: '变',
      narration: '换成「a 是 b 的因数」。先猜个数，再把关系在矩阵里点出来。',
      requireSolve: true,
      hints: [
        '每个数都能整除自己 —— 所以光「自己和自己配对」这一类就有 6 个。',
        '按行数：第 1 行（1）能整除 1、2、3、4、6、12，所以整行 6 个 1；第 2 行（2）是 2、4、6、12 四个；第 3 行是 3、6、12 三个；第 4 行是 4、12 两个；第 6 行是 6、12 两个；第 12 行只有 12 一个。',
        '一共 6 + 4 + 3 + 2 + 2 + 1 = 18 个有序对。在矩阵里把 (1,1)…(12,12) 这 6 个对角线格子都点亮，再补上 (1,2)、(1,3)、(1,4)、(1,6)、(1,12)、(2,4)、(2,6)、(2,12)、(3,6)、(3,12)、(4,12)、(6,12)。',
      ],
      render: (ctx) => <TransferStage ctx={ctx} />,
    },
  ],
}

export default topic
