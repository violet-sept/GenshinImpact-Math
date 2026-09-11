import { useCallback, useEffect, useRef, useState } from 'react'
import type { StageCtx } from './types'

/**
 * 「条件满足即通关」的守卫。
 *
 * 为什么需要它：交互画布通常靠「派生状态」判断用户是否做对了（例如「A 现在是 B 的子集」）。
 * 如果在 effect 里直接调 ctx.solve()，而 solve 又会触发一次 state 更新，
 * 判断条件在下一轮仍然成立 → 无限循环。这个 hook 保证条件一旦成立只触发一次，
 * 条件不再成立时自动解除（用户改回错误状态后可以再次通关）。
 */
export function useSolveOnce(ctx: StageCtx, when: boolean): void {
  const fired = useRef(false)
  const solve = ctx.solve

  useEffect(() => {
    if (when) {
      if (!fired.current) {
        fired.current = true
        solve()
      }
    } else {
      fired.current = false
    }
  }, [when, solve])
}

/** 记录用户点过哪些对象 —— 「每个都点一遍才算探索过」这类要求用得上 */
export function useTriedSet(): { tried: Set<string>; markTried: (id: string) => void } {
  const [tried, setTried] = useState<Set<string>>(() => new Set())
  const markTried = useCallback((id: string) => {
    setTried((prev) => (prev.has(id) ? prev : new Set(prev).add(id)))
  }, [])
  return { tried, markTried }
}
