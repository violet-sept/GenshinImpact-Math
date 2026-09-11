import { useEffect, useState } from 'react'

import { TruthTableView } from '@/primitives'
import {
  Callout,
  Card,
  Chip,
  Math as Fml,
  PlainSpeak,
  SectionTitle,
  Segmented,
  SwitchRow,
  cx,
} from '@/ui'
import { Quiz } from '@/ui/Quiz'
import { AND, NOT, OR, VAR, evalExpr, exprToString, truthTable, type Expr, type TruthRow } from '@/kernels/logic'
import { useSolveOnce, useTriedSet } from '../hooks'
import type { StageCtx, Topic } from '../types'

/* ============================================================== 常量 */

const AND_EXPR: Expr = AND(VAR('P'), VAR('Q'))
const NOT_R_EXPR: Expr = NOT(VAR('R'))
/** ② 里三位一体的那个式子：P 和 Q 都开，或者 R 关着 */
const EXPR: Expr = OR(AND_EXPR, NOT_R_EXPR)
const EXPR_TEXT = exprToString(EXPR)
const TABLE = truthTable(EXPR)
/** 「一步步拆开算」用到的中间列 */
const AND_COL = TABLE.rows.map((row) => evalExpr(AND_EXPR, row.assignment))
const NOT_R_COL = TABLE.rows.map((row) => evalExpr(NOT_R_EXPR, row.assignment))
/** 让灯亮的那些行 —— ② 里用户要把它们全找出来 */
const ON_ROWS = TABLE.rows.map((row, i) => (row.value ? i : -1)).filter((i) => i >= 0)

const AND_T = truthTable(AND(VAR('P'), VAR('Q')))
const OR_T = truthTable(OR(VAR('P'), VAR('Q')))
const NOT_T = truthTable(NOT(VAR('P')))

/** 报警器的式子：(温度过高 ∧ 烟雾超标) ∨ 手动按钮 */
const ALARM_EXPR: Expr = OR(AND(VAR('P'), VAR('Q')), VAR('R'))
const ALARM_TABLE = truthTable(ALARM_EXPR)
/** 「先算且、再算或」的另一种读法 —— 用它当反面对照 */
const MISREAD_EXPR: Expr = AND(VAR('P'), OR(VAR('Q'), VAR('R')))
const MISREAD_COL = ALARM_TABLE.rows.map((row) => evalExpr(MISREAD_EXPR, row.assignment))

const WIRE_ON = 'var(--color-cur-500)'
const WIRE_OFF = 'var(--color-dim-300)'
const wire = (live: boolean): string => (live ? WIRE_ON : WIRE_OFF)

const rowIndexOf = (rows: TruthRow[], env: Record<string, boolean>): number =>
  rows.findIndex((row) => Object.keys(env).every((k) => row.assignment[k] === env[k]))

const keyOf = (env: Record<string, boolean>): string =>
  Object.keys(env)
    .sort()
    .map((k) => (env[k] ? '1' : '0'))
    .join('')

const triple = (row: TruthRow): string =>
  `P=${row.assignment.P ? '真' : '假'} Q=${row.assignment.Q ? '真' : '假'} R=${row.assignment.R ? '真' : '假'}`

/* ============================================================== 电路小零件 */

function Switch({ x, y, closed, label }: { x: number; y: number; closed: boolean; label: string }) {
  return (
    <g>
      <line x1={x} y1={y} x2={x + 46} y2={y} stroke="transparent" strokeWidth={22} />
      <circle cx={x} cy={y} r={4} fill={closed ? WIRE_ON : 'var(--color-dim-500)'} />
      <circle cx={x + 46} cy={y} r={4} fill={closed ? WIRE_ON : 'var(--color-dim-500)'} />
      <line
        x1={x}
        y1={y}
        x2={closed ? x + 46 : x + 38}
        y2={closed ? y : y - 22}
        stroke={closed ? WIRE_ON : 'var(--color-dim-500)'}
        strokeWidth={3.5}
        strokeLinecap="round"
        style={{ transition: 'all var(--dl-dur) var(--ease-dl)' }}
      />
      <text x={x + 23} y={y - 15} textAnchor="middle" className="dl-svg-text" fill="var(--color-slate-600)">
        {label}
      </text>
    </g>
  )
}

function Bulb({ x, y, lit }: { x: number; y: number; lit: boolean }) {
  return (
    <g transform={`translate(${x},${y})`}>
      {lit ? <circle r={24} fill="var(--color-cur-500)" opacity={0.18} className="animate-pulse" /> : null}
      <circle
        r={17}
        fill={lit ? 'var(--color-cur-100)' : 'var(--color-slate-100)'}
        stroke={lit ? WIRE_ON : WIRE_OFF}
        strokeWidth={2.5}
        className="dl-transition"
      />
      <text textAnchor="middle" dy="0.35em" className="dl-svg-text" fill={lit ? 'var(--color-cur-700)' : 'var(--color-dim-600)'}>
        {lit ? '亮' : '灭'}
      </text>
    </g>
  )
}

