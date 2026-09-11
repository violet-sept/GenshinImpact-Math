import { useCallback, useMemo, useState } from 'react'

import { VennDiagram, twoCircles, maskOf, type VennItem } from '@/primitives'
import { isProperSubset, isSubset, setToString } from '@/kernels/sets'
import type { Pt } from '@/kernels/layout'
import { Btn, Callout, Card, PlainSpeak, SectionTitle, cx } from '@/ui'
import { Quiz } from '@/ui/Quiz'
import { useSolveOnce, useTriedSet } from '../hooks'
import type { StageCtx, Topic } from '../types'

const CIRCLES = twoCircles()

/* 每个区域预置几个「车位」，让元素摆放一开始就是整齐的、不会叠在一起 */
const SLOTS = {
  a: [
    { x: 86, y: 86 },
    { x: 84, y: 154 },
  ],
  b: [
    { x: 256, y: 86 },
    { x: 258, y: 154 },
  ],
  ab: [
    { x: 170, y: 90 },
    { x: 170, y: 150 },
  ],
  out: [
    { x: 52, y: 232 },
    { x: 288, y: 232 },
  ],
}

const HOOK_ITEMS: VennItem[] = [
  { id: 's1', label: '明', ...SLOTS.a[0] },
  { id: 's2', label: '红', ...SLOTS.ab[0] },
  { id: 's3', label: '刚', ...SLOTS.b[0] },
  { id: 's4', label: '美', ...SLOTS.a[1] },
  { id: 's5', label: '强', ...SLOTS.b[1] },
]

const EXPLORE_START: VennItem[] = [
  { id: 'n1', label: '1', x: 52, y: 232 },
  { id: 'n2', label: '2', x: 118, y: 236 },
  { id: 'n3', label: '3', x: 200, y: 236 },
  { id: 'n4', label: '4', x: 288, y: 232 },
  { id: 'n5', label: '5', x: 170, y: 30 },
]

/* ============================================================== ① 看一看 */

function HookStage({ ctx }: { ctx: StageCtx }) {
  const [items] = useState<VennItem[]>(HOOK_ITEMS)
  const { tried, markTried } = useTriedSet()

  const membershipsOf = useCallback(
    (it: VennItem) => maskOf(CIRCLES, { x: it.x, y: it.y }),
    [],
  )

  const handleClick = (id: string): void => {
    markTried(id)
    const it = items.find((x) => x.id === id)!
    const m = membershipsOf(it)
    const who = it.label
    if (m === 'AB') ctx.announce(`${who} 既在篮球队也在乐队 —— 两个圈重叠的地方。`)
    else if (m === 'A') ctx.announce(`${who} 只在篮球队。`)
    else if (m === 'B') ctx.announce(`${who} 只在乐队。`)
    else ctx.announce(`${who} 两个队都没参加。`)
  }

  useSolveOnce(ctx, tried.size >= items.length)

  return (
    <div className="flex flex-col gap-3">
      <PlainSpeak>
        一个班里有 5 个同学。左边的圈是<b>篮球队</b>，右边的圈是<b>乐队</b>。
        挨个点一下同学，看看他们各自站在哪儿。
      </PlainSpeak>

      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_15rem]">
        <div className="rounded-xl bg-slate-50 p-2 dark:bg-slate-800/40">
          <VennDiagram
            circles={CIRCLES}
            items={items}
            highlightItems={[...tried]}
            onItemClick={handleClick}
            ariaLabel="五个同学在篮球队和乐队两个圈里的分布"
            keyboardHint="用 Tab 选中同学，按 Enter 查看他参加哪些队。"
          />
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-sm">
            <span
              aria-hidden="true"
              className="inline-block h-3 w-3 rounded-full"
              style={{ background: 'var(--color-a-600)' }}
            />
            <span className="text-slate-600 dark:text-slate-300">左圈 = 篮球队</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span
              aria-hidden="true"
              className="inline-block h-3 w-3 rounded-full"
              style={{ background: 'var(--color-b-600)' }}
            />
            <span className="text-slate-600 dark:text-slate-300">右圈 = 乐队</span>
          </div>
          <Callout tone={tried.size >= items.length ? 'ok' : 'info'}>
            {tried.size >= items.length
              ? '点完了。你注意到没有：红 站在两个圈重叠的那一块。'
              : `已经点过 ${tried.size} / ${items.length} 个同学。`}
          </Callout>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            站在圈重叠处的同学，就是「既参加篮球队、又参加乐队」的人。
          </p>
        </div>
      </div>
    </div>
  )
}

