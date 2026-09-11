import { Link } from 'react-router-dom'

import { CATALOG, TOPIC_BY_ID, modulesByStage } from '@/topics/catalog'
import { isReady } from '@/topics/loader'
import { useProgress } from '@/platform/progress'
import { Card, Chip, PlainSpeak, cx } from '@/ui'

/**
 * 知识地图。
 *
 * 规划书 §9.3：**永不阻塞** —— 知识点之间只做「推荐顺序」，不做强制解锁。
 * 所以这里没有任何锁图标，只有「已走完 / 走了一半 / 还没开始 / 还在制作」四种状态。
 */
export default function KnowledgeMap() {
  const progress = useProgress()

  return (
    <div className="mx-auto w-full max-w-6xl px-3 pb-16 pt-6 sm:px-4">
      <header>
        <h1 className="text-2xl font-black text-slate-900 sm:text-3xl dark:text-slate-50">知识地图</h1>
        <p className="mt-2 max-w-3xl leading-relaxed text-slate-600 dark:text-slate-300">
          从下往上依次变难。箭头方向的依赖只是<b>推荐顺序</b>，不是门锁 ——
          任何知识点你都可以直接点进去，看不懂再回头补前置的就行。
        </p>
      </header>

      <div className="mt-4">
        <PlainSpeak>
          不知道怎么选？直接按地图从上往下、从左往右点就行。实在没主意，就先点
          <Link to="/learn/S1" className="mx-1 font-semibold text-a-600 underline">
            集合与子集
          </Link>
          —— 它不需要任何前置知识。
        </PlainSpeak>
      </div>

      <div className="mt-6 flex flex-col gap-8">
        {modulesByStage()
          .filter((g) => g.modules.some((m) => CATALOG.some((t) => t.moduleId === m.id)))
          .map((group) => (
            <section key={group.stage}>
              <div className="mb-3 flex items-center gap-3">
                <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">{group.title}</h2>
                <span className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
                <span className="font-mono text-xs text-slate-400">
                  阶段 {group.stage}
                </span>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                {group.modules
                  .filter((m) => CATALOG.some((t) => t.moduleId === m.id))
                  .map((m) => {
                    const topics = CATALOG.filter((t) => t.moduleId === m.id)
                    const readyCount = topics.filter((t) => isReady(t.id)).length
                    return (
                      <Card key={m.id} className="flex flex-col gap-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h3 className="font-semibold text-slate-800 dark:text-slate-100">
                              <Link to={`/m/${m.id}`} className="hover:text-a-600 hover:underline">
                                {m.name}
                              </Link>
                            </h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400">{m.blurb}</p>
                          </div>
                          <Chip tone={readyCount > 0 ? 'a' : 'dim'} showGlyph={false}>
                            {readyCount}/{topics.length}
                          </Chip>
                        </div>

                        <ul className="flex flex-col gap-1.5">
                          {topics.map((t) => {
                            const ready = isReady(t.id)
                            const p = progress.get(t.id)
                            const done = p.completed
                            const started = p.solved.length > 0
                            return (
                              <li key={t.id}>
                                <TopicRow
                                  id={t.id}
                                  ready={ready}
                                  done={done}
                                  started={started}
                                  solved={p.solved.length}
                                  total={p.total}
                                />
                              </li>
                            )
                          })}
                        </ul>
                      </Card>
                    )
                  })}
              </div>
            </section>
          ))}
      </div>

      <section className="mt-10">
        <Card>
          <h2 className="font-semibold text-slate-800 dark:text-slate-100">完整清单</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            一共规划了 {CATALOG.length} 个知识点。带「正在制作」标记的，算法内核和单测已经写好，交互稿还在打磨。
          </p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {CATALOG.map((t) => (
              <li key={t.id}>
                <Link to={`/learn/${t.id}`}>
                  <Chip tone={isReady(t.id) ? 'a' : 'dim'}>
                    {t.id} {t.title}
                  </Chip>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </section>
    </div>
  )
}

function TopicRow({
  id,
  ready,
  done,
  started,
  solved,
  total,
}: {
  id: string
  ready: boolean
  done: boolean
  started: boolean
  solved: number
  total: number
}) {
  const t = TOPIC_BY_ID[id]
  const pre = t.prerequisites.filter((p) => TOPIC_BY_ID[p])

  const inner = (
    <div
      className={cx(
        'flex items-center gap-3 rounded-xl border px-3 py-2.5 dl-transition',
        ready
          ? 'border-slate-200 bg-white hover:border-a-500 hover:shadow-sm dark:border-slate-700 dark:bg-slate-900'
          : 'border-dashed border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/40',
      )}
    >
      <span
        aria-hidden="true"
        className={cx(
          'grid h-7 w-7 shrink-0 place-items-center rounded-lg text-xs font-bold',
          done
            ? 'bg-ok-500 text-white'
            : started
              ? 'bg-cur-500 text-white'
              : ready
                ? 'bg-a-100 text-a-700 dark:bg-a-500/20 dark:text-a-300'
                : 'bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-500',
        )}
      >
        {done ? '✓' : ready ? id : '…'}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className={cx('text-sm font-medium', ready ? 'text-slate-800 dark:text-slate-100' : 'text-slate-500 dark:text-slate-400')}>
            {t.title}
          </span>
          {!ready ? <Chip tone="dim" showGlyph={false}>正在制作</Chip> : null}
        </div>
        <p className="truncate text-xs text-slate-500 dark:text-slate-400">{t.oneLiner}</p>
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1">
        <span className="font-mono text-[0.7rem] text-slate-400">{t.minutes} 分钟</span>
        {started && !done ? (
          <span className="font-mono text-[0.7rem] text-cur-600 dark:text-cur-500">
            {solved}/{total || 5}
          </span>
        ) : null}
        {pre.length > 0 ? (
          <span className="hidden text-[0.7rem] text-slate-400 sm:inline">
            前置 {pre.join(' ')}
          </span>
        ) : null}
      </div>
    </div>
  )

  return (
    <Link to={`/learn/${id}`} aria-label={`${t.title}${done ? '，已通关' : ''}${!ready ? '，正在制作' : ''}`}>
      {inner}
    </Link>
  )
}
