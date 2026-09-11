import { useEffect, useMemo, useState } from 'react'

import {
  AND,
  IFF,
  IMP,
  NOT,
  OR,
  VAR,
  equivalent,
  exprToString,
  isContradiction,
  isSatisfiable,
  isTautology,
  truthTable,
  type Env,
  type Expr,
} from '@/kernels/logic'
import { TruthTableView } from '@/primitives'
import { Btn, Callout, Card, Chip, Math, PlainSpeak, SectionTitle, Segmented, cx } from '@/ui'
import { Quiz } from '@/ui/Quiz'
import { useSolveOnce, useTriedSet } from '../hooks'
import type { StageCtx, Topic } from '../types'

/* --------------------------------------------------------------- 小工具 */

/** 把一行赋值写成「000 / 101」这样的组合键，方便和用户的猜测对上号 */
const keyOf = (a: Env, vars: string[]): string => vars.map((v) => (a[v] ? '1' : '0')).join('')

/** 一行赋值翻译成人话 */
const describe = (a: Env): string =>
  Object.keys(a)
    .map((k) => `${k} 取${a[k] ? '真' : '假'}`)
    .join('、')

type FormKind = 'tautology' | 'contradiction' | 'contingent'

const KIND_LABEL: Record<FormKind, string> = {
  tautology: '永远为真（重言式）',
  contradiction: '永远为假（矛盾式）',
  contingent: '有时真、有时假',
}

function kindOf(e: Expr): FormKind {
  if (isTautology(e)) return 'tautology'
  if (isContradiction(e)) return 'contradiction'
  return 'contingent'
}

/* ============================================================== ① 看一看 */

const DOOR_RULE = AND(VAR('P'), VAR('Q'))
const DOOR_ROWS = truthTable(DOOR_RULE).rows
const DOOR_VARS = ['P', 'Q']

interface Scene {
  key: string
  expected: boolean
  story: string
  why: string
}

const SCENES: Scene[] = [
  {
    key: '11',
    expected: true,
    story: '有人走过来，门也没有锁',
    why: '两个条件都满足 —— 「并且」成立，门开。',
  },
  {
    key: '10',
    expected: false,
    story: '有人走过来，可是门锁着',
    why: '「门没有锁」这一条不成立。而且要求两条都成立，缺一条就不行，所以门不开。',
  },
  {
    key: '01',
    expected: false,
    story: '没有人靠近，门也没有锁',
    why: '「有人靠近」这一条不成立，所以门不开。注意：门没锁也没用。',
  },
  {
    key: '00',
    expected: false,
    story: '没有人靠近，门还锁着',
    why: '两条都不成立，门当然不开。',
  },
]

