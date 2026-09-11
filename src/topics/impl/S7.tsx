import { useState } from 'react'

import { pigeonholeLowerBound } from '@/kernels/counting'
import { Btn, Callout, Card, Chip, Math as Formula, PlainSpeak, SectionTitle, SliderRow, cx } from '@/ui'
import { Quiz } from '@/ui/Quiz'
import { useSolveOnce } from '../hooks'
import type { StageCtx, Topic } from '../types'

/* ============================================================== ① 看一看 */

const MONTHS = ['1 月', '2 月', '3 月', '4 月', '5 月', '6 月', '7 月', '8 月', '9 月', '10 月', '11 月', '12 月']

/** 13 个人的生日月份分布：3 月挤了两个，其余每月一个 —— 合计 13 */
const MONTH_COUNTS = [1, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1]

interface Guess {
  id: string
  label: string
  correct: boolean
  why: string
}

const GUESSES: Guess[] = [
  {
    id: 'must',
    label: '一定有两个人同一个月',
    correct: true,
    why: '对。月份只有 12 个，人却有 13 个。就算前 12 个人分别占满 12 个月，第 13 个人也只能挤进已经有人待着的那个月。',
  },
  {
    id: 'maybe',
    label: '可能没有，全看运气',
    correct: false,
    why: '不对。这件事和运气无关：月份只有 12 个，第 13 个人没有「空月份」可去，无论怎么安排都躲不开。',
  },
  {
    id: 'never',
    label: '一定找不到同月的两个人',
    correct: false,
    why: '不对，而且正好相反。想凑出 13 个「月份各不相同」的人，只有 12 个月可以用，第 13 个人必然和前 12 个中的某一个撞上。',
  },
]

