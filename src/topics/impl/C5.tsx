import { useCallback, useMemo, useState } from 'react'

import { hanoiMinimum, hanoiMoves } from '@/kernels/counting'
import type { Step } from '@/kernels/types'
import { useStepper } from '@/platform/useStepper'
import { Btn, Callout, Card, Chip, Math as Formula, PlainSpeak, SectionTitle, StepControls, cx } from '@/ui'
import { Quiz } from '@/ui/Quiz'
import { useSolveOnce, useTriedSet } from '../hooks'
import type { StageCtx, Topic } from '../types'

/* ============================================================== 汉诺塔画布 */

/** 每个盘子的编号：数字越大盘子越大。1 = 最小 */
type Disks = number[][]

const PEG_NAMES = ['A', 'B', 'C']

const makeDisks = (n: number): Disks => [Array.from({ length: n }, (_, i) => n - i), [], []]

const cloneDisks = (d: Disks): Disks => d.map((p) => [...p])

const topOf = (d: Disks, p: number): number | null => (d[p].length > 0 ? d[p][d[p].length - 1] : null)

const boardW = 480
const boardH = 266
const pegH = 176
const pegTopY = 40
const diskH = 24
const diskGap = 2
const diskBase = 44
const diskStep = 14

const pegX = (p: number): number => (p + 0.5) * (boardW / 3)

const diskW = (size: number): number => diskBase + size * diskStep

interface BoardProps {
  disks: Disks
  selected: number | null
  rejected: { from: number; to: number; disk: number } | null
  ariaLabel: string
}

function HanoiBoard({ disks, selected, rejected, ariaLabel }: BoardProps) {
  return (
    <svg
      viewBox={`0 0 ${boardW} ${boardH}`}
      className="h-auto w-full max-w-lg"
      role="img"
      aria-label={ariaLabel}
    >
      {[0, 1, 2].map((p) => (
        <g key={`peg-${p}`}>
          <rect
            x={pegX(p) - 66}
            y={boardH - 34}
            width={132}
            height={12}
            rx={6}
            fill="var(--color-dim-300)"
          />
          <rect
            x={pegX(p) - 6}
            y={pegTopY}
            width={12}
            height={pegH}
            rx={5}
            fill={selected === p ? 'var(--color-cur-500)' : 'var(--color-dim-500)'}
          />
          <text className="dl-svg-text" x={pegX(p)} y={boardH - 10} textAnchor="middle" fill="#64748b">
            {PEG_NAMES[p]}
          </text>
        </g>
      ))}

      {[0, 1, 2].map((p) =>
        disks[p].map((size, idx) => {
          const w = diskW(size)
          const y = boardH - 40 - diskH - idx * (diskH + diskGap)
          const isTop = idx === disks[p].length - 1
          const bad = rejected !== null && rejected.disk === size && rejected.to === p
          const isSel = selected === p && isTop
          return (
            <g key={`d-${p}-${size}`}>
              <rect
                x={pegX(p) - w / 2}
                y={y}
                width={w}
                height={diskH}
                rx={7}
                fill={
                  bad
                    ? 'var(--color-bad-500)'
                    : isSel
                      ? 'var(--color-cur-500)'
                      : `var(--color-a-${Math.min(700, 300 + size * 100)})`
                }
                stroke={isSel ? 'var(--color-cur-700)' : 'none'}
                strokeWidth={isSel ? 2.5 : 0}
              />
              <text
                className="dl-svg-text"
                x={pegX(p)}
                y={y + diskH / 2}
                textAnchor="middle"
                dominantBaseline="central"
                fill="#ffffff"
              >
                {size}
              </text>
            </g>
          )
        }),
      )}

      <text className="dl-svg-text" x={boardW / 2} y={boardH - 10} textAnchor="middle" fill="#94a3b8">
        盘子越大号码越大，一次只能搬一个
      </text>
    </svg>
  )
}

/* ============================================================== 玩一玩用板子 */

interface PlayProps {
  ctx: StageCtx
  n: number
  disks: Disks
  setDisks: (d: Disks) => void
  selected: number | null
  setSelected: (p: number | null) => void
  rejected: { from: number; to: number; disk: number } | null
  setRejected: (r: { from: number; to: number; disk: number } | null) => void
  moves: number
  /** 记一步。直接把新的总步数传进来，避免「本步还没结算」的时序麻烦 */
  addMove: (next: number) => void
  onInvalid: (msg: string) => void
  /** 成功时调用，参数是这次成功一共用了几步 */
  onWin: (total: number) => void
  message: string
  /** 由 stage 决定怎么描述「成功」 */
  goalText: string
}

