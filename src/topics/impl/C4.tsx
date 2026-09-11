import { useMemo, useState } from 'react'

import { binomialExpansion, combinations, pascal } from '@/kernels/counting'
import { Btn, Callout, Card, Chip, Math as Formula, PlainSpeak, SectionTitle, cx } from '@/ui'
import { Quiz } from '@/ui/Quiz'
import { useSolveOnce } from '../hooks'
import type { StageCtx, Topic } from '../types'

/* ============================================================== ① 看一看 */

/** 四块面积图：一个边长 a+b 的正方形，竖切一刀、横切一刀，变成四块 */
function AreaSquare({ a, b, ariaLabel }: { a: number; b: number; ariaLabel: string }) {
  const total = a + b
  const scale = 200 / total
  const wa = a * scale
  const wb = b * scale

  return (
    <svg viewBox="0 0 200 200" className="h-auto w-48 shrink-0" role="img" aria-label={ariaLabel}>
      <rect x={0} y={0} width={wa} height={wa} fill="var(--color-a-100)" stroke="var(--color-a-600)" strokeWidth={1.5} />
      <rect x={wa} y={0} width={wb} height={wa} fill="var(--color-b-100)" stroke="var(--color-b-600)" strokeWidth={1.5} />
      <rect x={0} y={wa} width={wa} height={wb} fill="var(--color-b-100)" stroke="var(--color-b-600)" strokeWidth={1.5} />
      <rect
        x={wa}
        y={wa}
        width={wb}
        height={wb}
        fill="var(--color-cur-100)"
        stroke="var(--color-cur-600)"
        strokeWidth={1.5}
      />
      <text className="dl-svg-text" x={wa / 2} y={wa / 2} textAnchor="middle" dominantBaseline="central" fill="#1d4ed8">
        a²
      </text>
      <text
        className="dl-svg-text"
        x={wa + wb / 2}
        y={wa / 2}
        textAnchor="middle"
        dominantBaseline="central"
        fill="#6d28d9"
      >
        ab
      </text>
      <text
        className="dl-svg-text"
        x={wa / 2}
        y={wa + wb / 2}
        textAnchor="middle"
        dominantBaseline="central"
        fill="#6d28d9"
      >
        ab
      </text>
      <text
        className="dl-svg-text"
        x={wa + wb / 2}
        y={wa + wb / 2}
        textAnchor="middle"
        dominantBaseline="central"
        fill="#b45309"
      >
        b²
      </text>
      <text className="dl-svg-text" x={100} y={-8} textAnchor="middle" fill="#64748b">
        宽 = a + b = {total}
      </text>
    </svg>
  )
}

