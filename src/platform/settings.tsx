import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

/* ---------------------------------------------------------------------------
 * 动态壁纸的视频地址
 *
 * 仓库里**不含**那段壁纸视频（135MB，超过 GitHub 单文件 100MB 上限），所以有两个来源：
 *   · 本地开发：public/wallpaper/nahida.mp4 —— 直接用本地文件，离线可用、不耗外链流量
 *   · 生产构建：VITE_WALLPAPER_URL 指向的外链（图床 / CDN / GitHub Release 附件）
 *
 * ⚠️ vite.config.ts 里的 `dl-wallpaper-flag` 插件按**同一条规则**给首屏内联脚本注入
 *    了一个同名布尔值（那边叫 __DL_HAS_WALLPAPER__）。两处必须一致：
 *    规则是「开发模式放行，生产构建必须有外链」。改一处记得改另一处。
 *
 *    这里刻意用 `import.meta.env.MODE === 'development'` 而不是更顺手的 `import.meta.env.DEV`：
 *    配置文件里能拿到的只有 `mode`，而 DEV 取自 NODE_ENV。平时两者等价，但将来若有人加一个
 *    `vite build --mode staging`，DEV 与 mode 就会分叉 —— 那一刻 HTML 里的判断和这里的判断
 *    会给出相反答案，正好复现「毛玻璃压在空白上」这个 bug。用 MODE 就能保证永远同步。
 * ------------------------------------------------------------------------- */
const CONFIGURED_WALLPAPER_URL = (import.meta.env.VITE_WALLPAPER_URL ?? '').trim()
const LOCAL_WALLPAPER_URL = `${import.meta.env.BASE_URL}wallpaper/nahida.mp4`

/** 这次构建到底有没有壁纸可放。为 false 时连 <video> 都不渲染，避免一个必然 404 的请求。 */
export const HAS_WALLPAPER = import.meta.env.MODE === 'development' || CONFIGURED_WALLPAPER_URL !== ''

/** 实际播放的地址：开发模式用本地文件，生产构建优先用外链。 */
export const WALLPAPER_SRC =
  import.meta.env.MODE === 'development'
    ? LOCAL_WALLPAPER_URL
    : CONFIGURED_WALLPAPER_URL || LOCAL_WALLPAPER_URL

export type ThemeMode = 'light' | 'dark' | 'auto'

export interface Settings {
  theme: ThemeMode
  /** 字号缩放：对应规划书 §8.6「支持 200% 缩放不破版」 */
  fontScale: number
  /** 动画开关：对应规划书 §6.2「全站尊重 prefers-reduced-motion」 */
  motion: 'on' | 'off'
  /** 高对比度：投影仪 / 强光教室场景 */
  contrast: boolean
  /** 课堂模式：字号放大、隐藏次要信息，方便投屏 */
  classroom: boolean
  /** 是否默认展开正式定义（默认不展开 —— 铁律：先人话，后符号） */
  showFormal: boolean
  /** 动态壁纸：整站背景循环播放一段视频（默认开启） */
  wallpaper: boolean
}

const DEFAULTS: Settings = {
  theme: 'dark',
  fontScale: 1,
  motion: 'on',
  contrast: false,
  classroom: false,
  showFormal: false,
  wallpaper: true,
}

const STORAGE_KEY = 'dl.settings.v1'

interface SettingsCtx extends Settings {
  update: (patch: Partial<Settings>) => void
  /** 综合「系统偏好 + 站内开关」，组件只关心这一个布尔值 */
  reducedMotion: boolean
  /**
   * 动态壁纸此刻是否真的在渲染。
   * 组件与 `<html class="wallpaper-on">` 都只认这一个布尔值，避免两处判断漂移。
   */
  wallpaperOn: boolean
  /**
   * 视频加载失败（地址填错 / 文件被删 / 格式不支持）时调用。
   *
   * 置位后 `wallpaper-on` 会被一并摘掉，整站退回纯主题色背景 ——
   * 不然留下的是一层毛玻璃压在空背景上，卡片半透明、正文对比度不达标。
   * 只降级一次，之后不再重试。
   */
  markWallpaperFailed: () => void
}

const Ctx = createContext<SettingsCtx | null>(null)

function read(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULTS
    return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Settings>) }
  } catch {
    return DEFAULTS
  }
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(() => read())
  const [systemDark, setSystemDark] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches,
  )
  const [systemReducedMotion, setSystemReducedMotion] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
  // 视频加载失败过就不再渲染壁纸层（首帧内联脚本已经铺了 class，要靠这里摘掉）
  const [wallpaperFailed, setWallpaperFailed] = useState(false)

  useEffect(() => {
    const dark = window.matchMedia('(prefers-color-scheme: dark)')
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onDark = (e: MediaQueryListEvent): void => setSystemDark(e.matches)
    const onMotion = (e: MediaQueryListEvent): void => setSystemReducedMotion(e.matches)
    dark.addEventListener('change', onDark)
    motion.addEventListener('change', onMotion)
    return () => {
      dark.removeEventListener('change', onDark)
      motion.removeEventListener('change', onMotion)
    }
  }, [])

  const reducedMotion = settings.motion === 'off' || systemReducedMotion
  /*
   * 动态壁纸是否真的在渲染：开关开着，且没有要求减少动态效果，
   * 也不是高对比度场景（投屏时视频背景只会毁掉对比度），
   * 这次构建确实有视频可放，且它还没有加载失败。
   * 壁纸是独立于浅色 / 深色的一层 —— 它的渲染条件里不含 theme。
   */
  const wallpaperOn =
    settings.wallpaper && !reducedMotion && !settings.contrast && HAS_WALLPAPER && !wallpaperFailed

  // 把设置写到 <html> 上，样式层只认 class / CSS 变量
  useEffect(() => {
    const el = document.documentElement
    const isDark = settings.theme === 'dark' || (settings.theme === 'auto' && systemDark)
    el.classList.toggle('dark', isDark)
    el.classList.toggle('contrast-high', settings.contrast)
    el.classList.toggle('motion-off', settings.motion === 'off')
    // 课堂模式把字再放大一档；与用户自己的字号设置相乘，而不是覆盖它
    el.classList.toggle('classroom', settings.classroom)
    el.classList.toggle('wallpaper-on', wallpaperOn)
    el.style.setProperty('--dl-font-scale', String(settings.fontScale * (settings.classroom ? 1.25 : 1)))
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
    } catch {
      /* 隐私模式下 localStorage 可能不可写，功能不应因此中断 */
    }
  }, [settings, systemDark, wallpaperOn])

  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((s) => ({ ...s, ...patch }))
  }, [])

  const markWallpaperFailed = useCallback(() => setWallpaperFailed(true), [])

  const value = useMemo<SettingsCtx>(
    () => ({
      ...settings,
      update,
      reducedMotion,
      wallpaperOn,
      markWallpaperFailed,
    }),
    [settings, update, reducedMotion, wallpaperOn, markWallpaperFailed],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useSettings(): SettingsCtx {
  const v = useContext(Ctx)
  if (!v) throw new Error('useSettings 必须在 <SettingsProvider> 内使用')
  return v
}
