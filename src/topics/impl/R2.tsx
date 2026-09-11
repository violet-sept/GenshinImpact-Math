import { useCallback, useEffect, useMemo, useState } from 'react'

import { GraphView, MatrixGrid } from '@/primitives'
import type { Graph } from '@/kernels/graph'
import { circleLayout } from '@/kernels/layout'
import {
  checkProperties,
  hasPair,
  isEquivalence,
  isPartialOrder,
  relationToString,
  toMatrix,
  togglePair,
  transitiveClosureSteps,
  type PropertyKey,
  type Relation,
} from '@/kernels/relations'
import type { Step } from '@/kernels/types'
import { useStepper } from '@/platform/useStepper'
import { Btn, Callout, Card, Chip, Math, PlainSpeak, SectionTitle, StepControls, cx } from '@/ui'
import { Quiz } from '@/ui/Quiz'
import { useSolveOnce, useTriedSet } from '../hooks'
import type { StageCtx, Topic } from '../types'

/* ============================================================ 共用小工具 */

const E = (a: string, b: string): string => `${a}->${b}`

/** 我们只讲这四个性质；反自反性在「迁移」里顺带说一句 */
const SHOWN: PropertyKey[] = ['reflexive', 'symmetric', 'antisymmetric', 'transitive']

type Tone = 'ok' | 'cur'

const toneOf = (ok: boolean): Tone => (ok ? 'ok' : 'cur')

function pairsToGraph(relation: Relation): Graph {
  return {
    nodes: relation.domain,
    edges: relation.pairs.map(([a, b]) => ({ id: E(a, b), u: a, v: b, w: 1 })),
  }
}

/** 把证人的有序对名字翻译成矩阵里要标红的格子 */
function conflictCells(r: Relation, witness: string[] | null): [number, number][] {
  if (!witness || witness.length === 0) return []
  const at = (x: string): number => r.domain.indexOf(x)
  const cells: [number, number][] = []
  const push = (a: string, b: string): void => {
    const i = at(a)
    const j = at(b)
    if (i >= 0 && j >= 0) cells.push([i, j])
  }
  if (witness.length === 1) push(witness[0], witness[0])
  else if (witness.length === 2) push(witness[0], witness[1])
  else {
    // 传递性的证人是一个三元组 (a, b, c)：a→b 和 b→c 都在，缺的是 a→c
    push(witness[0], witness[1])
    push(witness[1], witness[2])
    if (!hasPair(r, witness[0], witness[2])) push(witness[0], witness[2])
  }
  return cells
}

/** 反例要连带把「缺的那条边」也画成虚线，否则学生看不出缺了哪条 */
function missingPair(key: PropertyKey, witness: string[] | null): string[] {
  if (!witness) return []
  if (key === 'reflexive') return [E(witness[0], witness[0])]
  if (key === 'symmetric') return [E(witness[1], witness[0])]
  if (key === 'transitive') return [E(witness[0], witness[2])]
  return []
}

/** 一个性质一块面板：绿 ✓ 通过，橙 ! 不过，并且必须说清楚为什么 */
function PropertyCard({
  check,
  active,
  dim,
}: {
  check: { key: PropertyKey; label: string; plain: string; ok: boolean; witness: string[] | null; reason: string }
  active: boolean
  dim: boolean
}) {
  const witnessText = check.witness ? check.witness.join(', ') : ''

  return (
    <li
      className={cx(
        'rounded-xl border-l-4 px-3 py-2.5 text-sm dl-transition',
        check.ok
          ? 'border-l-ok-500 bg-ok-50 dark:bg-ok-500/10'
          : 'border-l-cur-500 bg-cur-50 dark:bg-cur-500/10',
        dim && 'opacity-70',
      )}
      aria-current={active ? 'true' : undefined}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span aria-hidden="true" className="text-base">
          {check.ok ? '✓' : '!'}
        </span>
        <span className="font-semibold text-slate-800 dark:text-slate-100">{check.label}</span>
        <Chip tone={toneOf(check.ok)}>{check.ok ? '通过' : '不通过'}</Chip>
      </div>
      <p className="mt-1 text-slate-600 dark:text-slate-300">{check.plain}</p>
      <p className={cx('mt-1', check.ok ? 'text-ok-700 dark:text-ok-500' : 'text-cur-700 dark:text-cur-500')}>
        {check.ok ? '✓ ' : '为什么不行：'}
        {check.reason}
      </p>
      {!check.ok && check.witness ? (
        <p className="mt-1 font-mono text-xs text-slate-600 dark:text-slate-300">
          {dim
            ? `反例涉及的有序对：(${witnessText})`
            : check.key === 'transitive'
              ? `反例是这三个有序对：(${check.witness[0]},${check.witness[1]}) 和 (${check.witness[1]},${check.witness[2]}) 都在，缺 (${check.witness[0]},${check.witness[2]})`
              : check.key === 'reflexive'
                ? `反例就是缺少的这个有序对：(${check.witness[0]},${check.witness[0]})`
                : check.key === 'antisymmetric'
                  ? `反例就是这一对：(${check.witness[0]},${check.witness[1]}) 和 (${check.witness[1]},${check.witness[0]}) 同时存在`
                  : `反例就是这个方向缺失：(${check.witness[0]},${check.witness[1]}) 在，可是 (${check.witness[1]},${check.witness[0]}) 不在`}
        </p>
      ) : null}
    </li>
  )
}

