import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import type { StepperApi, Speed } from '@/platform/useStepper'
import { SPEEDS } from '@/platform/useStepper'

export const cx = (...parts: (string | false | null | undefined)[]): string => parts.filter(Boolean).join(' ')

/* ============================================================== 按钮 */

type BtnVariant = 'primary' | 'ghost' | 'subtle' | 'outline'
type BtnSize = 'sm' | 'md' | 'lg'

const BTN_VARIANT: Record<BtnVariant, string> = {
  primary: 'bg-a-600 text-white hover:bg-a-700 active:bg-a-700 border border-transparent',
  subtle: 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 border border-transparent',
  ghost: 'bg-transparent text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 border border-transparent',
  outline:
    'bg-white text-slate-700 hover:bg-slate-50 border border-slate-300 dark:bg-slate-900 dark:text-slate-200 dark:border-slate-700 dark:hover:bg-slate-800',
}

/** 最小命中区 44×44（规划书 §8.2 拇指热区），sm 尺寸用于密集控制条时才允许略小 */
const BTN_SIZE: Record<BtnSize, string> = {
  sm: 'min-h-9 px-3 text-sm gap-1.5',
  md: 'min-h-11 px-4 text-[0.95rem] gap-2',
  lg: 'min-h-12 px-5 text-base gap-2',
}

export interface BtnProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: BtnVariant
  size?: BtnSize
}

export function Btn({ variant = 'subtle', size = 'md', className, ...rest }: BtnProps) {
  return (
    <button
      type="button"
      className={cx(
        'inline-flex items-center justify-center rounded-xl font-medium dl-transition',
        'disabled:cursor-not-allowed disabled:opacity-40',
        BTN_VARIANT[variant],
        BTN_SIZE[size],
        className,
      )}
      {...rest}
    />
  )
}

/** 图标按钮：视觉上是图标，但必须有可读的 aria-label */
export function IconBtn({
  label,
  children,
  className,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cx(
        'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-lg',
        'bg-slate-100 text-slate-700 hover:bg-slate-200 dl-transition',
        'dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700',
        'disabled:cursor-not-allowed disabled:opacity-40',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  )
}

/* ============================================================== 容器 */

export function Card({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cx('dl-card p-4 sm:p-5', className)} {...rest}>
      {children}
    </div>
  )
}

export function SectionTitle({ children, hint }: { children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="mb-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">{children}</h3>
      {hint ? <span className="text-xs text-slate-500 dark:text-slate-400">{hint}</span> : null}
    </div>
  )
}

/**
 * 公式排版：用等宽字体，避免引入 KaTeX 的体积。
 *
 * 刻意叫 `Formula` 而不是 `Math` —— 后者会遮蔽 JavaScript 全局的 `Math` 对象，
 * 让 `Math.round(...)` 这类调用在导入本组件后莫名其妙地报错，是个很隐蔽的坑。
 */
export function Formula({ children, block = false }: { children: ReactNode; block?: boolean }) {
  return (
    <span
      className={cx(
        'font-mono tracking-tight text-slate-900 dark:text-slate-100',
        block ? 'block my-2 text-center text-lg' : 'text-[0.95em]',
      )}
      style={{ fontStyle: 'normal' }}
    >
      {children}
    </span>
  )
}

/**
 * @deprecated 请改用 `Formula`。保留这个别名只是为了兼容早期写好的内容文件。
 * 如果你需要用全局 `Math`，不要从本模块导入这个名字。
 */
export const Math = Formula

/* ============================================================== 语义色标签 */

export type Tone = 'a' | 'b' | 'ok' | 'bad' | 'cur' | 'dim'

const TONE_CHIP: Record<Tone, string> = {
  a: 'bg-a-100 text-a-700 border-a-300 dark:bg-a-500/20 dark:text-a-300 dark:border-a-500/40',
  b: 'bg-b-100 text-b-700 border-b-300 dark:bg-b-500/20 dark:text-b-300 dark:border-b-500/40',
  ok: 'bg-ok-100 text-ok-700 border-ok-500 dark:bg-ok-500/20 dark:text-ok-500 dark:border-ok-500/40',
  bad: 'bg-bad-100 text-bad-700 border-bad-500 dark:bg-bad-500/20 dark:text-bad-500 dark:border-bad-500/40',
  cur: 'bg-cur-100 text-cur-700 border-cur-500 dark:bg-cur-500/20 dark:text-cur-500 dark:border-cur-500/40',
  dim: 'bg-slate-100 text-dim-600 border-dim-300 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700',
}

