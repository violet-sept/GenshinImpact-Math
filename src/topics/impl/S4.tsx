import { useCallback, useEffect, useMemo, useState } from 'react'

import { Btn, Callout, Card, Chip, Math as Formula, PlainSpeak, SectionTitle, cx } from '@/ui'
import { Quiz } from '@/ui/Quiz'
import { useSolveOnce } from '../hooks'
import type { StageCtx, Topic } from '../types'

/* ================================================================
   判定用的纯函数：全部只依赖「箭头集合」，没有副作用，可以单独推敲
   ================================================================ */

/** 一条箭头：左边第 0 个元素 → 右边第 1 个元素 */
type Arrow = [string, string]

const outDeg = (arrows: readonly Arrow[], a: string): number => arrows.filter((x) => x[0] === a).length
const inDeg = (arrows: readonly Arrow[], b: string): number => arrows.filter((x) => x[1] === b).length

/** 函数：左边每个点都**恰好**射出 1 条箭头（0 条不行，2 条也不行） */
const isFunction = (left: readonly string[], arrows: readonly Arrow[]): boolean =>
  left.every((a) => outDeg(arrows, a) === 1)

/** 单射：右边的点最多被指到 1 次（不允许「撞车」） */
const isInjective = (right: readonly string[], arrows: readonly Arrow[]): boolean =>
  right.every((b) => inDeg(arrows, b) <= 1)

/** 满射：右边的点至少被指到 1 次（不允许「漏掉」） */
const isSurjective = (right: readonly string[], arrows: readonly Arrow[]): boolean =>
  right.every((b) => inDeg(arrows, b) >= 1)

/** 双射 = 函数 + 单射 + 满射：一一配上对 */
const isBijection = (left: readonly string[], right: readonly string[], arrows: readonly Arrow[]): boolean =>
  isFunction(left, arrows) && isInjective(right, arrows) && isSurjective(right, arrows)

const LEFT = ['1', '2', '3']
const RIGHT = ['a', 'b', 'c']

const LX = 84
const RX = 256
const COL_Y = [62, 130, 198]
const NODE_R = 20

const yOf = (list: readonly string[], id: string): number => COL_Y[Math.max(0, list.indexOf(id))]

/* ============================================================== ① 看一看 */

interface Person {
  id: string
  name: string
  emoji: string
}

const KIDS: Person[] = [
  { id: 'ming', name: '小明', emoji: '🧒' },
  { id: 'hong', name: '小红', emoji: '👧' },
  { id: 'gang', name: '小刚', emoji: '👦' },
]

const ADULTS: Person[] = [
  { id: 'wang', name: '王阿姨', emoji: '👩' },
  { id: 'li', name: '李叔叔', emoji: '👨' },
  { id: 'zhang', name: '张老师', emoji: '🧑' },
]

/** 谁是谁的家长 */
const PARENT: Arrow[] = [
  ['ming', 'wang'],
  ['hong', 'li'],
  ['gang', 'wang'],
]

