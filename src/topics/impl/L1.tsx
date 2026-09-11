import { useEffect, useMemo, useState } from 'react'

import {
  AND,
  IMP,
  OR,
  VAR,
  evalExpr,
  exprToString,
  truthTable,
  type Env,
} from '@/kernels/logic'
import { TruthTableView } from '@/primitives'
import { Callout, Card, Chip, Math, PlainSpeak, SectionTitle, Segmented, SwitchRow, cx } from '@/ui'
import { Quiz } from '@/ui/Quiz'
import { useSolveOnce, useTriedSet } from '../hooks'
import type { StageCtx, Topic } from '../types'

/* ================================================================ 电路原语 */

type CircuitMode = 'series' | 'parallel'

const MODE_LABEL: Record<CircuitMode, string> = { series: '串联', parallel: '并联' }

const ON = 'var(--color-cur-500)'
const OFF = 'var(--color-dim-300)'

/**
 * 电路里的一个开关。
 *
 * 直接画在 SVG 里，是因为「拨开关」这个动作本身就是最好的说明；
 * 但每个开关仍然是一个带 aria-label 的 role="button"，Tab 能选中、回车能拨动。
 */
function SwitchGlyph({
  x,
  y,
  closed,
  label,
  tone,
  onToggle,
}: {
  x: number
  y: number
  closed: boolean
  label: string
  tone: string
  onToggle: () => void
}) {
  return (
    <g
      role="button"
      tabIndex={0}
      aria-label={`开关 ${label}，现在${closed ? '合上、电流能通过' : '断开、电流过不去'}，按一下切换`}
      onClick={onToggle}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onToggle()
        }
      }}
      style={{ cursor: 'pointer' }}
    >
      {/* 透明大矩形 = 加大命中区，手指也能点中 */}
      <rect x={x - 12} y={y - 30} width={64} height={54} fill="transparent" />
      <circle cx={x} cy={y} r={3.5} fill={closed ? tone : 'var(--color-dim-500)'} />
      <circle cx={x + 40} cy={y} r={3.5} fill={closed ? tone : 'var(--color-dim-500)'} />
      <line
        x1={x}
        y1={y}
        x2={closed ? x + 40 : x + 33}
        y2={closed ? y : y - 22}
        stroke={closed ? tone : 'var(--color-dim-500)'}
        strokeWidth={3.5}
        strokeLinecap="round"
        style={{ transition: 'all var(--dl-dur) var(--ease-dl)' }}
      />
      <text x={x + 20} y={y + 24} textAnchor="middle" className="dl-svg-text" fill="var(--color-dim-600)">
        {label}
      </text>
    </g>
  )
}

/**
 * 两个开关 + 一盏灯。
 *
 * series：P、Q 串在一条路上 —— 电流必须穿过两个开关。
 * parallel：P、Q 各占一条支路 —— 电流挑好走的那条走。
 * 同一个 P、Q 同时喂给两条电路，学生才能一眼看出「同样两个开关，接线不同结果就不同」。
 */
