import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'

import { HAS_WALLPAPER, useSettings } from '@/platform/settings'
import { useProgress } from '@/platform/progress'
import { Btn, Card, Segmented, SliderRow, SwitchRow, cx } from '@/ui'
import { CATALOG } from '@/topics/catalog'
import { READY_IDS } from '@/topics/loader'
import { DynamicWallpaper } from '@/layout/DynamicWallpaper'

const NAV = [
  { to: '/map', label: '知识地图', icon: '🗺' },
  { to: '/sandbox', label: '沙盒', icon: '🧪' },
  { to: '/glossary', label: '术语表', icon: '📖' },
  { to: '/progress', label: '我的进度', icon: '📈' },
]

export function AppShell() {
  const { pathname } = useLocation()
  const progress = useProgress()

  // 路由切换后把焦点交给主内容区，读屏用户不用重新 Tab 一遍导航
  useEffect(() => {
    document.getElementById('dl-main')?.focus({ preventScroll: true })
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [pathname])

  const doneCount = progress.summary.completed
  const totalReady = READY_IDS.length

  return (
    <div className="relative flex min-h-dvh flex-col">
      <DynamicWallpaper />
      <a href="#dl-main" className="sr-only-focusable absolute left-2 top-2 z-50">
        <Btn variant="primary" size="sm">
          跳到主要内容
        </Btn>
      </a>

      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/85 backdrop-blur dark:border-slate-800 dark:bg-slate-950/85">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-3 sm:px-4">
          <Link to="/" className="flex items-center gap-2 font-bold text-slate-800 dark:text-slate-100">
            <span
              aria-hidden="true"
              className="grid h-8 w-8 place-items-center rounded-lg bg-neon-400 text-sm text-slate-900"
            >
              离
            </span>
            <span className="hidden xs:inline">离散数学</span>
          </Link>

          <nav aria-label="主导航" className="ml-2 hidden items-center gap-1 md:flex">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                className={({ isActive }) =>
                  cx(
                    'rounded-lg px-3 py-2 text-sm font-medium dl-transition',
                    isActive
                      ? 'bg-a-50 text-a-700 dark:bg-a-500/20 dark:text-a-300'
                      : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800',
                  )
                }
              >
                {n.label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <span className="hidden text-xs text-slate-500 sm:inline dark:text-slate-400">
              已通关 {doneCount}/{totalReady}
            </span>
            <SettingsMenu />
          </div>
        </div>
      </header>

      <main id="dl-main" tabIndex={-1} className="flex-1 outline-none">
        <Outlet />
      </main>

      <footer className="mt-10 hidden border-t border-slate-200 px-4 py-6 text-xs text-slate-500 md:block dark:border-slate-800 dark:text-slate-400">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
          <p>
            离散数学 · 用可以上手拖的动画讲离散数学 · 共 {CATALOG.length} 个知识点，已上线 {totalReady} 个
          </p>
          <nav className="flex gap-3" aria-label="页脚导航">
            <Link to="/about" className="hover:text-a-600 hover:underline">
              关于与教学理念
            </Link>
            <Link to="/progress" className="hover:text-a-600 hover:underline">
              进度与数据
            </Link>
          </nav>
        </div>
      </footer>

      {/* 移动端底部标签栏：放在拇指热区（规划书 §8.2） */}
      <nav
        aria-label="移动端导航"
        className="sticky bottom-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur md:hidden dark:border-slate-800 dark:bg-slate-950/95"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <ul className="flex">
          {NAV.map((n) => (
            <li key={n.to} className="flex-1">
              <NavLink
                to={n.to}
                className={({ isActive }) =>
                  cx(
                    'flex min-h-14 flex-col items-center justify-center gap-0.5 text-[0.7rem] font-medium dl-transition',
                    isActive ? 'text-a-600 dark:text-a-300' : 'text-slate-500 dark:text-slate-400',
                  )
                }
              >
                <span aria-hidden="true" className="text-lg leading-none">
                  {n.icon}
                </span>
                {n.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}

function SettingsMenu() {
  const [open, setOpen] = useState(false)
  const s = useSettings()

  return (
    <div className="relative">
      <Btn
        variant="outline"
        size="sm"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((o) => !o)}
      >
        <span aria-hidden="true">⚙</span>
        <span className="hidden sm:inline">显示设置</span>
      </Btn>

      {open ? (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden="true" />
          <Card
            role="dialog"
            aria-label="显示设置"
            className="absolute right-0 top-12 z-50 w-[min(20rem,calc(100vw-1.5rem))] shadow-xl"
          >
            <div className="flex flex-col gap-4">
              <Segmented
                label="主题"
                value={s.theme}
                onChange={(v) => s.update({ theme: v })}
                size="sm"
                options={[
                  { value: 'auto', label: '跟随系统' },
                  { value: 'light', label: '浅色' },
                  { value: 'dark', label: '深色' },
                ]}
              />
              {/* 动态壁纸是独立于主题色的一层，单独成组，不和主题选择混在一起。
                  这次构建没有视频可放时整组都不出现 —— 留一个按了没反应的开关只会误导人。 */}
              {HAS_WALLPAPER && (
                <>
                  <div className="h-px bg-slate-200 dark:bg-slate-700" aria-hidden="true" />
                  <SwitchRow
                    label="动态壁纸"
                    checked={s.wallpaper}
                    onChange={(v) => s.update({ wallpaper: v })}
                    hint="独立于浅色 / 深色的一层视频背景，内容方框会透出壁纸自己的颜色。开启「关闭动画」、系统减少动态效果或高对比度时自动停用。"
                  />
                </>
              )}
              <div className="h-px bg-slate-200 dark:bg-slate-700" aria-hidden="true" />
              <SliderRow
                label="字号"
                min={1}
                max={1.5}
                step={0.1}
                value={s.fontScale}
                onChange={(v) => s.update({ fontScale: v })}
                format={(v) => `${Math.round(v * 100)}%`}
                hint="看不清就放大，布局会自动适应。"
              />
              <SwitchRow
                label="关闭动画"
                checked={s.motion === 'off'}
                onChange={(v) => s.update({ motion: v ? 'off' : 'on' })}
                hint="用静态高亮代替移动，适合容易晕动或想要更快节奏的人。"
              />
              <SwitchRow
                label="高对比度"
                checked={s.contrast}
                onChange={(v) => s.update({ contrast: v })}
                hint="投影仪或强光环境下更清楚。"
              />
              <SwitchRow
                label="课堂模式"
                checked={s.classroom}
                onChange={(v) => s.update({ classroom: v })}
                hint="字号放大、页面更干净，适合投屏讲解。"
              />
              <SwitchRow
                label="默认展开正式定义"
                checked={s.showFormal}
                onChange={(v) => s.update({ showFormal: v })}
                hint="默认关闭：先看人话和动画，需要时再看符号。"
              />
              <p className="text-xs text-slate-500 dark:text-slate-400">
                设置只存在你这台设备上，不会上传。
              </p>
            </div>
          </Card>
        </>
      ) : null}
    </div>
  )
}