function PegRow({
  ctx,
  n,
  disks,
  setDisks,
  selected,
  setSelected,
  rejected,
  setRejected,
  moves,
  addMove,
  onInvalid,
  onWin,
  message,
  goalText,
}: PlayProps) {
  const tryMove = useCallback(
    (from: number, to: number): void => {
      if (selected === null) {
        if (disks[from].length === 0) {
          onInvalid(`${PEG_NAMES[from]} 柱上一个盘子都没有，没得搬。先点一根有盘子的柱子。`)
          return
        }
        setSelected(from)
        ctx.announce(`选中了 ${PEG_NAMES[from]} 柱最上面的 ${topOf(disks, from)} 号盘子。再点一个目标柱。`)
        ctx.say(`选中 ${PEG_NAMES[from]} 柱最上面的盘子。现在点你想把它搬到的柱子。`)
        return
      }
      if (selected === to) {
        setSelected(null)
        ctx.say('取消选择。重新点一根柱子吧。')
        return
      }

      const disk = topOf(disks, selected)
      if (disk === null) {
        setSelected(null)
        return
      }
      const target = topOf(disks, to)
      const next = moves + 1

      if (target !== null && target < disk) {
        setRejected({ from: selected, to, disk })
        onInvalid(
          `${disk} 号盘子比 ${PEG_NAMES[to]} 柱最上面的 ${target} 号盘子大，大盘子不能压在小盘子上。`,
        )
        ctx.announce(`不能搬：${disk} 号盘子比 ${target} 号大，大盘子不能压在小盘子上。`)
        ctx.say(`不行：大盘子不能压在小盘子上。${disk} 号比 ${target} 号大。`)
        addMove(next)
        setSelected(null)
        return
      }

      const after = cloneDisks(disks)
      after[selected].pop()
      after[to].push(disk)
      setDisks(after)
      setRejected(null)
      setSelected(null)
      addMove(next)

      const done = after[2].length === n
      ctx.say(`把 ${disk} 号盘子从 ${PEG_NAMES[selected]} 搬到了 ${PEG_NAMES[to]}。`)
      ctx.announce(`把 ${disk} 号盘子搬到了 ${PEG_NAMES[to]} 柱。`)
      if (done) onWin(next)
    },
    [addMove, ctx, disks, moves, n, onInvalid, onWin, selected, setDisks, setRejected, setSelected],
  )

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-xl bg-slate-50 p-2 dark:bg-slate-800/40">
        <HanoiBoard
          disks={disks}
          selected={selected}
          rejected={rejected}
          ariaLabel={`汉诺塔：A 柱 ${disks[0].length} 个盘子，B 柱 ${disks[1].length} 个，C 柱 ${disks[2].length} 个`}
        />
      </div>

      <div className="grid grid-cols-3 gap-2">
        {[0, 1, 2].map((p) => {
          const top = topOf(disks, p)
          const isSel = selected === p
          return (
            <button
              key={p}
              type="button"
              aria-pressed={isSel}
              aria-label={
                `柱子 ${PEG_NAMES[p]}，${
                  disks[p].length === 0
                    ? '空的'
                    : `有 ${disks[p].length} 个盘子，最上面是 ${top} 号`
                }${isSel ? '，已选中' : '，按回车选中或作为目标'}`
              }
              onClick={() => tryMove(selected ?? p, p)}
              className={cx(
                'flex min-h-11 flex-col items-center justify-center rounded-xl border px-2 py-2 text-sm font-semibold dl-transition',
                isSel
                  ? 'border-cur-500 bg-cur-50 text-cur-700 dark:bg-cur-500/15 dark:text-cur-500'
                  : 'border-slate-300 bg-white text-slate-700 hover:border-a-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200',
              )}
            >
              <span>{PEG_NAMES[p]} 柱</span>
              <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
                {disks[p].length === 0 ? '空的' : `最上面 ${top} 号`}
              </span>
            </button>
          )
        })}
      </div>

      <Callout tone={disks[2].length === n ? 'ok' : 'info'} role="status">
        {message}
      </Callout>

      <div className="flex flex-wrap items-center gap-2">
        <Chip tone="dim" showGlyph={false}>
          你走了 {moves} 步
        </Chip>
        <Chip tone={moves >= hanoiMinimum(n) ? 'cur' : 'dim'} showGlyph={false}>
          最少只要 {hanoiMinimum(n)} 步
        </Chip>
        <span className="text-xs text-slate-500 dark:text-slate-400">{goalText}</span>
        <Btn
          variant="outline"
          size="sm"
          onClick={() => {
            setDisks(makeDisks(n))
            setSelected(null)
            setRejected(null)
          }}
        >
          重来一遍
        </Btn>
      </div>
    </div>
  )
}

/* ============================================================== ① 看一看 */

