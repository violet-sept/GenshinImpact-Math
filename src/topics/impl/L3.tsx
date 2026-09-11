import { useEffect, useMemo, useState } from 'react'

import {
  AND,
  IMP,
  NOT,
  OR,
  VAR,
  deMorganSteps,
  equivalent,
  evalExpr,
  exprToString,
  findDifference,
  truthTable,
  type DeMorganSide,
  type Env,
  type Expr,
} from '@/kernels/logic'
import { useStepper } from '@/platform/useStepper'
import { TruthTableView } from '@/primitives'
import { Btn, Callout, Card, Chip, Math, PlainSpeak, SectionTitle, Segmented, StepControls, SwitchRow, cx } from '@/ui'
import { Quiz } from '@/ui/Quiz'
import { useSolveOnce, useTriedSet } from '../hooks'
import type { StageCtx, Topic } from '../types'

/* --------------------------------------------------------------- 小工具 */

const target = NOT(AND(VAR('P'), VAR('Q')))
const PAIR_ROWS = truthTable(target).rows

const comboOf = (a: Env): string => `${a.P ? '1' : '0'}${a.Q ? '1' : '0'}`

/** 把一个「身高 / 长相」的组合翻译成一句人话 */
function plainScene(a: Env): string {
  if (a.P && a.Q) return '又高又帅'
  if (a.P && !a.Q) return '个子高，但不够帅'
  if (!a.P && a.Q) return '个子不高，但挺帅'
  return '又不高又不帅'
}

/* ============================================================== ① 看一看 */

interface Choice {
  id: string
  plain: string
  expr: Expr
}

const CHOICES: Choice[] = [
  { id: 'a', plain: '不高，而且也不帅', expr: AND(NOT(VAR('P')), NOT(VAR('Q'))) },
  { id: 'b', plain: '不高，或者不够帅（至少有一项不满足）', expr: OR(NOT(VAR('P')), NOT(VAR('Q'))) },
  { id: 'c', plain: '又高又帅', expr: AND(VAR('P'), VAR('Q')) },
]