/* ============================================================== ② 玩一玩 */

function ExploreStage({ ctx }: { ctx: StageCtx }) {
  const [items, setItems] = useState<VennItem[]>(EXPLORE_START)

  const groups = useMemo(() => {
    const A: string[] = []
    const B: string[] = []
    const outside: string[] = []
    for (const it of items) {
      const m = maskOf(CIRCLES, { x: it.x, y: it.y })
      if (m.includes('A')) A.push(it.label)
      if (m.includes('B')) B.push(it.label)
      if (m === '') outside.push(it.label)
    }
    return { A: A.sort(), B: B.sort(), outside }
  }, [items])

  const sub = isSubset(groups.A, groups.B)
  const target = groups.A.length > 0 && sub

  const onMove = useCallback(
    (id: string, pt: Pt) => {
      setItems((prev) => prev.map((it) => (it.id === id ? { ...it, x: Math.round(pt.x), y: Math.round(pt.y) } : it)))
    },
    [],
  )

  useSolveOnce(ctx, target)

  return (
    <div className="flex flex-col gap-3">
      <PlainSpeak>
        圈里的小球就是这个集合的<b>元素</b>。试着把小球拖来拖去，目标是：
        <b>让 A 圈里的东西 B 圈里全都有</b>（A 里有几个都行，但不能一个都没有）。
      </PlainSpeak>

      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_15rem]">
        <div className="rounded-xl bg-slate-50 p-2 dark:bg-slate-800/40">
          <VennDiagram
            circles={CIRCLES}
            items={items}
            onMoveItem={onMove}
            highlightItems={target ? items.filter((i) => maskOf(CIRCLES, i).includes('A')).map((i) => i.id) : []}
            dimItems={target ? items.filter((i) => !maskOf(CIRCLES, i).includes('A')).map((i) => i.id) : []}
            ariaLabel="可以自由拖动的集合画布"
            keyboardHint="触摸或鼠标直接拖；键盘：Tab 选中一个球，用方向键移动（Shift 加速）。"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Card className="p-3">
            <div className="flex flex-col gap-1.5 font-mono text-sm">
              <div className="flex justify-between gap-2">
                <span className="text-a-700 dark:text-a-300">A =</span>
                <span className="text-slate-700 dark:text-slate-200">{setToString(groups.A)}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-b-700 dark:text-b-300">B =</span>
                <span className="text-slate-700 dark:text-slate-200">{setToString(groups.B)}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-slate-500">圈外 =</span>
                <span className="text-slate-500">{setToString(groups.outside)}</span>
              </div>
            </div>
          </Card>

          <Callout tone={target ? 'ok' : 'cur'} role="status">
            {target
              ? '成功了！A 里的东西 B 里全都有 —— 这就叫「A 是 B 的子集」。'
              : groups.A.length === 0
                ? 'A 圈现在还是空的。至少放一个小球进去。'
                : '还差一点：A 里有东西不在 B 里，所以 A 目前不是 B 的子集。'}
          </Callout>
        </div>
      </div>
    </div>
  )
}

/* ============================================================== ③ 起个名 */

interface SymbolQuestion {
  id: string
  sentence: string
  answer: '∈' | '⊆'
  why: string
}

const SYMBOL_QUESTIONS: SymbolQuestion[] = [
  {
    id: 'q1',
    sentence: '数字 3 是集合 A 里的一个东西',
    answer: '∈',
    why: '单个东西和集合之间用 ∈，读作「属于」。',
  },
  {
    id: 'q2',
    sentence: 'A 里的东西 B 里全都有',
    answer: '⊆',
    why: '集合和集合之间用 ⊆，读作「包含于」或「是……的子集」。',
  },
  {
    id: 'q3',
    sentence: '{1, 2} 里的东西全都在 {1, 2, 3} 里面',
    answer: '⊆',
    why: '左右两边都是集合，所以用 ⊆。',
  },
]