/* ============================================================== ① 看一看 */

type Mode = 'series' | 'parallel'

/** 两个开关的串 / 并联电路 */
function HookCircuit({ p, q, mode, lit }: { p: boolean; q: boolean; mode: Mode; lit: boolean }) {
  const series = mode === 'series'
  return (
    <svg
      viewBox="0 0 300 150"
      className="h-auto w-full"
      role="img"
      aria-label={`${series ? '串联' : '并联'}电路：P ${p ? '合上' : '断开'}、Q ${q ? '合上' : '断开'}，灯泡${lit ? '亮' : '不亮'}`}
    >
      <circle cx={22} cy={75} r={8} fill="none" stroke="var(--color-dim-500)" strokeWidth={2} />
      <text x={22} y={104} textAnchor="middle" className="dl-svg-text" fill="var(--color-dim-600)">
        电源
      </text>
      <line x1={30} y1={75} x2={70} y2={75} stroke={wire(true)} strokeWidth={3} strokeLinecap="round" />

      {series ? (
        <>
          <line x1={70} y1={75} x2={150} y2={75} stroke={wire(p)} strokeWidth={3} strokeLinecap="round" />
          <Switch x={70} y={75} closed={p} label="P" />
          <Switch x={150} y={75} closed={q} label="Q" />
          <line x1={196} y1={75} x2={222} y2={75} stroke={wire(p && q)} strokeWidth={3} strokeLinecap="round" />
        </>
      ) : (
        <>
          <path d="M70 75 V40 H96" fill="none" stroke={wire(true)} strokeWidth={3} strokeLinecap="round" />
          <Switch x={96} y={40} closed={p} label="P" />
          <path d="M142 40 H214 V75" fill="none" stroke={wire(p)} strokeWidth={3} strokeLinecap="round" />
          <path d="M70 75 V110 H96" fill="none" stroke={wire(true)} strokeWidth={3} strokeLinecap="round" />
          <Switch x={96} y={110} closed={q} label="Q" />
          <path d="M142 110 H214 V75" fill="none" stroke={wire(q)} strokeWidth={3} strokeLinecap="round" />
          <line x1={214} y1={75} x2={222} y2={75} stroke={wire(p || q)} strokeWidth={3} strokeLinecap="round" />
        </>
      )}

      <Bulb x={244} y={75} lit={lit} />
    </svg>
  )
}

function HookStage({ ctx }: { ctx: StageCtx }) {
  const [p, setP] = useState(true)
  const [q, setQ] = useState(false)
  const [mode, setMode] = useState<Mode>('series')
  const { tried, markTried } = useTriedSet()

  const lit = mode === 'series' ? p && q : p || q
  const rowIndex = rowIndexOf(AND_T.rows, { P: p, Q: q })
  const combos = [...tried].filter((k) => k.startsWith('c:'))
  const modes = [...tried].filter((k) => k.startsWith('m:'))
  const enoughCombos = combos.length >= 4
  const enoughModes = modes.length >= 2

  // 一开始就是串联，所以先把它记上（否则「两种接法都试过」永远差一种）
  useEffect(() => {
    markTried('m:series')
  }, [markTried])

  const flip = (which: 'P' | 'Q', next: boolean): void => {
    const np = which === 'P' ? next : p
    const nq = which === 'Q' ? next : q
    if (which === 'P') setP(next)
    else setQ(next)
    const key = `c:${keyOf({ P: np, Q: nq })}`
    markTried(key)
    const nlit = mode === 'series' ? np && nq : np || nq
    ctx.say(
      mode === 'series'
        ? `串联：P 和 Q 都合上才通，现在灯${nlit ? '亮' : '不亮'}。`
        : `并联：P 和 Q 任意一个合上就通，现在灯${nlit ? '亮' : '不亮'}。`,
      nlit ? 'accept' : 'normal',
    )
    ctx.announce(`${which} 打到${next ? '合上' : '断开'}。${mode === 'series' ? '串联' : '并联'}时灯${nlit ? '亮' : '不亮'}。`)
  }

  const changeMode = (m: Mode): void => {
    setMode(m)
    markTried(`m:${m}`)
    ctx.say(m === 'series' ? '串联：两个开关都得合上。' : '并联：任意一个合上就行。', 'normal')
  }

  useSolveOnce(ctx, enoughCombos && enoughModes)

  return (
    <div className="flex flex-col gap-3">
      <PlainSpeak>
        电流从电源出发，要能一路走到灯泡，灯才亮。<b>串联</b>是两个开关串在一根线上 ——
        <b>两个都合上才通</b>；<b>并联</b>是各走一条支路 —— <b>任意一个合上就通</b>。
        把两个开关的四种组合都试一遍，再换成另一种接法试一遍。
      </PlainSpeak>

      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_15rem]">
        <div className="flex flex-col gap-2">
          <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/40">
            <HookCircuit p={p} q={q} mode={mode} lit={lit} />
          </div>
          <Segmented<Mode>
            label="接法"
            value={mode}
            onChange={changeMode}
            options={[
              { value: 'series', label: '串联（都合上才亮）' },
              { value: 'parallel', label: '并联（一个合上就亮）' },
            ]}
          />
        </div>

        <div className="flex flex-col gap-3">
          <SwitchRow label="开关 P" checked={p} onChange={(v) => flip('P', v)} hint="点一下切换合上 / 断开" />
          <SwitchRow label="开关 Q" checked={q} onChange={(v) => flip('Q', v)} hint="点一下切换合上 / 断开" />

          <Callout tone={lit ? 'ok' : 'info'} role="status">
            现在灯 <b>{lit ? '亮' : '灭'}</b>。
          </Callout>

          <Card className="p-3">
            <SectionTitle hint="四种组合都要试到">试过哪些</SectionTitle>
            <div className="flex flex-wrap gap-1.5">
              {[
                { P: false, Q: false },
                { P: false, Q: true },
                { P: true, Q: false },
                { P: true, Q: true },
              ].map((c) => {
                const done = tried.has(`c:${keyOf(c)}`)
                return (
                  <Chip key={keyOf(c)} tone={done ? 'ok' : 'dim'} showGlyph={false}>
                    {c.P ? 'P合' : 'P断'}·{c.Q ? 'Q合' : 'Q断'}
                  </Chip>
                )
              })}
            </div>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              四种组合试到 {combos.length}/4；{modes.length >= 2 ? '两种接法都试过了' : '另一种接法还没试'}
            </p>
          </Card>
        </div>
      </div>

      <Card>
        <SectionTitle hint="亮 = 真，灭 = 假">这一种接法的「开关组合 → 灯亮不亮」</SectionTitle>
        <TruthTableView
          vars={AND_T.vars}
          rows={AND_T.rows}
          highlightRows={[rowIndex]}
          columns={[
            {
              label: mode === 'series' ? 'P ∧ Q（串联）' : 'P ∨ Q（并联）',
              values: (mode === 'series' ? AND_T : OR_T).rows.map((x) => x.value),
              accent: true,
            },
          ]}
          caption="高亮的那一行，就是现在两个开关的状态。"
        />
      </Card>
    </div>
  )
}