function C5HookStage({ ctx }: { ctx: StageCtx }) {
  const n = 2
  const [disks, setDisks] = useState<Disks>(() => makeDisks(n))
  const [selected, setSelected] = useState<number | null>(null)
  const [rejected, setRejected] = useState<{ from: number; to: number; disk: number } | null>(null)
  const [moves, setMoves] = useState(0)
  const [message, setMessage] = useState('A 柱上面是 1 号（小盘子），下面是 2 号（大盘子）。点 A 柱，再点一根目标柱试试。')
  const { tried, markTried } = useTriedSet()

  const solved = disks[2].length === n
  useSolveOnce(ctx, solved)

  return (
    <div className="flex flex-col gap-3">
      <PlainSpeak>
        这叫汉诺塔。三根柱子 <b>A、B、C</b>，A 柱上摞着两个盘子。
        规则只有一条：<b>大盘子永远不能压在小盘子上</b>。
        目标：把两个盘子全搬到 <b>C 柱</b>。
      </PlainSpeak>

      <Card>
        <SectionTitle hint="玩法：先点「要搬哪根」，再点「搬到哪根」">先玩两个盘子</SectionTitle>

        <PegRow
          ctx={ctx}
          n={n}
          disks={disks}
          setDisks={setDisks}
          selected={selected}
          setSelected={setSelected}
          rejected={rejected}
          setRejected={setRejected}
          moves={moves}
          addMove={setMoves}
          onInvalid={(msg) => {
            markTried('bad')
            setMessage(msg)
          }}
          onWin={(total) => setMessage(`两个盘子都到 C 柱了！你用了 ${total} 步。`)}
          message={message}
          goalText="先把 A 柱上的两个盘子搬到 C 柱。"
        />

        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <Chip tone={tried.has('bad') ? 'ok' : 'dim'} showGlyph={false}>
            {tried.has('bad') ? '你已经试过「非法的一步」了 ✓' : '还没遇到非法的一步'}
          </Chip>
          <span className="text-slate-500 dark:text-slate-400">
            故意试一次「大盘压小盘」，看看系统会怎么说。
          </span>
        </div>
      </Card>

      <Callout tone={solved ? 'ok' : 'info'}>
        {solved
          ? `两个盘子最少要 ${hanoiMinimum(2)} 步。换成 3 个盘子呢？下一关见。`
          : '两个盘子看起来很简单。可要是盘子变成 10 个呢？先记住这条规则。'}
      </Callout>
    </div>
  )
}

/* ============================================================== ② 玩一玩 */

const EXPLORE_N = 3

function C5ExploreStage({ ctx }: { ctx: StageCtx }) {
  const [disks, setDisks] = useState<Disks>(() => makeDisks(EXPLORE_N))
  const [selected, setSelected] = useState<number | null>(null)
  const [rejected, setRejected] = useState<{ from: number; to: number; disk: number } | null>(null)
  const [moves, setMoves] = useState(0)
  const [message, setMessage] = useState(
    `A 柱上有 3 个盘子。先点 A 柱，再点 B 或 C，把最上面那个搬走。`,
  )
  const { tried, markTried } = useTriedSet()

  const solved = disks[2].length === EXPLORE_N
  useSolveOnce(ctx, solved)

  return (
    <div className="flex flex-col gap-3">
      <PlainSpeak>
        现在有 <b>3 个盘子</b>，目标还是全搬到 <b>C 柱</b>。
        系统会数你走了几步 —— 顺便告诉你最少只需要几步。
      </PlainSpeak>

      <Card>
        <SectionTitle hint="先点源柱，再点目标柱">任务：把 3 个盘子全部搬到 C 柱</SectionTitle>

        <PegRow
          ctx={ctx}
          n={EXPLORE_N}
          disks={disks}
          setDisks={setDisks}
          selected={selected}
          setSelected={setSelected}
          rejected={rejected}
          setRejected={setRejected}
          moves={moves}
          addMove={setMoves}
          onInvalid={(msg) => {
            markTried('bad')
            setMessage(msg)
          }}
          onWin={(total) =>
            setMessage(
              `成功！3 个盘子全到 C 柱了。最少只要 ${hanoiMinimum(EXPLORE_N)} 步，你用了 ${total} 步。`,
            )
          }
          message={message}
          goalText="把 3 个盘子从 A 柱全部搬到 C 柱。"
        />
      </Card>

      {solved ? (
        <Callout tone="ok" title="顺便说一句">
          不管你怎么绕，少于 {hanoiMinimum(EXPLORE_N)} 步是搬不完的。
          想知道为什么最少是 {hanoiMinimum(EXPLORE_N)} 步吗？下一关说。
        </Callout>
      ) : null}

      <Callout tone="info">
        第一步其实只有一种好选择：把 1 号盘子搬到 C 柱。为什么不搬 2 号？
        因为 2 号一搬走，1 号就只能压在它上面 —— 那就违规了。
      </Callout>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Chip tone={tried.has('bad') ? 'ok' : 'cur'} showGlyph={false}>
          {tried.has('bad') ? '你已经试过非法的一步了 ✓' : '试着故意走一步非法的'}
        </Chip>
        <span className="text-slate-500 dark:text-slate-400">
          亲眼看一次「为什么错」，规则才记得住。
        </span>
      </div>
    </div>
  )
}

/* ============================================================== ③ 起个名 */

