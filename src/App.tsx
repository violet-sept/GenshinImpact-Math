import { lazy, Suspense } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'

import { AppShell } from '@/layout/AppShell'
import { SettingsProvider } from '@/platform/settings'
import { ProgressProvider } from '@/platform/progress'
import { Announcer } from '@/platform/announcer'

/*
 * 路由级代码分割（规划书 §8.5 的包体预算）：
 * 首页只带导航和首页本身的代码，知识点页与沙盒的交互代码在真正进入时才下载。
 * 用 HashRouter 是因为产出的是纯静态文件，放到任何静态托管上都不用配 URL 重写。
 */
const Home = lazy(() => import('@/pages/Home'))
const KnowledgeMap = lazy(() => import('@/pages/KnowledgeMap'))
const ModulePage = lazy(() => import('@/pages/ModulePage'))
const TopicPage = lazy(() => import('@/learn/TopicPage'))
const ProgressPage = lazy(() => import('@/pages/ProgressPage'))
const GlossaryPage = lazy(() => import('@/pages/GlossaryPage'))
const SandboxPage = lazy(() => import('@/pages/SandboxPage'))
const AboutPage = lazy(() => import('@/pages/AboutPage'))

function RouteFallback() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10" aria-busy="true" aria-live="polite">
      <div className="h-6 w-40 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
      <div className="mt-4 h-64 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800/60" />
      <span className="sr-only">正在加载…</span>
    </div>
  )
}

export default function App() {
  return (
    <SettingsProvider>
      <ProgressProvider>
        <Announcer>
          <HashRouter>
            <Suspense fallback={<RouteFallback />}>
              <Routes>
                <Route element={<AppShell />}>
                  <Route path="/" element={<Home />} />
                  <Route path="/map" element={<KnowledgeMap />} />
                  <Route path="/m/:moduleId" element={<ModulePage />} />
                  <Route path="/learn/:topicId" element={<TopicPage />} />
                  <Route path="/progress" element={<ProgressPage />} />
                  <Route path="/glossary" element={<GlossaryPage />} />
                  <Route path="/sandbox" element={<SandboxPage />} />
                  <Route path="/about" element={<AboutPage />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Route>
              </Routes>
            </Suspense>
          </HashRouter>
        </Announcer>
      </ProgressProvider>
    </SettingsProvider>
  )
}