function NameStage({ ctx }: { ctx: StageCtx }) {
  const [answers, setAnswers] = useState<Record<string, '∈' | '⊆'>>({})

  const allRight = SYMBOL_QUESTIONS.every((q) => answers[q.id] === q.answer)
  useSolveOnce(ctx, allRight)

  return (
    <div className="flex flex-col gap-4">
      <PlainSpeak>
        你刚才做的事情，数学上只有两个符号要记：
        <b>「单个东西 → 集合」用 ∈</b>，<b>「集合 → 集合」用 ⊆</b>。
        记住口诀：<b>看右边是谁</b> —— 右边是集合就用 ∈，右边是「一批集合」的关系就用 ⊆。
      </PlainSpeak>

      <Card>
        <SectionTitle hint="点一下选符号，选错会告诉你为什么">该用哪个符号？</SectionTitle>
        <ul className="flex flex-col gap-3">
          {SYMBOL_QUESTIONS.map((q) => {
            const picked = answers[q.id]
            const right = picked === q.answer
            return (
              <li key={q.id} className="flex flex-col gap-2">
                <p className="text-sm text-slate-700 dark:text-slate-200">{q.sentence}</p>
                <div className="flex flex-wrap items-center gap-2">
                  {(['∈', '⊆'] as const).map((sym) => {
                    const active = picked === sym
                    const good = active && right
                    const bad = active && !right
                    return (
                      <button
                        key={sym}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setAnswers((a) => ({ ...a, [q.id]: sym }))}
                        className={cx(
                          'min-h-11 min-w-14 rounded-xl border px-4 font-mono text-lg font-bold dl-transition',
                          good
                            ? 'border-ok-500 bg-ok-50 text-ok-700 dark:bg-ok-500/15 dark:text-ok-500'
                            : bad
                              ? 'border-bad-500 bg-bad-50 text-bad-700 dark:bg-bad-500/15 dark:text-bad-500'
                              : 'border-slate-300 bg-white text-slate-700 hover:border-a-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200',
                        )}
                      >
                        {sym}
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
            ['集合', '把一些东西装在一起，就是一个集合。圈本身就是一个集合。'],
            ['元素', '装在里面的一样东西。小球就是元素。'],
            ['∈ 属于', '「3 ∈ A」意思是 3 是 A 里的一个元素。'],
            ['⊆ 子集', '「A ⊆ B」意思是 A 里的每一个元素都在 B 里。'],
            ['∅ 空集', '什么都不装的集合。它也是一个集合，只是里面没东西。'],
            ['真子集 ⊂', 'A ⊆ B 而且 A ≠ B —— B 里还有 A 里没有的东西。'],
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
        三道题，随便选，选错了会告诉你为什么错 —— 没有次数限制，也没有扣分。
      </p>

      <Card>
        <Quiz
          question={
            <>
              集合 A = {'{1, 2, 3}'}，集合 B = {'{1, 2, 3, 4}'}。下面哪个说法是<b>对</b>的？
            </>
          }
          resetKey="p1"
          onSolved={() => setSolvedCount((c) => c + 1)}
          choices={[
            { id: 'a', label: 'A ⊆ B', correct: true, why: '对。A 里的 1、2、3 在 B 里全都有，所以 A 是 B 的子集。' },
            {
              id: 'b',
              label: 'B ⊆ A',
              correct: false,
              why: '不对。B 里有个 4，A 里没有 —— A 装不下 B。',
            },
            {
              id: 'c',
              label: '4 ∈ A',
              correct: false,
              why: '不对。4 在 B 里，不在 A 里。符号 ∈ 的右边必须是包含它的那个集合。',
            },
            {
              id: 'd',
              label: 'A 和 B 没有关系',
              correct: false,
              why: '不对。它们之间的关系恰恰是「A 被 B 装下了」。',
            },
          ]}
        />
      </Card>

      <Card>
        <Quiz
          question={<>空集 ∅ 和集合 B = {'{1, 2}'} 之间，哪个说法是对的？</>}
          resetKey="p2"
          onSolved={() => setSolvedCount((c) => c + 1)}
          choices={[
            {
              id: 'a',
              label: '∅ ⊆ B',
              correct: true,
              why: '对。空集里没有任何元素，所以「空集里的每个元素都在 B 里」这句话不会被任何元素违反 —— 空集是任何集合的子集。',
            },
            {
              id: 'b',
              label: '∅ ∈ B',
              correct: false,
              why: '不对。B 里装的是 1 和 2，没有装「空集」这个东西。∈ 要求右边那个集合真的含有左边。',
            },
            {
              id: 'c',
              label: '空集不是集合',
              correct: false,
              why: '不对。空集也是集合，只是里面没东西。它是一个合法的、非常重要的集合。',
            },
          ]}
        />
      </Card>

      <Card>
        <Quiz
          question={<>A = {'{1, 2}'}，B = {'{1, 2, 3}'}。A ⊂ B 这个说法……</>}
          resetKey="p3"
          onSolved={() => setSolvedCount((c) => c + 1)}
          choices={[
            {
              id: 'a',
              label: '对，而且是真子集',
              correct: true,
              why: '对。A ⊆ B 成立，同时 A ≠ B（B 多了个 3），所以 A 是 B 的真子集，记作 A ⊂ B。',
            },
            {
              id: 'b',
              label: '不对，A 只是子集不是真子集',
              correct: false,
              why: '不对。只有 A 和 B 完全一样时，才「只是子集、不是真子集」。',
            },
          ]}
        />
      </Card>
    </div>
  )
}

/* ============================================================== ⑤ 换个场景 */

function TransferStage({ ctx }: { ctx: StageCtx }) {
  /** 四个小球：1、2 一开始只在 A 里，3、5 一开始只在 B 里。A 和 B 都由**位置**决定 */
  const INITIAL: VennItem[] = [
    { id: 't1', label: '1', ...SLOTS.a[0] },
    { id: 't2', label: '2', ...SLOTS.a[1] },
    { id: 't3', label: '3', ...SLOTS.b[0] },
    { id: 't4', label: '5', ...SLOTS.b[1] },
  ]

  const [items, setItems] = useState<VennItem[]>(INITIAL)
  const [saved, setSaved] = useState<VennItem[] | null>(null)
  const [challengeDone, setChallengeDone] = useState(false)

  const groups = useMemo(() => {
    const A: string[] = []
    const B: string[] = []
    for (const it of items) {
      const m = maskOf(CIRCLES, { x: it.x, y: it.y })
      if (m.includes('A')) A.push(it.label)
      if (m.includes('B')) B.push(it.label)
    }
    return { A: A.sort(), B: B.sort() }
  }, [items])

  // 任务一：A 是 B 的真子集（A 非空、被 B 装下、且 B 比 A 多东西）
  const taskOne = isProperSubset(groups.A, groups.B)
  useSolveOnce(ctx, taskOne && challengeDone)

  const onMove = useCallback((id: string, pt: Pt) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, x: Math.round(pt.x), y: Math.round(pt.y) } : it)))
  }, [])

  const emptied = groups.A.length === 0
  const toggleEmpty = (): void => {
    if (saved) {
      setItems(saved)
      setSaved(null)
      return
    }
    setSaved(items)
    // 把当前落在 A 圈里的球全部挪到圈外，让 A 变成空集
    setItems((prev) =>
      prev.map((it) => {
        const m = maskOf(CIRCLES, { x: it.x, y: it.y })
        return m.includes('A') ? { ...it, x: it.x < 170 ? 44 : 296, y: 236 } : it
      }),
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <PlainSpeak>
        换个场景：四个小球，A 圈里现在是 1 和 2，B 圈里是 3 和 5。
        <b>把 A 调成 B 的真子集</b> —— A 里的东西 B 里全都有，而且 B 还要比 A 多。
      </PlainSpeak>

      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_17rem]">
        <div className="rounded-xl bg-slate-50 p-2 dark:bg-slate-800/40">
          <VennDiagram
            circles={CIRCLES}
            items={items}
            onMoveItem={onMove}
            highlightItems={taskOne ? items.filter((i) => maskOf(CIRCLES, i).includes('A')).map((i) => i.id) : []}
            ariaLabel="把 A 调成 B 的真子集"
            keyboardHint="把「1」和「2」拖进 B 圈的范围（拖到两圈重叠处最省事）。"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Card className="p-3">
            <div className="flex flex-col gap-1.5 font-mono text-sm">
              <div className="flex justify-between gap-2">
                <span className="text-a-700 dark:text-a-300">A =</span>
                <span className="text-slate-700 dark:text-slate-200">{setToString(groups.A)}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-b-700 dark:text-b-300">B =</span>
                <span className="text-slate-700 dark:text-slate-200">{setToString(groups.B)}</span>
              </div>
            </div>
          </Card>

          <Callout tone={taskOne ? 'ok' : 'cur'} role="status">
            {taskOne
              ? '成功：A ⊂ B。A 里的东西 B 全有，而且 B 还多了别的 —— 这就是真子集。'
              : emptied
                ? 'A 现在是空集。∅ 也是 B 的子集（而且 B 非空时还是真子集）—— 但先试着让 A 真的有东西。'
                : groups.A.length === 0
                  ? 'A 现在空了。先放点东西进去。'
                  : '还不是：A 里有 B 装不下的数字（比如 2 不在 B 里）。'}
          </Callout>

          <Btn variant="outline" size="sm" onClick={toggleEmpty}>
            {saved ? '把 A 的东西放回来' : '把 A 清空，看看会怎样'}
          </Btn>

          {emptied && saved ? (
            <Callout tone="info" title="这里有个反直觉的结论">
              即使 A 里什么都没有，<b>∅ 依然 ⊆ B</b>。为什么？做一下下面的题。
            </Callout>
          ) : null}
        </div>
      </div>

      <Card>
        <Quiz
          question={<>为什么「空集是任何集合的子集」？</>}
          resetKey="t1"
          onSolved={() => setChallengeDone(true)}
          choices={[
            {
              id: 'a',
              label: '因为「空集里的每个元素都在 B 里」这句话没法被违反',
              correct: true,
              why: '对。子集的定义是「A 里的每一个元素都在 B 里」。空集里一个元素都没有，也就找不到反例 —— 找不到反例，命题就成立。',
            },
            {
              id: 'b',
              label: '因为空集里面装着 B',
              correct: false,
              why: '不对。空集里面什么都没有。「装着」是 ∈ 的说法，不是 ⊆ 的说法。',
            },
            {
              id: 'c',
              label: '这是人为规定的，没有道理',
              correct: false,
              why: '不对。它是从子集定义直接推出来的，不是额外规定的。如果把空集排除在外，很多定理都要多写一堆「当 A 非空时」的例外。',
            },
          ]}
        />
      </Card>
    </div>
  )
}

/* ============================================================== 导出 */

const topic: Topic = {
  id: 'S1',
  title: '集合与子集',
  moduleId: 'sets',
  oneLiner: '把东西装进圈里，并判断谁装得下谁',
  outcome: '你能看着一张韦恩图说出「谁是谁的子集」，并且分清「属于 ∈」和「包含于 ⊆」。',
  prerequisites: [],
  bigIdea: '集合就是「一个圈里装了哪些东西」；子集就是「一个圈被另一个圈整个装下」。整章集合论，都是这两个画面的组合。',
  misconceptions: [
    { wrong: '空集不算集合', right: '空集也是集合，只是里面没东西。它是任何集合的子集。' },
    { wrong: '∅ ∈ B 和 ∅ ⊆ B 是一回事', right: '完全是两回事：∈ 看的是 B 里有没有「空集」这个东西，⊆ 看的是空集的元素是否都在 B 里。后者永远成立。' },
    { wrong: 'A ⊆ B 说明 A 比 B 小', right: '不一定小，也可能相等。要求「真的小」必须用真子集 ⊂。' },
  ],
  formalDefinition: (
    <>
      <p>
        <b>子集：</b>
        <span className="font-mono">A ⊆ B ⟺ ∀x (x ∈ A → x ∈ B)</span>
      </p>
      <p>
        <b>真子集：</b>
        <span className="font-mono">A ⊂ B ⟺ A ⊆ B 且 A ≠ B</span>
      </p>
      <p>
        <b>集合相等：</b>
        <span className="font-mono">A = B ⟺ A ⊆ B 且 B ⊆ A</span>
      </p>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        最后这条叫「外延公理」，它是证明两个集合相等的标准套路：互相包含，就相等。
      </p>
    </>
  ),
  glossary: [
    { term: '集合', plain: '把一些东西装在一起，就是一个集合。圈本身就是集合。', formal: '元素的总体' },
    { term: '元素', plain: '装进集合里的一样东西。' },
    { term: '属于 ∈', plain: '单个东西在不在某个集合里。左边是东西，右边是集合。', formal: 'x ∈ A' },
    { term: '子集 ⊆', plain: '一个集合里的东西，另一个集合里全都有。', formal: 'A ⊆ B ⟺ ∀x(x ∈ A → x ∈ B)' },
    { term: '真子集 ⊂', plain: '是子集，而且两个集合还不一样（另一个有多余的东西）。', formal: 'A ⊂ B ⟺ A ⊆ B 且 A ≠ B' },
    { term: '空集 ∅', plain: '什么都不装的集合。', formal: '∅ = { }，且 ∅ ⊆ A 对任意 A 成立' },
    { term: '韦恩图', plain: '用圈来表示集合的图。重叠的地方就是两个集合共有的东西。' },
  ],
  stages: [
    {
      label: '① 看一看',
      short: '看',
      narration: '先不看符号。这里有两个圈，左边是篮球队，右边是乐队 —— 点一点同学，看看谁站在哪。',
      requireSolve: true,
      hints: [
        '挨个点一下每个同学，注意观察他落在哪个圈里。',
        '有一个同学同时落在两个圈重叠的那一块，把他找出来。',
        '红 站在两个圈重叠的地方 —— 这就是「既在篮球队、又在乐队」。',
      ],
      render: (ctx) => <HookStage ctx={ctx} />,
    },
    {
      label: '② 玩一玩',
      short: '玩',
      narration: '现在换成数字。拖动小球，目标是让 A 圈里的东西 B 圈里全都有。',
      requireSolve: true,
      hints: [
        '把只落在 A 圈里、却不在 B 圈里的小球，拖到两个圈重叠的区域去。',
        '看着右边「A = …」和「B = …」两行：当 A 里的每个数字在 B 里都能找到时，就成功了。',
        '把 1 号球拖到两个圈重叠的地方。这样 A = {1}，而 B 也包含 1，A 就成了 B 的子集。',
      ],
      render: (ctx) => <ExploreStage ctx={ctx} />,
    },
    {
      label: '③ 起个名',
      short: '名',
      narration: '你刚做的事，数学上只需要两个符号。先试试该用哪一个。',
      requireSolve: true,
      hints: [
        '关键看左边是「一个东西」还是「一个集合」。',
        '单个数和集合之间用 ∈；集合和集合之间用 ⊆。',
        '三句话的答案依次是：∈、⊆、⊆。',
      ],
      render: (ctx) => <NameStage ctx={ctx} />,
    },
    {
      label: '④ 练一练',
      short: '练',
      narration: '三道小题。选错了没有惩罚，会直接告诉你错在哪，可以马上再来。',
      requireSolve: true,
      hints: [
        '先在心里把两个集合的元素都列出来，再逐个检查。',
        '判断 A ⊆ B，就是检查「A 里的每一个元素，B 里是不是都有」。',
        '三道题的正确选项分别是：A ⊆ B；∅ ⊆ B；对，而且是真子集。',
      ],
      render: (ctx) => <PracticeStage ctx={ctx} />,
    },
    {
      label: '⑤ 换个场景',
      short: '变',
      narration: '最后一关：让 A 成为 B 的真子集，然后回答一个很多人都想错的问题。',
      requireSolve: true,
      hints: [
        '真子集要求两件事：A 被 B 装下，并且 B 里还有 A 没有的东西。',
        'A 圈里现在是 1 和 2；B 圈里是 3 和 5。要让 A 被 B 装下，就得让 A 里的数字也落进 B 圈。',
        '把标着「1」和「2」的两个球都拖进 B 圈的范围（拖到两圈重叠处最省事）。此时 A = {1,2}，B = {1,2,3,5}，A ⊂ B 成立。做完再答最后一题。',
      ],
      render: (ctx) => <TransferStage ctx={ctx} />,
    },
  ],
}

export default topic