function C4HookStage({ ctx }: { ctx: StageCtx }) {
  const [step, setStep] = useState(0)
  const a = 3
  const b = 2
  const total = a + b

  const full = step >= 3
  useSolveOnce(ctx, full)

  const blocks = [
    { label: 'a²', text: `a × a = ${a} × ${a} = ${a * a}`, show: step >= 1 },
    { label: 'ab', text: `a × b = ${a} × ${b} = ${a * b}`, show: step >= 2 },
    { label: 'ab（另一块）', text: `b × a = ${b} × ${a} = ${a * b}`, show: step >= 2 },
    { label: 'b²', text: `b × b = ${b} × ${b} = ${b * b}`, show: step >= 3 },
  ]

  return (
    <div className="flex flex-col gap-3">
      <PlainSpeak>
        边长为 <b>a + b</b> 的正方形，面积是多少？一边切一刀，就变成四块。
        点下面的按钮，一块一块看。
      </PlainSpeak>

      <Card>
        <div className="flex flex-wrap items-center justify-center gap-6">
          <AreaSquare a={a} b={b} ariaLabel={`边长 a 加 b 的正方形，被切成 a 平方、两个 ab、b 平方共四块`} />

          <div className="flex min-w-56 flex-col gap-2">
            {blocks.map((blk, i) => (
              <div
                key={blk.label}
                className={cx(
                  'rounded-xl border px-3 py-2 dl-transition',
                  blk.show
                    ? 'border-a-300 bg-a-50 dark:border-a-500/40 dark:bg-a-500/10'
                    : 'border-dashed border-slate-300 bg-transparent dark:border-slate-700',
                )}
              >
                <div className="font-mono text-sm font-bold text-slate-800 dark:text-slate-100">
                  {blk.show ? blk.label : '第 ' + (i + 1) + ' 块'}
                </div>
                <div className="text-xs text-slate-600 dark:text-slate-300">
                  {blk.show ? blk.text : '还没揭开'}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Btn variant="primary" onClick={() => setStep((s) => Math.min(s + 1, 3))} disabled={full}>
            {step === 0 ? '竖着切一刀' : step === 1 ? '横着再切一刀' : '数一数'}
          </Btn>
          <Btn variant="outline" onClick={() => setStep(0)}>
            重来
          </Btn>
          <Chip tone={full ? 'ok' : 'dim'} showGlyph={false}>
            四块已揭开 {step} / 3 步
          </Chip>
        </div>
      </Card>

      <Callout tone={full ? 'ok' : 'info'} role="status">
        {!full
          ? '切完一刀会多出几块？先动手切，再说话。'
          : '四块加起来就是整个正方形：' + a * a + ' + ' + a * b + ' + ' + a * b + ' + ' + b * b + ' = ' + total * total + '。'}
      </Callout>

      {full ? (
        <Card>
          <SectionTitle hint="把 a 和 b 换成字母，数字就变成了公式">把数字换成字母看看</SectionTitle>
          <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-200">
            刚才正方形被分成了 <b>a²</b>、两块 <b>ab</b>、<b>b²</b>。写成公式就是：
          </p>
          <p className="mt-2">
            <Formula block>(a + b)² = a² + 2ab + b²</Formula>
          </p>
          <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-200">
            中间那个 <b>2</b> 不是天上掉下来的：它是<b>两块一模一样的长方形</b> —— 一块横着、一块竖着，
            所以是 ab 加 ab。
          </p>
        </Card>
      ) : null}
    </div>
  )
}

/* ============================================================== 杨辉三角 */

const ROWS = 7
const CELL = 46
const GAP_X = 46

function xOf(n: number, k: number): number {
  const maxHalf = ((ROWS - 1) * (CELL + GAP_X)) / 2
  const rowHalf = (n * (CELL + GAP_X)) / 2
  const originX = 28 + maxHalf
  return originX - rowHalf + k * (CELL + GAP_X)
}

function yOf(n: number): number {
  return 28 + n * (CELL + 12)
}

const VIEW_W = 2 * (28 + ((ROWS - 1) * (CELL + GAP_X)) / 2)
const VIEW_H = yOf(ROWS - 1) + CELL + 16

interface TriangleProps {
  /** 已经揭开的格子 */
  seen: Set<string>
  /** 当前选中的格子 */
  active: { n: number; k: number } | null
  onPick: (n: number, k: number) => void
  highlightRow: number
}

const KEY = (n: number, k: number): string => `${n}-${k}`

function PascalTriangle({ seen, active, onPick, highlightRow }: TriangleProps) {
  const rows = useMemo(() => pascal(ROWS), [])
  const parentA = active && active.k > 0 ? { n: active.n - 1, k: active.k - 1 } : null
  const parentB = active && active.k < active.n ? { n: active.n - 1, k: active.k } : null

  const isShown = (n: number, k: number): boolean => seen.has(KEY(n, k))

  const fillOf = (n: number, k: number): string => {
    if (active && active.n === n && active.k === k) return 'var(--color-cur-100)'
    if (
      (parentA && parentA.n === n && parentA.k === k) ||
      (parentB && parentB.n === n && parentB.k === k)
    ) {
      return 'var(--color-a-100)'
    }
    if (n === highlightRow && isShown(n, k)) return 'var(--color-ok-100)'
    if (isShown(n, k)) return '#ffffff'
    return '#f8fafc'
  }

  const strokeOf = (n: number, k: number): string => {
    if (active && active.n === n && active.k === k) return 'var(--color-cur-600)'
    if (
      (parentA && parentA.n === n && parentA.k === k) ||
      (parentB && parentB.n === n && parentB.k === k)
    ) {
      return 'var(--color-a-600)'
    }
    if (n === highlightRow && isShown(n, k)) return 'var(--color-ok-500)'
    if (isShown(n, k)) return 'var(--color-dim-300)'
    return 'var(--color-dim-300)'
  }

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      className="h-auto w-full max-w-xl"
      role="img"
      aria-label="杨辉三角。用 Tab 走到某个数字，按回车查看它由上面哪两个数相加而来。"
    >
      {/* 两条连到「上一行两个数」的线：先画线，再画格子，线就自然在下面 */}
      {active && parentA ? (
        <line
          x1={xOf(parentA.n, parentA.k) + CELL / 2}
          y1={yOf(parentA.n) + CELL}
          x2={xOf(active.n, active.k) + CELL / 2}
          y2={yOf(active.n)}
          stroke="var(--color-a-600)"
          strokeWidth={2.5}
        />
      ) : null}
      {active && parentB ? (
        <line
          x1={xOf(parentB.n, parentB.k) + CELL / 2}
          y1={yOf(parentB.n) + CELL}
          x2={xOf(active.n, active.k) + CELL / 2}
          y2={yOf(active.n)}
          stroke="var(--color-a-600)"
          strokeWidth={2.5}
        />
      ) : null}

      {rows.map((row, n) =>
        row.map((value, k) => {
          const x = xOf(n, k)
          const y = yOf(n)
          const shown = isShown(n, k)
          const isActive = active !== null && active.n === n && active.k === k
          const isParent =
            (parentA !== null && parentA.n === n && parentA.k === k) ||
            (parentB !== null && parentB.n === n && parentB.k === k)
          return (
            <g
              key={KEY(n, k)}
              role="button"
              tabIndex={0}
              aria-label={
                shown
                  ? `第 ${n} 行第 ${k} 个数，值是 ${value}`
                  : `第 ${n} 行第 ${k} 个数，还没揭开，按回车揭开它`
              }
              onClick={() => onPick(n, k)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onPick(n, k)
                }
              }}
              style={{ cursor: 'pointer' }}
            >
              <rect
                x={x}
                y={y}
                width={CELL}
                height={CELL}
                rx={10}
                fill={fillOf(n, k)}
                stroke={strokeOf(n, k)}
                strokeWidth={isActive || isParent ? 3 : 1.5}
              />
              <text
                className="dl-svg-text"
                x={x + CELL / 2}
                y={y + CELL / 2}
                textAnchor="middle"
                dominantBaseline="central"
                fill={shown ? '#0f172a' : '#94a3b8'}
              >
                {shown ? value : '?'}
              </text>
            </g>
          )
        }),
      )}
    </svg>
  )
}