/* ============================================================== ① 看一看 */

const HOOK_DOMAIN = ['小红', '小明', '小刚']

const HOOK_RELATION: Relation = {
  domain: HOOK_DOMAIN,
  pairs: [
    ['小红', '小明'],
    ['小明', '小刚'],
    ['小刚', '小红'],
  ],
}

interface HookRound {
  active: string
  verdict: string
}

const HOOK_ROUNDS: HookRound[] = [
  {
    active: '小红',
    verdict: '小红住得离小明近。',
  },
  {
    active: '小明',
    verdict: '小明住得离小刚也近。',
  },
  {
    active: '小刚',
    verdict: '可是「住得近」不传递！小红和小刚可能隔着一条街 —— 他俩之间没有箭头。',
  },
]

function HookStage({ ctx }: { ctx: StageCtx }) {
  const [log, setLog] = useState<HookRound[]>([])
  const { tried, markTried } = useTriedSet()

  const onPick = useCallback(
    (id: string) => {
      markTried(id)
      setLog((prev) => {
        const round = HOOK_ROUNDS.find((x) => x.active === id)
        if (!round) return prev
        return prev.some((x) => x.active === id) ? prev : [...prev, round]
      })
      ctx.announce(`你点了${id}。${HOOK_ROUNDS.find((x) => x.active === id)?.verdict ?? ''}`)
    },
    [ctx, markTried],
  )

  const flashed = log.map((x) => x.active)
  useSolveOnce(ctx, tried.size >= HOOK_DOMAIN.length)

  return (
    <div className="flex flex-col gap-3">
      <PlainSpeak>
        三个人住在同一条街上。「住得近」听起来很合理，但它有个毛病。
        按顺序点过去：先点小红，再点小明，最后点小刚。
      </PlainSpeak>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,19rem)_minmax(0,1fr)]">
        <Card className="p-3">
          <SectionTitle hint="点一个人，看他和谁住得近">点一下他们</SectionTitle>
          <ul className="flex flex-col gap-2">
            {HOOK_DOMAIN.map((id, i) => {
              const seen = tried.has(id)
              return (
                <li key={id}>
                  <button
                    type="button"
                    aria-pressed={seen}
                    aria-label={`点一下${id}，看他跟谁住得近`}
                    onClick={() => onPick(id)}
                    className={cx(
                      'flex min-h-12 w-full items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left dl-transition',
                      flashed.includes(id)
                        ? 'border-cur-500 bg-cur-50 dark:bg-cur-500/10'
                        : 'border-slate-200 bg-white hover:border-a-300 dark:border-slate-700 dark:bg-slate-900',
                    )}
                  >
                    <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                      {i + 1}. {id}
                    </span>
                    <Chip tone={seen ? 'cur' : 'dim'}>{seen ? '看过了' : '还没点'}</Chip>
                  </button>
                </li>
              )
            })}
          </ul>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            按 1 → 2 → 3 的顺序点，效果最好。
          </p>
        </Card>

        <div className="flex flex-col gap-2">
          <Card className="p-3">
            <SectionTitle hint="箭头 = 住得近">这条街上的「住得近」</SectionTitle>
            <div className="rounded-xl bg-slate-50 p-1 dark:bg-slate-800/40">
              <GraphView
                graph={pairsToGraph(HOOK_RELATION)}
                positions={circleLayout(HOOK_DOMAIN, 170, 148, 104)}
                directed
                highlightNodes={flashed}
                ariaLabel="三个人的住得近关系图"
                keyboardHint="箭头是双向的，所以「住得近」是对称的；但 小红 和 小刚 之间没有箭头。"
              />
            </div>
          </Card>

          <ol className="flex flex-col gap-1.5 text-sm">
            {HOOK_ROUNDS.map((r) => (
              <li key={r.active}>
                <Callout tone={log.some((x) => x.active === r.active) ? 'cur' : 'info'}>
                  {log.some((x) => x.active === r.active)
                    ? r.verdict
                    : `第 ${HOOK_DOMAIN.indexOf(r.active) + 1} 步：还没点，先点一下「${r.active}」。`}
                </Callout>
              </li>
            ))}
          </ol>

          <Callout tone={tried.size >= HOOK_DOMAIN.length ? 'ok' : 'info'} role="status">
            {tried.size >= HOOK_DOMAIN.length
              ? '「住得近」不传递：能转两趟到的地方，常常走不了直达。'
              : `已经点了 ${tried.size} / ${HOOK_DOMAIN.length} 个人。`}
          </Callout>
        </div>
      </div>
    </div>
  )
}