function HookStage({ ctx }: { ctx: StageCtx }) {
  const [shown, setShown] = useState<string[]>([])

  const reveal = useCallback(
    (kidId: string) => {
      setShown((prev) => (prev.includes(kidId) ? prev : [...prev, kidId]))
      const kid = KIDS.find((k) => k.id === kidId)
      const parentId = PARENT.find((p) => p[0] === kidId)?.[1]
      const parent = ADULTS.find((p) => p.id === parentId)
      if (!kid || !parent) return
      const already = PARENT.filter((p) => p[1] === parent.id).length
      ctx.say(`${kid.name} 的家长是 ${parent.name}。`)
      ctx.announce(
        already > 1
          ? `${kid.name} 的家长是 ${parent.name}。${parent.name} 还带着别的孩子。`
          : `${kid.name} 的家长是 ${parent.name}。`,
      )
    },
    [ctx],
  )

  useSolveOnce(ctx, shown.length >= KIDS.length)

  const allShown = shown.length >= KIDS.length

  return (
    <div className="flex flex-col gap-3">
      <PlainSpeak>
        左边是三个小朋友，右边是三个大人。点一点小朋友，看看他的家长是谁 —— 中间会拉出一条线。
      </PlainSpeak>

      <div className="rounded-xl bg-slate-50 p-2 dark:bg-slate-800/40">
        <svg
          viewBox="0 0 340 260"
          className="h-auto w-full select-none"
          role="img"
          aria-label="左边三个小朋友与右边三个大人之间的家长关系箭头"
        >
          <text x={LX} y={26} textAnchor="middle" className="dl-svg-text" fill="var(--color-a-700)" fontSize={13}>
            小朋友
          </text>
          <text x={RX} y={26} textAnchor="middle" className="dl-svg-text" fill="var(--color-b-700)" fontSize={13}>
            大人
          </text>

          {PARENT.map(([kid, parent]) => {
            const on = shown.includes(kid)
            return (
              <line
                key={`${kid}-${parent}`}
                x1={LX + NODE_R}
                y1={yOf(KIDS.map((k) => k.id), kid)}
                x2={RX - NODE_R - 6}
                y2={yOf(ADULTS.map((p) => p.id), parent)}
                stroke="var(--color-a-500)"
                strokeWidth={on ? 2.5 : 1.5}
                strokeDasharray={on ? '0' : '5 5'}
                opacity={on ? 1 : 0.25}
                style={{ transition: 'opacity var(--dl-dur) var(--ease-dl)' }}
              />
            )
          })}

          <g>
            {KIDS.map((k, i) => (
              <g key={k.id}>
                <circle
                  cx={LX}
                  cy={COL_Y[i]}
                  r={NODE_R}
                  fill={shown.includes(k.id) ? 'var(--color-a-500)' : 'white'}
                  stroke="var(--color-a-600)"
                  strokeWidth={2.5}
                />
                <text
                  x={LX}
                  y={COL_Y[i]}
                  dy="0.35em"
                  textAnchor="middle"
                  className="dl-svg-text"
                  fill={shown.includes(k.id) ? 'white' : 'var(--color-slate-700)'}
                  fontSize={12}
                >
                  {k.name.slice(1)}
                </text>
              </g>
            ))}
            {ADULTS.map((p, i) => (
              <g key={p.id}>
                <circle cx={RX} cy={COL_Y[i]} r={NODE_R} fill="var(--color-b-100)" stroke="var(--color-b-600)" strokeWidth={2.5} />
                <text x={RX} y={COL_Y[i]} dy="0.35em" textAnchor="middle" className="dl-svg-text" fill="var(--color-b-700)" fontSize={12}>
                  {p.name.slice(0, 1)}
                </text>
              </g>
            ))}
          </g>
        </svg>
      </div>

      <div className="flex flex-wrap gap-2">
        {KIDS.map((k) => (
          <button
            key={k.id}
            type="button"
            aria-pressed={shown.includes(k.id)}
            aria-label={`看看 ${k.name} 的家长是谁`}
            onClick={() => reveal(k.id)}
            className={cx(
              'inline-flex min-h-11 items-center gap-2 rounded-xl border px-3 text-sm font-medium dl-transition',
              shown.includes(k.id)
                ? 'border-a-500 bg-a-50 text-a-700 dark:bg-a-500/20 dark:text-a-300'
                : 'border-slate-300 bg-white text-slate-700 hover:border-a-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200',
            )}
          >
            <span aria-hidden="true">{k.emoji}</span>
            {k.name}
          </button>
        ))}
      </div>

      <Callout tone={allShown ? 'ok' : 'info'} role="status">
        {allShown
          ? '每个小朋友都恰好有一位家长。可是张老师一个孩子也没有，王阿姨却带了两个孩子。'
          : `已经点亮了 ${shown.length} / ${KIDS.length} 个小朋友。`}
      </Callout>
    </div>
  )
}

/* ============================================================== ② 玩一玩 */

interface Verdict {
  fn: boolean
  inj: boolean
  sur: boolean
  bij: boolean
}

function judge(arrows: readonly Arrow[]): Verdict {
  return {
    fn: isFunction(LEFT, arrows),
    inj: isInjective(RIGHT, arrows),
    sur: isSurjective(RIGHT, arrows),
    bij: isBijection(LEFT, RIGHT, arrows),
  }
}

function fnMessage(arrows: readonly Arrow[]): string {
  const zero = LEFT.filter((a) => outDeg(arrows, a) === 0)
  const many = LEFT.filter((a) => outDeg(arrows, a) > 1)
  if (zero.length === 0 && many.length === 0) return '左边每个点都恰好射出 1 条箭头 —— 这是函数。'
  const parts: string[] = []
  if (zero.length > 0) parts.push(`「${zero.join('、')}」一条箭头都没射出（函数要求恰好 1 条，0 条不行）`)
  if (many.length > 0) parts.push(`「${many.join('、')}」射出了不止 1 条箭头（函数要求恰好 1 条，2 条也不行）`)
  return `还不是函数：${parts.join('；')}。`
}

function injMessage(arrows: readonly Arrow[]): string {
  const dup = RIGHT.filter((b) => inDeg(arrows, b) > 1)
  if (dup.length === 0) return '右边每个点最多被指到 1 次 —— 没有撞车，这是单射。'
  return `不是单射：「${dup.join('、')}」被指到了不止 1 次（撞车了）。`
}

function surMessage(arrows: readonly Arrow[]): string {
  const missed = RIGHT.filter((b) => inDeg(arrows, b) === 0)
  if (missed.length === 0) return '右边每个点都被指到了 —— 没有漏掉，这是满射。'
  return `不是满射：「${missed.join('、')}」一次都没被指到（漏掉了）。`
}

const MILESTONES = [
  { id: 'func', label: '做出一个函数', tip: '左边每个点恰好 1 条箭头' },
  { id: 'inj', label: '做出一个单射', tip: '右边每个点最多被指到 1 次' },
  { id: 'bij', label: '做出一个双射', tip: '单射 + 满射，一一配上对' },
]

