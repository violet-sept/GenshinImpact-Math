import { useMemo, useState } from 'react'

import { COUNT_MODELS, combinations, countModel, type CountMode } from '@/kernels/counting'
import {
  Btn,
  Callout,
  Card,
  Chip,
  Math as Formula,
  PlainSpeak,
  SectionTitle,
  Segmented,
  SliderRow,
  cx,
} from '@/ui'
import { Quiz } from '@/ui/Quiz'
import { useSolveOnce } from '../hooks'
import type { StageCtx, Topic } from '../types'

/* ================================================================ 小工具 */

interface Seq {
  /** 选了哪些球（下标从 0 开始）。有序模型按顺序记，无序模型按从小到大记 */
  pick: number[]
}

/**
 * 把一种计数模型的**前几种**方案枚举出来（数量小，教学场景足够）。
 * 总数不靠它 —— 总数交给内核的 compute；这里只是给用户一个「真的长这样」的例子。
 */
function enumerate(base: number[], k: number, ordered: boolean, rep: boolean, cap = 24): Seq[] {
  const out: Seq[] = []
  const walk = (cur: number[], start: number): boolean => {
    if (cur.length === k) {
      out.push({ pick: [...cur] })
      return out.length >= cap
    }
    for (let i = start; i < base.length; i++) {
      const nextStart = ordered || rep ? 0 : i + 1
      if (walk([...cur, base[i]], nextStart)) return true
    }
    return false
  }
  walk([], 0)
  return out
}

function modelEnumeration(n: number, k: number, key: CountMode): Seq[] {
  const base = Array.from({ length: n }, (_, i) => i)
  if (key === 'ordered-no-rep') return enumerate(base, k, true, false)
  if (key === 'unordered-no-rep') return enumerate(base, k, false, false)
  if (key === 'ordered-with-rep') return enumerate(base, k, true, true)
  return enumerate(base, k, false, true)
}

/** 展示用的「每个球被选中几次」统计：可重复模型里同一个球会被选中好几次 */
function countsOf(pick: number[], n: number): number[] {
  const c = Array.from({ length: n }, () => 0)
  for (const i of pick) c[i] += 1
  return c
}

function pickText(pick: number[]): string {
  return pick.map((i) => i + 1).join('、')
}

/* ============================================================== 小球画布 */

interface BallsProps {
  n: number
  /** 每个球被选中的次数（可重复模型里会 > 1） */
  counts: number[]
  /** 用 A/B/C… 标出选中的先后顺序（只有有序模型才需要） */
  order?: number[]
  ariaLabel: string
}

function BallsSvg({ n, counts, order, ariaLabel }: BallsProps) {
  const gap = 62
  const start = 44
  const width = start * 2 + gap * (n - 1)
  const r = 10 + Math.min(6, Math.max(0, 40 / n))

  return (
    <svg viewBox={`0 0 ${width} 150`} className="h-[150px] w-full max-w-md" role="img" aria-label={ariaLabel}>
      <line
        x1={18}
        y1={86}
        x2={width - 18}
        y2={86}
        stroke="var(--color-dim-300)"
        strokeWidth="1.5"
        strokeDasharray="4 4"
      />

      {Array.from({ length: n }, (_, i) => {
        const x = start + i * gap
        const c = counts[i] ?? 0
        const on = c > 0
        return (
          <g key={i}>
            <circle
              cx={x}
              cy={60}
              r={r}
              fill={on ? 'var(--color-a-100)' : 'var(--color-slate-100)'}
              stroke={on ? 'var(--color-a-600)' : 'var(--color-dim-300)'}
              strokeWidth={on ? 3 : 1.5}
            />
            <text
              className="dl-svg-text"
              x={x}
              y={60}
              textAnchor="middle"
              dominantBaseline="central"
              fill={on ? '#1d4ed8' : '#94a3b8'}
            >
              {i + 1}
            </text>
            {c > 1 ? (
              <text className="dl-svg-text" x={x + r + 2} y={60 - r - 2} fill="#b45309">
                ×{c}
              </text>
            ) : null}
            {on && order && order[i] > 0 ? (
              <text className="dl-svg-text" x={x} y={94} textAnchor="middle" fill="#1d4ed8">
                {String.fromCharCode(64 + order[i])}
              </text>
            ) : null}
          </g>
        )
      })}
    </svg>
  )
}