/* ============================================================== ② 玩一玩 */

const EXPLORE_DOMAIN = ['1', '2', '3', '4']

const EXPLORE_START: Relation = {
  domain: EXPLORE_DOMAIN,
  pairs: [
    ['1', '2'],
    ['2', '3'],
    ['3', '4'],
  ],
}

function ExploreStage({ ctx }: { ctx: StageCtx }) {
  const [relation, setRelation] = useState<Relation>(EXPLORE_START)
  const [focus, setFocus] = useState<PropertyKey | null>(null)
  const [madeEquiv, setMadeEquiv] = useState(false)
  const [madeOrder, setMadeOrder] = useState(false)

  const checks = useMemo(() => checkProperties(relation), [relation])
  const shown = checks.filter((c) => SHOWN.includes(c.key))
  const equivalence = isEquivalence(relation)
  const partialOrder = isPartialOrder(relation)

  useEffect(() => {
    if (equivalence) setMadeEquiv(true)
  }, [equivalence])
  useEffect(() => {
    if (partialOrder) setMadeOrder(true)
  }, [partialOrder])

  useSolveOnce(ctx, madeEquiv && madeOrder)

  const onToggle = useCallback((i: number, j: number) => {
    setRelation((prev) => togglePair(prev, prev.domain[i], prev.domain[j]))
  }, [])

  const focusCheck = focus ? shown.find((c) => c.key === focus) ?? null : null
  const conflict = useMemo(
    () => (focusCheck ? conflictCells(relation, focusCheck.witness) : []),
    [relation, focusCheck],
  )
  const highlight = useMemo(
    () => (focusCheck ? missingPair(focusCheck.key, focusCheck.witness) : []),
    [focusCheck],
  )
  const graph = useMemo(() => pairsToGraph(relation), [relation])
  const positions = useMemo(() => circleLayout(relation.domain, 168, 148, 102), [relation.domain])
  const highlightEdges = graph.edges.filter((e) => highlight.includes(`E:${e.u},${e.v}`)).map((e) => e.id)

  const allSelf = relation.pairs.filter(([a, b]) => a === b).length

  return (
    <div className="flex flex-col gap-3">
      <PlainSpeak>
        点格子随意加/删有序对。右边会<b>当场</b>告诉你四个性质过不过，
        哪一条不过、为什么不过，还会把出问题的那几个有序对标出来。
      </PlainSpeak>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
        <div className="flex flex-col gap-3">
          <Card className="p-3">
            <SectionTitle hint="点格子切换 0 / 1">② 自己搭一个关系</SectionTitle>
            <div className="grid gap-3 sm:grid-cols-[auto_minmax(0,1fr)]">
              <MatrixGrid
                rows={relation.domain}
                cols={relation.domain}
                data={toMatrix(relation)}
                onToggle={onToggle}
                conflict={conflict}
                rowTitle="行 a"
                colTitle="列 b"
                ariaLabel="关系矩阵编辑器：点格子切换 a 和 b 有没有关系"
              />
              <div className="rounded-xl bg-slate-50 p-1 dark:bg-slate-800/40">
                <GraphView
                  graph={graph}
                  positions={positions}
                  directed
                  highlightEdges={highlightEdges}
                  ariaLabel={`关系图：现在有 ${graph.edges.length} 条边`}
                  keyboardHint="点格子时，图上会同步长出或消失一条箭头；自己连自己的画成一个自环。"
                />
              </div>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Chip tone="dim" showGlyph={false}>
                共 {relation.pairs.length} 个有序对
              </Chip>
              <Chip tone="dim" showGlyph={false}>
                其中有 {allSelf} 个自己配自己
              </Chip>
              <Btn size="sm" variant="outline" onClick={() => setRelation(EXPLORE_START)} aria-label="把关系清回起点">
                回到起点
              </Btn>
              <Btn size="sm" variant="ghost" onClick={() => setRelation({ domain: EXPLORE_DOMAIN, pairs: [] })} aria-label="清空全部有序对">
                全部清空
              </Btn>
            </div>
            <p className="mt-2 break-all font-mono text-xs text-slate-600 dark:text-slate-300">
              R = {relationToString(relation)}
            </p>
          </Card>

          <Card className="p-3">
            <SectionTitle hint="两个目标都要做到">要做的两件事</SectionTitle>
            <ul className="flex flex-col gap-2 text-sm">
              <li className="flex flex-wrap items-center gap-2">
                <Chip tone={madeEquiv ? 'ok' : 'dim'}>{madeEquiv ? '做到了' : '还没'}</Chip>
                <span className="text-slate-700 dark:text-slate-200">
                  做出一个「自反 + 对称 + 传递」的关系（叫等价关系）
                </span>
              </li>
              <li className="flex flex-wrap items-center gap-2">
                <Chip tone={madeOrder ? 'ok' : 'dim'}>{madeOrder ? '做到了' : '还没'}</Chip>
                <span className="text-slate-700 dark:text-slate-200">
                  再做出一个「自反 + 反对称 + 传递」的关系（叫偏序关系）
                </span>
              </li>
            </ul>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              两个目标可以先后达成，做出一个之后接着改就行。
            </p>
          </Card>
        </div>

        <div className="flex flex-col gap-2">
          <Card className="p-3">
            <SectionTitle hint="点一条看它的反例">四个性质的实时体检</SectionTitle>
            <ul className="flex flex-col gap-2">
              {shown.map((c) => (
                <div
                  key={c.key}
                  role="button"
                  tabIndex={0}
                  aria-label={`查看${c.label}的反例`}
                  onClick={() => setFocus(c.key)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      setFocus(c.key)
                    }
                  }}
                  className="cursor-pointer"
                >
                  <PropertyCard check={c} active={focus === c.key} dim={Boolean(focus) && focus !== c.key} />
                </div>
              ))}
            </ul>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              点一条性质，矩阵里会把出问题的格子标红，图上会把相关的箭头加粗。
            </p>
          </Card>

          <Callout tone={equivalence ? 'ok' : partialOrder ? 'ok' : 'info'} role="status">
            {equivalence && partialOrder
              ? '两个都做出来了！同一个元素集合上，这两类关系可以长得完全不一样。'
              : equivalence
                ? '等价关系达成！接着把它改成偏序：留几个自己配自己的，别留互相指来指去的。'
                : partialOrder
                  ? '偏序达成！接着改成等价关系：让每个箭头都有反向的箭头陪着。'
                  : '两个目标都还没达成。先看右边哪一条不过。'}
          </Callout>
        </div>
      </div>
    </div>
  )
}

