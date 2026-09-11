import type { ReactNode } from 'react'
import type { TruthRow } from '@/kernels/logic'
import { cx } from '@/ui'

export interface TruthTableViewProps {
  vars: string[]
  rows: TruthRow[]
  /** 高亮的行（当前正在检查的那一行） */
  highlightRows?: number[]
  /**
   * 额外的中间列，用于展示「一步步拆开算」的过程。
   * 例如 (P ∧ Q) ∨ R 可以拆成 [P∧Q] 和 [整体] 两列。
   */
  columns?: { label: string; values: boolean[]; accent?: boolean }[]
  caption?: ReactNode
  /** 行被点击 */
  onRowClick?: (index: number) => void
}

const Cell = ({ v, tone = 'normal' }: { v: boolean; tone?: 'normal' | 'accent' }) => (
  <span
    className={cx(
      'inline-flex h-7 w-7 items-center justify-center rounded-md font-mono text-sm font-bold',
      v
        ? tone === 'accent'
          ? 'bg-ok-500 text-white'
          : 'bg-a-500 text-white'
        : tone === 'accent'
          ? 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
          : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
    )}
  >
    {v ? '真' : '假'}
  </span>
)

/**
 * 真值表（承载 L1 / L2 / L3 / B1）。
 *
 * 「真/假」而不是「T/F」或「1/0」：中文用户读「真」比读「T」快，
 * 而认知负荷每降低一点，能坚持学完的人就多一点。
 */
export function TruthTableView({ vars, rows, highlightRows = [], columns = [], caption, onRowClick }: TruthTableViewProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm" aria-label="真值表">
        {caption ? <caption className="mb-1.5 text-left text-xs text-slate-500 dark:text-slate-400">{caption}</caption> : null}
        <thead>
          <tr>
            {vars.map((v) => (
              <th key={v} scope="col" className="px-2 py-1.5 font-mono text-slate-600 dark:text-slate-300">
                {v}
              </th>
            ))}
            {columns.map((c) => (
              <th
                key={c.label}
                scope="col"
                className={cx(
                  'border-l border-slate-200 px-2 py-1.5 font-mono dark:border-slate-700',
                  c.accent ? 'text-ok-700 dark:text-ok-500' : 'text-slate-600 dark:text-slate-300',
                )}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const hi = highlightRows.includes(i)
            const Tag = onRowClick ? 'button' : 'div'
            return (
              <tr
                key={i}
                className={cx(
                  'border-t border-slate-100 dl-transition dark:border-slate-800',
                  hi && 'bg-cur-50 dark:bg-cur-500/10',
                )}
              >
                {vars.map((v) => (
                  <td key={v} className="px-2 py-1.5 text-center">
                    <Tag
                      {...(onRowClick ? { type: 'button' as const, onClick: () => onRowClick(i) } : {})}
                      className="inline-flex cursor-pointer items-center justify-center"
                      aria-label={onRowClick ? `第 ${i + 1} 行，点击查看这一种情况` : undefined}
                    >
                      <Cell v={row.assignment[v]} />
                    </Tag>
                  </td>
                ))}
                {columns.map((c) => (
                  <td key={c.label} className="border-l border-slate-200 px-2 py-1.5 text-center dark:border-slate-700">
                    <Cell v={c.values[i]} tone={c.accent ? 'accent' : 'normal'} />
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