/* ============================================================== ② 玩一玩 */

function C4ExploreStage({ ctx }: { ctx: StageCtx }) {
  const [seen, setSeen] = useState<Set<string>>(() => new Set([KEY(0, 0)]))
  const [active, setActive] = useState<{ n: number; k: number } | null>(null)
  const [picked, setPicked] = useState<string[]>([])

  const parents = useMemo(() => {
    if (!active || active.n === 0) return []
    const out: { n: number; k: number }[] = []
    if (active.k > 0) out.push({ n: active.n - 1, k: active.k - 1 })
    if (active.k < active.n) out.push({ n: active.n - 1, k: active.k })
    return out
  }, [active])

  const onPick = (n: number, k: number): void => {
    setSeen((prev) => {
      const next = new Set(prev)
      next.add(KEY(n, k))
      return next
    })
    setActive({ n, k })

    if (n === 0) {
      ctx.say('最顶上的 1 没有上一行，它就是起点。')
      ctx.announce('最顶上的 1 是起点，上面没有东西。')
      return
    }
    const a = k > 0 ? combinations(n - 1, k - 1) : 0
    const b = k < n ? combinations(n - 1, k) : 0
    const v = combinations(n, k)
    const parts: string[] = []
    if (k > 0) parts.push(String(a))
    if (k < n) parts.push(String(b))
    ctx.say(`${parts.join(' + ')} = ${v} —— 上面两个数加起来，就是它。`)
    ctx.announce(`${parts.join(' 加 ')} 等于 ${v}。`)

    if (n === 5) {
      ctx.say(`第 5 行的 ${v}，正好是「5 个里挑 ${k} 个」的选法数。`)
    }
  }

  const markRow = (): void => {
    if (picked.includes('row5')) return
    const ks = Array.from({ length: 6 }, (_, k) => k)
    setSeen((prev) => {
      const next = new Set(prev)
      ks.forEach((k) => next.add(KEY(5, k)))
      return next
    })
    setPicked((p) => [...p, 'row5'])
  }

  useSolveOnce(ctx, picked.includes('row5'))

  return (
    <div className="flex flex-col gap-3">
      <PlainSpeak>
        这张表叫<b>杨辉三角</b>。每个数都等于它<b>上面两个数相加</b>。
        点一个数字试试，看看是哪两个数加出来的。
      </PlainSpeak>

      <Card>
        <SectionTitle hint="两边的 1 是边界，中间全靠相加">任务：把第 5 行点出来</SectionTitle>

        <div className="overflow-x-auto rounded-xl bg-slate-50 p-2 dark:bg-slate-800/40">
          <PascalTriangle seen={seen} active={active} onPick={onPick} highlightRow={5} />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Btn variant="outline" size="sm" onClick={markRow} disabled={picked.includes('row5')}>
            我懒得一个个点，把第 5 行一次点开
          </Btn>
          <Btn
            variant="ghost"
            size="sm"
            onClick={() => {
              setSeen(new Set([KEY(0, 0)]))
              setActive(null)
              setPicked([])
            }}
          >
            重来
          </Btn>
          {picked.includes('row5') ? <Chip tone="ok">第 5 行已点开</Chip> : null}
        </div>
      </Card>

      <Card>
        <SectionTitle hint="点数字之后这里会说话">你点的那个数</SectionTitle>
        {active === null ? (
          <Callout tone="cur">先点三角里的一个数字。两边的 1 也可以点，看看它们怎么回事。</Callout>
        ) : (
          <div className="flex flex-col gap-2 text-sm leading-relaxed text-slate-700 dark:text-slate-200">
            <p>
              你点的是第 <b>{active.n}</b> 行第 <b>{active.k}</b> 个数（从 0 开始数）：
              <Formula>C({active.n}, {active.k}) = {combinations(active.n, active.k)}</Formula>
            </p>
            {active.n === 0 ? (
              <p>
                最顶上那个 1 是起点。它表示「0 个东西里挑 0 个」，只有 1 种挑法 —— 什么都不挑。
              </p>
            ) : (
              <>
                <p>
                  它上面两个数是 {parents.map((p) => combinations(p.n, p.k)).join(' 和 ')}，加起来：
                  <Formula>
                    {parents.map((p) => combinations(p.n, p.k)).join(' + ')} = {combinations(active.n, active.k)}
                  </Formula>
                </p>
                <p className="text-slate-600 dark:text-slate-300">
                  组合的意义：<Formula>C({active.n}, {active.k})</Formula> 就是从 {active.n} 个东西里挑{' '}
                  {active.k} 个的选法数。三角里的每个数，都是这么来的。
                </p>
              </>
            )}
          </div>
        )}
      </Card>

      <Callout tone={picked.includes('row5') ? 'ok' : 'cur'} role="status">
        {picked.includes('row5')
          ? '第 5 行打开了：1、5、10、10、5、1。念一遍试试 —— 左右对称。'
          : '还差一步：让第 5 行（1、5、10、10、5、1）出现在三角里。'}
      </Callout>
    </div>
  )
}