const PRESETS: { n: number; moves: number }[] = [
  { n: 1, moves: 1 },
  { n: 2, moves: 3 },
  { n: 3, moves: 7 },
  { n: 4, moves: 15 },
  { n: 5, moves: 31 },
]

function C5NameStage({ ctx }: { ctx: StageCtx }) {
  const [open, setOpen] = useState<number | null>(null)
  const [opened, setOpened] = useState<number[]>([])

  const look = (n: number): void => {
    setOpen(n)
    setOpened((s) => (s.includes(n) ? s : [...s, n]))
    ctx.say(`把最大的那个盘子搬到 C，一共需要 2 × T(${n - 1}) + 1 步。`)
  }

  useSolveOnce(ctx, opened.length >= 3)

  return (
    <div className="flex flex-col gap-4">
      <PlainSpeak>
        你刚才做的事，可以用一句话总结：<b>先把上面 n−1 个搬开，再搬最大的，最后把 n−1 个搬回来</b>。
        下面把这句话变成式子。
      </PlainSpeak>

      <Card>
        <SectionTitle hint="点左边，右边会告诉你这一步要干什么">把「搬 n 个」拆成三步</SectionTitle>

        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.n}
                type="button"
                aria-pressed={open === p.n}
                aria-label={`查看搬 ${p.n} 个盘子的思路`}
                onClick={() => look(p.n)}
                className={cx(
                  'h-11 min-w-16 rounded-xl border font-mono text-sm font-bold dl-transition',
                  open === p.n
                    ? 'border-a-500 bg-a-50 text-a-700 dark:bg-a-500/20 dark:text-a-300'
                    : 'border-slate-300 bg-white text-slate-600 hover:border-a-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300',
                )}
              >
                n = {p.n}
              </button>
            ))}
          </div>

          <div className="rounded-xl bg-slate-50 px-3 py-2.5 text-sm leading-relaxed dark:bg-slate-800/50">
            {open === null ? (
              <span className="text-slate-500 dark:text-slate-400">
                点左边一个 n，看看搬 n 个盘子要分哪三步。
              </span>
            ) : (
              <>
                <div className="font-semibold text-slate-800 dark:text-slate-100">
                  搬 {open} 个盘子（从 A 到 C，B 当临时柱子）
                </div>
                <ol className="mt-1 flex list-decimal flex-col gap-1 pl-5 text-slate-700 dark:text-slate-200">
                  <li>
                    先把上面 {open - 1} 个盘子搬到 B 柱，用掉 T({open - 1}) 步。
                  </li>
                  <li>把最大的第 {open} 号盘子搬到 C 柱，1 步。</li>
                  <li>
                    再把 B 柱上的 {open - 1} 个盘子搬到 C 柱，又是 T({open - 1}) 步。
                  </li>
                </ol>
                <div className="mt-1.5">
                  <Formula>
                    T({open}) = 2 × T({open - 1}) + 1，T(1) = 1
                  </Formula>
                </div>
              </>
            )}
          </div>
        </div>
      </Card>

      <Card>
        <SectionTitle hint="同一个式子，换个写法就解出来了">递推怎么变成 2ⁿ − 1</SectionTitle>
        <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-200">
          <Formula>T(n) = 2T(n−1) + 1</Formula> 这个式子只告诉你「和上一项的关系」，
          还不能直接算出 T(10)。要算 T(10)，得先算 T(9)……一路算下去太慢。所以想个办法把它展开：
        </p>
        <ul className="mt-2 flex flex-col gap-1.5 text-sm text-slate-700 dark:text-slate-200">
          <li>
            <Formula>T(n) = 2T(n−1) + 1</Formula>
          </li>
          <li>
            <Formula>
              = 2(2T(n−2) + 1) + 1 = 4T(n−2) + 2 + 1
            </Formula>
          </li>
          <li>
            <Formula>
              = 4(2T(n−3) + 1) + 2 + 1 = 8T(n−3) + 4 + 2 + 1
            </Formula>
          </li>
          <li className="text-slate-500 dark:text-slate-400">……一直展开下去</li>
          <li>
            <Formula>
              = 2^(n−1) · T(1) + (2^(n−2) + … + 2 + 1) = 2^(n−1) + 2^(n−1) − 1
            </Formula>
          </li>
          <li className="font-semibold">
            <Formula>T(n) = 2^n − 1</Formula>
          </li>
        </ul>
        <Callout tone="info">
          中间那一串 <Formula>1 + 2 + 4 + … + 2^(n−1)</Formula> 加起来刚好是 <Formula>2^n − 1</Formula>
          （每一行翻倍，加起来比再翻一倍的数小 1）。所以串起来正好凑成 2ⁿ − 1。
        </Callout>

        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[18rem] border-collapse text-sm">
            <caption className="sr-only">n 从 1 到 5 时，递推算出的步数与通项公式的对照</caption>
            <thead>
              <tr className="text-left text-xs text-slate-500 dark:text-slate-400">
                <th scope="col" className="py-1.5 pr-2 font-medium">
                  n
                </th>
                <th scope="col" className="py-1.5 pr-2 font-medium">
                  递推 2T(n−1)+1
                </th>
                <th scope="col" className="py-1.5 font-medium">
                  通项 2ⁿ−1
                </th>
              </tr>
            </thead>
            <tbody>
              {PRESETS.map((p, i) => (
                <tr key={p.n} className="border-t border-slate-200 dark:border-slate-700">
                  <td className="py-1.5 pr-2 font-mono text-slate-600 dark:text-slate-300">{p.n}</td>
                  <td className="py-1.5 pr-2 font-mono text-slate-700 dark:text-slate-200">
                    {i === 0 ? 'T(1) = 1' : `2 × ${PRESETS[i - 1].moves} + 1 = ${p.moves}`}
                  </td>
                  <td className="py-1.5 font-mono font-bold text-a-700 dark:text-a-300">
                    2^{p.n} − 1 = {hanoiMinimum(p.n)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Callout tone={opened.length >= 3 ? 'ok' : 'cur'} role="status">
        {opened.length >= 3
          ? '你看过至少三种情形了。记住那个式子：T(n) = 2T(n−1) + 1。'
          : `再点开 ${3 - opened.length} 个 n 看看。`}
      </Callout>
    </div>
  )
}

/* ============================================================== ④ 练一练 */

function C5PracticeStage({ ctx }: { ctx: StageCtx }) {
  const [done, setDone] = useState(0)
  useSolveOnce(ctx, done >= 3)

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-slate-600 dark:text-slate-300">
        三道题。选错了会告诉你<b>为什么错</b>，随时可以重来。
      </p>

      <Card>
        <Quiz
          question={<>汉诺塔 4 个盘子，最少要搬几步？</>}
          resetKey="c5p1"
          onSolved={() => setDone((d) => d + 1)}
          choices={[
            {
              id: 'a',
              label: <>15 步</>,
              correct: true,
              why: '对。T(4) = 2⁴ − 1 = 15。也可以从 T(3) = 7 推：2 × 7 + 1 = 15。',
            },
            {
              id: 'b',
              label: <>8 步</>,
              correct: false,
              why: '不对。8 = 2⁴，那是「2 的 4 次方」，公式里还要减 1。正确的 T(4) = 2⁴ − 1 = 15。',
            },
            {
              id: 'c',
              label: <>16 步</>,
              correct: false,
              why: '不对。16 = 2⁴，多算了 1 步。搬完最后一次之后不需要再搬了，所以是 2⁴ − 1。',
            },
            {
              id: 'd',
              label: <>24 步</>,
              correct: false,
              why: '不对。24 = 4! 是把盘子当成「要排队」了。每个盘子只关心它在哪根柱子上，跟 4! 没关系。',
            },
          ]}
        />
      </Card>

      <Card>
        <Quiz
          question={
            <>
              递推式 <Formula>T(n) = 2T(n−1) + 1</Formula> 里的那个「2」，说的是什么？
            </>
          }
          resetKey="c5p2"
          onSolved={() => setDone((d) => d + 1)}
          choices={[
            {
              id: 'a',
              label: <>上面那 n−1 个盘子被搬了两次：先去 B 柱，最后再去 C 柱。</>,
              correct: true,
              why: '对。为了给最大的盘子让路，先把 n−1 个盘子整体搬到 B（一次 T(n−1)），搬完最大的之后，还要再把它们整体搬到 C（又一次 T(n−1)）。所以是 2 倍。',
            },
            {
              id: 'b',
              label: <>因为有 2 根柱子可以选</>,
              correct: false,
              why: '不对。目标是固定的（搬到 C），中间借用的柱子也是固定的（B）。「2」不是柱子数量。',
            },
            {
              id: 'c',
              label: <>因为每次搬 2 个盘子</>,
              correct: false,
              why: '不对。汉诺塔一次只能搬一个盘子，这是规则。',
            },
            {
              id: 'd',
              label: <>因为 n 要除以 2</>,
              correct: false,
              why: '不对。这里的 2 是「乘」不是「除」，而且它来自 n−1 个盘子被搬了两次。',
            },
          ]}
        />
      </Card>

      <Card>
        <Quiz
          question={<>已知 T(3) = 7，那么 T(4) 等于多少？</>}
          resetKey="c5p3"
          onSolved={() => setDone((d) => d + 1)}
          choices={[
            {
              id: 'a',
              label: (
                <>
                  <Formula>2 × 7 + 1 = 15</Formula>
                </>
              ),
              correct: true,
              why: '对。递推的意思就是：n 个盘子的步数 = 2 ×（n−1 个盘子的步数）+ 1。代进去就是 2×7+1 = 15。',
            },
            {
              id: 'b',
              label: (
                <>
                  <Formula>7 + 1 = 8</Formula>
                </>
              ),
              correct: false,
              why: '不对。8 是「2 的 3 次方」，不是 T(4)。递推里 T(n−1) 前面要乘 2，因为那堆盘子被整体搬了两次。',
            },
            {
              id: 'c',
              label: (
                <>
                  <Formula>7 × 2 = 14</Formula>
                </>
              ),
              correct: false,
              why: '不对。漏掉了搬最大盘子的那 1 步。递推式里加的那个 1，就是搬最大盘子的那一步。',
            },
            {
              id: 'd',
              label: (
                <>
                  <Formula>7 × 7 = 49</Formula>
                </>
              ),
              correct: false,
              why: '不对。递推是「乘以 2 再加 1」，不是「自己乘自己」。自己在自己上乘，那是完全不同的增长方式。',
            },
          ]}
        />
      </Card>
    </div>
  )
}

/* ============================================================== ⑤ 换个场景 */

const PLANS = [3, 4, 5]

function C5TransferStage({ ctx }: { ctx: StageCtx }) {
  const [plan, setPlan] = useState(3)
  const [tableOpen, setTableOpen] = useState(false)
  const [quizDone, setQuizDone] = useState(false)
  /** 用户是否真的动过播放器 —— 保证这一步也是「不操作就不能推进」 */
  const [touched, setTouched] = useState(false)

  const moves = useMemo(() => hanoiMoves(plan, 'A', 'C', 'B'), [plan])

  const steps = useMemo<Step<{ disks: Disks; count: number }>[]>(() => {
    const state = makeDisks(plan)
    const out: Step<{ disks: Disks; count: number }>[] = [
      {
        snapshot: { disks: cloneDisks(state), count: 0 },
        explanation: `开始：${plan} 个盘子全在 A 柱。`,
        highlight: [],
        label: '开始',
      },
    ]
    moves.forEach((m, i) => {
      const from = PEG_NAMES.indexOf(m.from)
      const to = PEG_NAMES.indexOf(m.to)
      state[from].pop()
      state[to].push(m.disk)
      out.push({
        snapshot: { disks: cloneDisks(state), count: i + 1 },
        explanation: `第 ${i + 1} 步：把 ${m.disk} 号盘子从 ${m.from} 柱搬到 ${m.to} 柱。`,
        highlight: [`${m.to}`],
        label: `${i + 1}. ${m.from}→${m.to}`,
        tone: i === moves.length - 1 ? 'accept' : 'normal',
      })
    })
    return out
  }, [moves, plan])

  const stepper = useStepper(steps, plan)
  const snap = stepper.step?.snapshot ?? { disks: makeDisks(plan), count: 0 }

  const onStepChange = useCallback(
    (i: number) => {
      setTouched(true)
      const s = steps[i]
      if (s) ctx.say(s.explanation)
    },
    [ctx, steps],
  )

  useSolveOnce(ctx, touched && stepper.atEnd && quizDone)

  return (
    <div className="flex flex-col gap-4">
      <PlainSpeak>
        最后一步：让机器来搬。看它一步一步走，数一数总步数 —— 是不是正好 <b>2ⁿ − 1</b>。
      </PlainSpeak>

      <Card>
        <SectionTitle hint="机器走的是最优解，一步都不会浪费">看机器自动搬</SectionTitle>

        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="text-sm text-slate-600 dark:text-slate-300">盘子个数：</span>
          {PLANS.map((p) => (
            <button
              key={p}
              type="button"
              aria-pressed={plan === p}
              aria-label={`选择 ${p} 个盘子`}
              onClick={() => setPlan(p)}
              className={cx(
                'h-11 min-w-11 rounded-xl border font-mono text-sm font-bold dl-transition',
                plan === p
                  ? 'border-a-500 bg-a-50 text-a-700 dark:bg-a-500/20 dark:text-a-300'
                  : 'border-slate-300 bg-white text-slate-600 hover:border-a-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300',
              )}
            >
              {p} 个
            </button>
          ))}
        </div>

        <div className="rounded-xl bg-slate-50 p-2 dark:bg-slate-800/40">
          <HanoiBoard
            disks={snap.disks}
            selected={null}
            rejected={null}
            ariaLabel={`机器搬运过程：当前已经走了 ${snap.count} 步`}
          />
        </div>

        <div className="mt-3">
          <StepControls api={stepper} label="汉诺塔最优解" onStepChange={onStepChange} />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Chip tone={snap.count === hanoiMinimum(plan) ? 'ok' : 'cur'} showGlyph={false}>
            步数计数器：{snap.count} / {hanoiMinimum(plan)}
          </Chip>
          <Chip tone="dim" showGlyph={false}>
            共 {moves.length} 步
          </Chip>
        </div>

        <Callout tone={snap.count === hanoiMinimum(plan) ? 'ok' : 'info'} role="status">
          {snap.count === hanoiMinimum(plan)
            ? `走完了：${plan} 个盘子正好 ${hanoiMinimum(plan)} 步 = 2^${plan} − 1。`
            : stepper.step?.explanation ?? '点播放按钮，让机器开始搬。'}
        </Callout>
      </Card>

      <Card>
        <SectionTitle hint="n 每加 1，步数就翻倍再加一">步数一览表</SectionTitle>
        <Btn variant="outline" size="sm" onClick={() => setTableOpen(true)} disabled={tableOpen}>
          {tableOpen ? '已经打开了' : '把表格打开'}
        </Btn>

        {tableOpen ? (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[20rem] border-collapse text-sm">
              <caption className="sr-only">n 从 1 到 6 时的最少步数</caption>
              <thead>
                <tr className="text-left text-xs text-slate-500 dark:text-slate-400">
                  <th scope="col" className="py-1.5 pr-2 font-medium">
                    盘子数 n
                  </th>
                  <th scope="col" className="py-1.5 pr-2 font-medium">
                    最少步数 2ⁿ − 1
                  </th>
                  <th scope="col" className="py-1.5 font-medium">
                    比上一行多了多少
                  </th>
                </tr>
              </thead>
              <tbody>
                {[1, 2, 3, 4, 5, 6].map((n) => {
                  const v = hanoiMinimum(n)
                  const prev = n === 1 ? 0 : hanoiMinimum(n - 1)
                  return (
                    <tr key={n} className="border-t border-slate-200 dark:border-slate-700">
                      <td className="py-1.5 pr-2 font-mono text-slate-600 dark:text-slate-300">{n}</td>
                      <td className="py-1.5 pr-2 font-mono font-bold text-a-700 dark:text-a-300">{v}</td>
                      <td className="py-1.5 font-mono text-slate-600 dark:text-slate-300">
                        {n === 1 ? '—' : `${v} − ${prev} = ${v - prev}`}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              1、3、7、15、31、63 —— 每一步都是「上一项 × 2 + 1」，也正好是 2ⁿ − 1。
              这个表格还能看出递推和通项是同一件事。
            </p>
          </div>
        ) : null}
      </Card>

      <Card>
        <Quiz
          question={<>汉诺塔 6 个盘子，最少要多少步？</>}
          resetKey="c5t1"
          onSolved={() => setQuizDone(true)}
          choices={[
            {
              id: 'a',
              label: <>63 步</>,
              correct: true,
              why: '对。T(6) = 2⁶ − 1 = 64 − 1 = 63。也可以从 T(5) = 31 推：2 × 31 + 1 = 63。',
            },
            {
              id: 'b',
              label: <>64 步</>,
              correct: false,
              why: '不对。64 = 2⁶，公式里还要减 1。多出来的那一步是不存在的。',
            },
            {
              id: 'c',
              label: <>36 步</>,
              correct: false,
              why: '不对。36 = 6 × 6，是把盘子数平方了。步数的增长比这快得多：5 个盘子就已经 31 步了。',
            },
            {
              id: 'd',
              label: <>31 步</>,
              correct: false,
              why: '不对。31 是 5 个盘子的答案。多一个盘子，步数几乎要翻倍再加上 1，所以 6 个盘子是 63 步。',
            },
          ]}
        />
      </Card>
    </div>
  )
}

/* ============================================================== 导出 */

const topic: Topic = {
  id: 'C5',
  title: '递推关系与汉诺塔',
  moduleId: 'counting',
  oneLiner: '把大问题拆成同样形状的小问题',
  outcome: '你能把「搬 n 个盘子」拆成「搬 n−1 个盘子」的问题，写出递推式，并把它解成通项公式。',
  prerequisites: ['C1'],
  bigIdea:
    '递推就是「用同一个问题的更小版本，回答更大的版本」。汉诺塔把这件事演得最清楚：想搬 n 个，就先搬 n−1 个 —— T(n) = 2T(n−1) + 1，解出来是 2ⁿ − 1。',
  misconceptions: [
    {
      wrong: '汉诺塔的步数大概和盘子数量的平方差不多',
      right:
        '差得远。步数是指数增长：1、3、7、15、31、63……每多一个盘子，步数几乎翻倍。第 64 个盘子的传说要 2⁶⁴ − 1 步，按每秒一步算要几千亿年。',
    },
    {
      wrong: '递推式 T(n) = 2T(n−1) + 1 本身就是一个能直接算出答案的公式',
      right:
        '递推式只告诉你「和上一项的关系」。要算 T(30)，还得一路推 30 次。通项公式 T(n) = 2ⁿ − 1 才能一步出答案 —— 把递推展开，就能得到它。',
    },
    {
      wrong: '那个「+1」可以省掉，反正只有一步',
      right:
        '不能省。那一步是搬最大盘子的那一步，少了它任务根本没完成。比如 T(4) 是 15 而不是 14，差的正是这一步。',
    },
    {
      wrong: '把 n−1 个盘子搬到 B 柱之后，它们就不用再动了',
      right:
        '还要再搬一次。搬完最大的盘子之后，B 柱上那 n−1 个盘子必须整体搬到 C 柱去 —— 这就是递推式里「乘 2」的来源。',
    },
  ],
  formalDefinition: (
    <>
      <p>
        <b>递推关系：</b>
        <span className="font-mono">T(n) = 2T(n−1) + 1，T(1) = 1</span>
      </p>
      <p>
        <b>通项公式：</b>
        <span className="font-mono">T(n) = 2ⁿ − 1</span>
      </p>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        把递推反复代入（T(n) = 2T(n−1) + 1 = 4T(n−2) + 2 + 1 = …），就能把递推「解」成通项。
      </p>
      <p>
        <b>递推与通项的分工：</b>
        <span className="font-mono">递推 → 说清「怎么变小」；通项 → 一步算出答案</span>
      </p>
    </>
  ),
  glossary: [
    { term: '递推关系', plain: '用「同一件事的缩小版」来描述这件事。比如 T(n) 用 T(n−1) 来表示。', formal: 'T(n) = 2T(n−1) + 1' },
    { term: '初始条件', plain: '递推的起点，最小的那一档要单独说清楚。汉诺塔里就是 T(1) = 1。', formal: 'T(1) = 1' },
    { term: '通项公式', plain: '把 n 直接代进去就能算出答案的公式，不用一步步推。', formal: 'T(n) = 2ⁿ − 1' },
    { term: '展开递推', plain: '把递推式一层一层代进去，直到看出规律，从而解出通项。' },
    { term: '指数增长', plain: '每增加一个单位，数量就乘以一个固定的倍数。汉诺塔就是每加一个盘子，步数几乎翻倍。' },
    { term: '最优解', plain: '步数最少的那种搬法。汉诺塔的最优解步数就是 2ⁿ − 1。' },
  ],
  stages: [
    {
      label: '① 看一看',
      short: '看',
      narration: '三个柱子，两个盘子。大盘不能压小盘，搬到 C 柱。',
      requireSolve: true,
      hints: [
        '先点「要搬哪根柱子」，再点「搬到哪根柱子」。一次只搬一个盘子。',
        '1 号（小盘）可以压在 2 号（大盘）上，反过来不行。所以第一步只能搬 1 号。',
        '正确走法：先把 1 号从 A 搬到 B，再把 2 号从 A 搬到 C，最后把 1 号从 B 搬到 C。一共 3 步。',
      ],
      render: (ctx) => <C5HookStage ctx={ctx} />,
    },
    {
      label: '② 玩一玩',
      short: '玩',
      narration: '换成 3 个盘子，全搬到 C 柱。系统会数步数。',
      requireSolve: true,
      hints: [
        '想想看：要让最大的 3 号盘子能搬到 C，C 柱上必须先空着，所以前两个盘子得先挪到 B 柱去。',
        '第一步只能搬 1 号，而且第一步搬到 C 柱最好（后面几步会顺很多）。',
        '最优走法 7 步：1 号 A→C，2 号 A→B，1 号 C→B，3 号 A→C，1 号 B→A，2 号 B→C，1 号 A→C。',
      ],
      render: (ctx) => <C5ExploreStage ctx={ctx} />,
    },
    {
      label: '③ 起个名',
      short: '名',
      narration: '把「搬 n 个」拆成三步，就写出一个式子。',
      requireSolve: true,
      hints: [
        '为了搬最大的那一个，必须先把它上面的 n−1 个挪走；搬完它之后，那 n−1 个还得再搬回来。',
        '所以 T(n) 里会出现两次 T(n−1)，再加搬最大盘子的那 1 步：T(n) = 2T(n−1) + 1。',
        '公式是 T(n) = 2T(n−1) + 1，T(1) = 1。至少点开 3 个 n 看一遍，这一关就过了。',
      ],
      render: (ctx) => <C5NameStage ctx={ctx} />,
    },
    {
      label: '④ 练一练',
      short: '练',
      narration: '三道题：算 T(4)，讲清那个 2，推 T(4)。',
      requireSolve: true,
      hints: [
        '所有题都可以用同一个式子：T(n) = 2T(n−1) + 1。',
        '已知 T(1) = 1，就能一步步推出 T(2) = 3、T(3) = 7、T(4) = 15。',
        '三道题的正确选项依次是：15 步；n−1 个盘子被搬了两次；T(4) = 2×7+1 = 15。',
      ],
      render: (ctx) => <C5PracticeStage ctx={ctx} />,
    },
    {
      label: '⑤ 换个场景',
      short: '变',
      narration: '让机器搬一遍最优解，数一数步数。',
      requireSolve: true,
      hints: [
        '点播放按钮，机器会自己一步一步搬。看右下角的步数计数器。',
        '每次走完，计数器都会加一。走完的时候，看看它是不是正好等于 2ⁿ − 1。',
        '3 个盘子走 7 步、4 个走 15 步，都是 2ⁿ − 1。让机器走到底，再打开步数表，最后答对下面那题（6 个盘子 63 步）。',
      ],
      render: (ctx) => <C5TransferStage ctx={ctx} />,
    },
  ],
}

export default topic