function HookStage({ ctx }: { ctx: StageCtx }) {
  /** 用户对每个情境的猜测：true = 猜「门会开」 */
  const [guesses, setGuesses] = useState<Record<string, boolean>>({})

  const right = (s: Scene): boolean => guesses[s.key] === s.expected
  const rightCount = SCENES.filter(right).length
  const allRight = rightCount === SCENES.length

  useSolveOnce(ctx, allRight)

  const guess = (s: Scene, g: boolean): void => {
    setGuesses((prev) => ({ ...prev, [s.key]: g }))
    ctx.say(
      g === s.expected
        ? `猜对了：${s.why}`
        : `再想想：这里有两个条件，只满足一个是不够的。正确答案是「${s.expected ? '门开' : '门不开'}」。`,
      g === s.expected ? 'accept' : 'reject',
    )
  }

  // 猜对的那几行会一行行长进真值表里
  const revealed = useMemo(
    () =>
      DOOR_ROWS.filter((r) => {
        const k = keyOf(r.assignment, DOOR_VARS)
        const g = guesses[k]
        return g !== undefined && g === r.value
      }),
    [guesses],
  )

  return (
    <div className="flex flex-col gap-3">
      <PlainSpeak>
        先猜，再看表。自动门的规矩是：<b>有人靠近</b>，<b>而且</b>，<b>门没有锁</b> —— 两条同时满足门才开。
        下面四种情况，先猜猜门开不开，猜完真值表就长出来了。
      </PlainSpeak>

      <Card>
        <SectionTitle hint={`猜对 ${rightCount} / ${SCENES.length}`}>四种情况，门开吗？</SectionTitle>
        <ul className="flex flex-col gap-2">
          {SCENES.map((s) => {
            const picked = guesses[s.key]
            const ok = right(s)
            return (
              <li key={s.key} className="flex flex-col gap-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="min-w-0 flex-1 text-sm text-slate-700 dark:text-slate-200">{s.story}</span>
                  {[true, false].map((g) => {
                    const active = picked === g
                    const good = active && ok
                    const bad = active && !ok
                    return (
                      <button
                        key={String(g)}
                        type="button"
                        aria-label={`${s.story}：猜${g ? '门会开' : '门不开'}`}
                        aria-pressed={active}
                        onClick={() => guess(s, g)}
                        className={cx(
                          'min-h-11 rounded-xl border px-3 text-sm font-medium dl-transition',
                          good
                            ? 'border-ok-500 bg-ok-50 text-ok-700 dark:bg-ok-500/15 dark:text-ok-500'
                            : bad
                              ? 'border-bad-500 bg-bad-50 text-bad-700 dark:bg-bad-500/15 dark:text-bad-500'
                              : 'border-slate-300 bg-white text-slate-700 hover:border-a-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200',
                        )}
                      >
                        {g ? '门会开' : '门不开'}
                      </button>
                    )
                  })}
                </div>
                {picked !== undefined ? (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {ok ? '✓ ' : '✗ '}
                    {s.why}
                  </p>
                ) : null}
              </li>
            )
          })}
        </ul>
      </Card>

      <Card>
        <SectionTitle hint="猜对一行，长一行">你刚猜出来的真值表</SectionTitle>
        {revealed.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">还空着 —— 先在上面猜对一行试试。</p>
        ) : (
          <TruthTableView
            vars={DOOR_VARS}
            rows={revealed}
            columns={[{ label: '门开', values: revealed.map((r) => r.value), accent: true }]}
            caption="P = 有人靠近，Q = 门没有锁。真 = 成立 / 门开，假 = 不成立 / 门不开。"
          />
        )}
      </Card>

      {allRight ? (
        <Callout tone="ok">
          四行凑齐了 —— 这就是「把所有可能情况排成一张表」。这种表有个正式名字：<b>真值表</b>。
        </Callout>
      ) : null}
    </div>
  )
}

/* ============================================================== ② 玩一玩 */

interface Candidate {
  id: string
  expr: Expr
}

/** 候选式子一律用 AST 构造函数拼出来 —— 不手写字符串，就不会写出有歧义的括号 */
const CANDIDATES: Candidate[] = [
  { id: 'and', expr: AND(VAR('P'), VAR('Q')) },
  { id: 'or', expr: OR(VAR('P'), VAR('Q')) },
  { id: 'imp', expr: IMP(VAR('P'), VAR('Q')) },
  { id: 'notor', expr: OR(NOT(VAR('P')), VAR('Q')) },
  { id: 'iff', expr: IFF(VAR('P'), VAR('Q')) },
  { id: 'excluded', expr: OR(VAR('P'), NOT(VAR('P'))) },
]