/* ============================================================== ③ 起个名 */

interface NameItem {
  key: PropertyKey
  title: string
  plain: string
  formal: string
  tell: string
}

const NAME_ITEMS: NameItem[] = [
  {
    key: 'reflexive',
    title: '自反',
    plain: '每个东西都和自己有关系。',
    formal: '∀a ∈ A，(a, a) ∈ R',
    tell: '矩阵上：整条对角线都是 1，一个都不能少。',
  },
  {
    key: 'symmetric',
    title: '对称',
    plain: '有来有往：a 对 b 有关系，b 就对 a 有关系。',
    formal: '∀a,b，(a, b) ∈ R → (b, a) ∈ R',
    tell: '图上：每条箭头都有反向的箭头陪着；矩阵上：沿对角线翻过来一模一样。',
  },
  {
    key: 'antisymmetric',
    title: '反对称',
    plain: '两个不同的东西之间，最多只能有一个方向。',
    formal: '∀a≠b，(a, b) ∈ R → (b, a) ∉ R',
    tell: '图上：不同两点之间不会有来回两个箭头（自己指自己的不算）。',
  },
  {
    key: 'transitive',
    title: '传递',
    plain: '能转两趟到的，就必须能直达。',
    formal: '∀a,b,c，(a,b) ∈ R 且 (b,c) ∈ R → (a,c) ∈ R',
    tell: '图上：顺着箭头走两步能到的地方，一定也得有一条直达箭头。',
  },
]