function HookStage({ ctx }: { ctx: StageCtx }) {
  const [chosenId, setChosenId] = useState<string | null>(null)
  const [p, setP] = useState(true)
  const [q, setQ] = useState(true)
  const { tried, markTried } = useTriedSet()

  const combo = `${p ? '1' : '0'}${q ? '1' : '0'}`
  useEffect(() => {
    markTried(combo)
  }, [combo, markTried])

  const chosen = CHOICES.find((c) => c.id === chosenId) ?? null
  const env: Env = { P: p, Q: q }
  const originNow = evalExpr(target, env)
  const chosenNow = chosen ? evalExpr(chosen.expr, env) : false

  const settled = chosen !== null && equivalent(chosen.expr, target) && tried.size >= PAIR_ROWS.length
  useSolveOnce(ctx, settled)

  const seen = useMemo(() => PAIR_ROWS.filter((r) => tried.has(comboOf(r.assignment))), [tried])

  const pick = (c: Choice): void => {
    setChosenId(c.id)
    ctx.say('先记住这个选择。下面用两个开关把四种人都试一遍，看看它会不会露馅。')
  }

  return (
    <div className="flex flex-col gap-3">
      <PlainSpeak>
        先不动符号，就凭感觉：<b>「不是（又高又帅）」</b>到底等于哪句话？
        选一个，然后用下面两个开关把四种人都试一遍，看你的选择撑不撑得住。
      </PlainSpeak>

      <Card>
        <SectionTitle hint="先选，再检验">你觉得是哪句？</SectionTitle>
        <div className="flex flex-col gap-2" role="radiogroup" aria-label="不是（又高又帅）等于哪句话">
          {CHOICES.map((c) => {
            const active = chosenId === c.id
            return (
              <button
                key={c.id}
                type="button"
                role="radio"
                aria-checked={active}
                aria-label={`选择：${c.plain}`}
                onClick={() => pick(c)}
                className={cx(
                  'min-h-11 rounded-xl border px-3 py-2 text-left text-sm dl-transition',
                  active
                    ? 'border-a-500 bg-a-50 text-a-700 dark:bg-a-500/20 dark:text-a-300'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-a-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200',
                )}
              >
                {c.plain}
              </button>
            )
          })}
        </div>
      </Card>

      <div className="grid gap-3 sm:grid-cols-[16rem_minmax(0,1fr)]">
        <div className="flex flex-col gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
          <SwitchRow label="个子高" checked={p} onChange={(v) => setP(v)} hint="P" />
          <SwitchRow label="长得帅" checked={q} onChange={(v) => setQ(v)} hint="Q" />
          <div
            role="status"
            className={cx(
              'rounded-xl border px-3 py-2 text-sm dl-transition',
              !chosen
                ? 'border-slate-200 bg-white text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400'
                : originNow === chosenNow
                  ? 'border-ok-500 bg-ok-50 text-ok-700 dark:bg-ok-500/10 dark:text-ok-500'
                  : 'border-bad-500 bg-bad-50 text-bad-700 dark:bg-bad-500/10 dark:text-bad-500',
            )}
          >
            <div className="font-medium">{plainScene(env)}</div>
            <div className="mt-1 font-mono text-xs">
              原句「不是（又高又帅）」= {originNow ? '真' : '假'}
              {chosen ? ` · 你选的那句 = ${chosenNow ? '真' : '假'}` : ' · 还没选'}
            </div>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            已经试过 {tried.size} / {PAIR_ROWS.length} 种人。
          </p>
        </div>

        <Card className="p-3">
          <SectionTitle hint="试过一种就记一行">四种人，逐一对账</SectionTitle>
          {seen.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">还没试过。先拨一下上面两个开关。</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {seen.map((r) => {
                const o = r.value
                const c = chosen ? evalExpr(chosen.expr, r.assignment) : null
                const same = c === null ? true : c === o
                return (
                  <li
                    key={comboOf(r.assignment)}
                    className={cx(
                      'rounded-xl border px-3 py-2 text-sm',
                      same
                        ? 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900'
                        : 'border-bad-500 bg-bad-50 dark:bg-bad-500/10',
                    )}
                  >
                    <div className="text-slate-700 dark:text-slate-200">{plainScene(r.assignment)}</div>
                    <div className="mt-0.5 font-mono text-xs text-slate-500 dark:text-slate-400">
                      原句 = {o ? '真' : '假'}
                      {c === null ? ' · 你还没选' : ` · 你选的那句 = ${c ? '真' : '假'}`}
                    </div>
                    {!same ? (
                      <p className="mt-1 text-xs text-bad-700 dark:text-bad-500">
                        对不上！这个人并不满足「又高又帅」，所以「不是（又高又帅）」是成立的；可你选的那句话这时候不成立。
                      </p>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          )}
        </Card>
      </div>

      {settled ? (
        <Callout tone="ok" title="撑住了">
          四种人都试过，你选的那句话和「不是（又高又帅）」逐行一致 —— 它们就是同一句话的两种说法。
          第②步我们把它一步步变形出来。
        </Callout>
      ) : null}
    </div>
  )
}

/* ============================================================== ② 玩一玩 */

const SIDE_LABEL: Record<DeMorganSide, string> = {
  notAnd: '不是（P 而且 Q）',
  notOr: '不是（P 或者 Q）',
}

function ExploreStage({ ctx }: { ctx: StageCtx }) {
  const [side, setSide] = useState<DeMorganSide>('notAnd')
  const [p, setP] = useState(true)
  const [q, setQ] = useState(false)

  const steps = useMemo(() => deMorganSteps(side, VAR('P'), VAR('Q')), [side])
  const stepper = useStepper<Expr>(steps, side)
  const step = stepper.step

  const env: Env = { P: p, Q: q }
  const now = step ? evalExpr(step.snapshot, env) : false
  const origin = steps[0] ? evalExpr(steps[0].snapshot, env) : false

  const reachedEnd = side === 'notAnd' && stepper.index === stepper.count - 1
  useSolveOnce(ctx, reachedEnd)

  return (
    <div className="flex flex-col gap-3">
      <PlainSpeak>
        这就是「把否定搬进去」的全过程。点<b>下一步</b>，看式子一点点变样；
        也可以来回拖、随时倒回去重看 —— 每一步的取值都没变，只是写法变了。
      </PlainSpeak>

      <Segmented
        label="选一条德摩根律"
        value={side}
        onChange={(v) => setSide(v)}
        options={[
          { value: 'notAnd', label: '不是（P 而且 Q）' },
          { value: 'notOr', label: '不是（P 或者 Q）' },
        ]}
      />

      <Card>
        <SectionTitle hint={`${stepper.index + 1} / ${stepper.count}`}>{SIDE_LABEL[side]}</SectionTitle>

        <div className="rounded-xl bg-slate-50 px-3 py-4 text-center dark:bg-slate-800/40">
          <div className="text-xl sm:text-2xl">
            <Math>{step ? exprToString(step.snapshot) : ''}</Math>
          </div>
          {step?.highlight.includes('op') ? (
            <Chip tone="cur" className="mt-2">
              这一步在改中间的联结词
            </Chip>
          ) : null}
        </div>

        <div className="mt-3">
          <Callout tone={step?.tone === 'accept' ? 'ok' : 'info'} role="status">
            <b>{step?.label ?? ''}：</b>
            {step?.explanation ?? ''}
          </Callout>
        </div>

        <div className="mt-3">
          <StepControls api={stepper} label={SIDE_LABEL[side]} />
        </div>
      </Card>

      <div className="grid gap-3 sm:grid-cols-[16rem_minmax(0,1fr)]">
        <div className="flex flex-col gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
          <SwitchRow label="把 P 拨成真" checked={p} onChange={(v) => setP(v)} hint="合上 = P 为真，断开 = P 为假" />
          <SwitchRow label="把 Q 拨成真" checked={q} onChange={(v) => setQ(v)} hint="合上 = Q 为真，断开 = Q 为假" />
        </div>

        <Callout tone={now === origin ? 'ok' : 'bad'} role="status">
          当 P 取{p ? '真' : '假'}、Q 取{q ? '真' : '假'}时：<b>当前这一步</b>的式子是 {now ? '真' : '假'}，
          <b>原式</b>是 {origin ? '真' : '假'} —— {now === origin ? '取值没变，变的只是写法。' : '取值变了，说明这一步改错了。'}
        </Callout>
      </div>

      {reachedEnd ? (
        <Callout tone="ok" title="变形完成">
          否定被搬到了括号里面，同时 ∧ 换成了 ∨。这条规律叫<b>德摩根律</b>，第③步给它正式立个牌子。
          想看另一条（不是（P 或者 Q））的话，点上面的切换。
        </Callout>
      ) : null}
    </div>
  )
}

/* ============================================================== ③ 起个名 */

interface Law {
  id: DeMorganSide
  formula: string
  plain: string
  left: Expr
  right: Expr
}

const LAWS: Law[] = [
  {
    id: 'notAnd',
    formula: '¬(P ∧ Q) ≡ ¬P ∨ ¬Q',
    plain: '「不是（又这样又那样）」=「至少有一样不这样」。否定搬进去，∧ 变成 ∨。',
    left: NOT(AND(VAR('P'), VAR('Q'))),
    right: OR(NOT(VAR('P')), NOT(VAR('Q'))),
  },
  {
    id: 'notOr',
    formula: '¬(P ∨ Q) ≡ ¬P ∧ ¬Q',
    plain: '「不是（这样或者那样）」=「两样都不这样」。否定搬进去，∨ 变成 ∧。',
    left: NOT(OR(VAR('P'), VAR('Q'))),
    right: AND(NOT(VAR('P')), NOT(VAR('Q'))),
  },
]

function NameStage({ ctx }: { ctx: StageCtx }) {
  const [lawId, setLawId] = useState<DeMorganSide>('notAnd')
  const { tried, markTried } = useTriedSet()

  const law = LAWS.find((l) => l.id === lawId)!
  const table = useMemo(() => truthTable(law.left), [law])
  const rightCol = table.rows.map((r) => evalExpr(law.right, r.assignment))

  const need = LAWS.length * table.rows.length
  const done = tried.size >= need
  useSolveOnce(ctx, done)

  const inspect = (i: number): void => {
    markTried(`${law.id}:${i}`)
    const row = table.rows[i]
    const l = row.value
    const r = rightCol[i]
    ctx.say(
      `P 取${row.assignment.P ? '真' : '假'}、Q 取${row.assignment.Q ? '真' : '假'}：左边 ${l ? '真' : '假'}，右边 ${
        r ? '真' : '假'
      } —— ${l === r ? '一模一样。' : '对不上。'}`,
      l === r ? 'accept' : 'reject',
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <PlainSpeak>
        把你的发现写成公式，就是这两条 <b>德摩根律</b>。它们最重要的地方是：
        <b>否定搬进括号时，∧ 和 ∨ 要互换</b>。下面逐行对账，看看两边是不是真的一模一样。
      </PlainSpeak>

      <div className="grid gap-2 sm:grid-cols-2">
        {LAWS.map((l) => (
          <div key={l.id} className="rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-800/50">
            <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">
              <Math>{l.formula}</Math>
            </div>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{l.plain}</p>
          </div>
        ))}
      </div>

      <Segmented
        label="对照哪一条"
        value={lawId}
        onChange={(v) => setLawId(v)}
        options={LAWS.map((l) => ({ value: l.id, label: l.formula }))}
      />

      <Card>
        <SectionTitle hint={`已对过 ${tried.size} / ${need} 行`}>逐行对账</SectionTitle>
        <TruthTableView
          vars={table.vars}
          rows={table.rows}
          onRowClick={inspect}
          highlightRows={table.rows.map((_, i) => i).filter((i) => tried.has(`${law.id}:${i}`))}
          columns={[
            { label: exprToString(law.left), values: table.rows.map((r) => r.value) },
            { label: exprToString(law.right), values: rightCol, accent: true },
          ]}
          caption="每一行都点一下，看看左右两列是不是每行都一样。两条定律的 4 行都要点到。"
        />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Chip tone={equivalent(law.left, law.right) ? 'ok' : 'bad'}>
            equivalent 判定：{equivalent(law.left, law.right) ? '完全等价' : '不等价'}
          </Chip>
          <Chip tone="dim" showGlyph={false}>
            共 {need} 行要核对
          </Chip>
        </div>
      </Card>

      {done ? (
        <Callout tone="ok" title="两条定律都核对完了">
          两边每一行取值都一样，所以它们<b>逻辑等价</b>：不是文字游戏，是同一个判断的两种写法。
        </Callout>
      ) : null}
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
        三道题。第一道是最有名的坑，很多人第一次都会选错 —— 选错也没关系，会告诉你错在哪。
      </p>

      <Card>
        <Quiz
          question={
            <>
              「<Math>¬(P ∧ Q)</Math> 等价于 <Math>¬P ∧ ¬Q</Math>」这个说法对吗？
            </>
          }
          resetKey="l3p1"
          onSolved={() => setSolvedCount((c) => c + 1)}
          choices={[
            {
              id: 'a',
              label: '不对。应该是 ¬P ∨ ¬Q。',
              correct: true,
              why: '对。「不是（又……又……）」的意思是「至少有一项不满足」，所以中间要用 ∨。举反例：P 假、Q 真时，¬(P ∧ Q) 为真，而 ¬P ∧ ¬Q 为假 —— 两者不等价。',
            },
            {
              id: 'b',
              label: '对，把否定分别送给两边就行。',
              correct: false,
              why: '不对。否定确实要分别送给两边，但联结词也必须换：∧ 要变成 ∨。只送否定不换符号，就漏掉了「至少一个不满足」这种情况。反例：一个人个子高但不够帅 —— ¬(又高又帅) 成立，而「不高而且不帅」不成立。',
            },
            {
              id: 'c',
              label: '对，但只对 P 真 Q 真 那一行成立。',
              correct: false,
              why: '不对。逻辑等价要求每一行都一样。而且恰恰是在 P 真 Q 假（或者反过来）这种「只有一项不满足」的行上，两个式子的差别最明显。',
            },
          ]}
        />
      </Card>

      <Card>
        <Quiz
          question={
            <>
              <Math>¬(P ∨ Q)</Math> 等价于下面哪一个？
            </>
          }
          resetKey="l3p2"
          onSolved={() => setSolvedCount((c) => c + 1)}
          choices={[
            {
              id: 'a',
              label: (
                <>
                  <Math>¬P ∧ ¬Q</Math>
                </>
              ),
              correct: true,
              why: '对。「不是（要么这样要么那样）」=「两样都不」。否定搬进去，∨ 换成了 ∧。',
            },
            {
              id: 'b',
              label: (
                <>
                  <Math>¬P ∨ ¬Q</Math>
                </>
              ),
              correct: false,
              why: '不对。¬P ∨ ¬Q 等价的是 ¬(P ∧ Q)（另一条德摩根律）。差别在：P 真、Q 假时，¬P ∨ ¬Q 为真，但 ¬(P ∨ Q) 为假 —— 因为 P 成立，「P 或者 Q」就成立了。',
            },
            {
              id: 'c',
              label: (
                <>
                  <Math>P ∧ Q</Math>
                </>
              ),
              correct: false,
              why: '不对。它连否定都没有，取值和原式完全相反：原式两行假两行真，P ∧ Q 只有一行真。',
            },
          ]}
        />
      </Card>

      <Card>
        <Quiz
          question={<>「不是（今天下雨或者刮风）」用大白话说，是哪一句？</>}
          resetKey="l3p3"
          onSolved={() => setSolvedCount((c) => c + 1)}
          choices={[
            {
              id: 'a',
              label: '今天既没下雨，也没刮风',
              correct: true,
              why: '对。这是 ¬(P ∨ Q) 的样子：要把「或者」整个否掉，就得两件事都不成立，所以中间是「而且」。',
            },
            {
              id: 'b',
              label: '今天没下雨，或者没刮风',
              correct: false,
              why: '不对。这句话宽松得多：只下了一点点雨、没刮风，它就算成立；可原句要求两样都不发生。它等价的是 ¬(P ∧ Q)，不是 ¬(P ∨ Q)。',
            },
            {
              id: 'c',
              label: '今天下雨了，但没刮风',
              correct: false,
              why: '不对。这句话反而承认了下雨，而原句一开始就把下雨否定掉了 —— 两句话的取值有一半是反的。',
            },
          ]}
        />
      </Card>
    </div>
  )
}

/* ============================================================== ⑤ 换个场景 */

interface Pair {
  id: string
  title: string
  a: Expr
  b: Expr
  /** 表头用的写法：内核的 exprToString 会自动省掉多余的括号，这里补成初学者更好读的样子 */
  aText: string
  bText: string
  same: boolean
  yes: string
  no: string
}

const PAIRS: Pair[] = [
  {
    id: 'dist',
    title: 'P ∧ (Q ∨ R) 对比 (P ∧ Q) ∨ (P ∧ R)',
    a: AND(VAR('P'), OR(VAR('Q'), VAR('R'))),
    b: OR(AND(VAR('P'), VAR('Q')), AND(VAR('P'), VAR('R'))),
    aText: 'P ∧ (Q ∨ R)',
    bText: '(P ∧ Q) ∨ (P ∧ R)',
    same: true,
    yes: '对。把 P 分别乘进括号里的两项再相加，结果不变 —— 这是分配律，也是真值表逐行核对的结果。',
    no: '其实它们是等价的：你可以在真值表里逐行看，8 行没有一行对不上。',
  },
  {
    id: 'dist-bad',
    title: 'P ∧ (Q ∨ R) 对比 (P ∧ Q) ∨ R',
    a: AND(VAR('P'), OR(VAR('Q'), VAR('R'))),
    b: OR(AND(VAR('P'), VAR('Q')), VAR('R')),
    aText: 'P ∧ (Q ∨ R)',
    bText: '(P ∧ Q) ∨ R',
    same: false,
    yes: '不对，它俩不等价。右边那个 R 前面漏了一个 P，破坏了对齐。',
    no: '对。右边第二项少了 P，P 假而 R 真的时候就会露馅。',
  },
  {
    id: 'contra',
    title: 'P → Q 对比 ¬Q → ¬P',
    a: IMP(VAR('P'), VAR('Q')),
    b: IMP(NOT(VAR('Q')), NOT(VAR('P'))),
    aText: 'P → Q',
    bText: '¬Q → ¬P',
    same: true,
    yes: '对。「如果 P 那么 Q」和它的逆否命题「如果非 Q 那么非 P」永远同真同假 —— 这是逆否律。',
    no: '其实它们等价。逆否命题和原命题是一回事：一个 4 行表里逐行都对得上。',
  },
]

function TransferStage({ ctx }: { ctx: StageCtx }) {
  const [sel, setSel] = useState<string>(PAIRS[0].id)
  const [answers, setAnswers] = useState<Record<string, boolean>>({})
  const [diffs, setDiffs] = useState<Record<string, number>>({})

  const pair = PAIRS.find((p) => p.id === sel)!
  const table = useMemo(() => truthTable(pair.a), [pair])
  const colB = table.rows.map((r) => evalExpr(pair.b, r.assignment))

  const allAnswered = PAIRS.every((p) => answers[p.id] === p.same)
  const diffUsed = Object.keys(diffs).length >= 1
  useSolveOnce(ctx, allAnswered && diffUsed)

  const rowOf = (assign: Env): number =>
    table.rows.findIndex((r) => table.vars.every((v) => r.assignment[v] === assign[v]))

  const answer = (guess: boolean): void => {
    setAnswers((prev) => ({ ...prev, [pair.id]: guess }))
    const ok = guess === pair.same
    if (!ok) {
      const d = findDifference(pair.a, pair.b)
      if (d) setDiffs((prev) => ({ ...prev, [pair.id]: rowOf(d.assignment) }))
    }
    ctx.say(ok ? (pair.same ? pair.yes : pair.no) : pair.same ? pair.no : pair.yes, ok ? 'accept' : 'reject')
  }

  const findFirstDiff = (): void => {
    const d = findDifference(pair.a, pair.b)
    if (!d) {
      ctx.say('findDifference 找遍了每一行，没有发现不同的地方 —— 它们完全等价。', 'accept')
      return
    }
    setDiffs((prev) => ({ ...prev, [pair.id]: rowOf(d.assignment) }))
    ctx.say(
      `第一处不同在第 ${rowOf(d.assignment) + 1} 行：左边是 ${d.left ? '真' : '假'}，右边是 ${d.right ? '真' : '假'}。`,
      'reject',
    )
  }

  const answered = answers[pair.id]
  const diffRow = diffs[pair.id]

  return (
    <div className="flex flex-col gap-3">
      <PlainSpeak>
        最后一关：不给公式，只给两对式子，你来判断它们是不是同一回事。
        拿不准就点<b>「找出第一处不同」</b> —— 真值表会当场把那一行点亮。
      </PlainSpeak>

      <Segmented
        label="选一组来比较"
        value={sel}
        onChange={(v) => setSel(v)}
        options={PAIRS.map((p) => ({ value: p.id, label: p.title }))}
      />

      <Card>
        <SectionTitle hint="先自己判断，再让系统算">这两句等价吗？</SectionTitle>
        <div className="mb-3 flex flex-wrap items-center gap-2 font-mono text-sm">
          <span className="rounded-lg bg-a-50 px-2 py-1 text-a-700 dark:bg-a-500/20 dark:text-a-300">
            {pair.aText}
          </span>
          <span aria-hidden="true">对比</span>
          <span className="rounded-lg bg-b-50 px-2 py-1 text-b-700 dark:bg-b-500/20 dark:text-b-300">
            {pair.bText}
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          <Btn
            variant={answered === true ? 'primary' : 'outline'}
            onClick={() => answer(true)}
            aria-label={`判断 ${pair.title} 等价`}
          >
            等价
          </Btn>
          <Btn
            variant={answered === false ? 'primary' : 'outline'}
            onClick={() => answer(false)}
            aria-label={`判断 ${pair.title} 不等价`}
          >
            不等价
          </Btn>
          <Btn variant="subtle" onClick={findFirstDiff} aria-label={`找出 ${pair.title} 的第一处不同`}>
            找出第一处不同
          </Btn>
        </div>

        <div className="mt-3">
          <Callout
            tone={answered === undefined ? 'info' : answered === pair.same ? 'ok' : 'bad'}
            role="status"
          >
            {answered === undefined
              ? '还没判断。可以先点「找出第一处不同」探一探。'
              : answered === pair.same
                ? pair.same
                  ? pair.yes
                  : pair.no
                : `判断反了。${pair.same ? pair.no : pair.yes}`}
          </Callout>
        </div>

        <div className="mt-3">
          <TruthTableView
            vars={table.vars}
            rows={table.rows}
            highlightRows={diffRow === undefined ? [] : [diffRow]}
            columns={[
              { label: pair.aText, values: table.rows.map((r) => r.value) },
              { label: pair.bText, values: colB, accent: true },
            ]}
            caption={
              diffRow === undefined
                ? '两列从上往下对一遍，看看有没有对不上的行。'
                : `被点亮的是第 ${diffRow + 1} 行 —— 这就是两边第一处对不上的地方。`
            }
          />
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Chip tone={equivalent(pair.a, pair.b) ? 'ok' : 'bad'}>
            equivalent：{equivalent(pair.a, pair.b) ? '等价' : '不等价'}
          </Chip>
          <Chip tone="dim" showGlyph={false}>
            已判断 {Object.keys(answers).length} / {PAIRS.length} 组
          </Chip>
        </div>
      </Card>
    </div>
  )
}

/* ============================================================== 导出 */

const topic: Topic = {
  id: 'L3',
  title: '逻辑等价与德摩根律',
  moduleId: 'logic',
  oneLiner: '两个看起来不一样的式子，其实说的是同一件事',
  outcome: '你能判断两个式子是否逻辑等价，并且会用德摩根律把否定搬进括号、同时把 ∧ 和 ∨ 互换。',
  prerequisites: ['L1', 'L2'],
  bigIdea: '式子不是文字，它只由真值表决定；两张真值表逐行一样，两个式子就是同一个东西 —— 德摩根律就是最常见的一次「换个说法」。',
  misconceptions: [
    {
      wrong: '¬(P ∧ Q) 等价于 ¬P ∧ ¬Q',
      right: '应是 ¬P ∨ ¬Q。否定搬进去时，联结词必须互换：∧ 变 ∨、∨ 变 ∧。反例：P 假、Q 真时左边为真、右边为假。',
    },
    {
      wrong: '否定可以只送给括号里的第一项',
      right: '否定要送给括号里的每一项，一项都不能漏。漏掉的那一项会让整句话变得比原来宽松。',
    },
    {
      wrong: '式子长得不一样，意思就一定不一样',
      right: '写法不同不代表意思不同。判断标准只有一个：真值表逐行比对，全都一样就是逻辑等价。',
    },
  ],
  formalDefinition: (
    <>
      <p>
        <b>逻辑等价：</b>
        <span className="font-mono">A ≡ B ⟺ A ↔ B 是重言式 ⟺ 两者真值表逐行相同</span>
      </p>
      <p>
        <b>德摩根律：</b>
      </p>
      <p className="font-mono">¬(P ∧ Q) ≡ ¬P ∨ ¬Q</p>
      <p className="font-mono">¬(P ∨ Q) ≡ ¬P ∧ ¬Q</p>
      <p>
        <b>另外两条常用的等价式：</b>
      </p>
      <p className="font-mono">P → Q ≡ ¬P ∨ Q</p>
      <p className="font-mono">P → Q ≡ ¬Q → ¬P（逆否律）</p>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        记忆口诀：否定搬进括号，括号里的 ∧ 和 ∨ 全部互换。否定的作用范围有多大，互换的范围就有多大。
      </p>
    </>
  ),
  glossary: [
    { term: '逻辑等价 ≡', plain: '两个式子在每一种取值下结果都一样，也就是真值表逐行相同。', formal: 'A ≡ B ⟺ A ↔ B 是重言式' },
    { term: '德摩根律', plain: '把「不是（……）」搬进括号里的规矩：否定分给每一项，同时 ∧ 和 ∨ 互换。' },
    { term: '命题变元 P、Q', plain: '句子里的「占位符」，可以取真也可以取假。' },
    { term: '逆否命题', plain: '把「如果 P 那么 Q」倒过来再加否定：如果非 Q，那么非 P。它和原命题永远等价。', formal: 'P → Q ≡ ¬Q → ¬P' },
    { term: '分配律', plain: 'P ∧ (Q ∨ R) 可以拆成 (P ∧ Q) ∨ (P ∧ R)，像乘法分配进去一样。' },
    { term: '反例', plain: '只要能找到一种取值让两个式子结果不同，它们就不等价 —— 那一行就是反例。' },
    { term: '互换 ∧ 和 ∨', plain: '德摩根律里最容易漏的一步：把否定搬进括号的同时，括号里的「而且」和「或者」要调个个儿。' },
  ],
  stages: [
    {
      label: '① 看一看',
      short: '看',
      narration: '「不是（又高又帅）」等于哪句？选一个，再验证。',
      requireSolve: true,
      hints: [
        '选完之后，用「个子高 / 长得帅」两个开关把四种人都摆出来，看看你选的那句会不会在某种人身上对不上。',
        '重点试「个子高但不够帅」和「个子不高但挺帅」这两种人 —— 破绽通常就藏在这里。',
        '答案是第二句「不高，或者不够帅」。四种人都试过之后，它和「不是（又高又帅）」逐行一致。',
      ],
      render: (ctx) => <HookStage ctx={ctx} />,
    },
    {
      label: '② 玩一玩',
      short: '玩',
      narration: '点「下一步」，看式子怎么一步步变形。',
      requireSolve: true,
      hints: [
        '用「下一步」按钮一直走到最后一步就行（底部进度条也能直接拖）。',
        '注意中间那一步：否定先被分给左右两边，然后联结词才从 ∧ 变成 ∨。',
        '走完 3 步，式子就从 ¬(P ∧ Q) 变成了 ¬P ∨ ¬Q。也可以切到另一条德摩根律再看看。',
      ],
      render: (ctx) => <ExploreStage ctx={ctx} />,
    },
    {
      label: '③ 起个名',
      short: '名',
      narration: '两条德摩根律，逐行对账看两边一样不一样。',
      requireSolve: true,
      hints: [
        '把两条定律的每一行都点一遍（一共 8 行），点完才算对完账。',
        '切换定律用中间那个分段按钮；点表格左边任意一行，系统会报出这一行左右两边的取值。',
        '两条定律分别对应：¬(P ∧ Q) ≡ ¬P ∨ ¬Q 和 ¬(P ∨ Q) ≡ ¬P ∧ ¬Q。8 行对完，你会发现没有一行对不上。',
      ],
      render: (ctx) => <NameStage ctx={ctx} />,
    },
    {
      label: '④ 练一练',
      short: '练',
      narration: '三道小题。第一道是经典错法，小心。',
      requireSolve: true,
      hints: [
        '记住口诀：否定搬进去，∧ 和 ∨ 要互换。',
        '不确定的时候举个具体例子：P 假、Q 真时，两边分别是什么？',
        '三题答案依次是：不对（应是 ¬P ∨ ¬Q）；¬P ∧ ¬Q；今天既没下雨也没刮风。',
      ],
      render: (ctx) => <PracticeStage ctx={ctx} />,
    },
    {
      label: '⑤ 换个场景',
      short: '变',
      narration: '三组式子，判断等价还是不等价。',
      requireSolve: true,
      hints: [
        '每组都先自己判断，再点「找出第一处不同」验证 —— 至少要亲手用一次这个按钮。',
        '有 P、Q、R 三个变量时表有 8 行，从第一行开始往下找，第一处对不上的地方就是答案。',
        '三组分别是：等价（分配律）、不等价（右边漏了 P，第 2 行就对不上了）、等价（逆否律）。',
      ],
      render: (ctx) => <TransferStage ctx={ctx} />,
    },
  ],
}

export default topic
