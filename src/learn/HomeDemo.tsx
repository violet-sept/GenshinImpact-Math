import { useState } from 'react'

import { VAR, AND, OR, evalExpr, exprToString, type Expr } from '@/kernels/logic'
import { Callout, Card, Chip, PlainSpeak, SectionTitle, SwitchRow, cx } from '@/ui'

const EXPR: Expr = OR(AND(VAR('P'), VAR('Q')), VAR('R'))

/**
 * 首页的「30 秒体验」。
 *
 * 规划书 §9.1 要求首页「一句话价值主张 + 直接进入推荐第一个知识点」。
 * 但「傻子也能看懂」还要更进一步：**先让访客亲手拨一下开关**，
 * 在 5 秒内体验一次「我操作 → 立刻看到结果 → 懂了」的闭环，
 * 这比任何文案都有说服力。
 */
export function HomeDemo() {
  const [p, setP] = useState(true)
  const [q, setQ] = useState(false)
  const [r, setR] = useState(false)

  const lit = evalExpr(EXPR, { P: p, Q: q, R: r })

  /** 串联：两个都要通才通电 */
  const series = p && q

  return (
    <Card className="overflow-hidden">
      <SectionTitle hint="拨一下开关试试">30 秒体验：这是什么感觉</SectionTitle>
      <PlainSpeak>
        电流从左边出发，要能一路走到右边的灯泡，灯才会亮。
        <strong className="font-semibold"> 串联 </strong>是「两个都合上才通」，
        <strong className="font-semibold"> 并联 </strong>是「任意一个合上就通」。
      </PlainSpeak>

      <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_15rem]">
        <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50">
          <CircuitSvg p={p} q={q} r={r} lit={lit} series={series} />
        </div>

        <div className="flex flex-col gap-3">
          <SwitchRow label="开关 P" checked={p} onChange={setP} />
          <SwitchRow label="开关 Q" checked={q} onChange={setQ} />
          <SwitchRow label="开关 R" checked={r} onChange={setR} />
          <div
            className={cx(
              'rounded-xl border px-3 py-2 text-center text-sm font-semibold dl-transition',
              lit
                ? 'border-cur-500 bg-cur-50 text-cur-700 dark:bg-cur-500/10 dark:text-cur-500'
                : 'border-slate-200 bg-white text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400',
            )}
            role="status"
          >
            <span aria-hidden="true" className="mr-1.5">
              {lit ? '💡' : '⚫'}
            </span>
            灯泡{lit ? '亮了' : '没亮'}
          </div>
          <Callout tone={lit ? 'ok' : 'info'}>
            现在它对应这个式子：<span className="font-mono">{exprToString(EXPR)}</span>
            <br />
            也就是「P 和 Q 都合上，<em>或者</em> R 合上」。
          </Callout>
        </div>
      </div>

      <p className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
        <Chip tone="a" showGlyph={false}>
          下一步
        </Chip>
        你会发现这张「所有开关组合 + 灯亮不亮」的表，就是课本里的<b className="mx-0.5">真值表</b>。
      </p>
    </Card>
  )
}