function HookStage({ ctx }: { ctx: StageCtx }) {
  const [guess, setGuess] = useState<string | null>(null)
  const [revealed, setRevealed] = useState(false)

  // 先猜（按钮要求猜过才亮），再点「看看怎么分」—— 两件事都做了才算这一步走完
  useSolveOnce(ctx, revealed)

  const pick = (g: Guess): void => {
    if (revealed) return
    setGuess(g.id)
    ctx.announce(g.correct ? '猜对了。' : '再想想。')
    ctx.say(g.correct ? '猜对了，13 个人一定有两个同月。' : '不太对，看看下面的解释。', g.correct ? 'accept' : 'reject')
  }

  const reveal = (): void => {
    setRevealed(true)
    ctx.say('数一数：13 个人塞进 12 个月，总有一个月挤两个。', 'accept')
    ctx.announce('13 个人放进 12 个月，一定有一个月至少有两个人。')
  }

  const pickedGuess = GUESSES.find((g) => g.id === guess)

  return (
    <div className="flex flex-col gap-3">
      <PlainSpeak>
        一个班里有 13 个人。<b>先猜一猜</b>：他们的生日月份里，一定有两个人同一个月吗？
      </PlainSpeak>

      <div className="flex flex-col gap-2" role="group" aria-label="先猜一猜">
        {GUESSES.map((g) => {
          const active = guess === g.id
          const showRight = revealed && g.correct
          return (
            <button
              key={g.id}
              type="button"
              aria-pressed={active}
              aria-label={`猜：${g.label}${showRight ? '（正确答案）' : ''}`}
              disabled={revealed}
              onClick={() => pick(g)}
              className={cx(
                'min-h-11 w-full rounded-xl border px-3 py-2 text-left text-sm font-medium dl-transition disabled:cursor-not-allowed',
                active && g.correct
                  ? 'border-ok-500 bg-ok-50 text-ok-700 dark:bg-ok-500/15 dark:text-ok-500'
                  : active
                    ? 'border-bad-500 bg-bad-50 text-bad-700 dark:bg-bad-500/15 dark:text-bad-500'
                    : showRight
                      ? 'border-ok-500 bg-ok-50 text-ok-700 dark:bg-ok-500/15 dark:text-ok-500'
                      : 'border-slate-300 bg-white text-slate-700 hover:border-a-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200',
              )}
            >
              {g.label}
              {showRight ? <span className="ml-2 text-xs">（正确答案）</span> : null}
            </button>
          )
        })}
      </div>

      {pickedGuess ? (
        <Callout tone={pickedGuess.correct ? 'ok' : 'bad'} role="status">
          {pickedGuess.correct ? '✓ 对，' : '✗ 再想想：'}
          {pickedGuess.why}
        </Callout>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Btn variant="primary" onClick={reveal} disabled={revealed || guess === null} aria-label="看看 13 个人是怎么分进 12 个月的">
          {revealed ? '已经看过了' : '看看 13 个人怎么分 ↓'}
        </Btn>
        {guess === null ? <span className="text-xs text-slate-500 dark:text-slate-400">先选一个答案，再看结果。</span> : null}
      </div>

      {revealed ? (
        <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/40">
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4" aria-label="12 个月各分到几个人">
            {MONTHS.map((m, i) => {
              const c = MONTH_COUNTS[i]
              return (
                <li
                  key={m}
                  className={cx(
                    'rounded-lg border px-2 py-1.5 text-center',
                    c >= 2
                      ? 'border-cur-500 bg-cur-50 dark:bg-cur-500/15'
                      : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900',
                  )}
                >
                  <div className="text-xs text-slate-500 dark:text-slate-400">{m}</div>
                  <div className="mt-0.5 flex justify-center gap-0.5" aria-hidden="true">
                    {Array.from({ length: c }, (_, k) => (
                      <span key={k} className="text-base leading-none">
                        🧑
                      </span>
                    ))}
                  </div>
                  <div className="sr-only">这个月有 {c} 个人</div>
                </li>
              )
            })}
          </ul>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            13 个人、12 个月，人手一个月的排法只够 12 个人用，第 13 个人一定会挤进已经有人待着的那一格。
          </p>
        </div>
      ) : null}
    </div>
  )
}

/* ============================================================== ② 玩一玩 */

const PIGEONS = ['鸽 1', '鸽 2', '鸽 3', '鸽 4', '鸽 5']
const HOLES = ['洞 1', '洞 2', '洞 3', '洞 4']

function ExploreStage({ ctx }: { ctx: StageCtx }) {
  const [where, setWhere] = useState<Record<string, string>>({})
  const [sel, setSel] = useState<string | null>(null)

  const counts = HOLES.map((h) => PIGEONS.filter((p) => where[p] === h).length)
  const placedCount = PIGEONS.filter((p) => where[p] !== undefined).length
  const allPlaced = placedCount === PIGEONS.length
  const crowded = HOLES.filter((_, i) => counts[i] >= 2)

  useSolveOnce(ctx, allPlaced && crowded.length > 0)

  const clickPigeon = (p: string): void => {
    if (where[p]) {
      setWhere((w) => {
        const copy = { ...w }
        delete copy[p]
        return copy
      })
      setSel(p)
      ctx.say(`把 ${p} 拿回来了，再点一个洞放进去。`)
      return
    }
    setSel(p)
    ctx.say(`手上拿着 ${p}，点一个洞把它放进去。`)
  }

  const clickHole = (h: string, idx: number): void => {
    if (!sel) {
      if (counts[idx] >= 2) {
        ctx.say(`${h} 里挤了 ${counts[idx]} 只 —— 洞不够分。`, 'accept')
        ctx.announce(`${h} 里有 ${counts[idx]} 只鸽子。`)
      } else {
        ctx.say('先点上面一只鸽子，再点这个洞。', 'reject')
      }
      return
    }
    const picked = sel
    const after = { ...where, [picked]: h }
    const afterCount = PIGEONS.filter((p) => after[p] === h).length
    const afterPlaced = PIGEONS.filter((p) => after[p] !== undefined).length
    setWhere(after)
    setSel(null)
    if (afterCount >= 2) {
      ctx.say(`${h} 里挤了 ${afterCount} 只！`, 'accept')
      ctx.announce(`${picked} 放进了 ${h}。这个洞里现在有 ${afterCount} 只。`)
    } else if (afterPlaced === PIGEONS.length) {
      ctx.say('5 只都放好了，看看哪个洞挤了两只。')
      ctx.announce('5 只鸽子都放好了。')
    } else {
      ctx.say(`把 ${picked} 放进了 ${h}。`, 'normal')
      ctx.announce(`${picked} 放进了 ${h}。`)
    }
  }

  const reset = (): void => {
    setWhere({})
    setSel(null)
    ctx.say('全部拿出来了，重新放一遍。')
  }

  return (
    <div className="flex flex-col gap-3">
      <PlainSpeak>
        5 只鸽子要住进 4 个洞。<b>先点一只鸽子，再点一个洞</b>，它就住进去了。点洞里的鸽子可以把它拿回来。
      </PlainSpeak>

      <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-800/40">
        <div className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">鸽子（点一只拿在手上）</div>
        <div className="flex flex-wrap gap-2">
          {PIGEONS.map((p) => {
            const on = sel === p
            const placed = where[p] !== undefined
            return (
              <button
                key={p}
                type="button"
                aria-pressed={on}
                aria-label={`${p}${placed ? `，已经放进 ${where[p]}` : '，还没放进去'}${on ? '，现在拿在手上' : ''}`}
                onClick={() => clickPigeon(p)}
                className={cx(
                  'inline-flex min-h-11 items-center gap-1.5 rounded-xl border px-3 text-sm font-medium dl-transition',
                  on
                    ? 'border-cur-500 bg-cur-50 text-cur-700 dark:bg-cur-500/20 dark:text-cur-500'
                    : placed
                      ? 'border-slate-200 bg-slate-100 text-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-500'
                      : 'border-slate-300 bg-white text-slate-700 hover:border-a-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200',
                )}
              >
                <span aria-hidden="true">🕊️</span>
                {p}
              </button>
            )
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {HOLES.map((h, i) => {
          const hot = counts[i] >= 2
          const inside = PIGEONS.filter((p) => where[p] === h)
          return (
            <button
              key={h}
              type="button"
              aria-label={`${h}，里面现在有 ${counts[i]} 只鸽子${hot ? '，挤了两只以上' : ''}`}
              onClick={() => clickHole(h, i)}
              className={cx(
                'flex min-h-28 flex-col items-center gap-1 rounded-xl border-2 border-dashed px-2 py-2 text-center dl-transition',
                hot
                  ? 'border-cur-500 bg-cur-50 dark:bg-cur-500/15'
                  : 'border-slate-300 bg-white hover:border-a-500 dark:border-slate-600 dark:bg-slate-900',
              )}
            >
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{h}</span>
              <span className="flex flex-wrap justify-center gap-0.5" aria-hidden="true">
                {inside.map((p) => (
                  <span key={p} className="text-base leading-none">
                    🕊️
                  </span>
                ))}
              </span>
              <span className={cx('text-xs', hot ? 'font-semibold text-cur-700 dark:text-cur-500' : 'text-slate-500 dark:text-slate-400')}>
                {counts[i]} 只{hot ? '（挤了）' : ''}
              </span>
            </button>
          )
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Btn size="sm" variant="outline" onClick={reset} aria-label="把所有鸽子拿出来重新放">
          全部拿出来
        </Btn>
        <Chip tone={allPlaced ? 'ok' : 'dim'}>已放进 {placedCount} / 5 只</Chip>
        {sel ? <Chip tone="cur">手上：{sel}</Chip> : null}
      </div>

      <Callout tone={allPlaced && crowded.length > 0 ? 'ok' : 'cur'} role="status">
        {!allPlaced
          ? `还差 ${PIGEONS.length - placedCount} 只没放。5 只鸽子、4 个洞，试试怎么放都行。`
          : `放好了。发亮的洞（${crowded.join('、')}）里至少有 2 只 —— 5 只鸽子塞 4 个洞，一定有一个洞要挤两只。`}
      </Callout>
    </div>
  )
}

/* ============================================================== ③ 起个名 */

const NAME_EXAMPLES: [number, number][] = [
  [13, 12],
  [5, 4],
  [7, 3],
  [10, 4],
]

function NameStage({ ctx }: { ctx: StageCtx }) {
  const [n, setN] = useState(5)
  const [m, setM] = useState(3)
  const bound = pigeonholeLowerBound(n, m)

  // 任务：亲手调出「13 个人 / 12 个月」这一组，看公式给出几
  useSolveOnce(ctx, n === 13 && m === 12)

  return (
    <div className="flex flex-col gap-4">
      <PlainSpeak>
        你刚做的事，数学上叫<b>鸽巢原理</b>：东西比抽屉多，就一定有一个抽屉塞了两样。用公式说就是 ⌈n/m⌉。
      </PlainSpeak>

      <Card>
        <SectionTitle hint="⌈x⌉ 读作「x 向上取整」">一句话 + 一个式子</SectionTitle>
        <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-200">
          把 <Formula>n</Formula> 只鸽子放进 <Formula>m</Formula> 个洞，那么<b>至少有一个洞</b>里装着
          <Formula>⌈n / m⌉</Formula> 只或更多。这里 ⌈ ⌉ 的意思是「往上取整」：算出来不是整数就往上进一格，
          因为「半只鸽子」是不可能的，装到 1.5 只就意味着至少 2 只。
        </p>
        <div className="mt-3 rounded-xl bg-slate-50 px-3 py-2.5 dark:bg-slate-800/50">
          <Formula block>
            ⌈{n} / {m}⌉ = {bound}
          </Formula>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            也就是说：{n} 只鸽子放进 {m} 个洞，至少有一个洞装着 <b>{bound}</b> 只或更多。
          </p>
        </div>
      </Card>

      <Card className="flex flex-col gap-4">
        <SectionTitle hint="拖动或按方向键">自己调一调，看见公式跟着变</SectionTitle>
        <SliderRow
          label="鸽子数 n"
          value={n}
          min={1}
          max={24}
          onChange={setN}
          hint="东西有多少"
        />
        <SliderRow
          label="洞数 m"
          value={m}
          min={1}
          max={12}
          onChange={setM}
          hint="抽屉有多少"
        />
        <Callout tone={n === 13 && m === 12 ? 'ok' : 'cur'} role="status">
          {n === 13 && m === 12
            ? '这就是开头那道题：13 个人、12 个月，⌈13/12⌉ = 2 —— 一定有两个人同月。'
            : '任务：把鸽子数调到 13、洞数调到 12，看看公式给出几。'}
        </Callout>
      </Card>

      <Card>
        <SectionTitle hint="都是同一个公式算出来的">几个常见例子</SectionTitle>
        <ul className="flex flex-col gap-2">
          {NAME_EXAMPLES.map(([pn, pm]) => {
            const b = pigeonholeLowerBound(pn, pm)
            return (
              <li key={`${pn}-${pm}`} className="flex flex-wrap items-baseline justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm dark:bg-slate-800/50">
                <span className="text-slate-700 dark:text-slate-200">
                  {pn} 只鸽子放进 {pm} 个洞
                </span>
                <span className="font-mono text-slate-600 dark:text-slate-300">
                  ⌈{pn}/{pm}⌉ = {b}
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">至少有一个洞装 {b} 只</span>
              </li>
            )
          })}
        </ul>
        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
          注意 n ≤ m 时算出来是 1 —— 那是句废话（「至少有一个洞装 1 只」），什么也没保证。公式真正有用的时候是 n &gt; m。
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
      <p className="text-sm text-slate-600 dark:text-slate-300">
        三道题。选错了会讲清楚错在哪，可以立刻重选。
      </p>

      <Card>
        <Quiz
          question={<>抽屉里只有黑、白两种颜色的袜子，闭着眼睛摸。至少要摸出几只，才能保证有一双同色？</>}
          resetKey="s7p1"
          onSolved={() => setSolvedCount((c) => c + 1)}
          choices={[
            {
              id: 'a',
              label: '3 只',
              correct: true,
              why: '对。两种颜色就是 2 个抽屉，摸出 3 只时 ⌈3/2⌉ = 2，一定有两只是同一个颜色 —— 那就是一双。摸 2 只时可能正好一黑一白，保证不了。',
            },
            {
              id: 'b',
              label: '2 只',
              correct: false,
              why: '不对。摸出 2 只完全可能是一黑一白，凑不成一双。要「保证」就不能允许这种情况存在。',
            },
            {
              id: 'c',
              label: '4 只',
              correct: false,
              why: '不对。4 只当然也能保证，但问题问的是「至少」。3 只就已经保证了，4 只多摸了一只。',
            },
          ]}
        />
      </Card>

      <Card>
        <Quiz
          question={<>一个班至少要有多少人，才能保证有两个人同一个月过生日？</>}
          resetKey="s7p2"
          onSolved={() => setSolvedCount((c) => c + 1)}
          choices={[
            {
              id: 'a',
              label: '13 人',
              correct: true,
              why: '对。12 个月就是 12 个抽屉，要逼出「同一个抽屉里有 2 个人」，人数得比 12 多，所以是 12 + 1 = 13。',
            },
            {
              id: 'b',
              label: '12 人',
              correct: false,
              why: '不对。12 个人可以刚好一人一个月，全部月份各不相同 —— 这种情况下没有两个人同月。',
            },
            {
              id: 'c',
              label: '24 人',
              correct: false,
              why: '不对。24 人当然保证同月，但远远不是「至少」。13 个人就已经躲不开了。',
            },
          ]}
        />
      </Card>

      <Card>
        <Quiz
          question={<>从 1 到 10 里随便取 6 个数，为什么一定有两个数互质？</>}
          resetKey="s7p3"
          onSolved={() => setSolvedCount((c) => c + 1)}
          choices={[
            {
              id: 'a',
              label: '把 1–10 分成 5 组（1,2）（3,4）（5,6）（7,8）（9,10），每组里两个数都互质；6 个数丢进 5 组，必有两个落在同一组',
              correct: true,
              why: '对。这就是鸽巢原理：5 个抽屉、6 个数，必有两个同抽屉。而每一组里两个数都是相邻整数，最大公约数只能是 1，所以它们互质。',
            },
            {
              id: 'b',
              label: '因为 1 和任何数都互质，而 6 个数里一定包含 1',
              correct: false,
              why: '不对。6 个数里可以没有 1，比如取 2、3、4、5、6、7，里面就没有 1。这题的关键是分组，而不是 1 在不在。',
            },
            {
              id: 'c',
              label: '因为 6 个数里一定有两个相邻的偶数，相邻偶数互质',
              correct: false,
              why: '不对，这句话本身就不成立：4 和 6 都是偶数，它们的最大公约数是 2，并不互质。而且 1–10 里一共只有 5 个偶数，取 6 个数也凑不出「两个相邻偶数」这种说法。',
            },
          ]}
        />
      </Card>
    </div>
  )
}

/* ============================================================== ⑤ 换个场景 */

/** 10 个候选整数，余数覆盖 0/1/2/3 四类 */
const CANDIDATES = [3, 7, 8, 11, 13, 19, 24, 26, 30, 21]

const BOX_LABELS = ['余 0', '余 1', '余 2', '余 3']

function TransferStage({ ctx }: { ctx: StageCtx }) {
  const [picked, setPicked] = useState<number[]>([])
  const [whyDone, setWhyDone] = useState(false)

  const full = picked.length === 5
  useSolveOnce(ctx, full && whyDone)

  const boxes = [0, 1, 2, 3].map((r) => picked.filter((x) => ((x % 4) + 4) % 4 === r))
  const hotIndex = boxes.findIndex((b) => b.length >= 2)
  const hot = boxes[hotIndex] ?? []
  const pair = hot.length >= 2 ? [hot[0], hot[1]] : null
  const diff = pair ? Math.abs(pair[0] - pair[1]) : 0

  const toggle = (x: number): void => {
    if (picked.includes(x)) {
      setPicked(picked.filter((v) => v !== x))
      ctx.say(`把 ${x} 拿出来了。`)
      return
    }
    if (picked.length >= 5) {
      ctx.say('已经取了 5 个了，先拿掉一个再换。', 'reject')
      return
    }
    setPicked([...picked, x])
    ctx.say(`把 ${x} 丢进「${BOX_LABELS[((x % 4) + 4) % 4]}」这个盒子。`)
  }

  return (
    <div className="flex flex-col gap-3">
      <PlainSpeak>
        换个场景：随便取 5 个整数。<b>看它们除以 4 的余数</b>，把每个数丢进对应的盒子。想想为什么一定有两个数落在同一个盒子里。
      </PlainSpeak>

      <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/40">
        <div className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
          从下面挑 5 个数（已选 {picked.length} / 5）
        </div>
        <div className="flex flex-wrap gap-2">
          {CANDIDATES.map((x) => {
            const on = picked.includes(x)
            return (
              <button
                key={x}
                type="button"
                aria-pressed={on}
                aria-label={`${x}${on ? '，已选，再点一下取消' : '，点一下选中'}`}
                onClick={() => toggle(x)}
                className={cx(
                  'min-h-11 min-w-11 rounded-xl border font-mono text-base font-bold dl-transition',
                  on
                    ? 'border-a-500 bg-a-50 text-a-700 dark:bg-a-500/20 dark:text-a-300'
                    : 'border-slate-300 bg-white text-slate-700 hover:border-a-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200',
                )}
              >
                {x}
              </button>
            )
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {BOX_LABELS.map((label, r) => {
          const inside = boxes[r]
          const isHot = inside.length >= 2
          return (
            <div
              key={label}
              className={cx(
                'flex min-h-24 flex-col items-center gap-1 rounded-xl border-2 border-dashed px-2 py-2 text-center',
                isHot
                  ? 'border-cur-500 bg-cur-50 dark:bg-cur-500/15'
                  : 'border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-900',
              )}
            >
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{label}</span>
              <span className="flex flex-wrap justify-center gap-1 font-mono text-sm text-slate-700 dark:text-slate-200">
                {inside.length === 0 ? <span className="text-xs text-slate-400">空</span> : inside.map((x) => <span key={x}>{x}</span>)}
              </span>
              <span className={cx('text-xs', isHot ? 'font-semibold text-cur-700 dark:text-cur-500' : 'text-slate-500 dark:text-slate-400')}>
                {inside.length} 个
              </span>
            </div>
          )
        })}
      </div>

      <Callout tone={full && hotIndex >= 0 ? 'ok' : 'cur'} role="status">
        {!full ? (
          `还差 ${5 - picked.length} 个数。只要取满 5 个，就一定有两个落在同一个盒子里 —— 盒子只有 4 个。`
        ) : pair ? (
          <>
            看「{BOX_LABELS[hotIndex]}」这个盒子：{pair[0]} 和 {pair[1]} 余数相同。
            <span className="font-mono">
              {' '}
              {Math.max(pair[0], pair[1])} − {Math.min(pair[0], pair[1])} = {diff} = 4 × {diff / 4}
            </span>
            ，差正好是 4 的倍数。
          </>
        ) : (
          '取满 5 个数，看看哪个盒子里挤了两个。'
        )}
      </Callout>

      <Card>
        <Quiz
          question={<>为什么落在同一个盒子里的两个数，它们的差一定是 4 的倍数？</>}
          resetKey="s7t1"
          onSolved={() => setWhyDone(true)}
          choices={[
            {
              id: 'a',
              label: '因为它们除以 4 的余数相同，相减时余数正好互相抵消，剩下的部分一定是 4 的倍数',
              correct: true,
              why: '对。两个数都写成「4 的倍数 + 相同的余数」，相减时那个余数被抵消掉，差就成了 4 的倍数。比如 13 = 4×3 + 1、21 = 4×5 + 1，21 − 13 = 4×2。',
            },
            {
              id: 'b',
              label: '因为它们两个本身都是 4 的倍数',
              correct: false,
              why: '不对。盒子里的数本身通常不是 4 的倍数：13 和 21 除以 4 都余 1，它们都不是 4 的倍数，但差 8 是。真正被保证的是「差」，不是这两个数。',
            },
            {
              id: 'c',
              label: '因为盒子一共只有 4 个，所以差只能是 4',
              correct: false,
              why: '不对。盒子的个数只能保证「有两个数落在同一个盒子」，它不决定差是多少 —— 差是 4 的倍数，可以是 4、8、12……',
            },
          ]}
        />
      </Card>

      <Card>
        <SectionTitle hint="把整套推理走一遍">为什么「5 个数必有 2 个之差是 4 的倍数」</SectionTitle>
        <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-sm leading-relaxed text-slate-700 dark:text-slate-200">
          <li>每个整数除以 4，余数只能是 0、1、2、3 这四种 —— 这就是 4 个盒子。</li>
          <li>取 5 个数，就是往 4 个盒子里丢 5 个东西。</li>
          <li>按鸽巢原理 ⌈5/4⌉ = 2，一定有两个数落在同一个盒子里。</li>
          <li>同一个盒子里的两个数余数相同，相减时余数抵消，差一定是 4 的倍数。</li>
        </ol>
      </Card>
    </div>
  )
}

/* ============================================================== 导出 */

const topic: Topic = {
  id: 'S7',
  title: '鸽巢原理',
  moduleId: 'sets',
  oneLiner: '东西比抽屉多，就一定有一个抽屉塞了两样',
  outcome: '你能用「抽屉比东西少」这种想法，证明某两个东西必然撞在一起，并算出至少挤几只。',
  prerequisites: ['S1'],
  bigIdea:
    '只要东西比抽屉多，就一定有一个抽屉里塞了两样。听上去像废话，但它能证明「13 个人必有两人同月」「5 个整数必有两个之差是 4 的倍数」这类看起来很神奇的事。',
  misconceptions: [
    {
      wrong: '鸽巢原理能告诉我们到底是哪两个人同月',
      right: '它只保证「存在」，指不出具体是谁。就像抽屉里摸袜子：能保证有一双同色，但说不出是黑的那双还是白的那双。',
    },
    {
      wrong: '13 个人里一定恰好有两个人同月',
      right: '只是「至少有两个人」。13 个人也可能全挤在同一个月里，那时同月的人远远不止两个。',
    },
    {
      wrong: '12 个人就可以保证有两个人同月了',
      right: '不行。12 个人可以刚好一人占一个月，全部月份各不相同。要逼出同月，人数必须比 12 多，也就是 13。',
    },
  ],
  formalDefinition: (
    <>
      <p>
        <b>鸽巢原理（简单形式）：</b>
        <span className="font-mono">把 n 只鸽子放进 m 个洞，若 n &gt; m，则至少有一个洞装着 ≥ 2 只鸽子</span>
      </p>
      <p>
        <b>加强形式（下界公式）：</b>
        <span className="font-mono">至少有一个洞装着 ⌈n / m⌉ 只或更多</span>
      </p>
      <p>
        <b>⌈x⌉ 向上取整：</b>
        <span className="font-mono">⌈2.01⌉ = 3，⌈3⌉ = 3</span>
      </p>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        为什么是 ⌈n/m⌉：如果每个洞都不超过 ⌈n/m⌉ − 1 只，那么 m 个洞一共最多装 m × (⌈n/m⌉ − 1) &lt; n 只，装不下，
        所以一定有个洞达到 ⌈n/m⌉ 只。
      </p>
    </>
  ),
  glossary: [
    { term: '鸽巢原理', plain: '东西比抽屉多，就一定有一个抽屉里塞了两样。', formal: 'n > m 时必有一个洞装 ≥ 2 只' },
    { term: '抽屉（洞）', plain: '东西被分到的那些类别。比如 12 个月、4 种余数。', formal: '把全体分成 m 个互不相交的类' },
    { term: '向上取整 ⌈x⌉', plain: '结果不是整数就往大里进一格。', formal: '⌈x⌉ = 不小于 x 的最小整数' },
    { term: '至少 / 保证', plain: '不管怎么放都躲不掉，而不是「运气好时会发生」。', formal: '对一切可能的分配都成立' },
    { term: '模 4 余数', plain: '一个整数除以 4 剩下来的数，只能是 0、1、2、3。', formal: 'x mod 4 ∈ {0,1,2,3}' },
    { term: '互质', plain: '两个数的最大公约数是 1，除了 1 没有别的共同因数。', formal: 'gcd(a, b) = 1' },
  ],
  stages: [
    {
      label: '① 看一看',
      short: '看',
      narration: '13 个人里，一定有两人同月生日吗？',
      requireSolve: true,
      hints: [
        '先凭感觉选一个，再想想有没有办法让 13 个人的生日月份全都不一样。',
        '试着一人占一个月：12 个月最多安排 12 个人，那第 13 个人往哪放？',
        '答案是「一定有」。选第一个选项，再点「看看 13 个人怎么分」—— 12 个月装不下 13 个人，第 13 个只能挤进已经有人待着的那个月。',
      ],
      render: (ctx) => <HookStage ctx={ctx} />,
    },
    {
      label: '② 玩一玩',
      short: '玩',
      narration: '把 5 只鸽子放进 4 个洞，看看会怎样。',
      requireSolve: true,
      hints: [
        '先点一只鸽子（它会被你拿在手上），再点一个洞把它放进去。',
        '把 5 只全放进去，随便怎么放都行，然后看哪个洞发亮了。',
        '5 只鸽子、4 个洞，无论怎么放，一定有一个洞里有 2 只 —— 那个洞会发亮。这就是鸽巢原理。',
      ],
      render: (ctx) => <ExploreStage ctx={ctx} />,
    },
    {
      label: '③ 起个名',
      short: '名',
      narration: '刚才那件事有个名字，还有个公式。',
      requireSolve: true,
      hints: [
        '两个滑块分别是「东西有多少」和「抽屉有多少」，看下面的 ⌈n/m⌉ 怎么跟着变。',
        '要复现开头那道题：13 个人就是 13 只鸽子，12 个月就是 12 个洞。',
        '把鸽子数调到 13、洞数调到 12，公式给出 ⌈13/12⌉ = 2 —— 一定有一个月至少有 2 个人。',
      ],
      render: (ctx) => <NameStage ctx={ctx} />,
    },
    {
      label: '④ 练一练',
      short: '练',
      narration: '三道经典题，选错会讲清楚为什么。',
      requireSolve: true,
      hints: [
        '每道题先想清楚：什么是「东西」，什么是「抽屉」。',
        '袜子题：抽屉是 2 种颜色；生日题：抽屉是 12 个月；互质题：抽屉是分好的 5 组。',
        '三题的正确选项依次是：3 只；13 人；把 1–10 分成 5 组、每组内两数互质，6 个数丢进 5 组必有两个同组。',
      ],
      render: (ctx) => <PracticeStage ctx={ctx} />,
    },
    {
      label: '⑤ 换个场景',
      short: '变',
      narration: '5 个整数里，必有两个之差是 4 的倍数。',
      requireSolve: true,
      hints: [
        '关键不是数本身，而是它们除以 4 剩下的余数 —— 余数只有 4 种。',
        '挑 5 个数，看它们各自落进「余 0 / 余 1 / 余 2 / 余 3」哪个盒子。',
        '取够 5 个数，一定有两个落进同一个盒子（4 个盒子装 5 个数）。它们余数相同，相减时余数抵消，差就是 4 的倍数。最后一题选第一个。',
      ],
      render: (ctx) => <TransferStage ctx={ctx} />,
    },
  ],
}

export default topic