/** 猜测用的数值控件：+/- 按钮可以大步跳，旁边还能直接打字 */
function GuessField({
  value,
  step,
  onChange,
}: {
  value: number
  step: number
  onChange: (v: number) => void
}) {
  const btn =
    'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-300 bg-white font-mono text-lg font-bold text-slate-700 hover:border-a-500 dl-transition dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200'
  const bump = (d: number): void => onChange(Math.max(0, value + d))
  return (
    <div className="flex items-center gap-2">
      <button type="button" aria-label={`猜测减 ${step}`} className={btn} onClick={() => bump(-step)}>
        −
      </button>
      <input
        type="number"
        min={0}
        value={value}
        aria-label="你猜的种数"
        onChange={(e) => onChange(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
        className="h-11 w-24 rounded-xl border border-slate-300 bg-white text-center font-mono text-xl font-bold text-a-700 dark:border-slate-600 dark:bg-slate-900 dark:text-a-300"
      />
      <button type="button" aria-label={`猜测加 ${step}`} className={btn} onClick={() => bump(step)}>
        +
      </button>
    </div>
  )
}

/* ============================================================== ① 看一看 */

const HOOK_SLOTS = [0, 1, 2, 3, 0, 1, 2, 3]

function C2HookStage({ ctx }: { ctx: StageCtx }) {
  const n = 4
  const [step, setStep] = useState(0)
  const [seen, setSeen] = useState(0)

  const counts = useMemo(() => {
    const c = Array.from({ length: n }, () => 0)
    for (let i = 0; i < step; i++) c[HOOK_SLOTS[i]] += 1
    return c
  }, [step])

  const order = useMemo(() => Array.from({ length: n }, (_, i) => (counts[i] > 0 ? i + 1 : 0)), [counts, n])

  const full = step >= 3
  useSolveOnce(ctx, full)

  return (
    <div className="flex flex-col gap-3">
      <PlainSpeak>
        桌上有 <b>4 个小球</b>，旁边有一个盒子。<b>盒子里只能放 2 个</b>。
        点「再放一种」看看能摆出多少花样 —— <b>先别管公式，就动手摆。</b>
      </PlainSpeak>

      <Card>
        <div className="rounded-xl bg-slate-50 p-2 dark:bg-slate-800/40">
          <BallsSvg n={n} counts={counts} order={order} ariaLabel={`盒子里现在有 ${step} 个球，选中的球加粗显示`} />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Btn
            variant="primary"
            onClick={() => setStep((s) => Math.min(s + 1, HOOK_SLOTS.length))}
            disabled={step >= HOOK_SLOTS.length}
          >
            再放一种
          </Btn>
          <Btn
            variant="outline"
            onClick={() => {
              setStep(0)
              setSeen(0)
            }}
          >
            重来
          </Btn>
          <Chip tone={full ? 'ok' : 'dim'} showGlyph={false}>
            盒子里 {step} / 2 个
          </Chip>
        </div>
      </Card>

      <Callout tone={full ? 'ok' : 'info'} role="status">
        {!full
          ? '把 2 个球放进盒子，就是这么简单。放好之后，问题就来了。'
          : '看，光是「挑 2 个」这件小事，花样也没有看起来那么少。'}
      </Callout>

      <Card>
        <SectionTitle hint="凭感觉回答，下一关再验证">先猜一个数</SectionTitle>
        <p className="mb-3 text-sm text-slate-700 dark:text-slate-200">
          4 个球里挑 2 个放进盒子（<b>不考虑谁先谁后</b>），一共有多少种选法？
        </p>
        <Segmented<string>
          label="你的猜测"
          value={String(seen)}
          onChange={(v) => setSeen(Number(v))}
          options={[
            { value: '0', label: '还没想好' },
            { value: '3', label: '3 种' },
            { value: '6', label: '6 种' },
            { value: '8', label: '8 种' },
            { value: '12', label: '12 种' },
          ]}
        />
        {seen > 0 ? <Callout tone="info">记下你的答案：{seen} 种。下一关我们真的数一遍。</Callout> : null}
      </Card>
    </div>
  )
}

/* ============================================================== ② 玩一玩 */

type Guess = { n: number; k: number; guess: number }

const FRESH: Guess = { n: 4, k: 2, guess: 4 }

/** 猜测滑块的量程上限；比这更大就靠旁边的输入框直接打字 */
const SLIDER_CAP = 200

const EMPTY_CHECK: Record<CountMode, number | null> = {
  'ordered-no-rep': null,
  'unordered-no-rep': null,
  'ordered-with-rep': null,
  'unordered-with-rep': null,
}

function C2ExploreStage({ ctx }: { ctx: StageCtx }) {
  const [mode, setMode] = useState<CountMode>('ordered-no-rep')
  const [forms, setForms] = useState<Record<CountMode, Guess>>({
    'ordered-no-rep': { ...FRESH },
    'unordered-no-rep': { ...FRESH },
    'ordered-with-rep': { ...FRESH },
    'unordered-with-rep': { ...FRESH },
  })
  const [checked, setChecked] = useState<Record<CountMode, number | null>>({ ...EMPTY_CHECK })
  const [right, setRight] = useState<CountMode[]>([])

  const model = countModel(mode)
  const form = forms[mode]
  const n = form.n
  const k = Math.min(form.k, n)
  const truth = model.compute(n, k)
  const submitted = checked[mode]
  const revealed = submitted !== null
  const isRight = submitted === truth

  const patch = (p: Partial<Guess>): void => {
    setForms((f) => ({ ...f, [mode]: { ...f[mode], ...p } }))
    setChecked((c) => ({ ...c, [mode]: null }))
  }

  const submit = (): void => {
    setChecked((c) => ({ ...c, [mode]: form.guess }))
    if (form.guess === truth) {
      setRight((r) => (r.includes(mode) ? r : [...r, mode]))
      ctx.announce(`对了！${model.label}一共 ${truth} 种。`)
    } else {
      ctx.announce(`再想想：你猜 ${form.guess} 种，其实是 ${truth} 种。`)
    }
  }

  const tryNext = (): void => {
    if (mode === 'ordered-no-rep') {
      setMode('unordered-no-rep')
      ctx.say('换成「无序 · 不重复」：顺序不算数了，数量会怎么变？')
    } else if (mode === 'unordered-no-rep') {
      setMode('ordered-with-rep')
      ctx.say('换成「有序 · 可重复」：选完还能再选，数字一下子就大了。')
    } else if (mode === 'ordered-with-rep') {
      setMode('unordered-with-rep')
      ctx.say('最后一种「无序 · 可重复」：能重复，但顺序不算数。')
    } else {
      ctx.say('四种都试过了。看右边 —— 现在该给它们起名字了。')
    }
  }

  const example = useMemo(() => modelEnumeration(n, k, mode)[0], [n, k, mode])
  const counts = example ? countsOf(example.pick, n) : Array.from({ length: n }, () => 0)
  const ordered = mode === 'ordered-no-rep' || mode === 'ordered-with-rep'
  const orderArr = useMemo(() => {
    if (!example || !ordered) return undefined
    const arr = Array.from({ length: n }, () => 0)
    example.pick.forEach((ball, idx) => {
      arr[ball] = idx + 1
    })
    return arr
  }, [example, ordered, n])

  useSolveOnce(ctx, right.length >= 1)

  return (
    <div className="flex flex-col gap-3">
      <PlainSpeak>
        先猜一个数，再点「看看对不对」。<b>猜错没关系</b>，重要的是先动脑子想一次。
      </PlainSpeak>

      <Card>
        <SectionTitle hint="四种玩法切换着看，规律自己会冒出来">同一堆球，四种问法</SectionTitle>
        <Segmented<CountMode>
          label="计数模型"
          value={mode}
          onChange={(m) => {
            setMode(m)
            ctx.say(countModel(m).plain)
          }}
          options={COUNT_MODELS.map((m) => ({ value: m.key, label: m.label }))}
        />
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{model.plain}</p>
      </Card>

      <div className="grid gap-3 md:grid-cols-2">
        <Card>
          <SectionTitle hint={model.label}>① 调参数，② 猜答案</SectionTitle>

          <SliderRow
            label="球的总数 n"
            value={form.n}
            min={3}
            max={6}
            onChange={(v) => patch({ n: v, k: Math.min(form.k, v) })}
            hint="一共有几个球可以挑"
          />
          <div className="mt-3">
            <SliderRow
              label="要挑几个 k"
              value={k}
              min={1}
              max={n}
              onChange={(v) => patch({ k: v })}
              hint="放进盒子里的个数"
            />
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">你猜一共多少种？</span>
            <GuessField value={form.guess} step={SLIDER_CAP / 20} onChange={(v) => patch({ guess: v })} />
          </div>
          <div className="mt-2">
            <input
              type="range"
              min={0}
              max={SLIDER_CAP}
              value={Math.min(form.guess, SLIDER_CAP)}
              onChange={(e) => patch({ guess: Number(e.target.value) })}
              aria-label="猜测的种数（滑块）"
              aria-valuetext={`猜 ${form.guess} 种`}
              className="h-11 w-full cursor-pointer accent-a-600"
            />
            <p className="text-xs text-slate-500 dark:text-slate-400">
              滑块最多拖到 {SLIDER_CAP}，要更大的数就直接在旁边的框里打字。
            </p>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Btn variant="primary" onClick={submit}>
              看看对不对
            </Btn>
            <Btn variant="ghost" size="sm" onClick={tryNext}>
              换一种玩法
            </Btn>
            {right.length > 0 ? <Chip tone="ok">已猜对 {right.length} 种</Chip> : null}
          </div>
        </Card>

        <Card>
          <SectionTitle hint={revealed ? '这就是其中一种摆法' : '猜完这里才打开'}>盒子里长什么样</SectionTitle>

          {!revealed ? (
            <Callout tone="cur">
              先在上面猜一个数字，点「看看对不对」—— <b>然后这里才会给你看答案</b>。
            </Callout>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="rounded-xl bg-slate-50 p-2 dark:bg-slate-800/40">
                <BallsSvg
                  n={n}
                  counts={counts}
                  order={orderArr}
                  ariaLabel={`其中一种选法，选中的球是 ${example ? pickText(example.pick) : '无'}`}
                />
              </div>

              {example ? (
                <p className="text-sm text-slate-700 dark:text-slate-200">
                  举一个例子：
                  <Formula>{ordered ? `（${pickText(example.pick)}）` : `{ ${pickText(example.pick)} }`}</Formula>
                  <span className="ml-1 text-slate-500 dark:text-slate-400">
                    {ordered ? '圆括号表示顺序算数' : '花括号表示顺序不算数'}
                  </span>
                </p>
              ) : null}

              <Callout tone={isRight ? 'ok' : 'bad'} role="status">
                {isRight ? (
                  <>
                    猜对了！{model.label}：一共 <b>{truth}</b> 种。
                  </>
                ) : (
                  <>
                    你猜 <b>{form.guess}</b> 种，实际是 <b>{truth}</b> 种。
                    {form.guess > truth
                      ? ' 你想多了：这个玩法里，很多种摆法其实是同一种。'
                      : ' 你想少了：这个玩法里还有你没数到的情况。'}
                  </>
                )}
              </Callout>

              <div className="rounded-xl border border-a-300 bg-a-50 px-3 py-2 dark:border-a-500/40 dark:bg-a-500/10">
                <div className="text-xs font-semibold text-a-700 dark:text-a-300">{model.label} 的公式</div>
                <div className="mt-1">
                  <Formula>{model.formula}</Formula>
                </div>
                <div className="mt-1">
                  <Formula>
                    n = {n}，k = {k} → {truth}
                  </Formula>
                </div>
              </div>

              {!isRight ? (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  改一下滑块再猜一次，或者直接再点「看看对不对」—— 没有次数限制。
                </p>
              ) : null}
            </div>
          )}
        </Card>
      </div>

      <Callout tone="info">
        小提示：「有序」就是<b>排队，顺序算数</b>；「不重复」就是<b>同一个球不能拿两次</b>。
        两个开关各两种状态，一共四种组合 —— 这就是全部的秘密。
      </Callout>
    </div>
  )
}

/* ============================================================== ③ 起个名 */

function C2NameStage({ ctx }: { ctx: StageCtx }) {
  const n = 5
  const k = 3
  const [seen, setSeen] = useState<CountMode[]>([])

  const look = (key: CountMode): void => {
    setSeen((s) => (s.includes(key) ? s : [...s, key]))
    ctx.say(countModel(key).plain)
  }

  useSolveOnce(ctx, seen.length >= COUNT_MODELS.length)

  return (
    <div className="flex flex-col gap-4">
      <PlainSpeak>
        你刚才玩的四种情况，数学上各有各的<b>名字和公式</b>。
        下面四张卡片，每张都点开看一眼 —— 四个都看过，这一关就过了。
      </PlainSpeak>

      <Card>
        <SectionTitle hint="四张都点一遍">四种说法，四个公式</SectionTitle>
        <div className="grid gap-2 sm:grid-cols-2">
          {COUNT_MODELS.map((m) => {
            const on = seen.includes(m.key)
            return (
              <button
                key={m.key}
                type="button"
                aria-pressed={on}
                aria-label={`${m.label}：${m.plain}，公式 ${m.formula}`}
                onClick={() => look(m.key)}
                className={cx(
                  'rounded-xl border px-3 py-2.5 text-left dl-transition',
                  on
                    ? 'border-a-500 bg-a-50 dark:bg-a-500/15'
                    : 'border-slate-200 bg-white hover:border-a-300 dark:border-slate-700 dark:bg-slate-900',
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">{m.label}</span>
                  {on ? <span className="text-xs text-ok-600">✓ 看过</span> : null}
                </div>
                <div className="mt-1 text-xs text-slate-600 dark:text-slate-300">{m.plain}</div>
                <div className="mt-1.5">
                  <Formula>{m.formula}</Formula>
                </div>
              </button>
            )
          })}
        </div>
      </Card>

      <Card>
        <SectionTitle hint={`n = ${n}，k = ${k}，四种玩法一起对比`}>同一批球，四种答案</SectionTitle>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[22rem] border-collapse text-sm">
            <caption className="sr-only">n 等于 5、k 等于 3 时，四种计数模型各自的结果</caption>
            <thead>
              <tr className="text-left text-xs text-slate-500 dark:text-slate-400">
                <th scope="col" className="py-1.5 pr-2 font-medium">
                  玩法
                </th>
                <th scope="col" className="py-1.5 pr-2 font-medium">
                  公式
                </th>
                <th scope="col" className="py-1.5 font-medium">
                  结果
                </th>
              </tr>
            </thead>
            <tbody>
              {COUNT_MODELS.map((m) => (
                <tr key={m.key} className="border-t border-slate-200 dark:border-slate-700">
                  <td className="py-1.5 pr-2 text-slate-700 dark:text-slate-200">{m.label}</td>
                  <td className="py-1.5 pr-2">
                    <Formula>{m.formula}</Formula>
                  </td>
                  <td className="py-1.5 font-mono font-bold text-a-700 dark:text-a-300">{m.compute(n, k)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          同样是 5 个球、同样挑 3 个，答案从 10 一直到 125 —— 差别全在「顺序」和「重复」这两个开关上。
        </p>
      </Card>

      <Card>
        <SectionTitle hint="只差「顺序算不算数」这一点">P 和 C，只差一个 k!</SectionTitle>
        <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-200">
          从 5 个球里挑 3 个：<b>排成一列</b>是{' '}
          <Formula>P(5, 3) = {countModel('ordered-no-rep').compute(5, 3)}</Formula>，<b>装进袋子</b>是{' '}
          <Formula>C(5, 3) = {countModel('unordered-no-rep').compute(5, 3)}</Formula>。
        </p>
        <p className="mt-2 text-sm leading-relaxed text-slate-700 dark:text-slate-200">
          拿具体的一袋 <Formula>{'{ 3、4 }'}</Formula> 来说：袋子里装着球 3 和球 4，它<b>只有一种装法</b>；
          可要是要求排队，这两个球还能站成 <Formula>(3, 4)</Formula> 和 <Formula>(4, 3)</Formula> 两种。
        </p>
        <p className="mt-2 text-sm leading-relaxed text-slate-700 dark:text-slate-200">
          所以每一袋都被多算了 <Formula>k!</Formula> 次，把多算的除掉就得到：
        </p>
        <p className="mt-1">
          <Formula block>C(n, k) = P(n, k) ÷ k!</Formula>
        </p>
        <Callout tone="info">
          一句话记牢：<b>问「排队」用 P，问「分组」用 C</b>。分不清的时候问自己一句：
          「把顺序换一下，算不算新的一种？」
        </Callout>
      </Card>

      <Callout tone={seen.length >= COUNT_MODELS.length ? 'ok' : 'cur'} role="status">
        {seen.length >= COUNT_MODELS.length
          ? '四个公式都看过了。接下来用它们做题。'
          : `还差 ${COUNT_MODELS.length - seen.length} 张卡片没点开。`}
      </Callout>
    </div>
  )
}

/* ============================================================== ④ 练一练 */

function C2PracticeStage({ ctx }: { ctx: StageCtx }) {
  const [done, setDone] = useState(0)
  useSolveOnce(ctx, done >= 3)

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-slate-600 dark:text-slate-300">
        三道题。选错了会告诉你<b>为什么错</b>，没有次数限制，也没有扣分。
      </p>

      <Card>
        <Quiz
          question={
            <>
              从 5 个人里选 3 个人组成一个小组（<b>不看顺序</b>），一共有多少种选法？
            </>
          }
          resetKey="c2p1"
          onSolved={() => setDone((d) => d + 1)}
          choices={[
            {
              id: 'a',
              label: (
                <>
                  <Formula>C(5, 3) = 10</Formula> 种
                </>
              ),
              correct: true,
              why: '对。小组只看「谁在里面」，不看谁先被叫到名字，所以顺序不算数 —— 用组合数 C(5,3) = (5×4×3) ÷ (3×2×1) = 10。',
            },
            {
              id: 'b',
              label: (
                <>
                  <Formula>P(5, 3) = 60</Formula> 种
                </>
              ),
              correct: false,
              why: '不对。60 是把这 3 个人排了队才得到的数。{甲,乙,丙} 和 {丙,乙,甲} 是同一个小组，这样算把每个小组都多算了 3! = 6 次，60 ÷ 6 才是答案。',
            },
            {
              id: 'c',
              label: (
                <>
                  <Formula>5 × 5 × 5 = 125</Formula> 种
                </>
              ),
              correct: false,
              why: '不对。5×5×5 允许「同一个人被选中两次」，可是一个人不能在同一个小组里当两个组员。这里不能重复选。',
            },
            {
              id: 'd',
              label: (
                <>
                  <Formula>C(5, 3) ÷ 3 = 3</Formula> 种
                </>
              ),
              correct: false,
              why: '不对。这是把「3 个人内部换顺序」当成只有 3 种了，其实 3 个人换顺序有 3! = 6 种；而且这道题本来就不该除。',
            },
          ]}
        />
      </Card>

      <Card>
        <Quiz
          question={
            <>
              从 5 个人里选 3 个人分别当<b>班长、副班长、组长</b>（职务不同），一共有多少种？
            </>
          }
          resetKey="c2p2"
          onSolved={() => setDone((d) => d + 1)}
          choices={[
            {
              id: 'a',
              label: (
                <>
                  <Formula>P(5, 3) = 60</Formula> 种
                </>
              ),
              correct: true,
              why: '对。班长和副班长是两个不同的位置，{甲当班长、乙当副班长} 和 {乙当班长、甲当副班长} 是两回事 —— 顺序算数，所以用排列数 P(5,3) = 5×4×3 = 60。',
            },
            {
              id: 'b',
              label: (
                <>
                  <Formula>C(5, 3) = 10</Formula> 种
                </>
              ),
              correct: false,
              why: '不对。10 是「只选人、不分工」的结果。题目里三个职务不同，把选出来的 3 个人分到 3 个职务上还有 3! = 6 种分法，10 × 6 = 60。',
            },
            {
              id: 'c',
              label: (
                <>
                  <Formula>5 × 5 × 5 = 125</Formula> 种
                </>
              ),
              correct: false,
              why: '不对。一个人不能同时当班长和副班长，所以第 2 个职务只剩 4 个人可选，不是 5 个。',
            },
          ]}
        />
      </Card>

      <Card>
        <Quiz
          question={
            <>
              一个 4 位密码锁，每一位是 0–9 十个数字之一，<b>数字可以重复</b>（比如 1111）。一共有多少个密码？
            </>
          }
          resetKey="c2p3"
          onSolved={() => setDone((d) => d + 1)}
          choices={[
            {
              id: 'a',
              label: (
                <>
                  <Formula>10⁴ = 10000</Formula> 个
                </>
              ),
              correct: true,
              why: '对。每一位都从 10 个数字里挑，而且每一位互不影响 —— 4 位就是 10×10×10×10 = 10⁴ = 10000。这就是「有序 · 可重复」的 nᵏ。',
            },
            {
              id: 'b',
              label: (
                <>
                  <Formula>P(10, 4) = 5040</Formula> 个
                </>
              ),
              correct: false,
              why: '不对。5040 是「每位数字都不能相同」时的答案。题目说了可以重复，1111、2233 这些都算，所以答案要大一些。',
            },
            {
              id: 'c',
              label: (
                <>
                  <Formula>C(10, 4) = 210</Formula> 个
                </>
              ),
              correct: false,
              why: '不对。210 既不管顺序也不管重复，跟密码锁完全不是一回事。密码 1234 和 4321 是两个不同的密码。',
            },
            {
              id: 'd',
              label: <>1000 个</>,
              correct: false,
              why: '不对。1000 = 10³，那是 3 位密码的数量。题目是 4 位，要乘 4 个 10。',
            },
          ]}
        />
      </Card>
    </div>
  )
}

/* ============================================================== ⑤ 换个场景 */

const TEN = Array.from({ length: 10 }, (_, i) => i + 1)

function C2TransferStage({ ctx }: { ctx: StageCtx }) {
  const [fixed, setFixed] = useState<number | null>(null)
  const [shown, setShown] = useState(false)
  const [quizDone, setQuizDone] = useState(false)

  const rest = 9
  const need = 3
  const ans = combinations(rest, need)
  const freeN = combinations(10, 4)
  const without = combinations(9, 4)

  useSolveOnce(ctx, fixed !== null && shown && quizDone)

  return (
    <div className="flex flex-col gap-4">
      <PlainSpeak>
        换个场景：10 个人里选 4 个人去开会。<b>其中一号必须去</b>。现在有多少种选法？
        先点名，再算数。
      </PlainSpeak>

      <Card>
        <SectionTitle hint="点一下一号，让他先坐进会议室">第一步：把「必须去的人」定下来</SectionTitle>
        <div className="flex flex-wrap gap-2">
          {TEN.map((p) => {
            const on = fixed === p
            const only = p === 1
            return (
              <button
                key={p}
                type="button"
                aria-pressed={on}
                aria-label={`第 ${p} 号${only ? '，这是必须去的那个人' : ''}${on ? '，已确定去' : '，点一下让他去'}`}
                onClick={() => {
                  if (only) {
                    setFixed(p)
                    ctx.say('一号坐进会议室了。剩下 9 个人里，还要再挑 3 个。')
                  } else {
                    setFixed(null)
                    ctx.say('题目要求一号必须去，先把他定下来，再挑别人。')
                  }
                }}
                className={cx(
                  'h-11 min-w-11 rounded-xl border px-3 font-mono text-sm font-bold dl-transition',
                  on
                    ? 'border-ok-500 bg-ok-50 text-ok-700 dark:bg-ok-500/15 dark:text-ok-500'
                    : only
                      ? 'border-cur-500 bg-cur-50 text-cur-700 hover:border-ok-500 dark:bg-cur-500/15 dark:text-cur-500'
                      : 'border-slate-300 bg-white text-slate-500 hover:border-a-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300',
                )}
              >
                {p} 号
              </button>
            )
          })}
        </div>
        <div className="mt-2">
          <Callout tone={fixed !== null ? 'ok' : 'cur'} role="status">
            {fixed !== null
              ? '好了，会议室里已经坐着 1 号，还剩 3 个空位。'
              : '还没定下来。一号是「必须去」的那个人，点他。'}
          </Callout>
        </div>
      </Card>

      <Card>
        <SectionTitle hint={`剩下 ${rest} 个人，再挑 ${need} 个`}>第二步：现场算一遍</SectionTitle>
        <Btn variant="primary" onClick={() => setShown(true)} disabled={fixed === null || shown}>
          {shown ? '已经算好了' : '算出剩下的选法'}
        </Btn>

        {shown ? (
          <div className="mt-3 flex flex-col gap-2 text-sm leading-relaxed text-slate-700 dark:text-slate-200">
            <p>
              一号已经站好了，他不用再算。剩下的 <b>{rest}</b> 个人里只要再挑 <b>{need}</b> 个，
              而且挑出来的这 3 个人<b>不排位置</b>（谁坐哪都一样）。
            </p>
            <p>
              所以答案是：
              <Formula>
                C({rest}, {need}) = (7 × 8 × 9) ÷ (1 × 2 × 3)
              </Formula>
            </p>
            <Callout tone="ok">
              一共 <b>{ans}</b> 种选法。
            </Callout>
            <p className="text-slate-600 dark:text-slate-300">
              换个角度核对一下：10 个人里随便挑 4 个有 <Formula>C(10, 4) = {freeN}</Formula> 种，
              其中有 <Formula>C(9, 4) = {without}</Formula> 种根本没带上一号 —— 把这些剔掉：
              <Formula>
                {' '}
                {freeN} − {without} = {freeN - without}
              </Formula>
              。两种算法结果一样，说明没算错。
            </p>
          </div>
        ) : null}
      </Card>

      <Card>
        <Quiz
          question={
            <>
              为什么这道题的答案不是 <Formula>C(10, 4)</Formula> 种？
            </>
          }
          resetKey="c2t1"
          onSolved={() => setQuizDone(true)}
          choices={[
            {
              id: 'a',
              label: (
                <>
                  因为一号被钉死了，能自由挑的只剩 9 个人，而且只补 3 个：
                  <Formula>C(9, 3) = 84</Formula>。
                </>
              ),
              correct: true,
              why: '对。C(10,4) 是「谁都可以不去」时的答案。题目要求一号必须去 —— 相当于先把他放进名单，再从剩下 9 人里补 3 个。补的这 3 个还是一组人、不排顺序，所以用 C 而不是 P。',
            },
            {
              id: 'b',
              label: (
                <>
                  因为要用排列数 <Formula>P(9, 3) = 504</Formula>，不是组合数。
                </>
              ),
              correct: false,
              why: '不对。选出来的 4 个人只是「一组」，没有班长副班长之分，顺序不算数，所以是组合不是排列。504 会把同一组人多算很多次。',
            },
            {
              id: 'c',
              label: (
                <>
                  因为还要乘上一号的选法：<Formula>10 × C(9, 3) = 840</Formula>。
                </>
              ),
              correct: false,
              why: '不对。一号是题目指定的人，不是「从 10 个里挑一个当固定的人」—— 他只有 1 种确定方式，乘 1 等于没乘。多乘一个 10 就把答案放大了十倍。',
            },
          ]}
        />
      </Card>

      <Callout tone="info">
        这类「某某必须在里面」或者「某某不能在里面」的题，套路都是先处理那个特殊的人，剩下的就变回普通的选人问题。
      </Callout>
    </div>
  )
}

/* ============================================================== 导出 */

const topic: Topic = {
  id: 'C2',
  title: '排列与组合',
  moduleId: 'counting',
  oneLiner: '顺序算不算数、能不能重复选 —— 四种情况一次讲清',
  outcome: '看到「挑几个」的问题，你能先判断「顺序算不算数、能不能重复」，再选出对的公式并算出答案。',
  prerequisites: ['C1'],
  bigIdea:
    '从一堆东西里挑几个，只需要回答两个问题：顺序算不算数？选过的还能不能再选？这两个问题的四种答案，就是全部四种计数模型。',
  misconceptions: [
    {
      wrong: '「从 5 个人里选 3 个」和「选 3 个当班长、副班长、组长」是一回事',
      right:
        '不是。前者只是一组人，顺序不算数，答案是 C(5,3) = 10；后者三个职务不同，顺序算数，答案是 P(5,3) = 60。差别就在「换一下顺序算不算新的一种」。',
    },
    {
      wrong: 'P 和 C 是两个没关系的新公式，得分别背下来',
      right:
        '它们只差一个「顺序」。每一袋 k 个东西，排队的方式都正好有 k! 种，所以 C(n,k) = P(n,k) ÷ k!。记住这一条，就只剩一个公式要记。',
    },
    {
      wrong: '密码锁每一位有 10 种可能，4 位就是 40 种',
      right:
        '不是相加是相乘。每一位都独立地从 10 个数字里挑，所以是 10 × 10 × 10 × 10 = 10⁴ = 10000 种。',
    },
    {
      wrong: '允许重复就等于无限制，答案一定是无穷多',
      right:
        '只要「挑几个」的个数 k 固定，就算允许重复，方案数也有限。比如 3 个球挑 2 个、允许重复，只有 3² = 9 种。',
    },
  ],
  formalDefinition: (
    <>
      <p>
        <b>排列数：</b>
        <span className="font-mono">P(n, k) = n! / (n−k)! = n × (n−1) × … × (n−k+1)</span>
      </p>
      <p>
        <b>组合数：</b>
        <span className="font-mono">C(n, k) = n! / (k!(n−k)!) = P(n, k) / k!</span>
      </p>
      <p>
        <b>可重复排列：</b>
        <span className="font-mono">nᵏ</span>
        <span className="text-xs text-slate-500 dark:text-slate-400">（每一位都独立地从 n 个里挑）</span>
      </p>
      <p>
        <b>可重复组合：</b>
        <span className="font-mono">C(n+k−1, k)</span>
        <span className="text-xs text-slate-500 dark:text-slate-400">
          （隔板法：k 个球和 n−1 块隔板一起排队）
        </span>
      </p>
    </>
  ),
  glossary: [
    { term: '排列 P(n,k)', plain: '从 n 个里挑 k 个排成一列，顺序算数。', formal: 'P(n,k) = n!/(n−k)!' },
    { term: '组合 C(n,k)', plain: '从 n 个里挑 k 个装进袋子，顺序不算数。', formal: 'C(n,k) = n!/(k!(n−k)!)' },
    { term: '有序', plain: '把顺序换一下就算新的一种。排队、分工、密码都是有顺序的。' },
    { term: '无序', plain: '顺序怎么换都还是同一种。分组、抓一把、点菜都没有顺序。' },
    { term: '可重复', plain: '选过的还能再选一次。', formal: '有序 nᵏ；无序 C(n+k−1, k)' },
    { term: '阶乘 n!', plain: '从 1 一直乘到 n。比如 4! = 1×2×3×4 = 24。', formal: 'n! = n × (n−1) × … × 1，并且 0! = 1' },
    { term: '隔板法', plain: '把「挑东西」想成「往一排东西中间插板子」，插几块板子就有几种分法。' },
  ],
  stages: [
    {
      label: '① 看一看',
      short: '看',
      narration: '4 个球，盒子里放 2 个。动手摆摆看有几种。',
      requireSolve: true,
      hints: [
        '点「再放一种」，每点一次就是一个新的选法，看看一共能点几次。',
        '按「最小的球先配」的顺序数：1 可以和 2、3、4 配，2 可以和 3、4 配……一个一个数下去。',
        '不考虑顺序时一共 6 种：{1,2}、{1,3}、{1,4}、{2,3}、{2,4}、{3,4}。注意 {1,2} 和 {2,1} 是同一种。',
      ],
      render: (ctx) => <C2HookStage ctx={ctx} />,
    },
    {
      label: '② 玩一玩',
      short: '玩',
      narration: '选一种玩法，先猜一个数，再点「看看对不对」。',
      requireSolve: true,
      hints: [
        '先想清楚两件事：顺序算不算数？选过的还能不能再选？这决定了该用哪种算法。',
        '「有序 · 不重复」就是第 1 个位置有 n 种放法，第 2 个位置剩 n−1 种，一路乘下去。',
        '把 n 调成 4、k 调成 2、玩法选「有序 · 不重复」，答案是 4 × 3 = 12 种。把猜测改成 12，再点「看看对不对」。',
      ],
      render: (ctx) => <C2ExploreStage ctx={ctx} />,
    },
    {
      label: '③ 起个名',
      short: '名',
      narration: '四种情况各有名字。四张卡片都点开看看。',
      requireSolve: true,
      hints: [
        '四个公式只差两个地方：要不要除以 k!，以及是乘 k 次还是每次都能重挑。',
        'P 负责「排队」，C 负责「分组」，两者只差一个 k!；允许重复的时候，有序的那一种是 nᵏ。',
        '四张卡片全点开就通关。它们的公式依次是：P(n,k) = n×(n−1)×…×(n−k+1)；C(n,k) = P(n,k)÷k!；nᵏ；C(n+k−1, k)。',
      ],
      render: (ctx) => <C2NameStage ctx={ctx} />,
    },
    {
      label: '④ 练一练',
      short: '练',
      narration: '三道题：分组、分工、密码锁。选错会讲为什么。',
      requireSolve: true,
      hints: [
        '每道题先只问自己一句：顺序算不算数？',
        '「选 3 个人组小组」不算顺序；「当班长副班长组长」算顺序；密码锁每一位独立选择，所以是相乘。',
        '三道题的正确选项依次是：C(5,3) = 10 种；P(5,3) = 60 种；10⁴ = 10000 个。',
      ],
      render: (ctx) => <C2PracticeStage ctx={ctx} />,
    },
    {
      label: '⑤ 换个场景',
      short: '变',
      narration: '10 个人选 4 个，其中一号必须去。先定他。',
      requireSolve: true,
      hints: [
        '那个「必须去」的人，先把他从题目里拿出来 —— 他已经占掉一个名额了。',
        '他占掉 1 个名额后，剩下 9 个人里只要再挑 3 个，而且这 3 个是一组人，不排顺序。',
        '答案是 C(9, 3) = (7×8×9) ÷ (1×2×3) = 84 种。先点一号让他「去」，再点「算出剩下的选法」，最后答对下面那题。',
      ],
      render: (ctx) => <C2TransferStage ctx={ctx} />,
    },
  ],
}

export default topic
