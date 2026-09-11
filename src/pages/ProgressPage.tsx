import { useState } from 'react'
import { Link } from 'react-router-dom'

import { CATALOG, TOPIC_BY_ID, MODULE_BY_ID } from '@/topics/catalog'
import { isReady } from '@/topics/loader'
import { useProgress } from '@/platform/progress'
import { Btn, Callout, Card, Chip, PlainSpeak, SectionTitle, cx } from '@/ui'

export default function ProgressPage() {
  const progress = useProgress()
  const [confirmReset, setConfirmReset] = useState(false)

  const started = CATALOG.map((t) => ({ meta: t, p: progress.get(t.id) })).filter(
    (x) => x.p.visits > 0 || x.p.solved.length > 0,
  )
  const completed = started.filter((x) => x.p.completed)

  // 提示使用分布：规划书 §14.1 说这是「最核心的难度指标」
  const hintTotals = started.reduce(
    (acc, x) => ({
      h1: acc.h1 + x.p.hints.h1,
      h2: acc.h2 + x.p.hints.h2,
      h3: acc.h3 + x.p.hints.h3,
    }),
    { h1: 0, h2: 0, h3: 0 },
  )
  const totalHints = hintTotals.h1 + hintTotals.h2 + hintTotals.h3
  const h3Rate = totalHints > 0 ? Math.round((hintTotals.h3 / totalHints) * 100) : 0

  const toughest = [...started]
    .map((x) => ({ ...x, regret: x.p.hints.h3 * 3 + x.p.hints.h2 * 2 + x.p.hints.h1 + x.p.confused * 2 }))
    .filter((x) => x.regret > 0)
    .sort((a, b) => b.regret - a.regret)
    .slice(0, 5)

  return (
    <div className="mx-auto w-full max-w-4xl px-3 pb-16 pt-6 sm:px-4">
      <header>
        <h1 className="text-2xl font-black text-slate-900 sm:text-3xl dark:text-slate-50">我的进度</h1>
        <p className="mt-2 text-slate-600 dark:text-slate-300">
          所有数据只存在你这台设备的浏览器里，不会上传到任何服务器。
        </p>
      </header>

      {started.length === 0 ? (
        <Card className="mt-6 text-center">
          <p className="text-4xl" aria-hidden="true">
            🌱
          </p>
          <p className="mt-3 text-slate-600 dark:text-slate-300">还没有任何记录。</p>
          <div className="mt-4 flex justify-center">
            <Link to="/learn/S1">
              <Btn variant="primary">走第一个知识点</Btn>
            </Link>
          </div>
        </Card>
      ) : (
        <>
          {/* -------------------------------------------------------- 总览 */}
          <section className="mt-6 grid gap-3 sm:grid-cols-3">
            <Stat label="已走完" value={`${completed.length}`} unit={`/ ${isReady('S1') ? CATALOG.filter((t) => isReady(t.id)).length : 0} 已上线`} />
            <Stat label="动过手" value={`${started.length}`} unit="个知识点" />
            <Stat
              label="看答案比例"
              value={`${h3Rate}%`}
              unit={h3Rate > 40 ? '偏高，说明有些步骤该重做' : '健康'}
              tone={h3Rate > 40 ? 'bad' : 'ok'}
            />
          </section>

          <div className="mt-3">
            <PlainSpeak>
              「看答案比例」是本站最重要的一个数字：如果某个步骤超过四成的人都要直接看答案，
              那就是我们把这一步讲得太跳了，需要重写 —— 而不是你不够聪明。
            </PlainSpeak>
          </div>

          {/* ------------------------------------------------------ 逐项进度 */}
          <Card className="mt-6">
            <SectionTitle hint="按学习地图顺序">知识点明细</SectionTitle>
            <ul className="flex flex-col gap-2.5">
              {started.map(({ meta, p }) => {
                const pct = p.total > 0 ? Math.round((p.solved.length / p.total) * 100) : 0
                const mod = MODULE_BY_ID[meta.moduleId]
                return (
                  <li key={meta.id}>
                    <Link to={`/learn/${meta.id}`} className="block">
                      <div className="flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-2.5 hover:border-a-500 dark:border-slate-700">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-medium text-slate-800 dark:text-slate-100">{meta.title}</span>
                            {p.completed ? <Chip tone="ok">已通关</Chip> : null}
                            {progress.state.mastered.includes(meta.id) ? <Chip tone="a">已掌握</Chip> : null}
                            {p.confused > 0 ? <Chip tone="bad">标过 {p.confused} 次没看懂</Chip> : null}
                          </div>
                          <div className="mt-1.5 flex items-center gap-2">
                            <div
                              className="h-2 flex-1 overflow-hidden rounded-full bg-slate-150 bg-slate-100 dark:bg-slate-800"
                              role="progressbar"
                              aria-valuenow={pct}
                              aria-valuemin={0}
                              aria-valuemax={100}
                              aria-label={`${meta.title} 完成度`}
                            >
                              <div
                                className={cx('h-full rounded-full dl-transition', p.completed ? 'bg-ok-500' : 'bg-a-500')}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="font-mono text-[0.7rem] text-slate-400">
                              {p.solved.length}/{p.total || 5}
                            </span>
                          </div>
                          <p className="mt-1 text-[0.7rem] text-slate-400">
                            {mod?.name} · 提示 H1×{p.hints.h1} H2×{p.hints.h2} H3×{p.hints.h3}
                          </p>
                        </div>
                      </div>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </Card>

          {/* ------------------------------------------------------ 卡点诊断 */}
          {toughest.length > 0 ? (
            <Card className="mt-4">
              <SectionTitle hint="按提示与「没看懂」次数排序">你最卡的地方</SectionTitle>
              <ol className="flex flex-col gap-2">
                {toughest.map((x) => (
                  <li key={x.meta.id} className="flex items-center gap-3 text-sm">
                    <span className="font-mono text-xs text-slate-400">{x.meta.id}</span>
                    <Link to={`/learn/${x.meta.id}`} className="flex-1 text-slate-700 hover:text-a-600 hover:underline dark:text-slate-200">
                      {x.meta.title}
                    </Link>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {x.p.hints.h3 > 0 ? `看答案 ${x.p.hints.h3} 次` : ''}
                      {x.p.hints.h3 > 0 && x.p.confused > 0 ? ' · ' : ''}
                      {x.p.confused > 0 ? `标了 ${x.p.confused} 次没看懂` : ''}
                    </span>
                  </li>
                ))}
              </ol>
              <div className="mt-3">
                <Callout tone="info">
                  这些都是我们该改的地方。你可以直接点进去再看一遍，或者用右下角的「这一步没看懂」告诉我们具体卡在哪。
                </Callout>
              </div>
            </Card>
          ) : null}

          {/* -------------------------------------------------------- 危险区 */}
          <Card className="mt-4">
            <SectionTitle>清除数据</SectionTitle>
            {!confirmReset ? (
              <Btn variant="outline" size="sm" onClick={() => setConfirmReset(true)}>
                清除全部学习记录
              </Btn>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-slate-600 dark:text-slate-300">确定吗？这个操作没法撤销。</span>
                <Btn
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    progress.resetAll()
                    setConfirmReset(false)
                  }}
                >
                  确定清除
                </Btn>
                <Btn variant="ghost" size="sm" onClick={() => setConfirmReset(false)}>
                  算了
                </Btn>
              </div>
            )}
          </Card>
        </>
      )}

      <p className="mt-6 text-xs text-slate-400">
        规划中的知识点共 {CATALOG.length} 个：
        {CATALOG.filter((t) => !isReady(t.id))
          .map((t) => TOPIC_BY_ID[t.id].title)
          .slice(0, 6)
          .join('、')}
        …… 会陆续上线。
      </p>
    </div>
  )
}

function Stat({
  label,
  value,
  unit,
  tone = 'a',
}: {
  label: string
  value: string
  unit?: string
  tone?: 'a' | 'ok' | 'bad'
}) {
  const color = tone === 'ok' ? 'text-ok-600' : tone === 'bad' ? 'text-bad-600' : 'text-a-600 dark:text-a-400'
  return (
    <Card>
      <div className="text-xs text-slate-500 dark:text-slate-400">{label}</div>
      <div className="mt-1 flex items-baseline gap-1.5">
        <span className={cx('text-2xl font-black', color)}>{value}</span>
        {unit ? <span className="text-xs text-slate-500 dark:text-slate-400">{unit}</span> : null}
      </div>
    </Card>
  )
}
