import { useCallback, useMemo, useState } from 'react'

import { VennDiagram, twoCircles, maskOf, type VennItem } from '@/primitives'
import { SET_OPS, applyOp, setToString, type SetOp } from '@/kernels/sets'
import type { Pt } from '@/kernels/layout'
import { Btn, Callout, Card, Chip, Math as Formula, PlainSpeak, SectionTitle, Segmented, cx } from '@/ui'
import { Quiz } from '@/ui/Quiz'
import { useSolveOnce, useTriedSet } from '../hooks'
import type { StageCtx, Topic } from '../types'

const CIRCLES = twoCircles()

/* 每个区域预置几个「车位」，让小球一开始就摆得整齐、不会和圈线叠在一起 */
const SLOTS = {
  a: [
    { x: 86, y: 86 },
    { x: 84, y: 154 },
  ],
  ab: [
    { x: 170, y: 90 },
    { x: 170, y: 150 },
  ],
  b: [
    { x: 256, y: 86 },
    { x: 258, y: 154 },
  ],
  out: [
    { x: 52, y: 232 },
    { x: 288, y: 232 },
  ],
}

const START_ITEMS: VennItem[] = [
  { id: 'i1', label: '1', ...SLOTS.a[0] },
  { id: 'i2', label: '2', ...SLOTS.ab[0] },
  { id: 'i3', label: '3', ...SLOTS.b[0] },
  { id: 'i4', label: '4', ...SLOTS.a[1] },
  { id: 'i5', label: '5', ...SLOTS.out[1] },
]

/** 四种运算各自要点亮哪些区域（VennDiagram 的 mask 语义：「有哪个字母就在哪个圆里」） */
const OP_MASKS: Record<SetOp, string[]> = {
  union: ['A', 'B', 'AB'],
  intersect: ['AB'],
  difference: ['A'],
  symdiff: ['A', 'B'],
}

/** 把亮起来的区域翻译成人话，免得用户只是看到一块黄色 */
const OP_REGION_WORDS: Record<SetOp, string> = {
  union: '只在 A 的一块 + 只在 B 的一块 + 两边都有的那一块',
  intersect: '只剩「两边都有」的那一小块',
  difference: '只剩「在 A 里、不在 B 里」的那一块',
  symdiff: '只在 A 的一块 + 只在 B 的一块，两边都有的反而灭掉',
}

function opMeta(op: SetOp): (typeof SET_OPS)[number] {
  const m = SET_OPS.find((o) => o.key === op)
  if (!m) throw new Error(`未知的集合运算：${op}`)
  return m
}

const OP_OPTIONS = SET_OPS.map((o) => ({
  value: o.key,
  label: `${o.label} ${o.symbol}`,
  title: o.plain,
}))

/* ============================================================== ① 看一看 */

interface Fruit {
  id: string
  emoji: string
  name: string
}

const FRUITS: Record<string, { emoji: string; name: string }> = {
  apple: { emoji: '🍎', name: '苹果' },
  banana: { emoji: '🍌', name: '香蕉' },
  grape: { emoji: '🍇', name: '葡萄' },
}

const BASKET_A: Fruit[] = [
  { id: 'apple', emoji: '🍎', name: '苹果' },
  { id: 'banana', emoji: '🍌', name: '香蕉' },
]

const BASKET_B: Fruit[] = [
  { id: 'apple', emoji: '🍎', name: '苹果' },
  { id: 'grape', emoji: '🍇', name: '葡萄' },
]

/** 倒进大筐后的顺序：重复的苹果只留一个 */
const BIG_ORDER = ['apple', 'banana', 'grape']

function FruitChip({ id }: { id: string }) {
  const f = FRUITS[id]
  return (
    <span className="flex flex-col items-center gap-0.5 rounded-xl bg-white px-2.5 py-1.5 shadow-sm dark:bg-slate-900">
      <span aria-hidden="true" className="text-2xl leading-none">
        {f.emoji}
      </span>
      <span className="text-xs text-slate-600 dark:text-slate-300">{f.name}</span>
    </span>
  )
}