function CircuitSvg({
  mode,
  p,
  q,
  onToggleP,
  onToggleQ,
}: {
  mode: CircuitMode
  p: boolean
  q: boolean
  onToggleP: () => void
  onToggleQ: () => void
}) {
  const lit = mode === 'series' ? p && q : p || q
  const topFlow = mode === 'series' ? p && q : p
  const bottomFlow = mode === 'series' ? p && q : q
  const rail = lit ? ON : OFF
  const bulbFill = lit ? 'var(--color-cur-100)' : 'var(--color-slate-100)'
  const swTone = 'var(--color-a-500)'

  return (
    <svg
      viewBox="0 0 320 170"
      className="h-auto w-full"
      role="group"
      aria-label={`${MODE_LABEL[mode]}电路：开关 P ${p ? '合上' : '断开'}，开关 Q ${
        q ? '合上' : '断开'
      }，灯泡${lit ? '亮' : '不亮'}`}
    >
      {/* 上支路 */}
      <path
        d={mode === 'series' ? 'M35 45 H95 M135 45 H165 M205 45 H255' : 'M35 45 H135 M175 45 H255'}
        stroke={topFlow ? ON : OFF}
        strokeWidth={3}
        fill="none"
        strokeLinecap="round"
      />
      {/* 下支路 */}
      <path
        d={mode === 'series' ? 'M35 130 H255' : 'M35 130 H135 M175 130 H255'}
        stroke={bottomFlow ? ON : OFF}
        strokeWidth={3}
        fill="none"
        strokeLinecap="round"
      />
      {/* 左竖轨（带电池） */}
      <path d="M35 45 V72 M35 104 V130" stroke={rail} strokeWidth={3} fill="none" strokeLinecap="round" />
      <line x1={21} y1={80} x2={49} y2={80} stroke="var(--color-dim-500)" strokeWidth={3} strokeLinecap="round" />
      <line x1={27} y1={96} x2={43} y2={96} stroke="var(--color-dim-500)" strokeWidth={3} strokeLinecap="round" />
      {/* 右竖轨（带灯泡） */}
      <path d="M255 45 V71 M255 103 V130" stroke={rail} strokeWidth={3} fill="none" strokeLinecap="round" />

      <circle cx={255} cy={87} r={16} fill={bulbFill} stroke={lit ? ON : OFF} strokeWidth={2.5} className="dl-transition" />
      <path
        d="M249 93 L255 79 L261 93"
        stroke={lit ? 'var(--color-cur-600)' : 'var(--color-dim-300)'}
        strokeWidth={2.5}
        fill="none"
        strokeLinecap="round"
      />
      <text x={255} y={126} textAnchor="middle" className="dl-svg-text" fill={lit ? 'var(--color-cur-700)' : 'var(--color-dim-600)'}>
        {lit ? '亮' : '灭'}
      </text>

      {/* 开关：串联时两个都在上支路，并联时一边一个 */}
      <SwitchGlyph
        x={mode === 'series' ? 95 : 135}
        y={45}
        closed={p}
        label="P"
        tone={swTone}
        onToggle={onToggleP}
      />
      {mode === 'series' ? (
        <SwitchGlyph x={165} y={45} closed={q} label="Q" tone={swTone} onToggle={onToggleQ} />
      ) : (
        <SwitchGlyph x={135} y={130} closed={q} label="Q" tone={swTone} onToggle={onToggleQ} />
      )}

      <text x={160} y={20} textAnchor="middle" className="dl-svg-text" fill="var(--color-dim-600)">
        {mode === 'series' ? '两个开关串在一条路上' : '两个开关各占一条路'}
      </text>
    </svg>
  )
}

/* 真值表里的一行 → 一个四位组合字符串（0 表示假，1 表示真） */
const comboOf = (a: Env): string => `${a.P ? '1' : '0'}${a.Q ? '1' : '0'}`

const PAIR_ROWS = truthTable(OR(VAR('P'), VAR('Q'))).rows
const SERIES_COL = PAIR_ROWS.map((r) => evalExpr(AND(VAR('P'), VAR('Q')), r.assignment))
const PARALLEL_COL = PAIR_ROWS.map((r) => evalExpr(OR(VAR('P'), VAR('Q')), r.assignment))

/* ============================================================== ① 看一看 */