/* ============================================================== ③ 起个名 */

function C4NameStage({ ctx }: { ctx: StageCtx }) {
  const [n, setN] = useState(2)
  const [opened, setOpened] = useState(false)

  const terms = useMemo(() => binomialExpansion(n), [n])
  const rows = useMemo(() => pascal(n + 1), [n])
  const coeffs = rows[n]

  const expr = terms
    .map((t, i) => {
      const head = i === 0 ? '' : ' + '
      const c = t.coeff === 1 && n > 0 ? '' : String(t.coeff)
      return head + c + t.term
    })
    .join('')

  useSolveOnce(ctx, opened)

  return (
    <div className="flex flex-col gap-4">
      <PlainSpeak>
        你点的那些数，其实在干一件事：算 <b>(a + b)</b> 自己乘自己很多次的系数。
        下面把这句话说清楚。
      </PlainSpeak>

      <Card>
        <SectionTitle hint="点一下展开，对照着看">二项式定理：一句话说清</SectionTitle>
        <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-200">
          把 <b>(a + b)</b> 连乘 n 次，每个括号里都要挑一个字母出来乘。挑到 k 次 b（剩下的 n−k 次挑 a），
          就会得到一项 <Formula>a^(n−k) · b^k</Formula>。这样的挑法有 <Formula>C(n, k)</Formula> 种，
          所以这一项的<b>系数</b>就是 C(n, k)。
        </p>
        <p className="mt-2">
          <Formula block>
            (a + b)^n = C(n,0)a^n + C(n,1)a^(n−1)b + … + C(n,k)a^(n−k)b^k + … + C(n,n)b^n
          </Formula>
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-sm text-slate-600 dark:text-slate-300">换个 n 看看：</span>
          {[2, 3, 4, 5].map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={n === v}
              aria-label={`把 n 换成 ${v}`}
              onClick={() => setN(v)}
              className={cx(
                'h-11 min-w-11 rounded-xl border font-mono text-sm font-bold dl-transition',
                n === v
                  ? 'border-a-500 bg-a-50 text-a-700 dark:bg-a-500/20 dark:text-a-300'
                  : 'border-slate-300 bg-white text-slate-600 hover:border-a-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300',
              )}
            >
              n = {v}
            </button>
          ))}
        </div>
      </Card>

      <Card>
        <SectionTitle hint={`左边是公式，右边是杨辉三角的第 ${n} 行`}>
          (a + b)^{n} 展开，系数就在三角里
        </SectionTitle>

        {!opened ? (
          <Btn variant="primary" onClick={() => setOpened(true)}>
            点一下，展开给我看
          </Btn>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="font-mono text-sm break-all text-slate-800 dark:text-slate-100">
              (a + b)^{n} = {expr}
            </p>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[20rem] border-collapse text-sm">
                <caption className="sr-only">展开后每一项的系数，与杨辉三角第 n 行的对应关系</caption>
                <thead>
                  <tr className="text-left text-xs text-slate-500 dark:text-slate-400">
                    <th scope="col" className="py-1.5 pr-2 font-medium">
                      项
                    </th>
                    <th scope="col" className="py-1.5 pr-2 font-medium">
                      系数记号
                    </th>
                    <th scope="col" className="py-1.5 font-medium">
                      杨辉三角第 {n} 行
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {terms.map((t) => (
                    <tr key={t.k} className="border-t border-slate-200 dark:border-slate-700">
                      <td className="py-1.5 pr-2 font-mono text-slate-700 dark:text-slate-200">{t.term}</td>
                      <td className="py-1.5 pr-2">
                        <Formula>
                          C({n}, {t.k})
                        </Formula>
                      </td>
                      <td className="py-1.5 font-mono font-bold text-a-700 dark:text-a-300">{t.coeff}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Callout tone="info">
              把第 {n} 行从左往右念一遍：{coeffs.join('、')} —— 正好就是展开式里各项的系数。
              所以 <b>杨辉三角的第 n 行，就是 (a + b)^n 的系数表</b>。
            </Callout>
          </div>
        )}
      </Card>

      <Card>
        <SectionTitle hint="上标 n 表示乘几次">两个记号</SectionTitle>
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div className="rounded-lg bg-slate-50 px-2.5 py-2 dark:bg-slate-800/50">
            <dt className="font-semibold text-slate-800 dark:text-slate-100">C(n, k) 组合数</dt>
            <dd className="mt-0.5 text-slate-600 dark:text-slate-300">
              n 个里挑 k 个的选法数。也写成竖着的两行括号形式，读作「n 选 k」。
            </dd>
          </div>
          <div className="rounded-lg bg-slate-50 px-2.5 py-2 dark:bg-slate-800/50">
            <dt className="font-semibold text-slate-800 dark:text-slate-100">(a + b)^n</dt>
            <dd className="mt-0.5 text-slate-600 dark:text-slate-300">
              (a + b) 自己乘自己，一共乘 n 次。右上角那个 n 就是「乘几次」。
            </dd>
          </div>
        </dl>
      </Card>

      <Callout tone={opened ? 'ok' : 'cur'} role="status">
        {opened
          ? '展开式看过了。试着切换 n，看系数怎么跟着三角走。'
          : '先点「点一下，展开给我看」，看看展开式长什么样。'}
      </Callout>
    </div>
  )
}

/* ============================================================== ④ 练一练 */

function C4PracticeStage({ ctx }: { ctx: StageCtx }) {
  const [done, setDone] = useState(0)
  useSolveOnce(ctx, done >= 3)

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-slate-600 dark:text-slate-300">
        三道题。选错了会告诉你<b>为什么错</b>，随时可以重来。
      </p>

      <Card>
        <Quiz
          question={
            <>
              三角形里第 5 行第 2 个数（从 0 开始数）是多少？也就是 <Formula>C(5, 2)</Formula> 等于几？
            </>
          }
          resetKey="c4p1"
          onSolved={() => setDone((d) => d + 1)}
          choices={[
            {
              id: 'a',
              label: <>10</>,
              correct: true,
              why: '对。C(5,2) = C(5,3) = (5×4) ÷ (2×1) = 10。在三角里看，它就是第 4 行的 4 和 6 加起来：4 + 6 = 10。',
            },
            {
              id: 'b',
              label: <>5</>,
              correct: false,
              why: '不对。5 是它左边那个数 C(5,1)。再往右走一格，系数就变成 10 了。',
            },
            {
              id: 'c',
              label: <>20</>,
              correct: false,
              why: '不对。20 是 C(6,3)，也就是第 6 行中间那个数。行数多数了一行。',
            },
            {
              id: 'd',
              label: <>25</>,
              correct: false,
              why: '不对。25 = 5×5 是把「可重复」也算进去了。C(5,2) 不允许重复选同一个东西。',
            },
          ]}
        />
      </Card>

      <Card>
        <Quiz
          question={<>杨辉三角每一行都是左右对称的，比如 1、4、6、4、1。这说明了什么？</>}
          resetKey="c4p2"
          onSolved={() => setDone((d) => d + 1)}
          choices={[
            {
              id: 'a',
              label: (
                <>
                  <Formula>C(n, k) = C(n, n−k)</Formula>：挑出 k 个，和留下 n−k 个，是一回事。
                </>
              ),
              correct: true,
              why: '对。从 n 个里挑 k 个拿走，剩下 n−k 个；「拿走哪 k 个」和「留下哪 n−k 个」一一对应，所以数量必然相等。三角的对称就是这么来的。',
            },
            {
              id: 'b',
              label: <>三角只是画得好看，对称没什么实际含义</>,
              correct: false,
              why: '不对。对称背后是「拿走一批」和「留下一批」的对应关系，是一个能拿来做题的等式。',
            },
            {
              id: 'c',
              label: <>因为每一行的数都是偶数</>,
              correct: false,
              why: '不对。两边都是 1，是奇数。对称和奇偶性没有关系。',
            },
            {
              id: 'd',
              label: (
                <>
                  因为 <Formula>C(n, k)</Formula> 和 <Formula>P(n, k)</Formula> 相等
                </>
              ),
              correct: false,
              why: '不对。排列数和组合数一般不相等（比如 P(5,2) = 20、C(5,2) = 10）。对称说的是组合数自己的性质。',
            },
          ]}
        />
      </Card>

      <Card>
        <Quiz
          question={
            <>
              <Formula>(a + b)³</Formula> 展开后中间那一项（带 ab² 的那一项）前面的系数是多少？
            </>
          }
          resetKey="c4p3"
          onSolved={() => setDone((d) => d + 1)}
          choices={[
            {
              id: 'a',
              label: <>3</>,
              correct: true,
              why: '对。(a+b)³ = a³ + 3a²b + 3ab² + b³，系数 1、3、3、1 正好是杨辉三角第 3 行。带 b² 的那一项系数是 C(3,2) = 3。',
            },
            {
              id: 'b',
              label: <>2</>,
              correct: false,
              why: '不对。2 是 b 的指数，不是系数。系数是 C(3,2) = 3。',
            },
            {
              id: 'c',
              label: <>6</>,
              correct: false,
              why: '不对。6 是 3! 的结果，只有排列才会出现这个数。这里括号里挑 a 还是 b 只是一次选择，所以要看组合数 C(3,2) = 3。',
            },
            {
              id: 'd',
              label: <>1</>,
              correct: false,
              why: '不对。系数是 1 的是两头的 a³ 和 b³。中间两项的系数都是 3。',
            },
          ]}
        />
      </Card>
    </div>
  )
}