/* ============================================================== ② 玩一玩 */

function GateCircuit({ p, q, r, lit }: { p: boolean; q: boolean; r: boolean; lit: boolean }) {
  const andOut = p && q
  const notOut = !r
  return (
    <svg
      viewBox="0 0 360 240"
      className="h-auto w-full"
      role="img"
      aria-label={`逻辑门电路：P ${p ? '真' : '假'}、Q ${q ? '真' : '假'}、R ${r ? '真' : '假'}，灯泡${lit ? '亮' : '不亮'}`}
    >
      {/* 三个输入 */}
      {[
        { name: 'P', y: 60, v: p },
        { name: 'Q', y: 84, v: q },
        { name: 'R', y: 196, v: r },
      ].map((pin) => (
        <g key={pin.name}>
          <rect
            x={4}
            y={pin.y - 12}
            width={28}
            height={24}
            rx={6}
            fill={pin.v ? 'var(--color-a-500)' : 'var(--color-slate-200)'}
            stroke={pin.v ? 'var(--color-a-600)' : 'var(--color-dim-300)'}
            className="dl-transition"
          />
          <text x={18} y={pin.y + 4} textAnchor="middle" className="dl-svg-text" fill={pin.v ? 'white' : 'var(--color-slate-500)'}>
            {pin.name}
          </text>
        </g>
      ))}

      {/* 进线与门 */}
      <path d="M32 60 H110" fill="none" stroke={wire(p)} strokeWidth={3} strokeLinecap="round" className="dl-transition" />
      <path d="M32 84 H110" fill="none" stroke={wire(q)} strokeWidth={3} strokeLinecap="round" className="dl-transition" />
      <path d="M32 196 H110" fill="none" stroke={wire(r)} strokeWidth={3} strokeLinecap="round" className="dl-transition" />

      {/* 与门：D 形 */}
      <path
        d="M110 46 H126 A26 26 0 0 1 126 98 H110 Z"
        fill="var(--color-slate-100)"
        stroke="var(--color-slate-600)"
        strokeWidth={2}
      />
      <text x={124} y={38} textAnchor="middle" className="dl-svg-text" fill="var(--color-slate-600)">
        与门 AND
      </text>

      {/* 非门：三角形 + 小圆 */}
      <path d="M110 176 L110 216 L144 196 Z" fill="var(--color-slate-100)" stroke="var(--color-slate-600)" strokeWidth={2} />
      <circle cx={148} cy={196} r={4} fill="var(--color-slate-100)" stroke="var(--color-slate-600)" strokeWidth={2} />
      <text x={124} y={168} textAnchor="middle" className="dl-svg-text" fill="var(--color-slate-600)">
        非门 NOT
      </text>

      {/* 与门输出 → 或门上入口 */}
      <path d="M152 72 H226" fill="none" stroke={wire(andOut)} strokeWidth={3} strokeLinecap="round" className="dl-transition" />

      {/* 非门输出 → 绕到或门下入口 */}
      <path
        d="M152 196 H186 V108 H226"
        fill="none"
        stroke={wire(notOut)}
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="dl-transition"
      />

      {/* 或门：弧形 */}
      <path
        d="M226 58 Q260 58 278 84 Q260 110 226 110 Q240 84 226 58 Z"
        fill="var(--color-slate-100)"
        stroke="var(--color-slate-600)"
        strokeWidth={2}
      />
      <text x={252} y={50} textAnchor="middle" className="dl-svg-text" fill="var(--color-slate-600)">
        或门 OR
      </text>

      <path d="M278 84 H310" fill="none" stroke={wire(lit)} strokeWidth={3} strokeLinecap="round" className="dl-transition" />
      <Bulb x={328} y={84} lit={lit} />
    </svg>
  )
}