function HookStage({ ctx }: { ctx: StageCtx }) {
  const [poured, setPoured] = useState(false)
  const [checked, setChecked] = useState<string[]>([])

  useSolveOnce(ctx, poured && checked.includes('apple'))

  const pour = (): void => {
    if (poured) return
    setPoured(true)
    ctx.say('两筐倒在一起了：苹果只出现一次。', 'accept')
    ctx.announce('两筐水果倒进了大筐。苹果两筐都有，倒在一起只算一个。')
  }

  const clickFruit = (id: string): void => {
    setChecked((prev) => (prev.includes(id) ? prev : [...prev, id]))
    const name = FRUITS[id].name
    if (id === 'apple') {
      ctx.say('苹果两筐都有，倒进大筐只算一个。', 'accept')
      ctx.announce('苹果既在 A 筐也在 B 筐，倒进大筐后只有一个 —— 这就是并集。')
    } else {
      ctx.say(`${name}只在一个筐里，大筐里照样有它。`, 'normal')
      ctx.announce(`${name}只在一个筐里，倒进大筐后还是它一个。`)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <PlainSpeak>
        左边 A 筐和右边 B 筐都装着水果。<b>两筐一起倒进下面的大筐</b>，看看会怎么样。
      </PlainSpeak>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border-4 border-a-300 bg-a-50/60 p-3 dark:border-a-500/40 dark:bg-a-500/10">
          <div className="mb-2 text-sm font-semibold text-a-700 dark:text-a-300">A 筐</div>
          <div className="flex flex-wrap gap-2">
            {BASKET_A.map((f) => (
              <FruitChip key={f.id} id={f.id} />
            ))}
          </div>
        </div>

        <div className="rounded-2xl border-4 border-b-300 bg-b-50/60 p-3 dark:border-b-500/40 dark:bg-b-500/10">
          <div className="mb-2 text-sm font-semibold text-b-700 dark:text-b-300">B 筐</div>
          <div className="flex flex-wrap gap-2">
            {BASKET_B.map((f) => (
              <FruitChip key={f.id} id={f.id} />
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Btn variant="primary" onClick={pour} disabled={poured} aria-label="把两筐水果倒进大筐">
          {poured ? '已经倒好了' : '把两筐倒进大筐 ↓'}
        </Btn>
        {poured ? (
          <span className="text-xs text-slate-500 dark:text-slate-400">点一下大筐里任意一个水果，看看它从哪来的。</span>
        ) : null}
      </div>

      <div
        className={cx(
          'rounded-2xl border-4 border-dashed p-3 dl-transition',
          poured
            ? 'border-ok-500 bg-ok-50/60 dark:bg-ok-500/10'
            : 'border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/40',
        )}
      >
        <div className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">大筐（两筐倒在一起）</div>
        {poured ? (
          <div className="flex flex-wrap gap-2">
            {BIG_ORDER.map((id) => {
              const active = checked.includes(id)
              return (
                <button
                  key={id}
                  type="button"
                  aria-pressed={active}
                  aria-label={`大筐里的${FRUITS[id].name}`}
                  onClick={() => clickFruit(id)}
                  className={cx(
                    'flex flex-col items-center gap-0.5 rounded-xl border px-2.5 py-1.5 dl-transition',
                    active
                      ? 'border-ok-500 bg-ok-50 dark:bg-ok-500/20'
                      : 'border-slate-200 bg-white hover:border-a-500 dark:border-slate-700 dark:bg-slate-900',
                  )}
                >
                  <span aria-hidden="true" className="text-2xl leading-none">
                    {FRUITS[id].emoji}
                  </span>
                  <span className="text-xs text-slate-600 dark:text-slate-300">{FRUITS[id].name}</span>
                </button>
              )
            })}
          </div>
        ) : (
          <p className="text-sm text-slate-500 dark:text-slate-400">大筐现在还是空的。</p>
        )}
      </div>

      <Callout tone={poured && checked.includes('apple') ? 'ok' : 'info'} role="status">
        {!poured
          ? '先点上面的按钮，把两筐倒进去。'
          : checked.includes('apple')
            ? '看到了：苹果在两筐里都有，可大筐里只有一个 —— 重复的东西只算一份。'
            : '大筐里有三样东西。点一点苹果，看看它有什么特别的。'}
      </Callout>
    </div>
  )
}

/* ============================================================== ② 玩一玩 */

function ExploreStage({ ctx }: { ctx: StageCtx }) {
  const [items, setItems] = useState<VennItem[]>(START_ITEMS)
  const [op, setOp] = useState<SetOp>('union')
  const { tried, markTried } = useTriedSet()

  const groups = useMemo(() => {
    const A: string[] = []
    const B: string[] = []
    for (const it of items) {
      const m = maskOf(CIRCLES, it)
      if (m.includes('A')) A.push(it.label)
      if (m.includes('B')) B.push(it.label)
    }
    return { A, B }
  }, [items])

  const result = useMemo(() => applyOp(op, groups.A, groups.B), [op, groups])
  const meta = opMeta(op)
  const done = tried.size >= SET_OPS.length
  const missing = SET_OPS.filter((o) => !tried.has(o.key))

  const changeOp = useCallback(
    (next: SetOp) => {
      setOp(next)
      markTried(next)
      const m = opMeta(next)
      ctx.say(`${m.label}：${m.plain}`)
    },
    [ctx, markTried],
  )

  const onMove = useCallback((id: string, pt: Pt) => {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, x: Math.round(pt.x), y: Math.round(pt.y) } : it)),
    )
  }, [])

  useSolveOnce(ctx, done)

  return (
    <div className="flex flex-col gap-3">
      <PlainSpeak>
        小球落在哪儿，就属于哪个集合。<b>把小球拖来拖去</b>，再切换下面四种玩法，看黄色区域怎么变。
      </PlainSpeak>

      <Segmented<SetOp>
        label="选择一种集合运算"
        options={OP_OPTIONS}
        value={op}
        onChange={changeOp}
      />

      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_17rem]">
        <div className="rounded-xl bg-slate-50 p-2 dark:bg-slate-800/40">
          <VennDiagram
            circles={CIRCLES}
            items={items}
            highlightMasks={OP_MASKS[op]}
            onMoveItem={onMove}
            describeItem={(it, mask) => {
              const where = mask ? `在 ${mask.split('').join(' 和 ')} 里` : '两个圈都没进'
              return `${it.label}，${where}`
            }}
            ariaLabel="集合 A 与集合 B 的韦恩图，可以拖动小球改变成员，黄色区域是当前运算的结果"
            keyboardHint="拖小球改成员；键盘：Tab 选中一个球，方向键移动（Shift 加速）。"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Card className="p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <Chip tone="cur">{meta.symbol}</Chip>
              <span className="text-xs text-slate-500 dark:text-slate-400">{meta.label}</span>
            </div>
            <div className="flex flex-col gap-1.5 font-mono text-sm">
              <div className="flex justify-between gap-2">
                <span className="text-a-700 dark:text-a-300">A =</span>
                <span className="text-slate-700 dark:text-slate-200">{setToString(groups.A)}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-b-700 dark:text-b-300">B =</span>
                <span className="text-slate-700 dark:text-slate-200">{setToString(groups.B)}</span>
              </div>
              <div className="mt-1 flex justify-between gap-2 border-t border-slate-200 pt-1.5 dark:border-slate-700">
                <span className="text-cur-700 dark:text-cur-500">{meta.symbol} =</span>
                <span className="font-semibold text-slate-800 dark:text-slate-100">{setToString(result)}</span>
              </div>
            </div>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              |A| = {groups.A.length}，|B| = {groups.B.length}，|结果| = {result.length}
            </p>
          </Card>

          <Callout tone="info">
            亮的区域是：{OP_REGION_WORDS[op]}。
          </Callout>

          <Callout tone={done ? 'ok' : 'cur'} role="status">
            {done
              ? '四种玩法都点过了。同一堆小球，换个运算结果就变一个样。'
              : `还有 ${missing.length} 种没点：${missing.map((m) => m.label).join('、')}。四种都点一遍才算玩透。`}
          </Callout>
        </div>
      </div>
    </div>
  )
}