function ExploreStage({ ctx }: { ctx: StageCtx }) {
  const [arrows, setArrows] = useState<Arrow[]>([])
  const [sel, setSel] = useState<string | null>(null)
  const [done, setDone] = useState<Set<string>>(() => new Set())

  const v = useMemo(() => judge(arrows), [arrows])
  const allDone = done.has('func') && done.has('inj') && done.has('bij')

  // 三个任务各自达成过一次就永久记下（用户后面改坏了，也算他做到过）
  useEffect(() => {
    const next = judge(arrows)
    setDone((prev) => {
      const copy = new Set(prev)
      if (next.fn) copy.add('func')
      if (next.inj) copy.add('inj')
      if (next.bij) copy.add('bij')
      return copy.size === prev.size ? prev : copy
    })
  }, [arrows])

  useSolveOnce(ctx, allDone)

  const clickLeft = useCallback(
    (a: string) => {
      setSel(a)
      ctx.say(`选中了左边「${a}」，再点右边一个点就连线。`)
    },
    [ctx],
  )

  const clickRight = useCallback(
    (b: string) => {
      if (!sel) {
        ctx.say('先点左边一个点，再点右边这个点。', 'reject')
        return
      }
      const exists = arrows.some((x) => x[0] === sel && x[1] === b)
      const next: Arrow[] = exists
        ? arrows.filter((x) => !(x[0] === sel && x[1] === b))
        : [...arrows, [sel, b] as Arrow]
      setArrows(next)
      const nv = judge(next)
      if (exists) {
        ctx.say(`去掉了「${sel} → ${b}」这条箭头。`)
      } else if (nv.bij) {
        ctx.say('漂亮！单射 + 满射 = 双射，一一配上对了。', 'accept')
      } else if (nv.fn) {
        ctx.say(`连上「${sel} → ${b}」。现在左边每点恰好一条，是函数。`, 'accept')
      } else {
        ctx.say(`连上「${sel} → ${b}」。`)
      }
      ctx.announce(
        nv.bij
          ? `连上 ${sel} 到 ${b}。现在是双射：一一配上对。`
          : `连上 ${sel} 到 ${b}。函数：${nv.fn ? '是' : '否'}；单射：${nv.inj ? '是' : '否'}；满射：${nv.sur ? '是' : '否'}。`,
      )
    },
    [arrows, ctx, sel],
  )

  const clear = useCallback(() => {
    setArrows([])
    setSel(null)
    ctx.say('全部擦掉了，重新来。')
  }, [ctx])

  return (
    <div className="flex flex-col gap-3">
      <PlainSpeak>
        点左边的点，再点右边的点，就连出一条箭头。<b>点同一条箭头两次可以取消</b>。目标是做出一个函数、一个单射、一个双射。
      </PlainSpeak>

      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_17rem]">
        <div className="rounded-xl bg-slate-50 p-2 dark:bg-slate-800/40">
          <svg
            viewBox="0 0 340 260"
            className="h-auto w-full select-none"
            role="group"
            aria-label="左边集合 A 与右边集合 B 之间的箭头编辑器"
          >
            <defs>
              <marker id="s4-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--color-a-600)" />
              </marker>
            </defs>

            <text x={LX} y={26} textAnchor="middle" className="dl-svg-text" fill="var(--color-a-700)" fontSize={13}>
              A
            </text>
            <text x={RX} y={26} textAnchor="middle" className="dl-svg-text" fill="var(--color-b-700)" fontSize={13}>
              B
            </text>

            {arrows.map(([a, b]) => (
              <line
                key={`${a}-${b}`}
                x1={LX + NODE_R}
                y1={yOf(LEFT, a)}
                x2={RX - NODE_R - 6}
                y2={yOf(RIGHT, b)}
                stroke="var(--color-a-600)"
                strokeWidth={2.5}
                markerEnd="url(#s4-arrow)"
              />
            ))}

            {LEFT.map((a) => {
              const active = sel === a
              return (
                <g
                  key={`L-${a}`}
                  role="button"
                  tabIndex={0}
                  aria-label={`左边集合 A 的元素 ${a}${active ? '，已选中' : ''}`}
                  aria-pressed={active}
                  onClick={() => clickLeft(a)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      clickLeft(a)
                    }
                  }}
                  className="cursor-pointer"
                >
                  <circle
                    cx={LX}
                    cy={yOf(LEFT, a)}
                    r={NODE_R}
                    fill={active ? 'var(--color-cur-500)' : 'var(--color-a-500)'}
                    stroke={active ? 'var(--color-cur-700)' : 'var(--color-a-700)'}
                    strokeWidth={3}
                  />
                  <text x={LX} y={yOf(LEFT, a)} dy="0.35em" textAnchor="middle" className="dl-svg-text" fill="white" fontSize={14}>
                    {a}
                  </text>
                </g>
              )
            })}

            {RIGHT.map((b) => {
              const deg = inDeg(arrows, b)
              return (
                <g
                  key={`R-${b}`}
                  role="button"
                  tabIndex={0}
                  aria-label={`右边集合 B 的元素 ${b}，现在被 ${deg} 条箭头指到`}
                  onClick={() => clickRight(b)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      clickRight(b)
                    }
                  }}
                  className="cursor-pointer"
                >
                  <circle
                    cx={RX}
                    cy={yOf(RIGHT, b)}
                    r={NODE_R}
                    fill={deg > 1 ? 'var(--color-bad-500)' : deg === 1 ? 'var(--color-b-500)' : 'var(--color-b-100)'}
                    stroke="var(--color-b-700)"
                    strokeWidth={3}
                  />
                  <text
                    x={RX}
                    y={yOf(RIGHT, b)}
                    dy="0.35em"
                    textAnchor="middle"
                    className="dl-svg-text"
                    fill={deg >= 1 ? 'white' : 'var(--color-b-700)'}
                    fontSize={14}
                  >
                    {b}
                  </text>
                  <text x={RX + NODE_R + 4} y={yOf(RIGHT, b)} dy="0.35em" className="dl-svg-text" fill="var(--color-dim-600)" fontSize={11}>
                    {deg} 条
                  </text>
                </g>
              )
            })}
          </svg>

          <p className="px-1 text-xs text-slate-500 dark:text-slate-400">
            键盘：Tab 选到左边的点按 Enter 选中，再 Tab 到右边的点按 Enter 连线。
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <Card className="p-3">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-slate-600 dark:text-slate-300">是函数吗？</span>
                <Chip tone={v.fn ? 'ok' : 'bad'}>{v.fn ? '是函数' : '不是函数'}</Chip>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-slate-600 dark:text-slate-300">是单射吗？</span>
                <Chip tone={v.inj ? 'ok' : 'bad'}>{v.inj ? '是单射' : '不是单射'}</Chip>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-slate-600 dark:text-slate-300">是满射吗？</span>
                <Chip tone={v.sur ? 'ok' : 'bad'}>{v.sur ? '是满射' : '不是满射'}</Chip>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-slate-600 dark:text-slate-300">是双射吗？</span>
                <Chip tone={v.bij ? 'ok' : 'bad'}>{v.bij ? '是双射' : '不是双射'}</Chip>
              </div>
            </div>
          </Card>

          <Callout tone={v.bij ? 'ok' : 'info'}>
            <p>{fnMessage(arrows)}</p>
            <p className="mt-1">{injMessage(arrows)}</p>
            <p className="mt-1">{surMessage(arrows)}</p>
          </Callout>

          <Card className="p-3">
            <SectionTitle hint="做出来就算数">三个任务</SectionTitle>
            <ul className="flex flex-col gap-1.5">
              {MILESTONES.map((m) => (
                <li key={m.id} className="flex items-start gap-2 text-sm">
                  <span aria-hidden="true" className={done.has(m.id) ? 'text-ok-600' : 'text-slate-400'}>
                    {done.has(m.id) ? '✓' : '○'}
                  </span>
                  <span className={done.has(m.id) ? 'text-ok-700 dark:text-ok-500' : 'text-slate-600 dark:text-slate-300'}>
                    {m.label}
                    <span className="ml-1 text-xs text-slate-400">（{m.tip}）</span>
                  </span>
                </li>
              ))}
            </ul>
          </Card>

          <div className="flex flex-wrap items-center gap-2">
            <Btn size="sm" variant="outline" onClick={clear} aria-label="擦掉所有箭头">
              全部擦掉
            </Btn>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              已选中：左边 {sel ?? '无'}
            </span>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400">
            严格说，单射和满射是<b>函数</b>才有的性质。这里先用「右边有没有撞车 / 有没有漏掉」来看，凑齐三样才是双射。
            {done.has('inj') && done.has('bij') ? ' 3 个对 3 个的时候，只要做出单射就一定是双射 —— 这不是巧合，后面会讲。' : ''}
          </p>
        </div>
      </div>
    </div>
  )
}