function ExploreStage({ ctx }: { ctx: StageCtx }) {
  const [p, setP] = useState(false)
  const [q, setQ] = useState(false)
  const [r, setR] = useState(false)
  const { tried, markTried } = useTriedSet()

  const env = { P: p, Q: q, R: r }
  const lit = evalExpr(EXPR, env)
  const rowIndex = rowIndexOf(TABLE.rows, env)
  const foundOn = ON_ROWS.filter((i) => tried.has(keyOf(TABLE.rows[i].assignment)))

  const setVar = (name: 'P' | 'Q' | 'R', next: boolean): void => {
    const nenv = { ...env, [name]: next }
    if (name === 'P') setP(next)
    else if (name === 'Q') setQ(next)
    else setR(next)
    markTried(keyOf(nenv))
    const nlit = evalExpr(EXPR, nenv)
    ctx.say(`${name} 打到${next ? '真' : '假'}，灯${nlit ? '亮了' : '灭了'}。`, nlit ? 'accept' : 'normal')
    ctx.announce(`${name} 现在是${next ? '真' : '假'}，表达式取值${nlit ? '真' : '假'}，灯${nlit ? '亮' : '不亮'}。`)
  }

  useSolveOnce(ctx, foundOn.length >= ON_ROWS.length)

  return (
    <div className="flex flex-col gap-3">
      <PlainSpeak>
        这就是个纯逻辑电路，式子已经写在下面了：<b>P 和 Q 都为真，或者 R 为假，灯就亮</b>。
        拨动任何开关，<b>导线颜色、真值表高亮行、表达式结果会同时变化</b>。
        任务：把所有<b>能让灯亮</b>的开关组合都找出来（一共 {ON_ROWS.length} 种）。
      </PlainSpeak>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_17rem]">
        <div className="flex flex-col gap-2">
          <div className="rounded-xl bg-slate-50 p-2 dark:bg-slate-800/40">
            <GateCircuit p={p} q={q} r={r} lit={lit} />
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-slate-500 dark:text-slate-400">这个电路说的就是：</span>
            <Fml>{EXPR_TEXT}</Fml>
          </div>
        </div>

        <aside className="flex flex-col gap-3">
          <Card className="p-3">
            <SectionTitle hint="点一下切换真 / 假">三个开关</SectionTitle>
            <div className="flex flex-col gap-3">
              <SwitchRow label="P（开关一）" checked={p} onChange={(v) => setVar('P', v)} />
              <SwitchRow label="Q（开关二）" checked={q} onChange={(v) => setVar('Q', v)} />
              <SwitchRow label="R（开关三）" checked={r} onChange={(v) => setVar('R', v)} />
            </div>
          </Card>

          <Callout tone={lit ? 'ok' : 'info'} role="status">
            现在 {triple(TABLE.rows[rowIndex])}，表达式 = <b>{lit ? '真' : '假'}</b>，灯 <b>{lit ? '亮' : '灭'}</b>。
          </Callout>

          <Card className="p-3">
            <SectionTitle hint={`共 ${ON_ROWS.length} 种`}>找到的「灯亮」组合</SectionTitle>
            {foundOn.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">还没找到。拨拨开关，看灯什么时候亮。</p>
            ) : (
              <ul className="flex flex-col gap-1 font-mono text-xs">
                {foundOn.map((i) => (
                  <li key={i} className="text-ok-700 dark:text-ok-500">
                    ✓ {triple(TABLE.rows[i])}
                  </li>
                ))}
              </ul>
            )}
            <p className={cx('mt-2 text-xs font-medium', foundOn.length >= ON_ROWS.length ? 'text-ok-700 dark:text-ok-500' : 'text-slate-500 dark:text-slate-400')}>
              已找到 {foundOn.length} / {ON_ROWS.length}
            </p>
          </Card>
        </aside>
      </div>

      <Card>
        <SectionTitle hint="高亮行跟着开关走">真值表：所有组合一次看全</SectionTitle>
        <TruthTableView
          vars={TABLE.vars}
          rows={TABLE.rows}
          highlightRows={[rowIndex]}
          columns={[
            { label: 'P ∧ Q', values: AND_COL },
            { label: '¬R', values: NOT_R_COL },
            { label: EXPR_TEXT, values: TABLE.rows.map((row) => row.value), accent: true },
          ]}
          caption={`中间两列是拆开算的过程：${EXPR_TEXT} 就是「先算 P ∧ Q，再算 ¬R，最后取或」。高亮那一行是现在的开关状态。`}
        />
      </Card>
    </div>
  )
}

