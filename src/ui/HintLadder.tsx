import { useEffect, useRef, useState } from 'react'
import { Btn, Callout, cx } from './index'

export type HintLevel = 0 | 1 | 2 | 3

export interface HintLadderProps {
  /** [H1 方向提示, H2 局部演示, H3 完整答案] */
  hints: [string, string, string]
  level: HintLevel
  onLevelChange: (level: HintLevel) => void
  /** 用户停滞多久后自动浮现 H1（默认 15 秒，对应规划书 §3.4） */
  idleMs?: number
  /** 任何用户操作都应传入新值以重置停滞计时 */
  activityKey?: unknown
  /** 已经完成这一步时收起提示 */
  solved?: boolean
}

/**
 * 三级提示脚手架（规划书 §3.4）。
 *
 * 关键设计：**绝不一开始就剧透**。
 *   H1 方向提示 —— 停滞 15 秒后自动浮现，只指方向，不给操作
 *   H2 局部演示 —— 用户主动点「提示」，高亮正确的目标位置
 *   H3 完整答案 —— 用户主动点「看答案」，自动完成这一步并解释原因，可一键回退重试
 */
export function HintLadder({ hints, level, onLevelChange, idleMs = 15000, activityKey, solved }: HintLadderProps) {
  const [idle, setIdle] = useState(false)
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => {
    if (solved || level >= 1) {
      setIdle(false)
      return
    }
    setIdle(false)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setIdle(true), idleMs)
    return () => window.clearTimeout(timer.current)
  }, [activityKey, idleMs, level, solved])

  const effective: HintLevel = level >= 1 ? level : idle ? 1 : 0
  if (solved && level === 0) return null

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">卡住了？</span>
        {effective < 1 ? (
          <Btn size="sm" variant="ghost" onClick={() => onLevelChange(1)}>
            给点提示
          </Btn>
        ) : null}
        {effective < 2 ? (
          <Btn size="sm" variant="outline" onClick={() => onLevelChange(2)}>
            高亮给我看
          </Btn>
        ) : null}
        {effective < 3 ? (
          <Btn size="sm" variant="outline" onClick={() => onLevelChange(3)}>
            直接看答案
          </Btn>
        ) : null}
        {level > 0 ? (
          <Btn size="sm" variant="ghost" onClick={() => onLevelChange(0)}>
            收起提示
          </Btn>
        ) : null}
      </div>

      {effective >= 1 ? (
        <Callout tone="cur" title="方向提示">
          {hints[0]}
        </Callout>
      ) : null}
      {effective >= 2 ? (
        <Callout tone="cur" title="给你指个位置">
          {hints[1]}
        </Callout>
      ) : null}
      {effective >= 3 ? (
        <Callout tone="info" title="完整答案 + 为什么">
          {hints[2]}
        </Callout>
      ) : null}
      {effective === 0 ? (
        <p className={cx('text-xs text-slate-400 dark:text-slate-500', idle && 'hidden')}>
          自己先试一次，实在不行再点提示 —— 试错本身就是在学。
        </p>
      ) : null}
    </div>
  )
}
