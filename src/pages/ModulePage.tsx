import { Link, useParams } from 'react-router-dom'

import { MODULE_BY_ID, TOPIC_BY_ID, topicsOfModule } from '@/topics/catalog'
import { isReady } from '@/topics/loader'
import { useProgress } from '@/platform/progress'
import { Btn, Card, Chip, PlainSpeak, SectionTitle, cx } from '@/ui'
import { NotFound } from './NotFound'

export default function ModulePage() {
  const { moduleId = '' } = useParams()
  const mod = MODULE_BY_ID[moduleId]
  const progress = useProgress()

  if (!mod) return <NotFound what={`模块 ${moduleId}`} />

  const topics = topicsOfModule(mod.id)
  const readyTopics = topics.filter((t) => isReady(t.id))
  const firstReady = readyTopics[0]

  return (
    <div className="mx-auto w-full max-w-4xl px-3 pb-16 pt-6 sm:px-4">
      <nav aria-label="面包屑" className="mb-2 flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
        <Link to="/map" className="hover:text-a-600 hover:underline">
          知识地图
        </Link>
        <span aria-hidden="true">›</span>
        <span>{mod.name}</span>
      </nav>

      <header>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-black text-slate-900 sm:text-3xl dark:text-slate-50">{mod.name}</h1>
          <Chip tone="a" showGlyph={false}>
            阶段 {mod.stage}
          </Chip>
        </div>
        <p className="mt-2 text-slate-600 dark:text-slate-300">{mod.blurb}</p>
      </header>

      <div className="mt-4">
        <PlainSpeak>
          这个模块一共 {topics.length} 个知识点，已经上线 {readyTopics.length} 个。
          建议按下面列出的顺序走 —— 后面的会用到前面的东西。
        </PlainSpeak>
      </div>

      {firstReady ? (
        <div className="mt-4">
          <Link to={`/learn/${firstReady.id}`}>
            <Btn variant="primary" size="lg">
              从「{firstReady.title}」开始 →
            </Btn>
          </Link>
        </div>
      ) : null}

      <Card className="mt-6">
        <SectionTitle hint="按推荐顺序排列">知识点列表</SectionTitle>
        <ol className="flex flex-col gap-2">
          {topics.map((t, i) => {
            const ready = isReady(t.id)
            const p = progress.get(t.id)
            const pre = t.prerequisites.map((id) => TOPIC_BY_ID[id]).filter(Boolean)
            return (
              <li key={t.id}>
                <Link to={`/learn/${t.id}`} className="block">
                  <div
                    className={cx(
                      'flex items-start gap-3 rounded-xl border px-3 py-3 dl-transition',
                      ready
                        ? 'border-slate-200 bg-white hover:border-a-500 hover:shadow-sm dark:border-slate-700 dark:bg-slate-900'
                        : 'border-dashed border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/40',
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className={cx(
                        'grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold',
                        p.completed
                          ? 'bg-ok-500 text-white'
                          : p.solved.length > 0
                            ? 'bg-cur-500 text-white'
                            : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
                      )}
                    >
                      {p.completed ? '✓' : i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-slate-800 dark:text-slate-100">{t.title}</span>
                        <span className="font-mono text-[0.7rem] text-slate-400">{t.id}</span>
                        {!ready ? (
                          <Chip tone="dim" showGlyph={false}>
                            正在制作
                          </Chip>
                        ) : null}
                      </div>
                      <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-300">{t.oneLiner}</p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t.hookTeaser}</p>
                      {pre.length > 0 ? (
                        <p className="mt-1 text-[0.7rem] text-slate-400">
                          前置：{pre.map((x) => x.title).join('、')}
                        </p>
                      ) : null}
                    </div>
                    <span className="shrink-0 font-mono text-[0.7rem] text-slate-400">{t.minutes}′</span>
                  </div>
                </Link>
              </li>
            )
          })}
        </ol>
      </Card>
    </div>
  )
}
