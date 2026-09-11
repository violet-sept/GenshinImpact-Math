import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'

/**
 * 屏幕阅读器播报（规划书 §8.6）。
 *
 * 交互画布对读屏用户是「黑盒」，所以每次状态变化都必须有人话播报，
 * 例如「元素 3 已加入集合 A，并集现在有 4 个元素」。
 */
type Announce = (message: string, priority?: 'polite' | 'assertive') => void

const Ctx = createContext<Announce>(() => {})

export function Announcer({ children }: { children: ReactNode }) {
  const [polite, setPolite] = useState('')
  const [assertive, setAssertive] = useState('')
  const seq = useRef(0)

  const announce = useCallback<Announce>((message, priority = 'polite') => {
    // 同一条消息重复播报时读屏软件会静默，加一个不可见的序号强制它重新朗读
    seq.current += 1
    const text = `${message}`
    if (priority === 'assertive') setAssertive(text)
    else setPolite(text)
    window.setTimeout(() => {
      if (priority === 'assertive') setAssertive('')
      else setPolite('')
    }, 4000)
  }, [])

  const value = useMemo(() => announce, [announce])

  return (
    <Ctx.Provider value={value}>
      {children}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {polite}
      </div>
      <div aria-live="assertive" aria-atomic="true" className="sr-only">
        {assertive}
      </div>
    </Ctx.Provider>
  )
}

export const useAnnounce = (): Announce => useContext(Ctx)