/* ============================================================== ③ 起个名 */

type GateName = 'AND' | 'OR' | 'NOT'

interface GateQuestion {
  id: string
  scene: string
  answer: GateName
  why: string
}

const GATE_QUESTIONS: GateQuestion[] = [
  {
    id: 'q1',
    scene: '两个开关串在一根线上：两个都合上，灯才亮。',
    answer: 'AND',
    why: '这是与门：两件事都成立，结果才成立，记作 P ∧ Q。串联电路天然就是与门。',
  },
  {
    id: 'q2',
    scene: '两个开关各走一条支路：任意合上一个，灯就亮。',
    answer: 'OR',
    why: '这是或门：只要有一件成立，结果就成立，记作 P ∨ Q。并联电路天然就是或门。',
  },
  {
    id: 'q3',
    scene: '开关合上时灯反而灭，开关断开时灯反而亮。',
    answer: 'NOT',
    why: '这是非门：把结果整个翻过来，记作 ¬P。它只有一个输入。',
  },
]

const GATE_LABEL: Record<GateName, string> = { AND: '与门 ∧', OR: '或门 ∨', NOT: '非门 ¬' }

function NameStage({ ctx }: { ctx: StageCtx }) {
  const [answers, setAnswers] = useState<Record<string, GateName>>({})
  const allRight = GATE_QUESTIONS.every((q) => answers[q.id] === q.answer)
  useSolveOnce(ctx, allRight)

  return (
    <div className="flex flex-col gap-4">
      <PlainSpeak>
        你刚才玩的那套东西有三个名字，说的是同一件事：
        <b>表达式</b>（用 ∧ ∨ ¬ 写下来）、<b>电路</b>（用门搭出来）、<b>真值表</b>（把所有组合排成一张表）。
        这种「真 / 假 之间的计算」就叫<b>布尔代数</b>，搭出来的零件叫<b>逻辑门</b>。
      </PlainSpeak>

      <Card>
        <SectionTitle hint="点一下选门，选错会说清为什么">这是哪个门？</SectionTitle>
        <ul className="flex flex-col gap-3">
          {GATE_QUESTIONS.map((q) => {
            const picked = answers[q.id]
            const right = picked === q.answer
            return (
              <li key={q.id} className="flex flex-col gap-2">
                <p className="text-sm text-slate-700 dark:text-slate-200">{q.scene}</p>
                <div className="flex flex-wrap items-center gap-2">
                  {(['AND', 'OR', 'NOT'] as const).map((g) => {
                    const active = picked === g
                    const good = active && right
                    const bad = active && !right
                    return (
                      <button
                        key={g}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setAnswers((a) => ({ ...a, [q.id]: g }))}
                        className={cx(
                          'min-h-11 rounded-xl border px-4 text-sm font-medium dl-transition',
                          good
                            ? 'border-ok-500 bg-ok-50 text-ok-700 dark:bg-ok-500/15 dark:text-ok-500'
                            : bad
                              ? 'border-bad-500 bg-bad-50 text-bad-700 dark:bg-bad-500/15 dark:text-bad-500'
                              : 'border-slate-300 bg-white text-slate-700 hover:border-a-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200',
                        )}
                      >
                        {GATE_LABEL[g]}
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
        <SectionTitle hint="三个门，三张小真值表">三个门各自的规矩</SectionTitle>
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { title: '与门 ∧（两个都真才真）', vars: AND_T.vars, rows: AND_T.rows },
            { title: '或门 ∨（有一个真就真）', vars: OR_T.vars, rows: OR_T.rows },
            { title: '非门 ¬（真变假、假变真）', vars: NOT_T.vars, rows: NOT_T.rows },
          ].map((g) => (
            <div key={g.title}>
              <p className="mb-1 text-xs font-semibold text-slate-700 dark:text-slate-200">{g.title}</p>
              <TruthTableView
                vars={g.vars}
                rows={g.rows}
                columns={[{ label: g.title.split('（')[0], values: g.rows.map((x) => x.value), accent: true }]}
              />
            </div>
          ))}
        </div>
        <p className="mt-3 text-sm leading-relaxed text-slate-700 dark:text-slate-200">
          ② 里那个电路写成式子就是 <Fml>{EXPR_TEXT}</Fml>：先让 P 和 Q 过与门，再让 R 过非门，最后两路进或门。
          你拨开关时，<b>电路的导线颜色、真值表的高亮行、表达式的取值</b>是同一件事的三种画法 ——
          这就是「三位一体」。
        </p>
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
      <p className="text-sm text-slate-600 dark:text-slate-300">三道题，随便选。选错会说清为什么错，可以马上再来。</p>

      <Card>
        <Quiz
          question={
            <>
              P = 真，Q = 假。那么 <b>P ∧ Q</b> 和 <b>P ∨ Q</b> 分别是真还是假？
            </>
          }
          resetKey="b1p1"
          onSolved={() => setSolvedCount((c) => c + 1)}
          choices={[
            {
              id: 'a',
              label: 'P ∧ Q 是假，P ∨ Q 是真',
              correct: true,
              why: '对。与门要求两个都为真，Q 是假所以与门出假；或门只要有一个真就出真，P 是真所以或门出真。',
            },
            {
              id: 'b',
              label: '两个都是真',
              correct: false,
              why: '不对。与门比或门严格得多：两个都为真才出真。Q 是假，所以与门出假。',
            },
            {
              id: 'c',
              label: '两个都是假',
              correct: false,
              why: '不对。或门很宽松：P 是真就足够了，不必两个都真。',
            },
            {
              id: 'd',
              label: 'P ∧ Q 是真，P ∨ Q 是假',
              correct: false,
              why: '不对，正好搞反了 —— 与门更严（要求更多），或门更松（要求更少）。',
            },
          ]}
        />
      </Card>

      <Card>
        <Quiz
          question={
            <>
              不管 P 是真还是假，<b>¬P ∨ P</b> 总是……
            </>
          }
          resetKey="b1p2"
          onSolved={() => setSolvedCount((c) => c + 1)}
          choices={[
            {
              id: 'a',
              label: '总是真',
              correct: true,
              why: '对。非门把 P 反过来，所以 P 和 ¬P 里必定有一个是真的，或门收下它 —— 结果永远为真。这条规律叫「排中律」。',
            },
            {
              id: 'b',
              label: '总是假',
              correct: false,
              why: '不对。要让它为假，得让 P 和 ¬P 同时为假 —— 这不可能，因为它们永远相反。',
            },
            {
              id: 'c',
              label: '要看 P 取什么值',
              correct: false,
              why: '不对。P 取真，¬P ∨ P 里有 P 为真；P 取假，¬P 为真。两种情况下至少有一个为真，所以不需要看。',
            },
          ]}
        />
      </Card>

      <Card>
        <Quiz
          question={
            <>
              <b>¬(P ∧ Q)</b> 用电路的话该怎么说？
            </>
          }
          resetKey="b1p3"
          onSolved={() => setSolvedCount((c) => c + 1)}
          choices={[
            {
              id: 'a',
              label: '不是「两个都合上」—— 也就是至少有一个没合上',
              correct: true,
              why: '对。德摩根律说：¬(P ∧ Q) = ¬P ∨ ¬Q。「不是两个都成立」就等于「P 不成立，或者 Q 不成立」。',
            },
            {
              id: 'b',
              label: '两个都断开',
              correct: false,
              why: '不对。两个都断开是 ¬P ∧ ¬Q，比 ¬(P ∧ Q) 严格得多：P 合上、Q 断开时，「不是两个都合上」已经成立，但不是「两个都断开」。',
            },
            {
              id: 'c',
              label: '至少有一个合上',
              correct: false,
              why: '不对。那是 P ∨ Q，一个都不合上时为假；而 ¬(P ∧ Q) 在一个都不合上时为真。它们正好相反。',
            },
          ]}
        />
      </Card>
    </div>
  )
}

/* ============================================================== ⑤ 换个场景 */

function TransferStage({ ctx }: { ctx: StageCtx }) {
  const [quizDone, setQuizDone] = useState(false)
  const [clicked, setClicked] = useState<number | null>(null)

  const TARGET_ROW = 1 // P=假、Q=假、R=真 —— 只有手动按钮被按下
  const ok = quizDone && clicked === TARGET_ROW

  useSolveOnce(ctx, ok)

  return (
    <div className="flex flex-col gap-4">
      <PlainSpeak>
        换个场景。一个报警器：「温度过高<b>且</b>烟雾浓度超标，<b>或者</b>手动按下按钮，就报警」。
        先把这句话翻译成布尔表达式，再用真值表检查它是不是真的符合这句话。
      </PlainSpeak>

      <Card>
        <SectionTitle hint="先把三个开关对上号">三个开关的意思</SectionTitle>
        <ul className="flex flex-col gap-1 text-sm text-slate-700 dark:text-slate-200">
          <li>
            · <b>P</b> = 温度过高
          </li>
          <li>
            · <b>Q</b> = 烟雾浓度超标
          </li>
          <li>
            · <b>R</b> = 手动按下按钮
          </li>
        </ul>
      </Card>

      <Card>
        <Quiz
          question={<>这句话翻译成布尔表达式，应该是哪一个？</>}
          resetKey="b1t1"
          onSolved={() => setQuizDone(true)}
          choices={[
            {
              id: 'a',
              label: '(P ∧ Q) ∨ R',
              correct: true,
              why: '对。「温度过高且烟雾超标」是一整块，它「或者」手动按钮 —— 所以先把 P ∧ Q 用括号括起来，再和 R 取或。',
            },
            {
              id: 'b',
              label: 'P ∧ (Q ∨ R)',
              correct: false,
              why: '不对。这变成了「温度必须过高，而且（烟雾超标或手动按钮）」。照这样，光按按钮、温度不高时它不报警 —— 可说明书说按下按钮就该报警。',
            },
            {
              id: 'c',
              label: '(P ∨ Q) ∧ R',
              correct: false,
              why: '不对。这要求必须按下按钮才可能报警，可温度过高加烟雾超标本来就该自动报警。这里的「且」和「或」放反了。',
            },
            {
              id: 'd',
              label: 'P ∧ Q ∧ R',
              correct: false,
              why: '不对。这要求三件事同时成立才报警：温度不高时按按钮也不报警，太严了。',
            },
          ]}
        />
      </Card>

      {quizDone ? (
        <Card>
          <SectionTitle hint="点一行看看">用真值表验证一下</SectionTitle>
          <PlainSpeak>
            下面这张表里，<b>报警</b>那一列就是 (P ∧ Q) ∨ R。请点出这样一行：
            <b>温度不高、烟雾也没超标，只按下了手动按钮</b>。看看两列的差别。
          </PlainSpeak>
          <div className="mt-3">
            <TruthTableView
              vars={ALARM_TABLE.vars}
              rows={ALARM_TABLE.rows}
              highlightRows={clicked === null ? [] : [clicked]}
              columns={[
                { label: '报警 (P ∧ Q) ∨ R', values: ALARM_TABLE.rows.map((row) => row.value), accent: true },
                { label: '另一种读法 P ∧ (Q ∨ R)', values: MISREAD_COL },
              ]}
              onRowClick={(i) => {
                setClicked(i)
                const isTarget = i === TARGET_ROW
                const a = ALARM_TABLE.rows[i].value
                const b = MISREAD_COL[i]
                ctx.say(
                  isTarget
                    ? '就是这一行：只按了按钮，报警为真，另一种读法却是假。'
                    : `这一行：报警 = ${a ? '真' : '假'}，另一种读法 = ${b ? '真' : '假'}。`,
                  isTarget ? 'accept' : 'normal',
                )
                ctx.announce(`第 ${i + 1} 行，报警取值${a ? '真' : '假'}。`)
              }}
            />
          </div>

          {clicked === null ? (
            <Callout tone="cur">还没点。慢慢找那一行。</Callout>
          ) : clicked === TARGET_ROW ? (
            <Callout tone="ok" title="找到关键的那一行了">
              这一行 P、Q 都是假，只有 R 是真 —— 温度不高、烟雾也没超标，只是有人按了按钮。
              正确的式子在这里给出<b>真</b>（该报警），而「P ∧ (Q ∨ R)」给出<b>假</b>（不报警）。
              差别就出在括号上：报警器的说法是「或者按钮」，所以「按下按钮」这件事单独就能触发报警。
            </Callout>
          ) : (
            <Callout tone="bad">
              这一行还不对。要点在「只按了按钮、温度和烟雾都没事」这一种情况 ——
              也就是 <b>P = 假、Q = 假、R = 真</b> 的那一行。
            </Callout>
          )}
        </Card>
      ) : null}
    </div>
  )
}

/* ============================================================== 导出 */

const topic: Topic = {
  id: 'B1',
  title: '布尔代数与逻辑门',
  moduleId: 'boolean',
  oneLiner: '表达式、电路、真值表 —— 三位一体',
  outcome: '你能把一句话写成布尔表达式，看着逻辑门电路说出它在算什么，并用真值表把它验一遍。',
  prerequisites: ['L1', 'L2'],
  bigIdea: '「真 / 假」也能像数字一样计算。同一件事有三种写法 —— 表达式、电路图、真值表 —— 改一处，另外两处跟着变。',
  misconceptions: [
    {
      wrong: 'P ∧ Q 和 P ∨ Q 差不多，只是符号不同',
      right: '与门要求两个都真，或门只要一个真。P 真 Q 假时，与门出假、或门出真，结果正好相反。',
    },
    {
      wrong: '¬(P ∧ Q) 就是 ¬P ∧ ¬Q',
      right: '德摩根律告诉我们：¬(P ∧ Q) = ¬P ∨ ¬Q。否定一个「并且」，要把否定分给两边并把「并且」换成「或者」。',
    },
    {
      wrong: '画得不一样的两个电路，功能一定不同',
      right: '电路的画法可以不同，只要真值表一样，它们就是同一个逻辑功能。等价化简正是在利用这一点。',
    },
  ],
  formalDefinition: (
    <>
      <p>
        <b>布尔代数</b>
        <span className="font-mono"> 的取值只有真（1）和假（0），基本运算有三个：</span>
      </p>
      <ul className="ml-4 list-disc text-sm">
        <li>
          <span className="font-mono">P ∧ Q</span>：两个都真才为真（与门）
        </li>
        <li>
          <span className="font-mono">P ∨ Q</span>：有一个真就为真（或门）
        </li>
        <li>
          <span className="font-mono">¬P</span>：真变假、假变真（非门）
        </li>
      </ul>
      <p>
        <b>真值表：</b>
        <span className="font-mono">把每个变元的所有真假组合逐行列出，并写上表达式的取值</span>
      </p>
      <p>
        <b>德摩根律：</b>
        <span className="font-mono">¬(P ∧ Q) = ¬P ∨ ¬Q，¬(P ∨ Q) = ¬P ∧ ¬Q</span>
      </p>
    </>
  ),
  glossary: [
    { term: '布尔代数', plain: '只算「真 / 假」的代数，运算只有与、或、非三种。' },
    { term: '逻辑门', plain: '电路里能实现与、或、非的小零件。' },
    { term: '与门 ∧', plain: '两个输入都真，输出才真。就像两个开关串联。', formal: 'P ∧ Q' },
    { term: '或门 ∨', plain: '只要有一个输入真，输出就真。就像两个开关并联。', formal: 'P ∨ Q' },
    { term: '非门 ¬', plain: '把输入反过来：真变假、假变真。它只有一个输入。', formal: '¬P' },
    { term: '真值表', plain: '把所有开关组合和结果排成的一张表。' },
    { term: '表达式', plain: '用 ∧ ∨ ¬ 和字母写下来的那句话，比如 (P ∧ Q) ∨ ¬R。' },
  ],
  stages: [
    {
      label: '① 看一看',
      short: '看',
      narration: '两个开关串联、并联，灯什么时候亮？',
      requireSolve: true,
      hints: [
        '把两个开关的四种组合都拨一遍，再看灯什么时候亮。',
        '串联要两个都合上；并联只要一个合上。把两种接法都试一遍。',
        '四种组合都试过，并且把接法从串联切到并联（或反过来）各试一遍，这一步就完成了。',
      ],
      render: (ctx) => <HookStage ctx={ctx} />,
    },
    {
      label: '② 玩一玩',
      short: '玩',
      narration: '拨开关，电路、真值表、表达式同时跟着变',
      requireSolve: true,
      hints: [
        '先看表达式 (P ∧ Q) ∨ ¬R：它说「P 和 Q 都为真，或者 R 为假」。',
        '一个组合一个组合地试：8 种组合里只有 5 种能让灯亮。',
        '让灯亮的 5 种是：P假Q假R假、P假Q真R假、P真Q假R假、P真Q真R假、P真Q真R真（也就是只要 R 为假就亮，R 为真时还得 P、Q 都为真）。',
      ],
      render: (ctx) => <ExploreStage ctx={ctx} />,
    },
    {
      label: '③ 起个名',
      short: '名',
      narration: '三个门，三种规矩，一张表就能说清',
      requireSolve: true,
      hints: [
        '串联就是「都成立」，并联就是「有一个成立」，反着来就是「非」。',
        '与门看「两个都真」，或门看「有一个真」，非门只管「反过来」。',
        '三问答案依次是：与门 ∧、或门 ∨、非门 ¬。',
      ],
      render: (ctx) => <NameStage ctx={ctx} />,
    },
    {
      label: '④ 练一练',
      short: '练',
      narration: '三道题，选错会说明为什么错',
      requireSolve: true,
      hints: [
        '拿不准就代进去算：把 P、Q 换成真或假，一步步算。',
        '记住两句话：与门要两个都真，或门有一个真就够。',
        '三题答案依次是：P ∧ Q 假、P ∨ Q 真；¬P ∨ P 总是真；¬(P ∧ Q) = ¬P ∨ ¬Q。',
      ],
      render: (ctx) => <PracticeStage ctx={ctx} />,
    },
    {
      label: '⑤ 换个场景',
      short: '变',
      narration: '把一句大白话翻译成布尔表达式',
      requireSolve: true,
      hints: [
        '先找句子里的「且」和「或者」，看看谁管着谁。',
        '「温度过高且烟雾超标」是一整块，它和「手动按钮」之间是「或者」。',
        '正确答案是 (P ∧ Q) ∨ R。然后在真值表里点出 P 假、Q 假、R 真 那一行 —— 那一行上「报警」为真，而错误读法 P ∧ (Q ∨ R) 为假。',
      ],
      render: (ctx) => <TransferStage ctx={ctx} />,
    },
  ],
}

export default topic
