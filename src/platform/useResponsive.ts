import { useEffect, useState } from 'react'

/** 断点划分严格对应规划书 §8.1：按「内容形态」而非「设备」划分 */
export type Breakpoint = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

export interface Responsive {
  width: number
  breakpoint: Breakpoint
  /** 单列垂直堆叠（手机竖屏 / 手机横屏）—— 舞台在上、控制条在下（拇指热区） */
  isCompact: boolean
  /** 左右分栏（桌面 / 大屏） */
  isWide: boolean
  isPortrait: boolean
  /** 触摸设备（粗指针）：决定是否显示「拖动」类提示、是否放大命中区 */
  isTouch: boolean
}

function pick(width: number): Breakpoint {
  if (width < 480) return 'xs'
  if (width < 768) return 'sm'
  if (width < 1024) return 'md'
  if (width < 1440) return 'lg'
  return 'xl'
}

export function useResponsive(): Responsive {
  const [width, setWidth] = useState(() => (typeof window === 'undefined' ? 1024 : window.innerWidth))
  const [isPortrait, setPortrait] = useState(
    () => typeof window === 'undefined' || window.innerHeight >= window.innerWidth,
  )
  const [isTouch, setTouch] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches,
  )

  useEffect(() => {
    let frame = 0
    const onResize = (): void => {
      // 用 rAF 合并连续的 resize 事件，避免拖动窗口时每像素都重渲染
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        setWidth(window.innerWidth)
        setPortrait(window.innerHeight >= window.innerWidth)
      })
    }
    window.addEventListener('resize', onResize)
    window.addEventListener('orientationchange', onResize)
    const coarse = window.matchMedia('(pointer: coarse)')
    const onPointer = (e: MediaQueryListEvent): void => setTouch(e.matches)
    coarse.addEventListener('change', onPointer)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', onResize)
      window.removeEventListener('orientationchange', onResize)
      coarse.removeEventListener('change', onPointer)
    }
  }, [])

  const breakpoint = pick(width)
  return {
    width,
    breakpoint,
    isCompact: breakpoint === 'xs' || breakpoint === 'sm',
    isWide: breakpoint === 'lg' || breakpoint === 'xl',
    isPortrait,
    isTouch,
  }
}

/**
 * 低端设备自动降级（规划书 §8.2）。
 * 判据保守：只在明确拿不到性能信息、或核心数很低时才降级。
 */
export function useLowPower(): boolean {
  const [low, setLow] = useState(false)
  useEffect(() => {
    const cores = navigator.hardwareConcurrency ?? 4
    const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4
    setLow(cores <= 4 && mem <= 4)
  }, [])
  return low
}