function CircuitSvg({ p, q, r, lit, series }: { p: boolean; q: boolean; r: boolean; lit: boolean; series: boolean }) {
  const wire = lit ? 'var(--color-cur-500)' : 'var(--color-dim-300)'
  const active = lit ? 'var(--color-cur-500)' : 'var(--color-a-500)'

  return (
    <svg viewBox="0 0 320 170" className="h-auto w-full" role="img" aria-label={`电路示意：当前灯泡${lit ? '亮' : '不亮'}`}>
      <defs>
        <linearGradient id="flow" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="var(--color-cur-500)" stopOpacity="0.15" />
          <stop offset="100%" stopColor="var(--color-cur-500)" stopOpacity="0.55" />
        </linearGradient>
      </defs>

      {/* 主干：电源 → 分叉点 */}
      <path d="M28 85 H 96" stroke={wire} strokeWidth={3} fill="none" strokeLinecap="round" />
      <circle cx="28" cy="85" r="7" fill="none" stroke="var(--color-dim-500)" strokeWidth={2} />
      <text x="28" y="112" textAnchor="middle" className="dl-svg-text" fill="var(--color-dim-600)">
        电源
      </text>

      {/* 上支路：P 与 Q 串联 */}
      <path
        d="M96 85 V 38 H 150 M 190 38 H 236"
        stroke={p && q ? wire : 'var(--color-dim-300)'}
        strokeWidth={3}
        fill="none"
        strokeLinecap="round"
      />
      <Switch x={150} y={38} closed={p} label="P" color={active} />
      <Switch x={236} y={38} closed={q} label="Q" color={active} />
      <path
        d="M276 38 H 300 V 85"
        stroke={series ? wire : 'var(--color-dim-300)'}
        strokeWidth={3}
        fill="none"
        strokeLinecap="round"
      />
      <text x="213" y="18" textAnchor="middle" className="dl-svg-text" fill="var(--color-dim-600)">
        串联（P 且 Q）
      </text>

      {/* 下支路：R */}
      <path d="M96 85 V 132 H 150 M 190 132 H 300" stroke={r ? wire : 'var(--color-dim-300)'} strokeWidth={3} fill="none" strokeLinecap="round" />
      <Switch x={150} y={132} closed={r} label="R" color={active} />
      <text x="240" y="156" textAnchor="middle" className="dl-svg-text" fill="var(--color-dim-600)">
        并联（或 R）
      </text>

      {/* 合流 → 灯泡 */}
      <path d="M300 85 H 344" stroke={wire} strokeWidth={3} fill="none" strokeLinecap="round" className="hidden" />
      <circle cx="300" cy="85" r="4" fill={wire} />
      <g transform="translate(300,85)">
        <circle cx="0" cy="0" r="0" fill="none" />
      </g>

      {/* 灯泡画在右侧 */}
      <g transform="translate(292,58)">
        <circle
          cx="0"
          cy="27"
          r="17"
          fill={lit ? 'var(--color-cur-100)' : 'var(--color-slate-100)'}
          stroke={lit ? 'var(--color-cur-500)' : 'var(--color-dim-300)'}
          strokeWidth={2.5}
          className="dl-transition"
        />
        {lit ? <circle cx="0" cy="27" r="24" fill="url(#flow)" opacity="0.35" /> : null}
        <path
          d="M-6 14 L0 4 L6 14"
          stroke={lit ? 'var(--color-cur-600)' : 'var(--color-dim-300)'}
          strokeWidth={2.5}
          fill="none"
          strokeLinecap="round"
        />
        <text x="0" y="62" textAnchor="middle" className="dl-svg-text" fill={lit ? 'var(--color-cur-700)' : 'var(--color-dim-600)'}>
          {lit ? '亮' : '灭'}
        </text>
      </g>
    </svg>
  )
}

function Switch({ x, y, closed, label, color }: { x: number; y: number; closed: boolean; label: string; color: string }) {
  return (
    <g transform={`translate(${x},${y})`}>
      <line x1="0" y1="0" x2="40" y2="0" stroke="transparent" strokeWidth={26} />
      <circle cx="0" cy="0" r="3.5" fill={closed ? color : 'var(--color-dim-500)'} />
      <circle cx="40" cy="0" r="3.5" fill={closed ? color : 'var(--color-dim-500)'} />
      {/* 断开时抬起 32°，合上时落下 —— 保持「从旧位置长出来」的位移感 */}
      <line
        x1="0"
        y1="0"
        x2={closed ? 40 : 34}
        y2={closed ? 0 : -21}
        stroke={color}
        strokeWidth={3.5}
        strokeLinecap="round"
        style={{ transition: 'all var(--dl-dur) var(--ease-dl)' }}
      />
      <text x="20" y={-14} textAnchor="middle" className="dl-svg-text" fill="var(--color-slate-600)">
        {label}
      </text>
    </g>
  )
}