/**
 * 语义标签。
 * 规划书 §6.4 要求「颜色语义必须附加图形/文字冗余」—— 所以这里除了配色，
 * 还会根据 tone 自动带上一个形状符号，色觉障碍用户也能区分。
 */
const TONE_GLYPH: Record<Tone, string> = {
  a: '●',
  b: '▲',
  ok: '✓',
  bad: '!',
  cur: '◆',
  dim: '○',
}

export function Chip({
  tone = 'dim',
  children,
  showGlyph = true,
  className,
}: {
  tone?: Tone
  children: ReactNode
  showGlyph?: boolean
  className?: string
}) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-xs font-medium whitespace-nowrap',
        TONE_CHIP[tone],
        className,
      )}
    >
      {showGlyph ? <span aria-hidden="true">{TONE_GLYPH[tone]}</span> : null}
      {children}
    </span>
  )
}

/* ============================================================== 提示条 */

const CALLOUT: Record<'info' | 'ok' | 'bad' | 'cur', string> = {
  info: 'border-a-300 bg-a-50 text-slate-700 dark:border-a-500/40 dark:bg-a-500/10 dark:text-slate-200',
  ok: 'border-ok-500 bg-ok-50 text-ok-700 dark:border-ok-500/40 dark:bg-ok-500/10 dark:text-ok-500',
  bad: 'border-bad-500 bg-bad-50 text-bad-700 dark:border-bad-500/40 dark:bg-bad-500/10 dark:text-bad-500',
  cur: 'border-cur-500 bg-cur-50 text-cur-700 dark:border-cur-500/40 dark:bg-cur-500/10 dark:text-cur-500',
}

export function Callout({
  tone = 'info',
  title,
  children,
  role,
}: {
  tone?: 'info' | 'ok' | 'bad' | 'cur'
  title?: ReactNode
  children: ReactNode
  role?: 'status' | 'alert'
}) {
  return (
    <div role={role} className={cx('rounded-xl border-l-4 px-3 py-2.5 text-sm', CALLOUT[tone])}>
      {title ? <div className="mb-0.5 font-semibold">{title}</div> : null}
      <div className="leading-relaxed">{children}</div>
    </div>
  )
}

/**
 * 大白话块：铁律 R4 的载体 —— 新概念必须先有一句人话。
 *
 * `sticker` 传了就用表情包代替左边那个对话框 emoji（「一句话本质」用它）；
 * 传不上（比如新知识点还没配图）就退回 emoji，块本身照样能读。
 * 图高 48px（`h-12`）：高度写死、宽度 auto，所以放多大都保持原比例。
 */
export function PlainSpeak({ children, sticker }: { children: ReactNode; sticker?: string }) {
  return (
    <div className="flex gap-2.5 rounded-xl bg-slate-100 px-3 py-2.5 text-sm leading-relaxed text-slate-700 dark:bg-slate-800/70 dark:text-slate-200">
      {sticker ? (
        <img
          src={sticker}
          alt=""
          aria-hidden="true"
          loading="lazy"
          decoding="async"
          draggable={false}
          className="h-12 w-auto shrink-0 select-none self-start object-contain"
        />
      ) : (
        <span aria-hidden="true" className="select-none text-base leading-6">
          💬
        </span>
      )}
      <div>{children}</div>
    </div>
  )
}

/**
 * 正式定义折叠块。
 * 铁律 R1：先看现象、后给符号 —— 所以正式定义**默认折叠**，
 * 除非用户在设置里主动打开「默认显示正式定义」。
 */