function NameStage({ ctx }: { ctx: StageCtx }) {
  const [picked, setPicked] = useState<string[]>([])

  const onPick = useCallback(
    (label: string) => {
      setPicked((prev) => (prev.includes(label) ? prev : [...prev, label]))
      ctx.announce(`你选了「${label}」。`)
    },
    [ctx],
  )

  const matchQuestion = (
    <Card>
      <SectionTitle hint="点一个性质试试">哪个性质管的是「有来有往」？</SectionTitle>
      <div className="flex flex-wrap gap-2" role="group" aria-label="选出管「有来有往」的性质">
        {['自反', '对称', '反对称', '传递'].map((label) => {
          const isPicked = picked.includes(label)
          const isRight = isPicked && label === '对称'
          const isWrong = isPicked && label !== '对称'
          return (
            <button
              key={label}
              type="button"
              aria-pressed={isPicked}
              onClick={() => onPick(label)}
              className={cx(
                'min-h-11 rounded-xl border px-4 text-sm font-semibold dl-transition',
                isRight
                  ? 'border-ok-500 bg-ok-50 text-ok-700 dark:bg-ok-500/15 dark:text-ok-500'
                  : isWrong
                    ? 'border-bad-500 bg-bad-50 text-bad-700 dark:bg-bad-500/15 dark:text-bad-500'
                    : 'border-slate-300 bg-white text-slate-700 hover:border-a-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200',
              )}
            >
              {label}
            </button>
          )
        })}
      </div>
      {picked.length > 0 ? (
        <div className="mt-2">
          <Callout tone={picked.includes('对称') ? 'ok' : 'bad'}>
            {picked.includes('对称')
              ? '对，「有来有往」说的是对称：一条箭头必须有反向的那条陪着。'
              : picked.includes('反对称')
                ? '不对，你正好选到了它的反义词。反对称要求两个不同的元素之间<b>最多一个方向</b>，也就是「有来就不许有往」。'
                : picked.includes('自反')
                  ? '不对。自反说的是「每个元素都要和自己有关系」，只涉及 a 和 a，跟来不来往没关系。'
                  : '不对。传递说的是「走两步能到的，必须能一步直达」，它管的是路径的长度。'}
          </Callout>
        </div>
      ) : null}
    </Card>
  )

  return (
    <div className="flex flex-col gap-4">
      <PlainSpeak>
        你刚才看到的四个「体检项目」，就是关系的四个性质。它们的名字和意思如下 ——
        点一下任意一条，看它在图上长什么样。
      </PlainSpeak>

      {matchQuestion}

      <Card>
        <SectionTitle hint="四句话对应四个性质">四个性质：大白话 + 正式定义</SectionTitle>
        <ul className="flex flex-col gap-2">
          {NAME_ITEMS.map((it) => (
            <li key={it.key} className="rounded-xl border border-slate-200 px-3 py-2 dark:border-slate-700">
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">{it.title}</span>
                <span className="text-sm text-slate-600 dark:text-slate-300">{it.plain}</span>
              </div>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{it.tell}</p>
              <p className="mt-1">
                <Math>{it.formal}</Math>
              </p>
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <SectionTitle hint="容易搞混的一对">对称 ≠ 反对称，但可以同时成立</SectionTitle>
        <p className="text-sm text-slate-700 dark:text-slate-200">
          对称说「有去必须有回」，反对称说「不同的两个点之间不许有来有回」。
          听起来水火不容，可是<b>只跟自己配对</b>的关系（比如只有 1→1、2→2）两条都满足：
          它来回都对（对称），又确实没有任何一对<b>不同</b>的元素互相指。
          身份关系就是这样的例子。
        </p>
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        <Btn
          variant={picked.length > 0 ? 'primary' : 'outline'}
          disabled={picked.length === 0}
          onClick={ctx.solve}
          aria-label="已经想过「有来有往」是哪个性质，标记这一步完成"
        >
          想过了，继续
        </Btn>
        <span className="text-xs text-slate-500 dark:text-slate-400">
          上面那小题点一个选项，这里就能继续。
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
        三道题。选错了会告诉你为什么错，可以无限重试。
      </p>

      <Card>
        <Quiz
          resetKey="r2p1"
          onSolved={onSolved}
          question={
            <>
              关系 R = {'{ (1,2), (2,3) }'} 在 {'{1,2,3}'} 上。<b>为什么</b>它不是传递的？
            </>
          }
          choices={[
            {
              id: 'a',
              label: '因为有 (1,2) 和 (2,3)，却缺了 (1,3)',
              correct: true,
              why: '对。1→2→3 能转两趟到，就必须有 1→3 这条直达的。少了它，传递性被这三个有序对破坏了。',
            },
            {
              id: 'b',
              label: '因为它不对称，(2,1) 和 (3,2) 都没有',
              correct: false,
              why: '不对。对称性不通过是另一回事。传递性只关心「a→b 和 b→c 有没有 a→c」，跟反向箭头无关。',
            },
            {
              id: 'c',
              label: '因为它不是自反的，(1,1)、(2,2)、(3,3) 都缺',
              correct: false,
              why: '不对。缺自环破坏的是自反性，和传递性无关。很多传递的关系（比如「小于」）根本就没有自环。',
            },
            {
              id: 'd',
              label: '因为它只有两个有序对，太少了',
              correct: false,
              why: '不对。有序对少也可以是传递的。空关系就是传递的 —— 它连一个反例都找不出来。',
            },
          ]}
        />
      </Card>

      <Card>
        <Quiz
          resetKey="r2p2"
          onSolved={onSolved}
          question={<>有没有一个关系，<b>既对称又反对称</b>？</>}
          choices={[
            {
              id: 'a',
              label: '有。比如「每个元素只和自己有关系」的关系',
              correct: true,
              why: '对。这个关系里全是 (a,a)，所以每条箭头都有反向的（它自己），对称成立；不同元素之间一个箭头都没有，反对称也成立。',
            },
            {
              id: 'b',
              label: '没有，这两个性质不可能同时成立',
              correct: false,
              why: '不对。它们只在「两个不同元素互相指」这一种情况下冲突。只要不同元素之间没有来回箭头，两条都能通过。',
            },
            {
              id: 'c',
              label: '有，任何等价关系都是反对称的',
              correct: false,
              why: '不对，这正好说反了。等价关系只要含有 (a,b) 就一定含有 (b,a)（a≠b 时），所以它几乎总是<b>不</b>反对称的。',
            },
            {
              id: 'd',
              label: '有，任何偏序关系都是对称的',
              correct: false,
              why: '不对，偏序要求反对称：它能含有 (1,2) 和 (2,3)，但绝不能同时含有 (2,1)。',
            },
          ]}
        />
      </Card>

      <Card>
        <Quiz
          resetKey="r2p3"
          onSolved={onSolved}
          question={<>矩阵的<b>每一行都恰好有一个 1</b>（一共 n 个 1）。这个关系关于自反性怎么样？</>}
          choices={[
            {
              id: 'a',
              label: '不一定，要看这些 1 落在哪一列',
              correct: true,
              why: '对。自反只要求「每个元素都和自己配对」，也就是对角线 (1,1)、(2,2)… 全是 1。每行一个 1 完全可能全落在对角线以外的位置，那就一点都不自反。',
            },
            {
              id: 'b',
              label: '一定自反，因为每个元素都配了一次',
              correct: false,
              why: '不对。「每个元素都配了一次」不等于「每个元素都<b>和自己</b>配了一次」。比如 (1,2)、(2,1) 就满足了每行一个 1，但一个自环都没有。',
            },
            {
              id: 'c',
              label: '一定不自反',
              correct: false,
              why: '不对。如果这些 1 恰好就是对角线上的，那它反而是自反的。所以只能说「不一定」。',
            },
          ]}
        />
      </Card>
    </div>
  )
}

/* ============================================================== ⑤ 换个场景 */

const TRANSFER_DOMAIN = ['1', '2', '3', '4']

const TRANSFER_START: Relation = {
  domain: TRANSFER_DOMAIN,
  pairs: [
    ['1', '2'],
    ['2', '3'],
    ['3', '4'],
  ],
}

function TransferStage({ ctx }: { ctx: StageCtx }) {
  const steps = useMemo<Step<Relation>[]>(() => transitiveClosureSteps(TRANSFER_START), [])
  const stepper = useStepper<Relation>(steps)
  const snap: Relation = stepper.step?.snapshot ?? TRANSFER_START

  const [maxSeen, setMaxSeen] = useState(0)
  useEffect(() => {
    setMaxSeen((prev) => (stepper.index > prev ? stepper.index : prev))
  }, [stepper.index])

  const atEnd = stepper.index === stepper.count - 1
  useSolveOnce(ctx, atEnd && maxSeen >= stepper.count - 1)

  const graph = useMemo(() => pairsToGraph(snap), [snap])
  const positions = useMemo(() => circleLayout(TRANSFER_DOMAIN, 168, 148, 102), [])
  const highlightEdges = graph.edges
    .filter((e) => (stepper.step?.highlight ?? []).includes(`E:${e.u},${e.v}`))
    .map((e) => e.id)
  const conflict: [number, number][] = graph.edges
    .filter((e) => (stepper.step?.highlight ?? []).includes(`E:${e.u},${e.v}`))
    .map((e) => [snap.domain.indexOf(e.u), snap.domain.indexOf(e.v)])

  const isNowTransitive = (() => {
    for (const [a, b] of snap.pairs) {
      for (const [c, d] of snap.pairs) {
        if (b === c && !hasPair(snap, a, d)) return false
      }
    }
    return true
  })()

  return (
    <div className="flex flex-col gap-3">
      <PlainSpeak>
        最后一个场景：有些关系天生不传递。把它<b>补成</b>传递的，要补哪些线？
        用下面的播放器一步步看，每一步都会说清楚为什么补这一条。
      </PlainSpeak>

      <Card className="p-3">
        <SectionTitle hint="可以拖动进度条跳到任意一步">一步一步补边</SectionTitle>
        <StepControls api={stepper} label="传递闭包" />
      </Card>

      <div className="grid gap-3 lg:grid-cols-[auto_minmax(0,1fr)]">
        <Card className="p-3">
          <SectionTitle hint="橙框就是这一步动过的格子">每一步的矩阵</SectionTitle>
          <MatrixGrid
            rows={snap.domain}
            cols={snap.domain}
            data={toMatrix(snap)}
            conflict={conflict}
            rowTitle="行 a"
            colTitle="列 b"
            ariaLabel="传递闭包第几步的关系矩阵"
          />
          <div className="mt-2 rounded-xl bg-slate-50 p-1 dark:bg-slate-800/40">
            <GraphView
              graph={graph}
              positions={positions}
              directed
              highlightEdges={highlightEdges}
              ariaLabel={`传递闭包第 ${stepper.index + 1} 步的图，共 ${graph.edges.length} 条边`}
              keyboardHint="加粗的箭头就是这一步新补上或用来推理的那几条。"
            />
          </div>
        </Card>

        <div className="flex flex-col gap-2">
          <Card className="p-3">
            <SectionTitle hint="第几步">这一步在做什么</SectionTitle>
            <div className="flex flex-wrap items-center gap-2">
              <Chip tone="cur" showGlyph={false}>
                第 {stepper.index + 1} / {stepper.count} 步
              </Chip>
              <Chip tone="dim" showGlyph={false}>
                {stepper.step?.label ?? ''}
              </Chip>
            </div>
            <p className="mt-2 text-sm font-medium text-slate-800 dark:text-slate-100" aria-live="polite">
              {stepper.step?.explanation}
            </p>
            <p className="mt-2 break-all font-mono text-xs text-slate-600 dark:text-slate-300">
              R = {relationToString(snap)}
            </p>
          </Card>

          <Callout tone={atEnd ? (isNowTransitive ? 'ok' : 'cur') : 'info'} role="status">
            {atEnd
              ? '到最后一步了。这时候再也找不出「a→b、b→c 却没有 a→c」的地方了。'
              : '还没到最后一步。继续往后走，看每一条新线是怎么被逼出来的。'}
          </Callout>

          <Card className="p-3">
            <SectionTitle hint="从头往后看，每一步都会点亮">走到第几步了</SectionTitle>
            <p className="text-sm text-slate-700 dark:text-slate-200">
              从第一步走到第 {maxSeen + 1} 步了（一共 {stepper.count} 步）。
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {steps.map((s, i) => (
                <button
                  key={i}
                  type="button"
                  aria-label={`跳到第 ${i + 1} 步：${s.label ?? ''}`}
                  aria-pressed={stepper.index === i}
                  onClick={() => stepper.goTo(i)}
                  className={cx(
                    'rounded-lg border px-2 py-1 font-mono text-xs dl-transition',
                    stepper.index === i
                      ? 'border-a-500 bg-a-50 text-a-700 dark:bg-a-500/20 dark:text-a-300'
                      : i <= maxSeen
                        ? 'border-ok-500 bg-ok-50 text-ok-700 dark:bg-ok-500/10 dark:text-ok-500'
                        : 'border-slate-200 bg-white text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400',
                  )}
                >
                  {i + 1}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              一路走到最后一步，这一关才算完成（数字也可以直接点，用来回看某一步）。
            </p>
          </Card>

          <Callout tone="cur" title="顺便说一个词">
            原始关系里一个 <b>(a,a)</b> 都没有，这叫<b>反自反</b>（每个元素都<b>不</b>和自己有关系）。
            补闭包时，只有出现了 a→b→a 这样的来回，才会被迫补上 (a,a) —— 这个例子里没有来回，所以补完之后依然一个自环都没有。
          </Callout>
        </div>
      </div>
    </div>
  )
}

/* ============================================================== 导出 */

const topic: Topic = {
  id: 'R2',
  title: '关系的性质',
  moduleId: 'relations',
  oneLiner: '自反、对称、传递：三个性质撑起整个关系论',
  outcome: '你能看着一个关系（或它的矩阵）判断它自反、对称、反对称、传递，并且能指出破坏性质的具体反例。',
  prerequisites: ['R1'],
  bigIdea: '关系就是一堆箭头。五个性质都是在给这堆箭头立规矩：有没有自己指自己的、有没有反向的、两个点之间能不能来回、两步路能不能变成一步。性质不通过时，永远能找到一条具体的「反例」。',
  misconceptions: [
    {
      wrong: '对称和反对称是互相排斥的，「有对称就不反对称」',
      right: '两者可以同时成立。对称要求「有去必有回」，反对称只禁止「两个不同元素之间来回」。只有自环的关系（比如只有 (1,1)、(2,2)）两条都通过。',
    },
    {
      wrong: '传递性不成立，就是「这个关系太乱了」，说不上具体哪里错',
      right: '一定能指出具体的一处：存在 a、b、c，使得 (a,b) 和 (b,c) 都在，而 (a,c) 不在。比如 R = {(1,2),(2,3)} 就缺 (1,3)。',
    },
    {
      wrong: '不自反 = 反自反',
      right: '不一样。不自反只要「有一个元素没和自己配对」就够了；反自反要求「每个元素都不和自己配对」。R = {(1,1),(1,2)} 既不自反也不反自反。',
    },
    {
      wrong: '矩阵每一行有一个 1，就是自反的',
      right: '自反看的是对角线那 n 个格子必须全是 1。每行一个 1 完全可能落在对角线以外，那就一个自环都没有。',
    },
  ],
  formalDefinition: (
    <>
      <p>
        <b>自反：</b>
        <Math block>∀a ∈ A，(a, a) ∈ R</Math>
      </p>
      <p>
        <b>对称：</b>
        <Math block>∀a,b，(a, b) ∈ R → (b, a) ∈ R</Math>
      </p>
      <p>
        <b>反对称：</b>
        <Math block>∀a,b，(a, b) ∈ R 且 a ≠ b → (b, a) ∉ R</Math>
      </p>
      <p>
        <b>传递：</b>
        <Math block>∀a,b,c，(a,b) ∈ R 且 (b,c) ∈ R → (a,c) ∈ R</Math>
      </p>
      <p>
        <b>等价关系：</b>
        <Math block>自反 + 对称 + 传递</Math>
      </p>
      <p>
        <b>偏序关系：</b>
        <Math block>自反 + 反对称 + 传递</Math>
      </p>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        注意反对称的条件里写了 a ≠ b：自己指自己不算「来回」，所以自环不影响反对称。
      </p>
    </>
  ),
  glossary: [
    { term: '自反', plain: '每个东西都和自己有关系。矩阵上就是整条对角线全是 1。', formal: '∀a, (a,a) ∈ R' },
    { term: '反自反', plain: '每个东西都不和自己有关系。矩阵上就是对角线全是 0。', formal: '∀a, (a,a) ∉ R' },
    { term: '对称', plain: '有来有往：a 指向 b，就一定有 b 指向 a。', formal: '(a,b) ∈ R → (b,a) ∈ R' },
    { term: '反对称', plain: '两个不同的东西之间最多一个方向，不许来回指。', formal: '(a,b) ∈ R 且 a≠b → (b,a) ∉ R' },
    { term: '传递', plain: '能转两趟到的，就必须能直达。', formal: '(a,b),(b,c) ∈ R → (a,c) ∈ R' },
    { term: '反例 / 证人', plain: '破坏性质的那几个具体有序对。说「不满足」时必须把它指出来。' },
    { term: '等价关系', plain: '三条都占：自反 + 对称 + 传递。它会把元素分成一堆一堆。' },
    { term: '偏序关系', plain: '自反 + 反对称 + 传递，比如「小于等于」。它描述的是「层次」。' },
    { term: '传递闭包', plain: '在不传递的关系里，把「转两趟能到」的地方一条条补上直线，直到补不动为止。' },
  ],
  stages: [
    {
      label: '① 看一看',
      short: '看',
      narration: '「住得近」听起来很合理，可它有个毛病。按顺序点完三个人。',
      requireSolve: true,
      hints: [
        '按 1 → 2 → 3 的顺序点：先小红，再小明，最后小刚。',
        '点完前两个，看看图上有哪两条箭头；再点第三个，看看 小红 和 小刚 之间有没有箭头。',
        '小红住得离小明近、小明住得离小刚近，可是小红和小刚之间没有箭头 —— 所以「住得近」不传递。',
      ],
      render: (ctx) => <HookStage ctx={ctx} />,
    },
    {
      label: '② 玩一玩',
      short: '玩',
      narration: '点格子搭关系。右边当场告诉你四个性质过不过，并指出反例在哪。',
      requireSolve: true,
      hints: [
        '看右边哪一条是橙色的，照着它的 reason 改矩阵就行。',
        '自反 = 对角线全点亮；对称 = 有哪个箭头就必须有反向的箭头（点格子时成对上点亮）；传递 = 有 a→b 和 b→c 时必须补上 a→c。',
        '等价关系的做法：把 (1,1)、(2,2)、(3,3)、(4,4) 四个对角线格子点亮，就够了 —— 只有自环的关系同时满足自反、对称、传递。再改成偏序：先点「全部清空」，再点亮对角线，然后再加上 (1,2)、(1,3)、(1,4)、(2,3)、(2,4)、(3,4)（这就是「小于等于」），它自反、反对称、传递。',
      ],
      render: (ctx) => <ExploreStage ctx={ctx} />,
    },
    {
      label: '③ 起个名',
      short: '名',
      narration: '刚才那四个体检项目，就是关系的四个性质。先答一小题，再逐条看定义。',
      requireSolve: true,
      hints: [
        '「有来有往」里的「来往」就是方向相反的一对箭头。',
        '把四个选项的意思逐个念一遍：自己配自己 / 有去必有回 / 不同两点不许来回 / 两步变一步。',
        '正确答案是「对称」。对称是唯一一个在说「反向箭头」的性质，反对称恰好反过来，它禁止反向箭头。选完再点「想过了，继续」。',
      ],
      render: (ctx) => <NameStage ctx={ctx} />,
    },
    {
      label: '④ 练一练',
      short: '练',
      narration: '三道小题，重点是搞清楚「为什么不满足」，而不是死记定义。',
      requireSolve: true,
      hints: [
        '每道题先找出破坏性质的那几个具体有序对，再看哪个选项说的是它们。',
        '第 2 题的诀窍：对称和反对称只在「两个不同元素互相指」时冲突，那如果压根没有不同元素互相指呢？',
        '三题的正确答案依次是：因为有 (1,2) 和 (2,3) 却缺 (1,3)；有，比如每个元素只和自己有关系的关系；不一定，要看这些 1 落在哪一列。',
      ],
      render: (ctx) => <PracticeStage ctx={ctx} />,
    },
    {
      label: '⑤ 换个场景',
      short: '变',
      narration: '一个不传递的关系，怎么被一步步补成传递的？用播放器看完全过程。',
      requireSolve: true,
      hints: [
        '每一步都在找「a→b、b→c 却没有 a→c」的地方，找到就补上 a→c。',
        '注意矩阵里橙色的格子：那就是这一步新补的那条线。点数字 1、2、3… 可以直接回看某一步。',
        '一路点「下一步」走到最后一步（下面会显示「从第一步走到第 n 步了」）。这个例子里一共要补 3 条线，加上起点和完成，总共 5 步。',
      ],
      render: (ctx) => <TransferStage ctx={ctx} />,
    },
  ],
}

export default topic