function HookStage({ ctx }: { ctx: StageCtx }) {
  const [mode, setMode] = useState<CircuitMode>('series')
  const [p, setP] = useState(false)
  const [q, setQ] = useState(false)
  const [flips, setFlips] = useState(0)

  const lit = mode === 'series' ? p && q : p || q
  const say = ctx.say

  // 拨一次开关就换一句旁白：灯为什么亮、为什么灭
  useEffect(() => {
    say(
      lit
        ? '灯亮了：电流从电源出发，一路走通到了灯泡。'
        : '灯是灭的：电流在路上被挡住了，走不到灯泡。',
    )
  }, [lit, say])

  const flipP = (): void => {
    setFlips((n) => n + 1)
    setP((v) => !v)
  }
  const flipQ = (): void => {
    setFlips((n) => n + 1)
    setQ((v) => !v)
  }

  // 钩子不强制交互（requireSolve: false），但动过手就点亮完成标记
  useSolveOnce(ctx, flips >= 2)

  return (
    <div className="flex flex-col gap-3">
      <PlainSpeak>
        先不看任何符号。左边是电源，右边是灯泡，中间两个开关 P 和 Q。
        <b>拨一下开关</b>，看看灯什么时候亮 —— 也可以直接点电路图上的开关。
      </PlainSpeak>

      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_16rem]">
        <div className="rounded-xl bg-slate-50 p-2 dark:bg-slate-800/40">
          <CircuitSvg mode={mode} p={p} q={q} onToggleP={flipP} onToggleQ={flipQ} />
        </div>

        <div className="flex flex-col gap-3">
          <Segmented
            label="接线方式"
            value={mode}
            onChange={(m) => setMode(m)}
            options={[
              { value: 'series', label: '串联', title: '两个开关串在一条路上' },
              { value: 'parallel', label: '并联', title: '两个开关各占一条路' },
            ]}
          />
          <div className="flex flex-col gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
            <SwitchRow label="开关 P" checked={p} onChange={flipP} />
            <SwitchRow label="开关 Q" checked={q} onChange={flipQ} />
          </div>

          <div
            role="status"
            className={cx(
              'rounded-xl border px-3 py-2 text-center text-sm font-semibold dl-transition',
              lit
                ? 'border-cur-500 bg-cur-50 text-cur-700 dark:bg-cur-500/10 dark:text-cur-500'
                : 'border-slate-200 bg-white text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400',
            )}
          >
            <span aria-hidden="true" className="mr-1.5">
              {lit ? '💡' : '⚫'}
            </span>
            灯泡{lit ? '亮了' : '没亮'}
          </div>

          <Callout tone={lit ? 'ok' : 'info'}>
            现在是<b>{MODE_LABEL[mode]}</b>：{mode === 'series' ? '电流必须穿过两个开关。' : '电流挑任意一条走得通的路。'}
          </Callout>
        </div>
      </div>
    </div>
  )
}

/* ============================================================== ② 玩一玩 */

function ExploreStage({ ctx }: { ctx: StageCtx }) {
  const [p, setP] = useState(false)
  const [q, setQ] = useState(false)
  const { tried, markTried } = useTriedSet()

  const combo = `${p ? '1' : '0'}${q ? '1' : '0'}`

  // 当前摆出来的这一种组合，就算「试过了」
  useEffect(() => {
    markTried(combo)
  }, [combo, markTried])

  const done = tried.size >= PAIR_ROWS.length
  useSolveOnce(ctx, done)

  // 只把「试过的组合」放进表格：行和列的值都按同一批下标取，保证逐行对齐
  const shownIdx = useMemo(
    () => PAIR_ROWS.map((_, i) => i).filter((i) => tried.has(comboOf(PAIR_ROWS[i].assignment))),
    [tried],
  )
  const shown = shownIdx.map((i) => PAIR_ROWS[i])
  const highlightAt = shownIdx.findIndex((i) => comboOf(PAIR_ROWS[i].assignment) === combo)

  return (
    <div className="flex flex-col gap-3">
      <PlainSpeak>
        同一个 P、Q，同时喂给上面那条<b>串联</b>电路和下面那条<b>并联</b>电路。
        把 4 种开关组合<b>都试一遍</b>：表格会随着你试的组合一行行长出来。
      </PlainSpeak>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="rounded-xl bg-slate-50 p-2 dark:bg-slate-800/40">
          <CircuitSvg mode="series" p={p} q={q} onToggleP={() => setP((v) => !v)} onToggleQ={() => setQ((v) => !v)} />
          <div className="mt-3 border-t border-slate-200 pt-3 dark:border-slate-700">
            <CircuitSvg
              mode="parallel"
              p={p}
              q={q}
              onToggleP={() => setP((v) => !v)}
              onToggleQ={() => setQ((v) => !v)}
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Card className="p-3">
            <SectionTitle hint={`已试 ${tried.size} / ${PAIR_ROWS.length} 种`}>试过的组合</SectionTitle>
            <TruthTableView
              vars={['P', 'Q']}
              rows={shown}
              highlightRows={highlightAt >= 0 ? [highlightAt] : []}
              columns={[
                { label: '串联 灯', values: shownIdx.map((i) => SERIES_COL[i]) },
                { label: '并联 灯', values: shownIdx.map((i) => PARALLEL_COL[i]), accent: true },
              ]}
              caption="真 = 灯亮，假 = 灯灭。没试过的组合还没出现在表里。"
            />
          </Card>

          <Callout tone={done ? 'ok' : 'cur'} role="status">
            {done
              ? '4 种组合都试过了。看两列：串联那一列只有「两个都合上」才亮；并联那一列只有「两个都断开」才灭。'
              : `还差 ${PAIR_ROWS.length - tried.size} 种组合没试过。试试把两个开关都合上，再试试只合上一个。`}
          </Callout>
        </div>
      </div>
    </div>
  )
}