/* ============================================================== ③ 起个名 */

type Word = '函数' | '单射' | '满射' | '双射'
const WORDS: Word[] = ['函数', '单射', '满射', '双射']

interface WordQuestion {
  id: string
  sentence: string
  answer: Word
  why: string
}

const WORD_QUESTIONS: WordQuestion[] = [
  {
    id: 'q1',
    sentence: '左边每个点都恰好射出 1 条箭头（右边怎么样先不管）。',
    answer: '函数',
    why: '函数只管左边：每个输入恰好配一个输出。右边有没有撞车、有没有漏掉，都不影响它是不是函数。',
  },
  {
    id: 'q2',
    sentence: '在是函数的前提下：右边每个点最多被指到 1 次。',
    answer: '单射',
    why: '单射管的是「不许撞车」：不同的输入必须配到不同的输出。',
  },
  {
    id: 'q3',
    sentence: '在是函数的前提下：右边每个点都至少被指到 1 次。',
    answer: '满射',
    why: '满射管的是「不许漏掉」：右边每个点都要有箭头指过来。',
  },
  {
    id: 'q4',
    sentence: '在是函数的前提下：右边既不撞车、也不漏掉。',
    answer: '双射',
    why: '双射 = 单射 + 满射。两边一一配上对，一个不多一个不少。',
  },
]