export function FormalDefinition({ children, defaultOpen = false }: { children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex min-h-11 w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
      >
        <span aria-hidden="true" className={cx('dl-transition', open && 'rotate-90')}>
          ▸
        </span>
        正式定义（数学课本里的说法）
      </button>
      {open ? (
        <div className="border-t border-slate-200 px-3 py-3 text-sm dark:border-slate-700">{children}</div>
      ) : null}
    </div>
  )
}

/* ============================================================== 分段控件 */

export interface SegmentedOption<T extends string> {
  value: T
  label: ReactNode
  /** 键盘提示，例如「←→ 切换」 */
  title?: string
}

/** 用 radiogroup 语义实现分段控件，保证键盘与读屏可用 */
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
  size = 'md',
  columns,
}: {
  label: string
  options: SegmentedOption<T>[]
  value: T
  onChange: (v: T) => void
  size?: 'sm' | 'md'
  columns?: number
}) {
  const ref = useRef<HTMLDivElement>(null)

  const onKeyDown = (e: React.KeyboardEvent): void => {
    const keys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']
    if (!keys.includes(e.key)) return
    e.preventDefault()
    const i = options.findIndex((o) => o.value === value)
    const dir = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1
    const next = options[(i + dir + options.length) % options.length]
    onChange(next.value)
    const buttons = ref.current?.querySelectorAll<HTMLButtonElement>('[role="radio"]')
    buttons?.[options.indexOf(next)]?.focus()
  }

  return (
    <div
      ref={ref}
      role="radiogroup"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={cx('flex flex-wrap gap-1.5', columns ? 'grid' : '')}
      style={columns ? { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` } : undefined}
    >
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            title={o.title}
            onClick={() => onChange(o.value)}
            className={cx(
              'rounded-xl border font-medium dl-transition',
              size === 'sm' ? 'min-h-9 px-2.5 py-1 text-xs' : 'min-h-11 px-3 py-2 text-sm',
              active
                ? 'border-a-500 bg-a-50 text-a-700 dark:bg-a-500/20 dark:text-a-300'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800',
            )}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

/* ============================================================== 表单行 */

export function SliderRow({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  format,
  hint,
}: {
  label: ReactNode
  value: number
  min: number
  max: number
  step?: number
  onChange: (v: number) => void
  format?: (v: number) => string
  hint?: ReactNode
}) {
  const id = useId()
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm font-medium text-slate-700 dark:text-slate-200">
          {label}
        </label>
        <output htmlFor={id} className="font-mono text-sm font-semibold text-a-600 dark:text-a-300">
          {format ? format(value) : value}
        </output>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-11 w-full cursor-pointer accent-a-600"
      />
      {hint ? <p className="text-xs text-slate-500 dark:text-slate-400">{hint}</p> : null}
    </div>
  )
}

export function SwitchRow({
  label,
  checked,
  onChange,
  hint,
}: {
  label: ReactNode
  checked: boolean
  onChange: (v: boolean) => void
  hint?: ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="text-sm font-medium text-slate-700 dark:text-slate-200">{label}</div>
        {hint ? <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{hint}</p> : null}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={typeof label === 'string' ? label : undefined}
        onClick={() => onChange(!checked)}
        className={cx(
          'relative h-7 w-12 shrink-0 rounded-full border dl-transition',
          checked ? 'border-a-600 bg-a-600' : 'border-slate-300 bg-slate-200 dark:border-slate-600 dark:bg-slate-700',
        )}
      >
        <span
          className={cx(
            'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow dl-transition',
            checked ? 'left-6' : 'left-0.5',
          )}
        />
      </button>
    </div>
  )
}

/* ============================================================== 步骤进度 */

export interface StageDot {
  key: string
  label: string
  /** 五步法的阶段名 */
  short: string
}

export function StageDots({
  stages,
  index,
  solved,
  onPick,
}: {
  stages: StageDot[]
  index: number
  solved: number[]
  onPick?: (i: number) => void
}) {
  return (
    <ol className="flex flex-wrap items-center gap-1.5" aria-label="学习步骤进度">
      {stages.map((s, i) => {
        const done = solved.includes(i)
        const active = i === index
        return (
          <li key={s.key}>
            <button
              type="button"
              onClick={() => onPick?.(i)}
              disabled={!onPick}
              aria-current={active ? 'step' : undefined}
              aria-label={`第 ${i + 1} 步：${s.label}${done ? '（已完成）' : ''}`}
              className={cx(
                'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium dl-transition',
                active
                  ? 'border-a-500 bg-a-50 text-a-700 dark:bg-a-500/20 dark:text-a-300'
                  : done
                    ? 'border-ok-500 bg-ok-50 text-ok-700 dark:bg-ok-500/10 dark:text-ok-500'
                    : 'border-slate-200 bg-white text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400',
                onPick ? 'cursor-pointer hover:border-a-500' : 'cursor-default',
              )}
            >
              <span aria-hidden="true">{done ? '✓' : i + 1}</span>
              <span className="hidden sm:inline">{s.label}</span>
              <span className="sm:hidden">{s.short}</span>
            </button>
          </li>
        )
      })}
    </ol>
  )
}

/* ============================================================== 步骤播放器控件 */

export function StepControls<S>({
  api,
  label = '动画步骤',
  onStepChange,
}: {
  api: StepperApi<S>
  label?: string
  onStepChange?: (i: number) => void
}) {
  const { index, count, next, prev, reset, playing, toggle, speed, setSpeed, atStart, atEnd, steps } = api

  useEffect(() => {
    onStepChange?.(index)
  }, [index, onStepChange])

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <IconBtn label="上一步" onClick={prev} disabled={atStart}>
          ⟨
        </IconBtn>
        <IconBtn label={playing ? '暂停' : '自动播放'} onClick={toggle} className="bg-a-600 text-white hover:bg-a-700">
          {playing ? '❙❙' : '▶'}
        </IconBtn>
        <IconBtn label="下一步" onClick={next} disabled={atEnd}>
          ⟩
        </IconBtn>
        <IconBtn label="重置" onClick={reset}>
          ↺
        </IconBtn>

        <div className="ml-auto flex items-center gap-2">
          <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
            {count === 0 ? '0 / 0' : `${index + 1} / ${count}`}
          </span>
          <div className="flex items-center gap-1" role="group" aria-label="播放速度">
            {SPEEDS.map((s: Speed) => (
              <button
                key={s}
                type="button"
                aria-pressed={speed === s}
                onClick={() => setSpeed(s)}
                className={cx(
                  'rounded-md px-1.5 py-1 font-mono text-[0.7rem] dl-transition',
                  speed === s
                    ? 'bg-a-600 text-white'
                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400',
                )}
              >
                {s}×
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 步骤条：可直接跳到任意一步（时间旅行） */}
      {count > 1 ? (
        <div className="flex items-center gap-2">
          <label className="sr-only" htmlFor={`scrub-${label}`}>
            拖动以跳转到任意步骤
          </label>
          <input
            id={`scrub-${label}`}
            type="range"
            min={0}
            max={count - 1}
            value={index}
            onChange={(e) => api.goTo(Number(e.target.value))}
            className="h-6 w-full cursor-pointer accent-a-600"
            aria-valuetext={`第 ${index + 1} 步，共 ${count} 步：${steps[index]?.label ?? ''}`}
          />
        </div>
      ) : null}
    </div>
  )
}

/** 旁白条：任何时刻都要有一句人话解释屏幕上在发生什么（铁律 R4） */
export function NarratorBar({ children, tone = 'normal' }: { children: ReactNode; tone?: 'normal' | 'reject' | 'accept' }) {
  return (
    <div
      className={cx(
        'flex min-h-14 items-center gap-3 rounded-xl border px-3 py-2.5 text-sm leading-relaxed',
        tone === 'accept'
          ? 'border-ok-500 bg-ok-50 text-ok-700 dark:bg-ok-500/10 dark:text-ok-500'
          : tone === 'reject'
            ? 'border-bad-500 bg-bad-50 text-bad-700 dark:bg-bad-500/10 dark:text-bad-500'
            : 'border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200',
      )}
    >
      <span aria-hidden="true" className="shrink-0 text-base">
        {tone === 'accept' ? '✓' : tone === 'reject' ? '!' : '💬'}
      </span>
      <p>{children}</p>
    </div>
  )
}