/* ============================================================== ⑤ 换个场景 */

const SUM_ROWS = 6

function C4TransferStage({ ctx }: { ctx: StageCtx }) {
  const [lit, setLit] = useState(0)
  const [quizDone, setQuizDone] = useState(false)

  const rows = useMemo(() => pascal(SUM_ROWS), [])
  const sums = useMemo(() => rows.map((r) => r.reduce((s, v) => s + v, 0)), [rows])

  const litAll = lit >= SUM_ROWS
  useSolveOnce(ctx, litAll && quizDone)

  return (
    <div className="flex flex-col gap-4">
      <PlainSpeak>
        换个场景：把杨辉三角的每一行加起来，会得到一串新数字。
        点「照一次」，一行一行点亮，看重放出来的是什么。
      </PlainSpeak>

      <Card>
        <SectionTitle hint="一行一行加起来">把每一行加起来看看</SectionTitle>

        <div className="flex flex-col gap-1.5">
          {rows.map((row, n) => {
            const on = n < lit
            return (
              <div
                key={n}
                className={cx(
                  'flex flex-wrap items-center gap-2 rounded-xl border px-3 py-2 dl-transition',
                  on
                    ? 'border-a-300 bg-a-50 dark:border-a-500/40 dark:bg-a-500/10'
                    : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900',
                )}
              >
                <span className="w-14 shrink-0 text-xs text-slate-500 dark:text-slate-400">第 {n} 行</span>
                <span className="font-mono text-sm text-slate-700 dark:text-slate-200">
                  {on ? row.join(' + ') : '· · ·'}
                </span>
                {on ? (
                  <span className="ml-auto font-mono text-sm font-bold text-a-700 dark:text-a-300">
                    = {sums[n]} = 2^{n}
                  </span>
                ) : null}
              </div>
            )
          })}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Btn variant="primary" onClick={() => setLit((v) => Math.min(v + 1, SUM_ROWS))} disabled={litAll}>
            照一次
          </Btn>
          <Btn variant="outline" onClick={() => setLit(0)}>
            重来
          </Btn>
          <Btn variant="ghost" onClick={() => setLit(SUM_ROWS)} disabled={litAll}>
            一次全点亮
          </Btn>
          {litAll ? <Chip tone="ok">1、2、4、8、16、32</Chip> : null}
        </div>

        <Callout tone={litAll ? 'ok' : 'info'} role="status">
          {litAll
            ? '看这一串：1、2、4、8、16、32 —— 每次翻倍，也就是 2 的 n 次方。'
            : `已经点亮 ${lit} 行，还有 ${SUM_ROWS - lit} 行。`}
        </Callout>
      </Card>

      <Card>
        <SectionTitle hint="为什么一定是 2 的 n 次方">这件事为什么成立</SectionTitle>
        <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-200">
          把 <Formula>(a + b)^n</Formula> 里的 a 和 b <b>都换成 1</b>，左边就变成{' '}
          <Formula>(1 + 1)^n = 2^n</Formula>；右边每一项也变成它的系数。所以右边加起来必须等于 2ⁿ。
        </p>
        <p className="mt-2 text-sm leading-relaxed text-slate-700 dark:text-slate-200">
          换个说法也一样：第 n 行加起来 = <Formula>C(n,0) + C(n,1) + … + C(n,n)</Formula>，
          这等于「从 n 个东西里<b>随便挑几个</b>（挑 0 个、1 个、……、n 个都行）的方案数」。
          每个东西都有「要」和「不要」两种状态，n 个东西就是 <Formula>2^n</Formula> 种。
        </p>

        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[18rem] border-collapse text-sm">
            <caption className="sr-only">n 从 0 到 5 时，杨辉三角每行之和与 2 的 n 次方的对照</caption>
            <thead>
              <tr className="text-left text-xs text-slate-500 dark:text-slate-400">
                <th scope="col" className="py-1.5 pr-2 font-medium">
                  n
                </th>
                <th scope="col" className="py-1.5 pr-2 font-medium">
                  这一行
                </th>
                <th scope="col" className="py-1.5 pr-2 font-medium">
                  加起来
                </th>
                <th scope="col" className="py-1.5 font-medium">
                  2ⁿ
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, n) => (
                <tr key={n} className="border-t border-slate-200 dark:border-slate-700">
                  <td className="py-1.5 pr-2 font-mono text-slate-600 dark:text-slate-300">{n}</td>
                  <td className="py-1.5 pr-2 font-mono text-slate-700 dark:text-slate-200">{row.join('、')}</td>
                  <td className="py-1.5 pr-2 font-mono font-bold text-a-700 dark:text-a-300">{sums[n]}</td>
                  <td className="py-1.5 font-mono text-slate-600 dark:text-slate-300">2^{n} = {Math.pow(2, n)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <Quiz
          question={<>杨辉三角里，把第 6 行（1、6、15、20、15、6、1）全部加起来，得到多少？</>}
          resetKey="c4t1"
          onSolved={() => setQuizDone(true)}
          choices={[
            {
              id: 'a',
              label: <>64</>,
              correct: true,
              why: '对。第 n 行加起来永远等于 2ⁿ。第 6 行就是 2⁶ = 64。可以验算：1+6+15+20+15+6+1 = 64。',
            },
            {
              id: 'b',
              label: <>36</>,
              correct: false,
              why: '不对。36 是把行号当成了答案（6×6）。行的和不是这么算的，它是 2 的 n 次方。',
            },
            {
              id: 'c',
              label: <>21</>,
              correct: false,
              why: '不对。21 = 1+2+3+4+5+6，是把 1 到 6 相加的结果，跟杨辉三角没关系。',
            },
            {
              id: 'd',
              label: <>128</>,
              correct: false,
              why: '不对。128 = 2⁷，那是第 7 行的和。第 6 行的和是 64。',
            },
          ]}
        />
      </Card>
    </div>
  )
}

/* ============================================================== 导出 */

const topic: Topic = {
  id: 'C4',
  title: '二项式定理与杨辉三角',
  moduleId: 'counting',
  oneLiner: '(a+b)ⁿ 展开的系数，就藏在杨辉三角里',
  outcome: '你能说出 (a+b)ⁿ 展开后每一项的系数是 C(n,k)，并且能从杨辉三角里把系数直接读出来。',
  prerequisites: ['C2'],
  bigIdea:
    '把 (a+b) 连乘 n 次，每个括号挑一个字母。挑到几次 b，就有几种挑法，这个「几种」就是 C(n,k) —— 杨辉三角一整张表，装的就是这些数。',
  misconceptions: [
    {
      wrong: '(a+b)² 的中间项应该是 1 个 ab，写成 a² + ab + b²',
      right:
        '漏了一块。正方形被分成四块：一块 a²、一块 b²、还有两块一样的 ab（横一块竖一块），所以是 a² + 2ab + b²。那个 2 是真实存在的第二块。',
    },
    {
      wrong: '杨辉三角就是「上面两个数相加」的规律，跟组合数没关系',
      right:
        '两者是同一件事。三角形里第 n 行第 k 个数就是 C(n,k)，而「上面两个数相加」正是组合数的递推式 C(n,k) = C(n−1,k−1) + C(n−1,k)。',
    },
    {
      wrong: '(a+b)³ 展开后 ab² 那一项的系数是 3! = 6',
      right:
        '不是 6。系数是 C(3,2) = 3。6 是把「三个括号挑出来的顺序」也算进去了，可是括号本身是有先后位置的，不需要再排一次。',
    },
    {
      wrong: '杨辉三角每一行加起来没有规律',
      right:
        '每一行的和都是 2 的 n 次方：1、2、4、8、16……因为把 a 和 b 都换成 1，左边就是 (1+1)ⁿ = 2ⁿ。',
    },
  ],
  formalDefinition: (
    <>
      <p>
        <b>二项式定理：</b>
        <span className="font-mono">(a + b)^n = Σ C(n, k) · a^(n−k) · b^k</span>
        <span className="text-xs text-slate-500 dark:text-slate-400">（k 从 0 加到 n）</span>
      </p>
      <p>
        <b>组合数记号：</b>
        <span className="font-mono">C(n, k) = n! / (k!(n−k)!)</span>
      </p>
      <p>
        <b>杨辉三角的递推：</b>
        <span className="font-mono">C(n, k) = C(n−1, k−1) + C(n−1, k)</span>
        <span className="text-xs text-slate-500 dark:text-slate-400">（这就是「上面两个数相加」）</span>
      </p>
      <p>
        <b>行的和：</b>
        <span className="font-mono">Σ C(n, k) = 2^n</span>
      </p>
    </>
  ),
  glossary: [
    { term: '二项式', plain: '两个字母 a 和 b 加起来，再乘自己若干次。(a + b)ⁿ 就叫二项式。' },
    { term: '系数', plain: '字母前面的那个数。比如 3ab² 里，3 就是系数。' },
    { term: '杨辉三角', plain: '一个数字塔：两边都是 1，中间每个数等于它上面两个数相加。', formal: '第 n 行第 k 个数 = C(n,k)' },
    { term: '组合数 C(n,k)', plain: 'n 个里挑 k 个的选法数。', formal: 'C(n,k) = n!/(k!(n−k)!)' },
    { term: '展开', plain: '把括号都乘开，写成一个个项相加的样子。' },
    { term: '对称性', plain: '每一行左右对称：挑 k 个拿走，和留下 n−k 个，是一回事。', formal: 'C(n,k) = C(n,n−k)' },
  ],
  stages: [
    {
      label: '① 看一看',
      short: '看',
      narration: '边长 a 加 b 的正方形，切两刀变成四块。',
      requireSolve: true,
      hints: [
        '点按钮，一刀一刀地切，注意每切一刀多出几块。',
        '竖着切一刀得到 a² 和一块 ab；横着再切一刀，又多出一块 ab 和一块 b²。',
        '四块是 a²、ab、ab、b²。把它们加起来就是 a² + 2ab + b² —— 那个 2 就是两块一模一样的长方形。',
      ],
      render: (ctx) => <C4HookStage ctx={ctx} />,
    },
    {
      label: '② 玩一玩',
      short: '玩',
      narration: '点一个数字，看它由上面哪两个数加出来。',
      requireSolve: true,
      hints: [
        '每个数都等于它左上和右上那两个数相加。先点几个中间的数体会一下。',
        '第 5 行在从上往下第 6 层（第 0 行在最上面），它应该有 6 个数。',
        '第 5 行是 1、5、10、10、5、1。挨个点开就行 —— 不想点也可以用下面的「把第 5 行一次点开」。',
      ],
      render: (ctx) => <C4ExploreStage ctx={ctx} />,
    },
    {
      label: '③ 起个名',
      short: '名',
      narration: '你点的那些数，就是 (a+b)ⁿ 展开后的系数。',
      requireSolve: true,
      hints: [
        '把 n 换成几个不同的值，看展开式的系数是不是每次都和三角里的某一行一模一样。',
        '展开式里带 b^k 的那一项，系数就是 C(n,k)，而 C(n,k) 正是三角第 n 行第 k 个数。',
        '点「点一下，展开给我看」，就有完整公式和逐项对照表了。比如 (a+b)³ = a³ + 3a²b + 3ab² + b³。',
      ],
      render: (ctx) => <C4NameStage ctx={ctx} />,
    },
    {
      label: '④ 练一练',
      short: '练',
      narration: '三道题：查组合数、说对称、算展开系数。',
      requireSolve: true,
      hints: [
        '拿不准的时候，就把杨辉三角写出来对着找。',
        'C(5,2) 在三角的第 5 行；对称性说的是「挑出来」和「留下来」是一回事。',
        '三道题的正确选项依次是：C(5,2) = 10；C(n,k) = C(n,n−k)；(a+b)³ 里 ab² 的系数是 3。',
      ],
      render: (ctx) => <C4PracticeStage ctx={ctx} />,
    },
    {
      label: '⑤ 换个场景',
      short: '变',
      narration: '把杨辉三角每行加起来，点「照一次」看看。',
      requireSolve: true,
      hints: [
        '一行一行地加，把和写下来：1、2、4、8……看看这串数有什么规律。',
        '每一行的和都是前一行的两倍，也就是 2 的 n 次方。',
        '原因是把 a 和 b 都换成 1，左边变成 (1+1)ⁿ = 2ⁿ，右边就只剩下系数相加。点亮所有行，再答对下面那题就好。',
      ],
      render: (ctx) => <C4TransferStage ctx={ctx} />,
    },
  ],
}

export default topic
