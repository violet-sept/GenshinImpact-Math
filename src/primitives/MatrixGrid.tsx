import { cx } from '@/ui'

export interface MatrixGridProps {
  rows: string[]
  cols: string[]
  /** 布尔矩阵或数值矩阵 */
  data: (boolean | number)[][]
  mode?: 'boolean' | 'number'
  /** 需要高亮的格子 [行, 列] */
  highlight?: [number, number][]
  /** 需要淡化的格子 */
  dim?: [number, number][]
  /** 用橙色标出的「冲突 / 反例」格子 */
  conflict?: [number, number][]
  onToggle?: (r: number, c: number) => void
  /** 数值模式下直接改值 */
  onChange?: (r: number, c: number, v: number) => void
  ariaLabel: string
  rowTitle?: string
  colTitle?: string
}

const same = (a: [number, number], b: [number, number]): boolean => a[0] === b[0] && a[1] === b[1]

/**
 * 矩阵编辑器（交互原语 P3）。
 *
 * 用真正的 `<table>` + `<button>` 而不是画在 Canvas 上：
 * 读屏软件能念出「第 2 行第 3 列，已选中」，键盘也能 Tab 过去 —— 
 * 这是「关系矩阵 ↔ 有向图」联动能被无障碍使用的前提。
 */
export function MatrixGrid({
  rows,
  cols,
  data,
  mode = 'boolean',
  highlight = [],
  dim = [],
  conflict = [],
  onToggle,
  onChange,
  ariaLabel,
  rowTitle = '',
  colTitle = '',
}: MatrixGridProps) {
  const interactive = Boolean(onToggle || onChange)

  return (
    <div className="overflow-x-auto">
      <table className="border-separate border-spacing-1" aria-label={ariaLabel}>
        <caption className="sr-only">{ariaLabel}</caption>
        <thead>
          <tr>
            <th scope="col" className="w-8">
              <span className="sr-only">{rowTitle || '行'}</span>
            </th>
            {cols.map((c) => (
              <th key={c} scope="col" className="dl-svg-text px-1 text-center text-slate-500 dark:text-slate-400">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r}>
              <th scope="row" className="dl-svg-text pr-1 text-right text-slate-500 dark:text-slate-400">
                {r}
              </th>
              {cols.map((c, j) => {
                const v = data[i]?.[j] ?? (mode === 'boolean' ? false : 0)
                const isHi = highlight.some((x) => same(x, [i, j]))
                const isDim = dim.some((x) => same(x, [i, j]))
                const isBad = conflict.some((x) => same(x, [i, j]))
                const on = mode === 'boolean' ? Boolean(v) : Number(v) !== 0
                const content = mode === 'boolean' ? (on ? '1' : '0') : String(v)
                const label = `${rowTitle || rows[i]} ${r} 与 ${colTitle || cols[j]} ${c}：${
                  mode === 'boolean' ? (on ? '有关系' : '没关系') : content
                }`

                const cls = cx(
                  'flex h-10 w-10 items-center justify-center rounded-lg border font-mono text-sm font-semibold dl-transition',
                  isBad
                    ? 'border-bad-500 bg-bad-500 text-white'
                    : isHi
                      ? 'border-cur-500 bg-cur-500 text-white'
                      : on
                        ? 'border-a-500 bg-a-500 text-white'
                        : 'border-slate-200 bg-white text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-500',
                  isDim && 'opacity-30',
                  interactive && 'cursor-pointer hover:border-a-700',
                )

                if (!interactive) {
                  return (
                    <td key={c}>
                      <div className={cls} aria-label={label}>
                        {content}
                      </div>
                    </td>
                  )
                }

                return (
                  <td key={c}>
                    <button
                      type="button"
                      aria-label={label}
                      aria-pressed={mode === 'boolean' ? on : undefined}
                      className={cls}
                      onClick={() => {
                        if (onToggle) onToggle(i, j)
                        else onChange?.(i, j, Number(v) === 0 ? 1 : 0)
                      }}
                    >
                      {content}
                    </button>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