/* ============================================================== ③ 起个名 */

const CONNECTIVES: { sym: string; plain: string; example: string; when: string }[] = [
  { sym: '¬', plain: '「不是」：把真话变假话，把假话变真话。', example: '今天不是星期一', when: '整句真假翻个面。' },
  { sym: '∧', plain: '「而且」「又」「同时」：两件事都得成立。', example: '又高又帅 = 高 ∧ 帅', when: '只有两边都真，才是真。' },
  { sym: '∨', plain: '「或者」：至少有一件成立就行。', example: '带伞或者带雨衣', when: '只要有一边真，就是真。' },
  { sym: '→', plain: '「如果……那么……」：说条件、讲承诺。', example: '如果下雨，我就带伞', when: '只有「前面真、后面假」时才假。' },
  { sym: '↔', plain: '「当且仅当」：两边一模一样。', example: '等边 ↔ 等角', when: '两边取值相同就是真。' },
]

const SYMS = ['¬', '∧', '∨', '→', '↔'] as const
type Sym = (typeof SYMS)[number]

interface SymQuestion {
  id: string
  sentence: string
  answer: Sym
  why: string
  trap: string
}

const SYM_QUESTIONS: SymQuestion[] = [
  {
    id: 'n1',
    sentence: '今天又下雨又刮风',
    answer: '∧',
    why: '「又……又……」要求两件事同时成立，正好是 ∧ 的意思。',
    trap: '它不是在说「随便哪一件」，而是两件都在发生',
  },
  {
    id: 'n2',
    sentence: '我没吃早饭',
    answer: '¬',
    why: '「没」就是把「我吃早饭」这句话的真假翻过来，所以用 ¬。',
    trap: '整句话只是把一件事反过来说，没有连接两件事',
  },
  {
    id: 'n3',
    sentence: '坐地铁或者打车，都行',
    answer: '∨',
    why: '「或者」表示至少一个成立；两个都做也行，所以是 ∨ 而不是「只能一个」。',
    trap: '它不要求两边同时成立',
  },
  {
    id: 'n4',
    sentence: '如果下雨，我就带伞',
    answer: '→',
    why: '「如果……那么……」讲的是条件关系，用 →。',
    trap: '它不是在说两件事同时发生，而是在说「一个成立时另一个也成立」',
  },
  {
    id: 'n5',
    sentence: '一个数能被 2 整除，当且仅当它是偶数',
    answer: '↔',
    why: '「当且仅当」表示两边同真同假、永远绑在一起，用 ↔。',
    trap: '它说的不是单向的条件，而是两边完全同步',
  },
]