function NameStage({ ctx }: { ctx: StageCtx }) {
  const [answers, setAnswers] = useState<Record<string, Word>>({})
  const allRight = WORD_QUESTIONS.every((q) => answers[q.id] === q.answer)

  useSolveOnce(ctx, allRight)

  return (
    <div className="flex flex-col gap-4">
      <PlainSpeak>
        你刚才盯着四个徽章做的判断，数学上就是这四个词。它们的区别只在「看左边还是看右边」。
      </PlainSpeak>

      <Card>
        <SectionTitle hint="一句话 + 一个式子">四个词，四个意思</SectionTitle>
        <ul className="flex flex-col gap-2.5">
          {[
            ['函数 f: A → B', '左边每个点恰好射出一条箭头。', '对每个 x ∈ A，有唯一的 f(x) ∈ B'],
            ['单射（一对一）', '右边不撞车：不同的输入配到不同的输出。', 'f(x₁) = f(x₂) ⟹ x₁ = x₂'],
            ['满射（映上）', '右边不漏掉：每个输出都真的被用到。', '对每个 y ∈ B，存在 x ∈ A 使 f(x) = y'],
            ['双射（一一对应）', '既不撞车也不漏掉，两边一一配上对。', '既单射又满射'],
          ].map(([t, plain, formal]) => (
            <li key={t} className="rounded-xl bg-slate-50 px-3 py-2.5 dark:bg-slate-800/50">
              <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">{t}</div>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{plain}</p>
              <p className="mt-0.5 font-mono text-xs text-slate-500 dark:text-slate-400">{formal}</p>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
          读法：<Formula>f: A → B</Formula> 表示「从 A 到 B 的一个函数」；
          <Formula>f(x) = y</Formula> 表示「x 被配给了 y」。
        </p>
      </Card>

      <Card>
        <SectionTitle hint="只看描述，选出对应的词">该叫哪个名字？</SectionTitle>
        <ul className="flex flex-col gap-4">
          {WORD_QUESTIONS.map((q) => {
            const picked = answers[q.id]
            const right = picked === q.answer
            return (
              <li key={q.id} className="flex flex-col gap-2">
                <p className="text-sm text-slate-700 dark:text-slate-200">{q.sentence}</p>
                <div className="flex flex-wrap items-center gap-2">
                  {WORDS.map((w) => {
                    const active = picked === w
                    const good = active && right
                    const bad = active && !right
                    return (
                      <button
                        key={w}
                        type="button"
                        aria-pressed={active}
                        aria-label={`回答「${q.sentence}」：${w}`}
                        onClick={() => setAnswers((a) => ({ ...a, [q.id]: w }))}
                        className={cx(
                          'min-h-11 rounded-xl border px-3 text-sm font-medium dl-transition',
                          good
                            ? 'border-ok-500 bg-ok-50 text-ok-700 dark:bg-ok-500/15 dark:text-ok-500'
                            : bad
                              ? 'border-bad-500 bg-bad-50 text-bad-700 dark:bg-bad-500/15 dark:text-bad-500'
                              : 'border-slate-300 bg-white text-slate-700 hover:border-a-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200',
                        )}
                      >
                        {w}
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
        三道题。选错了会讲清楚为什么错，可以立刻重选。
      </p>

      <Card>
        <Quiz
          question={<>下面哪句关于「双射」的说法是对的？</>}
          resetKey="s4p1"
          onSolved={() => setSolvedCount((c) => c + 1)}
          choices={[
            {
              id: 'a',
              label: '既满足单射、又满足满射，才叫双射',
              correct: true,
              why: '对。双射 = 单射 + 满射，两个条件缺一不可：右边既不撞车，也不漏掉，才能一一配上对。',
            },
            {
              id: 'b',
              label: '只要满足单射就是双射',
              correct: false,
              why: '不对。A = {1, 2}、B = {a, b, c} 时，1→a、2→b 是单射（右边没撞车），但 c 一次都没被指到，所以它不是满射，也就不是双射。',
            },
            {
              id: 'c',
              label: '只要满足满射就是双射',
              correct: false,
              why: '不对。A = {1, 2, 3}、B = {a, b} 时，1→a、2→a、3→b 是满射（右边都被指到），但 a 被指了两次，撞车了，所以不是单射，也不是双射。',
            },
            {
              id: 'd',
              label: '两个集合元素一样多就是双射',
              correct: false,
              why: '不对。元素一样多只是「有可能」配上对。真正要求的是箭头本身既不撞车也不漏掉；而且元素个数不同的两个有限集合之间，根本不可能有双射。',
            },
          ]}
        />
      </Card>

      <Card>
        <Quiz
          question={<>A = {'{1, 2, 3}'}，B = {'{a, b, c}'}。箭头是 1→a、2→a、3→b。它是满射吗？</>}
          resetKey="s4p2"
          onSolved={() => setSolvedCount((c) => c + 1)}
          choices={[
            {
              id: 'a',
              label: '不是满射，因为 c 一次都没被指到',
              correct: true,
              why: '对。满射要求右边每个点都至少被指到一次，c 完全没有箭头过来，所以不是满射。（顺带一提，a 被指了两次，所以它也不是单射。）',
            },
            {
              id: 'b',
              label: '是满射，因为左边每个点都有箭头',
              correct: false,
              why: '不对。左边每个点都有箭头只说明它是函数。满射看的是右边：有没有点被漏掉。这里 c 就被漏掉了。',
            },
            {
              id: 'c',
              label: '是满射，因为 a 被指了两次，覆盖得更多',
              correct: false,
              why: '不对。a 被指两次是撞车，帮不上覆盖的忙。b 只被指到一次、c 一次都没有，右边没有被全部覆盖，所以不是满射。',
            },
          ]}
        />
      </Card>

      <Card>
        <Quiz
          question={<>A = {'{1, 2, 3}'}，B = {'{a, b}'}。能做出一个从 A 到 B 的单射吗？</>}
          resetKey="s4p3"
          onSolved={() => setSolvedCount((c) => c + 1)}
          choices={[
            {
              id: 'a',
              label: '不能。3 个点要射进 2 个点，一定有右边的点被指到两次',
              correct: true,
              why: '对。单射要求右边的点最多被指一次。3 条箭头分给 2 个点，按「东西比抽屉多」的道理，一定有一个点被指到两次 —— 所以做不出单射。',
            },
            {
              id: 'b',
              label: '能，只要左边每个点都射出箭头就行',
              correct: false,
              why: '不对。左边都射出箭头只保证是函数。3 条箭头落到 2 个点上，必然有一个点被指两次（3 > 2），单射就被破坏了。',
            },
            {
              id: 'c',
              label: '能，只要右边每个点都被指到就行',
              correct: false,
              why: '不对。右边都被指到只是满射。3 条箭头进 2 个点，一定有一个点被指两次，所以单射不可能成立。',
            },
          ]}
        />
      </Card>
    </div>
  )
}

/* ============================================================== ⑤ 换个场景 */

interface MapCard {
  id: string
  /** 左边第 i 个点连到右边第几个点；null 表示这个点没有箭头 */
  map: (number | null)[]
  valid: boolean
  reason?: string
}

const PERMUTATIONS: number[][] = [
  [0, 1, 2],
  [1, 2, 0],
  [2, 0, 1],
  [1, 0, 2],
  [2, 1, 0],
  [0, 2, 1],
]

const MAP_CARDS: MapCard[] = [
  { id: 'c1', map: [0, 1, 2], valid: true },
  { id: 'c2', map: [0, 0, 1], valid: false, reason: '「a」被指到了两次（1→a、2→a），右边撞车了 —— 不是单射，也不是双射。' },
  { id: 'c3', map: [1, 2, 0], valid: true },
  { id: 'c4', map: [0, 1, null], valid: false, reason: '左边的「3」一条箭头都没有，所以它根本不是函数，更不可能是双射。' },
  { id: 'c5', map: [2, 0, 1], valid: true },
  { id: 'c6', map: [1, 0, 2], valid: true },
  { id: 'c7', map: [2, 1, 0], valid: true },
  { id: 'c8', map: [0, 2, 1], valid: true },
]

const cardLabel = (c: MapCard): string =>
  c.map
    .map((t, i) => (t === null ? `${i + 1} 没有箭头` : `${i + 1}→${RIGHT[t]}`))
    .join('，')

function MiniArrows({ map }: { map: (number | null)[] }) {
  const ys = [16, 39, 62]
  return (
    <svg viewBox="0 0 100 78" className="h-16 w-24" aria-hidden="true">
      {map.map((t, i) =>
        t === null ? null : (
          <line key={`l${i}`} x1={22} y1={ys[i]} x2={78} y2={ys[t]} stroke="var(--color-a-500)" strokeWidth={2} />
        ),
      )}
      {ys.map((y, i) => (
        <circle key={`L${i}`} cx={14} cy={y} r={7} fill="var(--color-a-500)" />
      ))}
      {ys.map((y, i) => (
        <circle key={`R${i}`} cx={86} cy={y} r={7} fill="var(--color-b-500)" />
      ))}
    </svg>
  )
}

function TransferStage({ ctx }: { ctx: StageCtx }) {
  const [found, setFound] = useState<string[]>([])
  const [wrong, setWrong] = useState<string | null>(null)
  const [whyDone, setWhyDone] = useState(false)

  const solved = found.length >= PERMUTATIONS.length
  useSolveOnce(ctx, solved && whyDone)

  const clickCard = useCallback(
    (c: MapCard) => {
      if (found.includes(c.id)) return
      if (c.valid) {
        setFound((prev) => [...prev, c.id])
        setWrong(null)
        ctx.say('对，这一种也是一一配上对的双射。', 'accept')
      } else {
        setWrong(c.id)
        ctx.say('这张不是双射，看看为什么。', 'reject')
        ctx.announce(c.reason ?? '这张不是双射。')
      }
    },
    [ctx, found],
  )

  const reset = useCallback(() => {
    setFound([])
    setWrong(null)
    ctx.say('清空了，重新找一遍。')
  }, [ctx])

  return (
    <div className="flex flex-col gap-3">
      <PlainSpeak>
        A = {'{1, 2, 3}'}，B = {'{a, b, c}'}。<b>一共有多少种双射？</b>下面有 8 张连法，把「一一配上对」的那些全都点出来。
      </PlainSpeak>

      <div className="flex flex-wrap items-center gap-3">
        <Chip tone={solved ? 'ok' : 'cur'}>
          已找到 {found.length} / {PERMUTATIONS.length} 种
        </Chip>
        <Btn size="sm" variant="outline" onClick={reset} aria-label="清空重新找">
          重新找
        </Btn>
      </div>

      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {MAP_CARDS.map((c) => {
          const isFound = found.includes(c.id)
          const isWrong = wrong === c.id
          return (
            <li key={c.id}>
              <button
                type="button"
                aria-pressed={isFound}
                aria-label={`第 ${c.id.slice(1)} 张连法：${cardLabel(c)}${isFound ? '，已找到' : ''}`}
                onClick={() => clickCard(c)}
                className={cx(
                  'flex w-full flex-col items-center gap-1 rounded-xl border px-2 py-2 dl-transition',
                  isFound
                    ? 'border-ok-500 bg-ok-50 dark:bg-ok-500/15'
                    : isWrong
                      ? 'border-bad-500 bg-bad-50 dark:bg-bad-500/15'
                      : 'border-slate-200 bg-white hover:border-a-500 dark:border-slate-700 dark:bg-slate-900',
                )}
              >
                <MiniArrows map={c.map} />
                <span className="flex items-center gap-1 text-xs text-slate-600 dark:text-slate-300">
                  {isFound ? (
                    <span aria-hidden="true" className="text-ok-600">
                      ✓
                    </span>
                  ) : null}
                  {c.map.map((t, i) => (t === null ? `${i + 1}→—` : `${i + 1}→${RIGHT[t]}`)).join(' ')}
                </span>
              </button>
            </li>
          )
        })}
      </ul>

      {wrong ? (
        <Callout tone="bad" role="alert">
          {MAP_CARDS.find((c) => c.id === wrong)?.reason}
        </Callout>
      ) : null}

      <Callout tone={solved ? 'ok' : 'info'} role="status">
        {solved
          ? '六种全找出来了。8 张里正好有 2 张不是双射 —— 一张右边撞车，一张左边漏了箭头。'
          : '一张一张点过去。撞车或者漏掉的，都不是双射。'}
      </Callout>

      <Card>
        <Quiz
          question={<>3 个元素到 3 个元素，一共有多少种双射？</>}
          resetKey="s4t1"
          onSolved={() => setWhyDone(true)}
          choices={[
            {
              id: 'a',
              label: '6 种',
              correct: true,
              why: '对。给「1」挑对象有 3 种选法；挑完剩 2 个，「2」只剩 2 种；最后一个「3」只剩 1 种。3 × 2 × 1 = 6，也就是 3! —— 这就是上面那六张图。',
            },
            {
              id: 'b',
              label: '3 种',
              correct: false,
              why: '不对，3 只是「1」有几种选法。选完 1 之后，「2」还有 2 种选法，这两个选择是乘起来而不是并列的。',
            },
            {
              id: 'c',
              label: '9 种',
              correct: false,
              why: '不对，9 = 3 × 3 是「每个点都随便连、允许撞车」的算法。双射不许撞车，所以「2」只有 2 种选法、「3」只有 1 种。',
            },
            {
              id: 'd',
              label: '27 种',
              correct: false,
              why: '不对，27 = 3³ 是允许撞车、也不要求是函数的连法总数。双射是其中最严格的一类，只有 6 种。',
            },
          ]}
        />
      </Card>

      <Card>
        <SectionTitle hint="顺便记住这条">为什么 3 个对 3 个，单射就等于双射？</SectionTitle>
        <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-200">
          单射要求右边不撞车。3 条箭头进 3 个点，既然谁也不许被指两次，那 3 个点就<b>只能各被指一次</b> ——
          右边自然也不漏掉，于是自动满足满射。所以在「两边一样多」的时候，能做到单射就等于做出了双射。
          两边个数不一样时就不成立了：3 个点射进 2 个点，怎么都会撞车；3 个点射进 4 个点，怎么都会漏掉。
        </p>
      </Card>
    </div>
  )
}

/* ============================================================== 导出 */

const topic: Topic = {
  id: 'S4',
  title: '函数与映射',
  moduleId: 'sets',
  oneLiner: '单射、满射、双射：连线的方式决定了一切',
  outcome: '你能自己拉出箭头，说出它是不是函数、单射、满射、双射，并解释为什么。',
  prerequisites: ['S1'],
  bigIdea:
    '函数就是「左边每个点恰好牵一根线到右边」。再加两个要求：右边不许撞车（单射）、右边不许漏掉（满射）。两个都满足，两边就一一配上对了（双射）。',
  misconceptions: [
    {
      wrong: '只要左边的点都有箭头，就是函数了',
      right: '还要求「恰好一条」。左边某个点射出两条箭头时，同一个输入对应了两个输出，这就不算函数。',
    },
    {
      wrong: '单射和满射是一回事',
      right: '不一样。单射管右边「有没有撞车」，满射管右边「有没有漏掉」。左边的点比右边多时，永远做不出单射；左边的点比右边少时，永远做不出满射。',
    },
    {
      wrong: '两边元素一样多，就一定能配上对',
      right: '个数一样只是「可能」。箭头必须自己满足既不撞车也不漏掉才行；随便乱连照样会撞车、照样会漏。个数不一样时则一定做不到。',
    },
  ],
  formalDefinition: (
    <>
      <p>
        <b>函数：</b>
        <span className="font-mono">f: A → B，且对每个 x ∈ A，存在唯一的 y ∈ B 使 f(x) = y</span>
      </p>
      <p>
        <b>单射：</b>
        <span className="font-mono">f(x₁) = f(x₂) ⟹ x₁ = x₂</span>
      </p>
      <p>
        <b>满射：</b>
        <span className="font-mono">对每个 y ∈ B，都存在 x ∈ A 使 f(x) = y</span>
      </p>
      <p>
        <b>双射：</b>
        <span className="font-mono">既单射又满射</span>
      </p>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        有限集合上有个好用的结论：|A| = |B| 时，单射、满射、双射三件事是一回事；|A| &gt; |B| 时做不出单射；|A| &lt; |B| 时做不出满射。
      </p>
    </>
  ),
  glossary: [
    { term: '函数 f: A → B', plain: '左边每个点恰好配给右边一个点，不多也不少。', formal: '对每个 x ∈ A 有唯一的 f(x) ∈ B' },
    { term: '单射', plain: '右边不撞车：不同的输入配到不同的输出。', formal: 'f(x₁) = f(x₂) ⟹ x₁ = x₂' },
    { term: '满射', plain: '右边不漏掉：每个输出都真的被用到。', formal: '∀y ∈ B, ∃x ∈ A, f(x) = y' },
    { term: '双射', plain: '既不撞车也不漏掉，两边一一配上对。', formal: '单射 ∧ 满射' },
    { term: '定义域 A', plain: '左边的集合，也就是所有允许的输入。' },
    { term: '陪域 B', plain: '右边那个集合，也就是输出允许待的地方。' },
    { term: '像', plain: '右边真的被指到的那些点，合起来叫值域（像集）。只有值域等于 B 时才是满射。' },
  ],
  stages: [
    {
      label: '① 看一看',
      short: '看',
      narration: '点一点小朋友，看看他的家长是谁。',
      requireSolve: true,
      hints: [
        '三个小朋友都点一遍，让中间的线全部亮起来。',
        '点完之后看右边：哪个大人一条线都没连上？哪个大人连了两条线？',
        '三个小朋友都点亮了。每个孩子都恰好有一位家长；但张老师一次都没被连到，王阿姨却被连了两次。',
      ],
      render: (ctx) => <HookStage ctx={ctx} />,
    },
    {
      label: '② 玩一玩',
      short: '玩',
      narration: '点左边，再点右边，就拉出一条箭头。',
      requireSolve: true,
      hints: [
        '先点左边一个点，再点右边一个点。点过的同一对再点一次就是取消。',
        '想做出单射，就让三个右边点各被指一次；想做出函数，就让左边每个点都恰好有一条箭头。',
        '先给 1、2、3 各连一条（比如 1→a、2→b、3→c），函数就成立了；再检查右边有没有撞车和漏掉 —— 这个连法两边都满足，于是双射也一起达成。三个任务会同时打勾。',
      ],
      render: (ctx) => <ExploreStage ctx={ctx} />,
    },
    {
      label: '③ 起个名',
      short: '名',
      narration: '你盯着看的四个徽章，各有各的名字。',
      requireSolve: true,
      hints: [
        '先分清楚这句话在说左边还是说右边。',
        '说左边「每个点恰好一条」的是函数；说右边「不许撞车」的是单射；说右边「不许漏掉」的是满射；两个都满足是双射。',
        '四题依次是：函数、单射、满射、双射。记住：单射管撞车，满射管漏掉。',
      ],
      render: (ctx) => <NameStage ctx={ctx} />,
    },
    {
      label: '④ 练一练',
      short: '练',
      narration: '三道小题，选错会讲清楚为什么。',
      requireSolve: true,
      hints: [
        '每道题先问自己：这是在说左边（函数），还是在说右边？说右边的话，是撞车还是漏掉？',
        '判断满射就看右边有没有点被漏掉；判断单射就看右边有没有点被指了两次。',
        '三题的正确选项依次是：既单射又满射才叫双射；不是满射，因为 c 没被指到；不能做出单射，因为 3 个点射进 2 个点必然撞车。',
      ],
      render: (ctx) => <PracticeStage ctx={ctx} />,
    },
    {
      label: '⑤ 换个场景',
      short: '变',
      narration: '数一数：3 对 3 一共有几种双射？',
      requireSolve: true,
      hints: [
        '先把下面 8 张连法一张张看一遍，把「右边不撞车也不漏掉」的都点出来。',
        '撞车的那张和左边少一条箭头的那张不是双射，其余都是。',
        '一共 6 种双射（3 × 2 × 1 = 6）。最后那道题选 6 种：给「1」挑对象有 3 种，给「2」剩 2 种，给「3」只剩 1 种。',
      ],
      render: (ctx) => <TransferStage ctx={ctx} />,
    },
  ],
}

export default topic