/* ============================================================== ③ 起个名 */

interface OpQuestion {
  id: string
  sentence: string
  answer: SetOp
  why: string
}

const OP_QUESTIONS: OpQuestion[] = [
  {
    id: 'q1',
    sentence: 'A = {1, 2, 3}，B = {3, 4}。得到 {3} 的是哪一种？',
    answer: 'intersect',
    why: '3 在 A 里也在 B 里，交集只留两边都有的东西，所以结果是 {3}。',
  },
  {
    id: 'q2',
    sentence: 'A = {1, 2, 3}，B = {3, 4}。得到 {1, 2} 的是哪一种？',
    answer: 'difference',
    why: '从 A 里挑，把 B 里出现过的 3 拿走，剩下 1 和 2 —— 这就是差集 A − B。',
  },
  {
    id: 'q3',
    sentence: 'A = {1, 2, 3}，B = {3, 4}。得到 {1, 2, 4} 的是哪一种？',
    answer: 'symdiff',
    why: '1、2 只在 A 里，4 只在 B 里，3 两边都有被踢掉了 —— 这就是对称差 A ⊕ B。',
  },
  {
    id: 'q4',
    sentence: 'A = {1, 2, 3}，B = {3, 4}。得到 {1, 2, 3, 4} 的是哪一种？',
    answer: 'union',
    why: '两边的东西全倒在一起，重复的 3 只算一份 —— 这就是并集 A ∪ B。',
  },
]