function ExploreStage({ ctx }: { ctx: StageCtx }) {
  const [sel, setSel] = useState<string>(CANDIDATES[0].id)
  const { tried, markTried } = useTriedSet()

  useEffect(() => {
    markTried(sel)
  }, [sel, markTried])

  const current = CANDIDATES.find((c) => c.id === sel)!
  const table = useMemo(() => truthTable(current.expr), [current])

  const trueCount = table.rows.filter((r) => r.value).length
  const allSeen = tried.size >= CANDIDATES.length
  useSolveOnce(ctx, allSeen)

  return (
    <div className="flex flex-col gap-3">
      <PlainSpeak>
        下面六个式子都由 <b>P、Q</b> 两个开关拼出来。挨个点一遍，右边的真值表会<b>当场重算</b>。
        重点看最后一列：哪些式子几乎总是真？哪些几乎总是假？
      </PlainSpeak>

      <Segmented
        label="选一个式子"
        value={sel}
        onChange={(v) => setSel(v)}
        options={CANDIDATES.map((c) => ({ value: c.id, label: <Math>{exprToString(c.expr)}</Math> }))}
      />

      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_14rem]">
        <Card className="p-3">
          <SectionTitle hint={`已看过 ${tried.size} / ${CANDIDATES.length} 个式子`}>真值表</SectionTitle>
          <TruthTableView
            vars={table.vars}
            rows={table.rows}
            columns={[
              {
                label: exprToString(current.expr),
                values: table.rows.map((r) => r.value),
                accent: true,
              },
            ]}
            caption="亮色那一列就是这个式子在这一行的取值。"
          />
        </Card>

        <div className="flex flex-col gap-2">
          <Card className="p-3">
            <div className="flex flex-col gap-1.5 text-sm">
              <div className="flex justify-between gap-2">
                <span className="text-slate-500 dark:text-slate-400">变量个数</span>
                <span className="font-mono text-slate-700 dark:text-slate-200">{table.vars.length}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-slate-500 dark:text-slate-400">一共几行</span>
                <span className="font-mono text-slate-700 dark:text-slate-200">{table.rows.length}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-slate-500 dark:text-slate-400">为真的行数</span>
                <span className="font-mono text-slate-700 dark:text-slate-200">{trueCount}</span>
              </div>
            </div>
          </Card>

          <div className="flex flex-wrap gap-2">
            <Chip tone={trueCount === table.rows.length ? 'ok' : 'dim'}>真 {trueCount} 行</Chip>
            <Chip tone={trueCount === 0 ? 'bad' : 'dim'}>假 {table.rows.length - trueCount} 行</Chip>
          </div>

          <Callout tone={allSeen ? 'ok' : 'cur'} role="status">
            {allSeen
              ? '六个都看过了。你有没有发现：有一个式子的最后一列全是「真」，还有一个全是「假」。'
              : `还有 ${CANDIDATES.length - tried.size} 个式子没看过。每换一个，表的行数也可能变。`}
          </Callout>

          <p className="text-xs text-slate-500 dark:text-slate-400">
            变量每多一个，行数就翻一倍：2 个变量 4 行，3 个变量 8 行。
          </p>
        </div>
      </div>
    </div>
  )
}

/* ============================================================== ③ 起个名 */

const FORMS: Candidate[] = [
  { id: 'f-excluded', expr: OR(VAR('P'), NOT(VAR('P'))) },
  { id: 'f-self', expr: IMP(VAR('P'), VAR('P')) },
  { id: 'f-contra', expr: AND(VAR('P'), NOT(VAR('P'))) },
  { id: 'f-notself', expr: NOT(IMP(VAR('P'), VAR('P'))) },
  { id: 'f-and', expr: AND(VAR('P'), VAR('Q')) },
  { id: 'f-imp', expr: IMP(VAR('P'), VAR('Q')) },
]

const KINDS: FormKind[] = ['tautology', 'contradiction', 'contingent']

