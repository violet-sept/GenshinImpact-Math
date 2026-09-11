import { useMemo, useState, type ReactNode } from 'react'
import { Btn, Callout, Chip, cx } from './index'

export interface QuizChoice {
  id: string
  label: ReactNode
  correct: boolean
  /** 选了之后要讲清楚「为什么」——错误反馈不能只显示一个叉（铁律 R3） */
  why: string
}

export interface QuizProps {
  question: ReactNode
  choices: QuizChoice[]
  /** 多选题：需要点「检查」 */
  multi?: boolean
  onSolved?: () => void
  /** 变化时重置答题状态（切换题目用） */
  resetKey?: unknown
}

/**
 * 练习题。
 *
 * 铁律 R6「允许失败、失败不惩罚」：没有计分、没有次数上限、没有失败弹窗，
 * 选错只会告诉你错在哪，然后可以立刻再试。
 */
export function Quiz({ question, choices, multi = false, onSolved, resetKey }: QuizProps) {
  const [picked, setPicked] = useState<string[]>([])
  const [checked, setChecked] = useState(false)
  const [solved, setSolved] = useState(false)

  // 换题就重置
  const key = useMemo(() => JSON.stringify(resetKey ?? question), [resetKey, question])
  const [lastKey, setLastKey] = useState(key)
  if (key !== lastKey) {
    setLastKey(key)
    setPicked([])
    setChecked(false)
    setSolved(false)
  }

  const correctIds = choices.filter((c) => c.correct).map((c) => c.id)

  const commit = (ids: string[]): void => {
    setChecked(true)
    const ok = multi
      ? correctIds.length === ids.length && correctIds.every((c) => ids.includes(c))
      : correctIds.includes(ids[0])
    if (ok && !solved) {
      setSolved(true)
      onSolved?.()
    }
  }

  const toggle = (id: string): void => {
    if (solved) return
    if (!multi) {
      setPicked([id])
      commit([id])
      return
    }
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))
  }

  const isWrong = (id: string): boolean => checked && picked.includes(id) && !correctIds.includes(id)
  const isRight = (id: string): boolean => (solved || checked) && picked.includes(id) && correctIds.includes(id)

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{question}</p>

      <ul className="flex flex-col gap-2" role={multi ? 'group' : 'radiogroup'} aria-label="选项">
        {choices.map((c) => {
          const selected = picked.includes(c.id)
          const wrong = isWrong(c.id)
          const right = isRight(c.id)
          return (
            <li key={c.id}>
              <button
                type="button"
                role={multi ? 'checkbox' : 'radio'}
                aria-checked={selected}
                disabled={solved && !selected}
                onClick={() => toggle(c.id)}
                className={cx(
                  'flex w-full items-start gap-3 rounded-xl border px-3 py-2.5 text-left text-sm dl-transition',
                  right
                    ? 'border-ok-500 bg-ok-50 dark:bg-ok-500/10'
                    : wrong
                      ? 'border-bad-500 bg-bad-50 dark:bg-bad-500/10'
                      : selected
                        ? 'border-a-500 bg-a-50 dark:bg-a-500/10'
                        : 'border-slate-200 bg-white hover:border-a-300 dark:border-slate-700 dark:bg-slate-900',
                  solved && !selected ? 'opacity-50' : '',
                )}
              >
                <span
                  aria-hidden="true"
                  className={cx(
                    'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center border text-xs',
                    multi ? 'rounded-md' : 'rounded-full',
                    right
                      ? 'border-ok-500 bg-ok-500 text-white'
                      : wrong
                        ? 'border-bad-500 bg-bad-500 text-white'
                        : selected
                          ? 'border-a-500 bg-a-500 text-white'
                          : 'border-slate-300 text-transparent dark:border-slate-600',
                  )}
                >
                  {right ? '✓' : wrong ? '!' : selected ? '●' : '·'}
                </span>
                <span className="min-w-0 flex-1 text-slate-700 dark:text-slate-200">{c.label}</span>
              </button>
              {(wrong || right) && (checked || solved) ? (
                <div className="mt-1.5 pl-8">
                  <Callout tone={right ? 'ok' : 'bad'}>{c.why}</Callout>
                </div>
              ) : null}
            </li>
          )
        })}
      </ul>

      <div className="flex flex-wrap items-center gap-2">
        {multi && !solved ? (
          <Btn variant="primary" onClick={() => commit(picked)} disabled={picked.length === 0}>
            检查一下
          </Btn>
        ) : null}
        {checked && !solved ? (
          <Btn
            variant="outline"
            onClick={() => {
              setPicked([])
              setChecked(false)
            }}
          >
            再试一次
          </Btn>
        ) : null}
        {solved ? <Chip tone="ok">答对了</Chip> : null}
      </div>
    </div>
  )
}