function NameStage({ ctx }: { ctx: StageCtx }) {
  const [answers, setAnswers] = useState<Record<string, SetOp>>({})
  const allRight = OP_QUESTIONS.every((q) => answers[q.id] === q.answer)

  useSolveOnce(ctx, allRight)

  return (
    <div className="flex flex-col gap-4">
      <PlainSpeak>
        你刚才点出来的四块黄色区域，数学上各有一个名字和一个符号。下面这张表就是它们。
      </PlainSpeak>

      <Card>
        <SectionTitle hint="大白话在前，符号在后">四种运算，四个名字</SectionTitle>
        <ul className="flex flex-col gap-2.5">
          {SET_OPS.map((o) => (
            <li key={o.key} className="rounded-xl bg-slate-50 px-3 py-2.5 dark:bg-slate-800/50">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">{o.label}</span>
                <Formula>{o.symbol}</Formula>
              </div>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{o.plain}</p>
              <p className="mt-0.5 font-mono text-xs text-slate-500 dark:text-slate-400">{o.formal}</p>
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <SectionTitle hint="用同一对集合，看结果反推是哪种运算">对号入座</SectionTitle>
        <p className="mb-3 text-sm text-slate-600 dark:text-slate-300">
          都是 A = {'{1, 2, 3}'}、B = {'{3, 4}'}。看结果，选出对应的运算。
        </p>
        <ul className="flex flex-col gap-4">
          {OP_QUESTIONS.map((q) => {
            const picked = answers[q.id]
            const right = picked === q.answer
            return (
              <li key={q.id} className="flex flex-col gap-2">
                <p className="text-sm text-slate-700 dark:text-slate-200">{q.sentence}</p>
                <div className="flex flex-wrap items-center gap-2">
                  {SET_OPS.map((o) => {
                    const active = picked === o.key
                    const good = active && right
                    const bad = active && !right
                    return (
                      <button
                        key={o.key}
                        type="button"
                        aria-pressed={active}
                        aria-label={`第 ${q.id} 题选 ${o.label}`}
                        onClick={() => setAnswers((a) => ({ ...a, [q.id]: o.key }))}
                        className={cx(
                          'min-h-11 rounded-xl border px-3 text-sm font-medium dl-transition',
                          good
                            ? 'border-ok-500 bg-ok-50 text-ok-700 dark:bg-ok-500/15 dark:text-ok-500'
                            : bad
                              ? 'border-bad-500 bg-bad-50 text-bad-700 dark:bg-bad-500/15 dark:text-bad-500'
                              : 'border-slate-300 bg-white text-slate-700 hover:border-a-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200',
                        )}
                      >
                        {o.label}
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
        <SectionTitle>顺便认识几个词</SectionTitle>
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          {[
            ['并集 ∪', '两边的东西全都要，重复的只算一份。'],
            ['交集 ∩', '只要两边都有的东西。'],
            ['差集 −', '从左边挑，把右边也有的拿走。'],
            ['对称差 ⊕', '只要「只在一侧出现」的东西，两边都有的反而不要。'],
            ['不相交', '两个集合一个共同元素都没有，也就是交集是空的。'],
            ['容斥', '把并集的个数算清楚：两边的个数相加，再减掉重复数的那一次。'],
          ].map(([t, d]) => (
            <div key={t} className="rounded-lg bg-slate-50 px-2.5 py-2 dark:bg-slate-800/50">
              <dt className="font-semibold text-slate-800 dark:text-slate-100">{t}</dt>
              <dd className="mt-0.5 text-slate-600 dark:text-slate-300">{d}</dd>
            </div>
          ))}
        </dl>
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
        三道题，随便选。选错了会告诉你错在哪，可以马上再来 —— 没有次数限制。
      </p>

      <Card>
        <Quiz
          question={
            <>
              集合 A = {'{1, 2, 3}'}，B = {'{2, 3, 4}'}。那么 |A ∪ B| 一定等于 |A| + |B| 吗？
            </>
          }
          resetKey="s2p1"
          onSolved={() => setSolvedCount((c) => c + 1)}
          choices={[
            {
              id: 'a',
              label: '不一定。两边都有的元素会被算两次',
              correct: true,
              why: '对。2 和 3 同时装在 A 和 B 里：|A| + |B| = 3 + 3 = 6，把它们各数了两遍。真正在并集里的只有 1、2、3、4 这 4 个。',
            },
            {
              id: 'b',
              label: '一定。并集就是把两边的个数加起来',
              correct: false,
              why: '不对。并集是把元素倒在一起、重复的只算一份。「把个数加起来」会把同时在两个集合里的元素数两次，结果偏大。这里 3 + 3 = 6，但 |A ∪ B| = 4。',
            },
            {
              id: 'c',
              label: '只有 A = B 的时候才相等',
              correct: false,
              why: '不对，这恰好是差得最多的情况：A = B 时 |A ∪ B| = |A|，而 |A| + |B| = 2|A|，差了一倍。两边完全不重叠（|A ∩ B| = 0）的时候才相等。',
            },
          ]}
        />
      </Card>

      <Card>
        <Quiz
          question={<>A = {'{1, 2, 3}'}，B = {'{3, 4, 5}'}。A − B 等于什么？</>}
          resetKey="s2p2"
          onSolved={() => setSolvedCount((c) => c + 1)}
          choices={[
            {
              id: 'a',
              label: '{1, 2}',
              correct: true,
              why: '对。差集是「在 A 里、但不在 B 里」。A 里的 3 也在 B 里，所以被拿走，剩下 1 和 2。',
            },
            {
              id: 'b',
              label: '{1, 2, 3}',
              correct: false,
              why: '不对。这就是 A 本身，一点都没扣。差集要求把 B 里也出现过的元素从 A 里拿走，3 必须被拿走。',
            },
            {
              id: 'c',
              label: '{1, 2, 4, 5}',
              correct: false,
              why: '不对。这是对称差 A ⊕ B（只出现在一侧的元素）。差集只从 A 里挑，4 和 5 根本不在 A 里，不该出现。',
            },
            {
              id: 'd',
              label: '{4, 5}',
              correct: false,
              why: '不对。这是 B − A，方向反了。差集不满足交换律：A − B 和 B − A 一般不一样。',
            },
          ]}
        />
      </Card>

      <Card>
        <Quiz
          question={<>A = {'{1, 2}'}，B = {'{1, 2, 3}'}。下面哪一句是对的？</>}
          resetKey="s2p3"
          onSolved={() => setSolvedCount((c) => c + 1)}
          choices={[
            {
              id: 'a',
              label: 'A ∩ B = {1, 2}，而且 A ⊆ B',
              correct: true,
              why: '对。1、2 两边都有，所以交集就是 {1, 2}；A 里的东西 B 里全有，所以 A 是 B 的子集。这两件事在这里同时成立。',
            },
            {
              id: 'b',
              label: 'A ∪ B = {3}',
              correct: false,
              why: '不对。并集是把两边全倒进来，应该是 {1, 2, 3}。{3} 是 B − A 的结果。',
            },
            {
              id: 'c',
              label: 'A − B = {1, 2}',
              correct: false,
              why: '不对。A 里的 1 和 2 在 B 里都有，全都要被拿走，所以 A − B 是空集 ∅。',
            },
            {
              id: 'd',
              label: 'A ⊕ B = {1, 2}',
              correct: false,
              why: '不对。对称差只留下只在一侧的元素。1 和 2 两侧都有，要被踢掉；只剩下只属于 B 的 3，所以 A ⊕ B = {3}。',
            },
          ]}
        />
      </Card>
    </div>
  )
}

/* ============================================================== ⑤ 换个场景 */

function PickRow({
  label,
  options,
  value,
  onPick,
}: {
  label: string
  options: number[]
  value: number | null
  onPick: (n: number) => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{label}</span>
      {options.map((n) => (
        <button
          key={n}
          type="button"
          aria-pressed={value === n}
          aria-label={`${label}：选 ${n}`}
          onClick={() => onPick(n)}
          className={cx(
            'min-h-11 min-w-11 rounded-xl border font-mono text-base font-bold dl-transition',
            value === n
              ? 'border-a-500 bg-a-50 text-a-700 dark:bg-a-500/20 dark:text-a-300'
              : 'border-slate-300 bg-white text-slate-700 hover:border-a-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200',
          )}
        >
          {n}
        </button>
      ))}
    </div>
  )
}

function TransferStage({ ctx }: { ctx: StageCtx }) {
  const A = useMemo(() => ['1', '2', '3', '4'], [])
  const B = useMemo(() => ['3', '4', '5'], [])

  const [inter, setInter] = useState<number | null>(null)
  const [uni, setUni] = useState<number | null>(null)
  const [whyDone, setWhyDone] = useState(false)

  const okInter = inter === 2
  const okUni = uni === 5
  useSolveOnce(ctx, okInter && okUni && whyDone)

  const pickInter = (n: number): void => {
    setInter(n)
    ctx.say(n === 2 ? '对，A 和 B 都有的是 3 和 4。' : '再数数：两边都有的元素有几个？', n === 2 ? 'accept' : 'reject')
  }

  const pickUni = (n: number): void => {
    setUni(n)
    ctx.say(n === 5 ? '对，并集里是 1、2、3、4、5。' : '再数数：把所有不同的元素列出来有几个？', n === 5 ? 'accept' : 'reject')
  }

  return (
    <div className="flex flex-col gap-3">
      <PlainSpeak>
        换个具体例子：A = {'{1, 2, 3, 4}'}，B = {'{3, 4, 5}'}。先数出交集，再数出并集。
      </PlainSpeak>

      <Card>
        <div className="flex flex-col gap-1.5 font-mono text-sm">
          <div className="flex justify-between gap-2">
            <span className="text-a-700 dark:text-a-300">A =</span>
            <span className="text-slate-700 dark:text-slate-200">{setToString(A)}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-b-700 dark:text-b-300">B =</span>
            <span className="text-slate-700 dark:text-slate-200">{setToString(B)}</span>
          </div>
        </div>
      </Card>

      <Card className="flex flex-col gap-3">
        <PickRow label="A ∩ B 里有几个元素？" options={[1, 2, 3, 4]} value={inter} onPick={pickInter} />
        {inter !== null && !okInter ? (
          <Callout tone="bad">
            再想想：交集只留<b>两边都有</b>的元素。A 里是 1、2、3、4，B 里是 3、4、5，共同的是 3 和 4。
          </Callout>
        ) : null}
        {okInter ? <Callout tone="ok">对，A ∩ B = {'{3, 4}'}，一共 2 个。</Callout> : null}

        <PickRow label="A ∪ B 里有几个元素？" options={[4, 5, 6, 7]} value={uni} onPick={pickUni} />
        {uni !== null && !okUni ? (
          <Callout tone="bad">
            再想想：并集把两边倒在一起，重复的只算一份 —— 1、2、3、4 加上 B 里多出来的 5。
          </Callout>
        ) : null}
        {okUni ? (
          <Callout tone="ok">
            对，A ∪ B = {'{1, 2, 3, 4, 5}'}，一共 5 个。注意 |A| + |B| = 4 + 3 = 7，比 5 大 —— 多出来的正是被数了两遍的 3 和 4。
          </Callout>
        ) : null}
      </Card>

      <Card>
        <Quiz
          question={<>为什么 |A ∪ B| = |A| + |B| − |A ∩ B| 一定成立？</>}
          resetKey="s2t1"
          onSolved={() => setWhyDone(true)}
          choices={[
            {
              id: 'a',
              label: '因为交集里的元素在 |A| 里数了一次、在 |B| 里又数了一次，加起来被数了两遍，减去一遍就刚好算一次',
              correct: true,
              why: '对。把 A 和 B 的个数直接相加时，两边都有的元素被数了两遍；减掉一次 |A ∩ B|，它们就只被算一遍，正好等于并集的个数。这里 4 + 3 − 2 = 5。',
            },
            {
              id: 'b',
              label: '因为并集的名字里带一个「并」，所以要先把交集减掉',
              correct: false,
              why: '不对。这是从名字上猜的，不是理由。真正的原因只有一个：直接相加时，公共元素被数了两次，必须补一次减法。',
            },
            {
              id: 'c',
              label: '因为要先算交集才能算并集，减掉只是计算顺序而已',
              correct: false,
              why: '不对。计算顺序不影响结果，减 |A ∩ B| 也不是为了「先算交集」。它是为了修正重复计数 —— 你可以先算交集，也可以先算并集，但这个减法必须有。',
            },
          ]}
        />
      </Card>
    </div>
  )
}

/* ============================================================== 导出 */

const topic: Topic = {
  id: 'S2',
  title: '集合的运算',
  moduleId: 'sets',
  oneLiner: '并、交、差：两个圈之间能玩出的四种花样',
  outcome: '你能看着两个集合说出并集、交集、差集、对称差各是什么，并算对「结果里到底有几个元素」。',
  prerequisites: ['S1'],
  bigIdea:
    '两个圈摆在一起，只可能有四种玩法：全都要（并集）、只留共有的（交集）、只留一边的（差集）、只留各自独有的（对称差）。整章集合运算，都是这四个画面的组合。',
  misconceptions: [
    {
      wrong: '并集一定比原来的集合大',
      right: '不一定。A ⊆ B 时 A ∪ B 就是 B，一个元素也没多出来。只有当 A 里有 B 装不下的东西时，并集才会真的变大。',
    },
    {
      wrong: 'A ∩ B 是空集，说明两个集合没关系',
      right: '交集为空只说明它们没有共同元素。差集照样可能有很多东西：A = {1}、B = {2} 时，A − B = {1}，B − A = {2}。',
    },
    {
      wrong: '对称差就是把两边的元素都留下',
      right: '恰好相反。对称差把两边都有的元素踢掉，只留只在一侧出现的元素。A = {1, 2}、B = {2, 3} 时，A ⊕ B = {1, 3}，2 被踢掉了。',
    },
  ],
  formalDefinition: (
    <>
      <p>
        <b>并集：</b>
        <span className="font-mono">A ∪ B = {'{ x | x ∈ A 或 x ∈ B }'}</span>
      </p>
      <p>
        <b>交集：</b>
        <span className="font-mono">A ∩ B = {'{ x | x ∈ A 且 x ∈ B }'}</span>
      </p>
      <p>
        <b>差集：</b>
        <span className="font-mono">A − B = {'{ x | x ∈ A 且 x ∉ B }'}</span>
      </p>
      <p>
        <b>对称差：</b>
        <span className="font-mono">A ⊕ B = (A − B) ∪ (B − A)</span>
      </p>
      <p>
        <b>容斥（元素个数）：</b>
        <span className="font-mono">|A ∪ B| = |A| + |B| − |A ∩ B|</span>
      </p>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        「或」在这里是「至少一个」的意思：两边都满足也算。集合里的元素不重复，所以并集里重复的东西只算一份。
      </p>
    </>
  ),
  glossary: [
    { term: '并集 ∪', plain: '把两个集合里的东西全倒在一起，重复的只算一份。', formal: 'A ∪ B = { x | x ∈ A ∨ x ∈ B }' },
    { term: '交集 ∩', plain: '只留下同时在两个集合里的东西。', formal: 'A ∩ B = { x | x ∈ A ∧ x ∈ B }' },
    { term: '差集 −', plain: '从左边那个集合里挑，把右边也有的拿走。', formal: 'A − B = { x | x ∈ A ∧ x ∉ B }' },
    { term: '对称差 ⊕', plain: '只在一侧出现的东西；两边都有的反而被去掉。', formal: 'A ⊕ B = (A − B) ∪ (B − A)' },
    {
      term: '容斥原理（两个集合）',
      plain: '两边的个数相加，再减掉被数了两遍的公共部分，就是并集的个数。',
      formal: '|A ∪ B| = |A| + |B| − |A ∩ B|',
    },
    { term: '不相交（互斥）', plain: '两个集合一个共同元素都没有。', formal: 'A ∩ B = ∅' },
  ],
  stages: [
    {
      label: '① 看一看',
      short: '看',
      narration: '两筐水果倒进大筐，重复的只算一个。',
      requireSolve: true,
      hints: [
        '先点「把两筐倒进大筐」，再点一点大筐里的水果，看看它原来在哪个筐里。',
        '有一个水果在两个筐里都出现过，倒进大筐后它只出现了一次 —— 把它点出来。',
        '点大筐里的「苹果」。它既在 A 筐也在 B 筐，可大筐里只有一个 —— 倒在一起时，重复的东西只算一份。',
      ],
      render: (ctx) => <HookStage ctx={ctx} />,
    },
    {
      label: '② 玩一玩',
      short: '玩',
      narration: '切换四种运算，看圈里哪块亮起来。',
      requireSolve: true,
      hints: [
        '先拖几个小球进圈、出圈，再把「并集 / 交集 / 差集 / 对称差」四个按钮各点一遍。',
        '看点亮的黄色区域：并集亮三块，交集只亮中间那块，差集只亮左边那块，对称差亮左右两块。',
        '四种都点一遍（并集 ∪、交集 ∩、差集 −、对称差 ⊕）。并集 = 只在 A + 只在 B + 两边都有；交集 = 只有中间；差集 = 只在 A；对称差 = 只在 A 加只在 B。',
      ],
      render: (ctx) => <ExploreStage ctx={ctx} />,
    },
    {
      label: '③ 起个名',
      short: '名',
      narration: '刚才亮的区域，各有各的名字和符号。',
      requireSolve: true,
      hints: [
        '看结果里有哪些数，再回头对照上面那张表。',
        '{3} 只含两边都有的数；{1, 2} 是 A 扣掉 B 的 3；{1, 2, 4} 是只在一侧出现的数；{1, 2, 3, 4} 是全部。',
        '四道题依次是：交集 ∩、差集 −、对称差 ⊕、并集 ∪。',
      ],
      render: (ctx) => <NameStage ctx={ctx} />,
    },
    {
      label: '④ 练一练',
      short: '练',
      narration: '三道小题，选错会讲清楚为什么。',
      requireSolve: true,
      hints: [
        '先把两个集合的元素都在纸上列出来，再一个个数。',
        '问「个数」的题，先找出两边都有的元素 —— 它们在直接相加时会被数两遍。',
        '三题的正确选项依次是：不一定，两边都有的会被算两次；{1, 2}；A ∩ B = {1, 2} 且 A ⊆ B。',
      ],
      render: (ctx) => <PracticeStage ctx={ctx} />,
    },
    {
      label: '⑤ 换个场景',
      short: '变',
      narration: '换个数，算一算并集和交集有几个。',
      requireSolve: true,
      hints: [
        '先把两个集合相同的部分找出来 —— 那就是交集。',
        '并集不用重新数一遍：|A| + |B| 之后，把交集多算的那一次减掉就行。',
        'A ∩ B = {3, 4}，所以选 2；|A| + |B| − |A ∩ B| = 4 + 3 − 2 = 5，所以并集选 5。最后一题选第一个：公共元素被数了两遍，减去一遍刚好。',
      ],
      render: (ctx) => <TransferStage ctx={ctx} />,
    },
  ],
}

export default topic
