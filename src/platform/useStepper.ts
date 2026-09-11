import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Step } from '@/kernels/types'
import { useSettings } from './settings'

export const SPEEDS = [0.5, 1, 1.5, 2] as const
export type Speed = (typeof SPEEDS)[number]

const BASE_DELAY_MS = 1400

export interface StepperApi<S> {
  index: number
  step: Step<S> | undefined
  steps: Step<S>[]
  count: number
  next: () => void
  prev: () => void
  goTo: (index: number) => void
  reset: () => void
  playing: boolean
  toggle: () => void
  pause: () => void
  speed: Speed
  setSpeed: (s: Speed) => void
  atStart: boolean
  atEnd: boolean
}

/**
 * 步骤播放器（规划书 §7.4「返回步骤序列」的消费端）。
 *
 * 因为算法已经把每一帧的状态快照都算好了，这里的 next / prev / goTo 全部是
 * 纯索引移动 —— 「回退」不需要任何反向计算，时间旅行天然成立。
 */
export function useStepper<S>(steps: Step<S>[], resetKey?: unknown): StepperApi<S> {
  const [index, setIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState<Speed>(1)
  const { reducedMotion } = useSettings()

  const count = steps.length
  const last = Math.max(count - 1, 0)

  // 题目换了（steps 长度或外部 key 变化）→ 回到第一步，避免索引越界
  useEffect(() => {
    setIndex(0)
    setPlaying(false)
  }, [resetKey])

  useEffect(() => {
    setIndex((i) => Math.min(i, last))
  }, [last])

  const next = useCallback(() => setIndex((i) => Math.min(i + 1, last)), [last])
  const prev = useCallback(() => setIndex((i) => Math.max(i - 1, 0)), [])
  const goTo = useCallback((i: number) => setIndex(Math.min(Math.max(i, 0), last)), [last])
  const reset = useCallback(() => {
    setIndex(0)
    setPlaying(false)
  }, [])

  const atEnd = index >= last
  const atStart = index <= 0

  const toggle = useCallback(() => {
    if (atEnd) {
      setIndex(0)
      setPlaying(true)
      return
    }
    setPlaying((p) => !p)
  }, [atEnd])

  const pause = useCallback(() => setPlaying(false), [])

  // 自动播放：节奏 = 基准时长 / 倍速；到末尾自动停下
  const tick = useRef(0)
  useEffect(() => {
    if (!playing) return
    if (atEnd) {
      setPlaying(false)
      return
    }
    // 用户开启了「关闭动画」时，延长停顿时间，让人看清静态高亮，而不是快速翻页
    const delay = (reducedMotion ? BASE_DELAY_MS * 1.6 : BASE_DELAY_MS) / speed
    tick.current += 1
    const id = window.setTimeout(() => setIndex((i) => Math.min(i + 1, last)), delay)
    return () => window.clearTimeout(id)
  }, [playing, index, speed, last, atEnd, reducedMotion])

  return useMemo(
    () => ({
      index,
      step: steps[index],
      steps,
      count,
      next,
      prev,
      goTo,
      reset,
      playing,
      toggle,
      pause,
      speed,
      setSpeed,
      atStart,
      atEnd,
    }),
    [index, steps, count, next, prev, goTo, reset, playing, toggle, pause, speed, atStart, atEnd],
  )
}