function NameStage({ ctx }: { ctx: StageCtx }) {
  const [picked, setPicked] = useState<Record<string, Sym>>({})

  const allRight = SYM_QUESTIONS.every((q) => picked[q.id] === q.answer)
  useSolveOnce(ctx, allRight)

  const choose = (q: SymQuestion, sym: Sym): void => {
    setPicked((prev) => ({ ...prev, [q.id]: sym }))
    if (sym === q.answer) ctx.say(`对：${q.why}`, 'accept')
    else ctx.say(`再想想：这里说的是「${q.trap}」，所以不是 ${sym}。`, 'reject')
  }

  return (
    <div className="flex flex-col gap-4">
      <PlainSpeak>
        你刚才拨的开关，数学上只有五个符号要认：
        <b>¬ 不是</b>、<b>∧ 而且</b>、<b>∨ 或者</b>、<b>→ 如果那么</b>、<b>↔ 当且仅当</b>。
        每个符号管一件事，认准它在说什么就行。
      </PlainSpeak>

      <Card>
        <SectionTitle hint="五个符号，各配一句大白话">符号对照表</SectionTitle>
        <ul className="grid gap-2 sm:grid-cols-2">
          {CONNECTIVES.map((c) => (
            <li key={c.sym} className="rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-800/50">
              <div className="flex items-baseline gap-2">
                <Math>{c.sym}</Math>
                <span className="text-sm text-slate-700 dark:text-slate-200">{c.plain}</span>
              </div>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                例：{c.example} · {c.when}
              </p>
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <SectionTitle hint="每句选一个符号，选错会告诉你为什么">这句话该用哪个符号？</SectionTitle>
        <ul className="flex flex-col gap-3">
          {SYM_QUESTIONS.map((q) => {
            const pick = picked[q.id]
            const right = pick === q.answer
            return (
              <li key={q.id} className="flex flex-col gap-2">
                <p className="text-sm text-slate-700 dark:text-slate-200">{q.sentence}</p>
                <div className="flex flex-wrap items-center gap-2" role="group" aria-label={`为「${q.sentence}」选择符号`}>
                  {SYMS.map((sym) => {
                    const active = pick === sym
                    const good = active && right
                    const bad = active && !right
                    return (
                      <button
                        key={sym}
                        type="button"
                        aria-label={`选 ${sym}`}
                        aria-pressed={active}
                        onClick={() => choose(q, sym)}
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
                </div>
                {pick ? (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {right ? '✓ 对，' : `✗ 你选了 ${pick}。这里说的是「${q.trap}」，所以应该是 ${q.answer}：`}
                    {q.why}
                  </p>
                ) : null}
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
        三道题。选错不扣分、不限次数 —— 点错的选项会直接告诉你错在哪，然后马上可以再来一次。
      </p>

      <Card>
        <Quiz
          question={
            <>
              「如果明天下雨，我就带伞。」结果第二天<b>没下雨</b>，我也<b>没带伞</b>。这句话算说谎吗？
            </>
          }
          resetKey="l1p1"
          onSolved={() => setSolvedCount((c) => c + 1)}
          choices={[
            {
              id: 'a',
              label: '不算。前提「下雨」根本没发生，这句话没有被违反。',
              correct: true,
              why: '对。P → Q 只在前件 P 真、后件 Q 假时才为假。现在 P 是假的，整句自动为真 —— 这叫「前提为假时，蕴含式空真」。',
            },
            {
              id: 'b',
              label: '算。因为我明明说了带伞却没带。',
              correct: false,
              why: '不对。带伞这个承诺只有在「下雨」真的发生时才生效。前提都没发生，就谈不上违约 —— 就像「如果明天太阳从西边出来，我就请你吃饭」，太阳没从西边出来，你也没请，谁都不觉得你在骗人。',
            },
            {
              id: 'c',
              label: '算一半，因为我说到没做到。',
              correct: false,
              why: '不对。命题只有真、假两种取值，没有「一半真」。要么成立，要么不成立。',
            },
            {
              id: 'd',
              label: '信息不够，判断不了。',
              correct: false,
              why: '不对。只要 P、Q 的取值都定了，P → Q 的值就定了：P 假的时候它一定是真。',
            },
          ]}
        />
      </Card>

      <Card>
        <Quiz
          question={
            <>
              「<Math>P ∨ Q</Math> 为真」这句话是什么意思？
            </>
          }
          resetKey="l1p2"
          onSolved={() => setSolvedCount((c) => c + 1)}
          choices={[
            {
              id: 'a',
              label: 'P、Q 里至少有一个为真',
              correct: true,
              why: '对。逻辑里的「或者」是「至少一个」：一个真也行，两个都真也行，只有两个都假时才为假。',
            },
            {
              id: 'b',
              label: 'P、Q 两个都为真',
              correct: false,
              why: '不对。那是 P ∧ Q（而且）的意思。∨ 比 ∧ 宽松得多，多出来的是「只有一个真」的那两种情况。',
            },
            {
              id: 'c',
              label: 'P、Q 里恰好有一个为真',
              correct: false,
              why: '不对。「恰好一个」叫异或，通常在离散数学里写作 P ⊕ Q。它和 ∨ 的差别就在「两个都真」那一行：∨ 认为是真，⊕ 认为是假。',
            },
          ]}
        />
      </Card>

      <Card>
        <Quiz
          question={<>「他既会弹琴也会唱歌」对应下面哪个式子？（P = 会弹琴，Q = 会唱歌）</>}
          resetKey="l1p3"
          onSolved={() => setSolvedCount((c) => c + 1)}
          choices={[
            {
              id: 'a',
              label: (
                <>
                  <Math>P ∧ Q</Math>
                </>
              ),
              correct: true,
              why: '对。「既……也……」要求两件事都成立，就是 ∧。',
            },
            {
              id: 'b',
              label: (
                <>
                  <Math>P ∨ Q</Math>
                </>
              ),
              correct: false,
              why: '不对。∨ 只要求其中一个成立，比原句宽松 —— 只会弹琴不会唱歌的人也会让 P ∨ Q 为真，但原句对他不成立。',
            },
            {
              id: 'c',
              label: (
                <>
                  <Math>P → Q</Math>
                </>
              ),
              correct: false,
              why: '不对。→ 讲的是条件：会弹琴就会唱歌。原句没有这层因果，它只是在说两件事同时成立。',
            },
          ]}
        />
      </Card>
    </div>
  )
}

/* ============================================================== ⑤ 换个场景 */

interface Sentence {
  id: string
  text: string
  p: string
  q: string
}

const SENTENCES: Sentence[] = [
  { id: 'rain', text: '如果下雨，我就带伞。', p: '下雨', q: '带伞' },
  { id: 'exam', text: '如果考试及格，妈妈就给我买手机。', p: '考试及格', q: '买手机' },
  { id: 'clock', text: '如果电池没电，闹钟就不响。', p: '电池没电', q: '闹钟不响' },
]

const IMP_ROWS = truthTable(IMP(VAR('P'), VAR('Q'))).rows
const LIE_ROW = IMP_ROWS.findIndex((r) => !r.value)

/** 把一行赋值翻译成人话：这一行世界里发生了什么、句子为什么是真或假 */
function rowStory(a: Env, s: Sentence): string {
  const p = a.P
  const q = a.Q
  if (p && !q) return `${s.p}发生了，可是「${s.q}」没发生 —— 说好的事情没做到，这句就是假的。`
  if (!p && q) return `${s.p}没发生，但「${s.q}」照样发生了 —— 承诺没被违反，句子为真。`
  if (!p && !q) return `${s.p}没发生，「${s.q}」也没发生 —— 前提不成立，句子不会被违反，为真。`
  return `${s.p}发生了，「${s.q}」也发生了 —— 说到做到，句子为真。`
}

function TransferStage({ ctx }: { ctx: StageCtx }) {
  const [sel, setSel] = useState(0)
  const [picked, setPicked] = useState<number | null>(null)

  const sentence = SENTENCES[sel]
  const correct = picked !== null && picked === LIE_ROW
  useSolveOnce(ctx, correct)

  const onRow = (i: number): void => {
    setPicked(i)
    const row = IMP_ROWS[i]
    ctx.say(
      row.value
        ? `这一行句子是真的：${rowStory(row.assignment, sentence)}`
        : `就是这一行：${rowStory(row.assignment, sentence)}`,
      row.value ? 'normal' : 'accept',
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <PlainSpeak>
        换一个场景。下面这句话是<b>承诺</b>，不是事实描述 —— 承诺什么时候才算被打破？
        在真值表里点一下你认为「这句话算说谎」的那一行。
      </PlainSpeak>

      <Segmented
        label="选一个承诺"
        value={sentence.id}
        onChange={(id) => {
          const i = SENTENCES.findIndex((s) => s.id === id)
          setSel(i)
          setPicked(null)
        }}
        options={SENTENCES.map((s) => ({ value: s.id, label: s.text.replace('。', '') }))}
      />

      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_17rem]">
        <Card className="p-3">
          <SectionTitle hint="点一行看看这一行的世界">真值表</SectionTitle>
          <TruthTableView
            vars={['P', 'Q']}
            rows={IMP_ROWS}
            highlightRows={picked === null ? [] : [picked]}
            onRowClick={onRow}
            columns={[{ label: exprToString(IMP(VAR('P'), VAR('Q'))), values: IMP_ROWS.map((r) => r.value), accent: true }]}
            caption={`P = ${sentence.p}，Q = ${sentence.q}。点任意一行把它选中。`}
          />
        </Card>

        <div className="flex flex-col gap-2">
          <Card className="p-3">
            <div className="flex flex-col gap-1 text-sm">
              <div className="flex justify-between gap-2">
                <span className="text-slate-500 dark:text-slate-400">P =</span>
                <span className="font-mono text-slate-700 dark:text-slate-200">{sentence.p}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-slate-500 dark:text-slate-400">Q =</span>
                <span className="font-mono text-slate-700 dark:text-slate-200">{sentence.q}</span>
              </div>
            </div>
          </Card>

          <Callout tone={correct ? 'ok' : picked === null ? 'info' : 'cur'} role="status">
            {picked === null
              ? '还没选。想一想：什么时候才能说「你答应我的事没做到」？'
              : `${rowStory(IMP_ROWS[picked].assignment, sentence)}${
                  correct ? ' 这一行就是整张表里唯一为假的地方。' : ''
                }`}
          </Callout>

          {correct ? (
            <Callout tone="ok" title="换多少句子都一样">
              不管把 P、Q 换成什么，表都是同一个形状：<b>只有「前提真、结果假」那一行是假</b>。
              这就是 <Math>P → Q</Math> 的全部含义。
            </Callout>
          ) : (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              提示：把「前提发生了、结果没发生」翻译成一个具体的日期，你就知道是哪一行了。
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Chip tone="dim" showGlyph={false}>
              {IMP_ROWS.filter((r) => r.value).length} 行为真
            </Chip>
            <Chip tone="bad">{IMP_ROWS.filter((r) => !r.value).length} 行为假</Chip>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ============================================================== 导出 */

const topic: Topic = {
  id: 'L1',
  title: '命题与联结词',
  moduleId: 'logic',
  oneLiner: '把「而且」「或者」「不是」变成能算的开关',
  outcome: '你能把一句大白话翻译成 ∧ ∨ ¬ → ↔ 的式子，也知道「如果……那么……」什么时候才算假。',
  prerequisites: [],
  bigIdea: '每一句话都能看成一个只有「真 / 假」两种状态的开关；联结词就是把这些开关按照固定规则搭起来，搭法定了，结果就定了。',
  misconceptions: [
    {
      wrong: '「如果 P 那么 Q」在 P 不成立时是假话',
      right: 'P 不成立时整句为真。它只在「P 真、Q 假」时为假 —— 前提都没发生，承诺自然没有被打破。',
    },
    {
      wrong: '「P 或者 Q」要求两个都成立',
      right: '「或者」是至少一个成立。两个都成立也行，只有两个都不成立时才为假（那是 ∧ 的样子）。',
    },
    {
      wrong: '「或者」表示恰好一个成立',
      right: '恰好一个成立是「异或」，不是逻辑里的 ∨。P、Q 都真时 ∨ 仍为真。',
    },
  ],
  formalDefinition: (
    <>
      <p>
        <b>命题：</b>能判断真假的陈述句。它的取值只有两个：真（T）或假（F）。
      </p>
      <p>
        <b>五个联结词（按优先级从紧到松）：</b>
      </p>
      <ul className="ml-4 list-disc font-mono">
        <li>¬P —— P 真时为假，P 假时为真</li>
        <li>P ∧ Q —— 两边都真才为真</li>
        <li>P ∨ Q —— 至少一边真就为真</li>
        <li>P → Q —— 只有 P 真、Q 假时为假</li>
        <li>P ↔ Q —— 两边取值相同为真</li>
      </ul>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        写法约定：¬ 只作用于紧挨着它的那个命题；∧ 比 ∨ 结合得紧；→ 最松，所以 P ∧ Q → R 读作 (P ∧ Q) → R。
      </p>
    </>
  ),
  glossary: [
    { term: '命题', plain: '一句能分清真假的话。「今天下雨」是命题，「快下雨了吧」不是。', formal: '取值为真或假的陈述句' },
    { term: '¬ 否定', plain: '「不是」。把整句话的真假翻个面。', formal: '¬P 在 P 假时为真' },
    { term: '∧ 合取', plain: '「而且」「又」。两件事都成立才算数。', formal: 'P ∧ Q 为真 ⟺ P、Q 都真' },
    { term: '∨ 析取', plain: '「或者」。至少一件成立就算数（两个都成立也算）。', formal: 'P ∨ Q 为真 ⟺ P、Q 至少一个真' },
    { term: '→ 蕴含', plain: '「如果……那么……」。只有「前面真、后面假」才是假。', formal: 'P → Q ⟺ ¬P ∨ Q' },
    { term: '↔ 等价', plain: '「当且仅当」。两句话同真同假、永远绑在一起。', formal: 'P ↔ Q 为真 ⟺ P、Q 取值相同' },
    { term: '前件 / 后件', plain: '「如果 A 那么 B」里，A 是前件（条件），B 是后件（结果）。', formal: 'P → Q 中 P 为前件，Q 为后件' },
    { term: '真值表', plain: '把所有开关组合和对应结果排成一张表 —— 一眼看完全部情况。' },
  ],
  stages: [
    {
      label: '① 看一看',
      short: '看',
      narration: '先不看符号。两个开关一盏灯，拨一拨看灯亮不亮。',
      requireSolve: false,
      hints: [
        '把每个开关都拨一次，注意灯是在哪一次变化的。',
        '切到「串联」，只合上一个开关试试；再切到「并联」，也只合上一个试试。两种接线下的差别就是重点。',
        '串联：两个开关都合上灯才亮。并联：任意一个合上灯就亮，只有两个都断开才灭。',
      ],
      render: (ctx) => <HookStage ctx={ctx} />,
    },
    {
      label: '② 玩一玩',
      short: '玩',
      narration: '两个开关控制两条电路，4 种组合都试一遍。',
      requireSolve: true,
      hints: [
        '两个开关各有「合上 / 断开」两种状态，搭配起来一共 4 种，每种都要摆出来一次。',
        '试完「都合上」之后，别忘了「只合上 P」「只合上 Q」和「两个都断开」这三种。',
        '4 种组合是：都断开、只合 P、只合 Q、都合上。试完之后你会看到：串联那一列只有一行是「真」，并联那一列只有一行是「假」。',
      ],
      render: (ctx) => <ExploreStage ctx={ctx} />,
    },
    {
      label: '③ 起个名',
      short: '名',
      narration: '你刚拨的开关，数学上有五个符号。先认一认。',
      requireSolve: true,
      hints: [
        '先看句子说的是「两件事都成立」「至少一件成立」还是「一件事被否定」。',
        '「又……又……」用 ∧；「或者」用 ∨；「没 / 不」用 ¬；「如果……那么……」用 →；「当且仅当」用 ↔。',
        '五句的答案依次是：∧、¬、∨、→、↔。',
      ],
      render: (ctx) => <NameStage ctx={ctx} />,
    },
    {
      label: '④ 练一练',
      short: '练',
      narration: '三道小题。蕴含那道最容易错，慢慢想。',
      requireSolve: true,
      hints: [
        '第一题的重点不是「有没有带伞」，而是「带伞这个承诺什么时候才生效」。',
        '蕴含只在一处为假：前提成立、结果没发生。前提没成立时，整句都算真。',
        '三题答案依次是：不算说谎（前提没发生）；至少有一个为真；P ∧ Q。',
      ],
      render: (ctx) => <PracticeStage ctx={ctx} />,
    },
    {
      label: '⑤ 换个场景',
      short: '变',
      narration: '换几句承诺，点出「算说谎」的那一行。',
      requireSolve: true,
      hints: [
        '先想清楚：什么样的一天，才能证明「说到没做到」。',
        '在表里找 P 为真、Q 为假的那一行 —— 前提发生了，结果没发生。',
        '就是第 3 行：P 真（前提发生了）、Q 假（结果没发生），这一行式子的取值是「假」。',
      ],
      render: (ctx) => <TransferStage ctx={ctx} />,
    },
  ],
}

export default topic