function NameStage({ ctx }: { ctx: StageCtx }) {
  const [answers, setAnswers] = useState<Record<string, FormKind>>({})
  const [focus, setFocus] = useState<string>(FORMS[0].id)

  const allRight = FORMS.every((f) => answers[f.id] === kindOf(f.expr))
  useSolveOnce(ctx, allRight)

  const focusExpr = FORMS.find((f) => f.id === focus)!
  const focusTable = useMemo(() => truthTable(focusExpr.expr), [focusExpr])

  const classify = (f: Candidate, k: FormKind): void => {
    setAnswers((prev) => ({ ...prev, [f.id]: k }))
    setFocus(f.id)
    const real = kindOf(f.expr)
    ctx.say(
      k === real
        ? `对。${exprToString(f.expr)} 的真值表里，${KIND_LABEL[real]}。`
        : `再看看 ${exprToString(f.expr)} 的真值表：它其实是「${KIND_LABEL[real]}」。`,
      k === real ? 'accept' : 'reject',
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <PlainSpeak>
        真值表把所有情况摊开之后，式子就分成三种脾气：
        <b>永远真</b>、<b>永远假</b>、<b>有时真有时假</b>。认准这三个名字，后面整个逻辑都用得上。
      </PlainSpeak>

      <div className="grid gap-2 sm:grid-cols-3">
        {[
          ['重言式（永真式）', '不管变量怎么取值，它永远为真 —— 真值表那一列全是「真」。'],
          ['矛盾式（永假式）', '永远为假 —— 那一列全是「假」，任何情况都救不回来。'],
          ['可满足式', '至少有一种取值能让它为真。只要不是矛盾式，就都是可满足式。'],
        ].map(([t, d]) => (
          <div key={t} className="rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-800/50">
            <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">{t}</div>
            <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">{d}</p>
          </div>
        ))}
      </div>

      <Card>
        <SectionTitle hint="每个式子选一个身份，选完自动帮你看表">它们各是哪一种？</SectionTitle>
        <ul className="flex flex-col gap-3">
          {FORMS.map((f) => {
            const pick = answers[f.id]
            const real = kindOf(f.expr)
            const ok = pick === real
            return (
              <li key={f.id} className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    aria-label={`查看 ${exprToString(f.expr)} 的真值表`}
                    onClick={() => setFocus(f.id)}
                    className="min-h-11 rounded-xl border border-slate-300 bg-white px-3 font-mono text-sm text-slate-800 dl-transition hover:border-a-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                  >
                    {exprToString(f.expr)}
                  </button>
                  {KINDS.map((k) => {
                    const active = pick === k
                    const good = active && ok
                    const bad = active && !ok
                    return (
                      <button
                        key={k}
                        type="button"
                        aria-label={`认为 ${exprToString(f.expr)} 是${KIND_LABEL[k]}`}
                        aria-pressed={active}
                        onClick={() => classify(f, k)}
                        className={cx(
                          'min-h-11 rounded-xl border px-3 text-sm font-medium dl-transition',
                          good
                            ? 'border-ok-500 bg-ok-50 text-ok-700 dark:bg-ok-500/15 dark:text-ok-500'
                            : bad
                              ? 'border-bad-500 bg-bad-50 text-bad-700 dark:bg-bad-500/15 dark:text-bad-500'
                              : 'border-slate-300 bg-white text-slate-700 hover:border-a-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200',
                        )}
                      >
                        {KIND_LABEL[k]}
                      </button>
                    )
                  })}
                </div>
                {pick ? (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {ok ? '✓ 对。' : `✗ 不对，它其实是「${KIND_LABEL[real]}」。`}
                    系统当场算了三种判定：重言式 {isTautology(f.expr) ? '是' : '不是'} · 矛盾式{' '}
                    {isContradiction(f.expr) ? '是' : '不是'} · 可满足式 {isSatisfiable(f.expr) ? '是' : '不是'}。
                  </p>
                ) : null}
              </li>
            )
          })}
        </ul>
      </Card>

      <Card>
        <SectionTitle hint="点上面的式子就能换">正在看的表</SectionTitle>
        <p className="mb-2 text-sm text-slate-600 dark:text-slate-300">
          <Math>{exprToString(focusExpr.expr)}</Math>
        </p>
        <TruthTableView
          vars={focusTable.vars}
          rows={focusTable.rows}
          columns={[
            {
              label: exprToString(focusExpr.expr),
              values: focusTable.rows.map((r) => r.value),
              accent: true,
            },
          ]}
          caption="盯住这一列：全是真 → 重言式；全是假 → 矛盾式；真假都有 → 可满足但不是重言式。"
        />
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
        三道题，围着刚才那三个名字打转。选错会告诉你为什么错，可以无限重试。
      </p>

      <Card>
        <Quiz
          question={
            <>
              <Math>P ∨ ¬P</Math> 是重言式吗？
            </>
          }
          resetKey="l2p1"
          onSolved={() => setSolvedCount((c) => c + 1)}
          choices={[
            {
              id: 'a',
              label: '是。不管 P 取真还是取假，它都为真。',
              correct: true,
              why: '对。P 真时右半部分 ¬P 假，但左边为真；P 假时左边假，但 ¬P 为真。两个分支总有一个是真的，所以两行都是真 —— 这是重言式（它有名字，叫排中律）。',
            },
            {
              id: 'b',
              label: '不是。它得看 P 到底取什么值。',
              correct: false,
              why: '不对。要判断一个式子是不是重言式，恰恰是「把所有取值都试一遍」。试完了：P 真为真，P 假也为真 —— 它不依赖 P 的取值。',
            },
            {
              id: 'c',
              label: '只有 P 为真的时候它才为真。',
              correct: false,
              why: '不对。P 为假时 ¬P 为真，「或者」只要有一边真就成立，所以这时候它照样为真。',
            },
          ]}
        />
      </Card>

      <Card>
        <Quiz
          question={
            <>
              <Math>P ∧ ¬P</Math> 是什么？
            </>
          }
          resetKey="l2p2"
          onSolved={() => setSolvedCount((c) => c + 1)}
          choices={[
            {
              id: 'a',
              label: '矛盾式 —— 永远为假',
              correct: true,
              why: '对。同一时刻 P 不可能既真又假，所以「两个都成立」永远做不到，整列都是假。矛盾式就是「自己和自己打架」的式子。',
            },
            {
              id: 'b',
              label: '重言式 —— 永远为真',
              correct: false,
              why: '不对。∧ 要求两边同时成立，而 P 和 ¬P 永远一个真一个假，凑不齐，所以它永远为假。',
            },
            {
              id: 'c',
              label: '可满足式 —— 有时真有时假',
              correct: false,
              why: '不对。「有时真」意味着存在某种取值让它为真。这里两种取值算下来都是假，没有任何一行是真。',
            },
          ]}
        />
      </Card>

      <Card>
        <Quiz
          question={<>把一个重言式整个否定掉（前面加个 ¬），得到的是什么？</>}
          resetKey="l2p3"
          onSolved={() => setSolvedCount((c) => c + 1)}
          choices={[
            {
              id: 'a',
              label: '矛盾式',
              correct: true,
              why: '对。重言式每一行都是真，逐行翻面之后每一行都是假 —— 正好是矛盾式的样子。反过来，否定一个矛盾式也一定得到重言式。',
            },
            {
              id: 'b',
              label: '可满足式',
              correct: false,
              why: '不对。可满足式只要求「至少有一行为真」。否定重言式之后一行真都没有，它比可满足式更极端。',
            },
            {
              id: 'c',
              label: '还是重言式',
              correct: false,
              why: '不对。如果否定之后还是重言式，那它就要永远为真；可它原来永远为真，翻面之后只能永远为假。',
            },
          ]}
        />
      </Card>
    </div>
  )
}

/* ============================================================== ⑤ 换个场景 */

const IMP_FORM = IMP(VAR('P'), VAR('Q'))
const NOTP_OR_Q = OR(NOT(VAR('P')), VAR('Q'))
const IMP_IFF = IFF(IMP_FORM, NOTP_OR_Q)

const FORM_TABLE = truthTable(NOTP_OR_Q)

const FALSIFY = IMP(AND(VAR('P'), VAR('Q')), VAR('R'))
const FALSIFY_TABLE = truthTable(FALSIFY)
/** 给初学者看的写法：把隐含的括号补出来（∧ 比 → 结合得紧） */
const FALSIFY_TEXT = '(P ∧ Q) → R'

function TransferStage({ ctx }: { ctx: StageCtx }) {
  const [verified, setVerified] = useState(false)
  const [picked, setPicked] = useState<number | null>(null)

  const foundFalsifier = picked !== null && !FALSIFY_TABLE.rows[picked].value
  useSolveOnce(ctx, verified && foundFalsifier)

  const runVerify = (): void => {
    const same = equivalent(IMP_FORM, NOTP_OR_Q)
    const always = isTautology(IMP_IFF)
    setVerified(true)
    ctx.say(
      same
        ? `equivalent 算下来两边 4 行取值完全一致；把等价式用 ↔ 连起来，isTautology 说它 ${always ? '是' : '不是'}重言式。`
        : '两边的取值并不一致。',
      same ? 'accept' : 'reject',
    )
  }

  const onRow = (i: number): void => {
    setPicked(i)
    const row = FALSIFY_TABLE.rows[i]
    ctx.say(
      row.value
        ? `这一行式子是「真」：${describe(row.assignment)}。再找找别的行。`
        : `找到了：${describe(row.assignment)}，这时候 P ∧ Q 成立、R 不成立，整句就是假。`,
      row.value ? 'normal' : 'accept',
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <PlainSpeak>
        两件收尾的事。第一件：验证「如果 P 那么 Q」和「不是 P，或者 Q」是不是同一句话。
        第二件：给三个变量赋值，亲手找出一个复杂式子唯一为假的那一行。
      </PlainSpeak>

      <Card>
        <SectionTitle hint="点按钮，等价判定当场算给你看">第一件：这两句是不是一回事？</SectionTitle>
        <p className="mb-2 text-sm text-slate-700 dark:text-slate-200">
          <Math>{exprToString(IMP_FORM)}</Math> &nbsp;对比&nbsp; <Math>{exprToString(NOTP_OR_Q)}</Math>
        </p>
        <Btn variant="primary" onClick={runVerify} aria-label="用 equivalent 验证两个式子是否等价">
          用 equivalent 验证
        </Btn>

        {verified ? (
          <div className="mt-3 flex flex-col gap-3">
            <Callout tone={equivalent(IMP_FORM, NOTP_OR_Q) ? 'ok' : 'bad'}>
              {equivalent(IMP_FORM, NOTP_OR_Q)
                ? '4 行取值完全一样 —— 这两个式子在逻辑上是同一个东西。'
                : '取值出现了不一致 —— 它们不等价。'}
            </Callout>
            <TruthTableView
              vars={FORM_TABLE.vars}
              rows={FORM_TABLE.rows}
              columns={[
                { label: exprToString(IMP_FORM), values: FORM_TABLE.rows.map((r) => r.value), accent: false },
                { label: exprToString(NOTP_OR_Q), values: FORM_TABLE.rows.map((r) => r.value), accent: true },
              ]}
              caption="两列逐行对齐，一行不差。"
            />
            <Callout tone="info" title="把等价式再包一层">
              既然两边一样，<Math>{`(${exprToString(IMP_FORM)}) ↔ (${exprToString(NOTP_OR_Q)})`}</Math> 就是一个
              <b>重言式</b>：
              <code className="ml-1 font-mono text-xs">
                isTautology = {String(isTautology(IMP_IFF))}
              </code>
              。
            </Callout>
          </div>
        ) : (
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            没验证之前先自己猜：哪一行会让这两个式子看起来不一样？（提示：它们不会不一样。）
          </p>
        )}
      </Card>

      <Card>
        <SectionTitle hint="点一行把它选中">第二件：找出这个式子唯一为假的那一行</SectionTitle>
        <p className="mb-2 text-sm text-slate-700 dark:text-slate-200">
          <Math>{FALSIFY_TEXT}</Math> —— 意思是「P 和 Q 都成立的话，R 就成立」。
        </p>
        <TruthTableView
          vars={FALSIFY_TABLE.vars}
          rows={FALSIFY_TABLE.rows}
          highlightRows={picked === null ? [] : [picked]}
          onRowClick={onRow}
          columns={[{ label: FALSIFY_TEXT, values: FALSIFY_TABLE.rows.map((r) => r.value), accent: true }]}
          caption="点左边任意一行，就等于给 P、Q、R 都赋了值。"
        />

        <div className="mt-3">
          <Callout tone={foundFalsifier ? 'ok' : picked === null ? 'info' : 'cur'} role="status">
            {picked === null
              ? '还没选。想一想：什么时候「前面成立、后面却不成立」？'
              : foundFalsifier
                ? `就是这个：${describe(FALSIFY_TABLE.rows[picked].assignment)}。这是整张 8 行表里唯一为假的地方。`
                : `你选的是 ${describe(FALSIFY_TABLE.rows[picked].assignment)}，这一行式子取值为真。注意 ∧ 和 → 的优先级：式子读作 (P ∧ Q) → R。`}
          </Callout>
        </div>
      </Card>
    </div>
  )
}

/* ============================================================== 导出 */

const topic: Topic = {
  id: 'L2',
  title: '真值表与永真式',
  moduleId: 'logic',
  oneLiner: '把所有可能情况排成一张表，一眼看出真假',
  outcome: '你能给任意一个式子列出真值表，并一眼判断它是重言式、矛盾式还是可满足式。',
  prerequisites: ['L1'],
  bigIdea: '一个式子长什么样不重要，重要的是它在每一种取值下的表现；把所有取值一次性列出来，式子的脾气就全暴露了。',
  misconceptions: [
    {
      wrong: '重言式和可满足式是一回事',
      right: '重言式是「每一行都真」，可满足式只要「有一行为真」。所以重言式一定可满足，可满足式却未必是重言式（比如 P ∧ Q）。',
    },
    {
      wrong: '判断重言式要看变量取什么值',
      right: '重言式的意思正是「不管变量取什么值都成立」。所以判断方法是穷举所有取值，而不是挑一个值去试。',
    },
    {
      wrong: 'P ∧ ¬P 在某些情况下可以为真',
      right: '同一时刻 P 只能有一个取值，不可能既真又假，所以它永远为假 —— 这是矛盾式。',
    },
  ],
  formalDefinition: (
    <>
      <p>
        <b>真值表：</b>对式子里每个命题变元列出真、假的所有组合，并算出式子在该组合下的取值。含 n 个变元的式子共有 2<sup>n</sup> 行。
      </p>
      <p>
        <b>重言式（永真式）：</b>
        <span className="font-mono">对每一组赋值，取值都为真</span>
      </p>
      <p>
        <b>矛盾式（永假式）：</b>
        <span className="font-mono">对每一组赋值，取值都为假</span>
      </p>
      <p>
        <b>可满足式：</b>
        <span className="font-mono">存在至少一组赋值使取值为真</span>
      </p>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        三者的关系：重言式 ⊆ 可满足式；¬（重言式）= 矛盾式。不是矛盾式 ⟺ 是可满足式。
      </p>
    </>
  ),
  glossary: [
    { term: '真值表', plain: '把每个变量的所有取值组合列出来，再算出式子对应的结果，排成一张表。' },
    { term: '赋值', plain: '给每个变量指定一个真假值，也就是表里的一行。', formal: '从变元集到 {真, 假} 的一个映射' },
    { term: '重言式（永真式）', plain: '不管变量怎么取，它永远为真。真值表那一列全是真。', formal: '∀ 赋值，式子的取值都为真' },
    { term: '矛盾式（永假式）', plain: '永远为假，一行真的都没有。比如 P ∧ ¬P。', formal: '∀ 赋值，式子的取值都为假' },
    { term: '可满足式', plain: '至少有一种取值能让它为真。不是矛盾式就是可满足式。', formal: '∃ 赋值使式子为真' },
    { term: '排中律', plain: '「P 或者非 P」永远成立 —— 一件事要么发生，要么没发生，没有第三种。', formal: 'P ∨ ¬P 是重言式' },
    { term: '逻辑等价', plain: '两个式子在每一行取值都一样，像是同一个人换了两件衣服。', formal: 'A ≡ B ⟺ A ↔ B 是重言式' },
  ],
  stages: [
    {
      label: '① 看一看',
      short: '看',
      narration: '先猜后看：四种情况，门开不开？',
      requireSolve: true,
      hints: [
        '四个情境里，只有一个是「两条都满足」的。',
        '先看「有人靠近」这条成不成立，再看「门没锁」成不成立 —— 两个都成立门才开。',
        '四种情况依次是：门开、门不开、门不开、门不开。四行凑齐就是一张真值表。',
      ],
      render: (ctx) => <HookStage ctx={ctx} />,
    },
    {
      label: '② 玩一玩',
      short: '玩',
      narration: '六个式子挨个点一遍，看真值表当场重算。',
      requireSolve: true,
      hints: [
        '每个式子都要点一次 —— 六个都看过才算探索完。',
        '留意最后一列：有的几乎全是「真」，有的几乎全是「假」。',
        '六个都点完之后，把每个式子的「为真的行数」记下来：P ∨ ¬P 是 2 行全真，P ∧ ¬P 是 0 行为真。',
      ],
      render: (ctx) => <ExploreStage ctx={ctx} />,
    },
    {
      label: '③ 起个名',
      short: '名',
      narration: '永远真、永远假、有时真有时假：给它们起个名。',
      requireSolve: true,
      hints: [
        '点式子左边那个按钮，可以直接看它的真值表。',
        '看那一列：全是真就是重言式，全是假就是矛盾式，真假都有就是「有时真有时假」。',
        '六个式子的身份依次是：重言式、重言式、矛盾式、矛盾式、有时真有时假、有时真有时假。',
      ],
      render: (ctx) => <NameStage ctx={ctx} />,
    },
    {
      label: '④ 练一练',
      short: '练',
      narration: '三道小题，围着重言式、矛盾式、可满足式打转。',
      requireSolve: true,
      hints: [
        '拿不准的时候，就在心里把两种取值都代进去算一遍。',
        'P ∨ ¬P：P 真时左边真，P 假时右边真。P ∧ ¬P：两个要求同时成立，可 P 只能有一个取值。',
        '三题答案依次是：是重言式；是矛盾式；矛盾式。',
      ],
      render: (ctx) => <PracticeStage ctx={ctx} />,
    },
    {
      label: '⑤ 换个场景',
      short: '变',
      narration: '先验证两个式子是不是一回事，再找出唯一为假的那一行。',
      requireSolve: true,
      hints: [
        '第一件先点「用 equivalent 验证」，看两列取值逐行对不对得上。',
        '第二件要找「前面成立、后面不成立」的那一行：P、Q 都是真，而 R 是假。',
        '第一件：两列完全一样，等价成立。第二件：第 7 行（P 真、Q 真、R 假）是 8 行里唯一为假的一行。',
      ],
      render: (ctx) => <TransferStage ctx={ctx} />,
    },
  ],
}

export default topic
