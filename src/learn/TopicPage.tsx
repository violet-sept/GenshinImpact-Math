import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'

import { BIG_IDEA_STICKERS } from '@/assets/big-idea'
import { STAGE_SEQUENCE, type StageCtx, type Topic } from '@/topics/types'
import { TOPIC_BY_ID, nextTopicId, prevTopicId, MODULE_BY_ID } from '@/topics/catalog'
import { isReady, loadTopic } from '@/topics/loader'
import { useProgress } from '@/platform/progress'
import { useAnnounce } from '@/platform/announcer'
import { useSettings } from '@/platform/settings'
import { Btn, Callout, Card, Chip, FormalDefinition, NarratorBar, PlainSpeak, SectionTitle, StageDots, cx } from '@/ui'
import { HintLadder, type HintLevel } from '@/ui/HintLadder'
import { NotFound } from '@/pages/NotFound'

export default function TopicPage() {
  const { topicId = '' } = useParams()
  const meta = TOPIC_BY_ID[topicId]

  if (!meta) return <NotFound what={`知识点 ${topicId}`} />
  if (!isReady(topicId)) return <ComingSoon topicId={topicId} />
  return <TopicRunner key={topicId} topicId={topicId} />
}

function ComingSoon({ topicId }: { topicId: string }) {
  const meta = TOPIC_BY_ID[topicId]
  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <Card>
        <Chip tone="cur">正在制作</Chip>
        <h1 className="mt-3 text-2xl font-bold text-slate-800 dark:text-slate-100">{meta.title}</h1>
        <p className="mt-2 text-slate-600 dark:text-slate-300">{meta.oneLiner}</p>
        <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
          这个知识点的交互动画还在打磨中。它的算法内核和单测已经就位，等交互稿定稿就会上线。
        </p>
        <div className="mt-5">
          <Link to="/map">
            <Btn variant="primary">先去知识地图看看别的</Btn>
          </Link>
        </div>
      </Card>
    </div>
  )
}

/* ============================================================ 主运行器 */

function TopicRunner({ topicId }: { topicId: string }) {
  const meta = TOPIC_BY_ID[topicId]
  const moduleDef = MODULE_BY_ID[meta.moduleId]
  const navigate = useNavigate()
  const announce = useAnnounce()
  const progress = useProgress()
  const { reducedMotion, showFormal, classroom } = useSettings()

  const [topic, setTopic] = useState<Topic | null>(null)
  const [stageIndex, setStageIndex] = useState(0)
  const [hintLevel, setHintLevel] = useState<HintLevel>(0)
  const [dynamicSay, setDynamicSay] = useState<{ text: string; tone: 'normal' | 'reject' | 'accept' } | null>(null)
  const [activityKey, setActivityKey] = useState(0)
  const [feedbackSent, setFeedbackSent] = useState(false)
  const stageRef = useRef<HTMLDivElement>(null)

  const total = STAGE_SEQUENCE.length
  const p = progress.get(topicId, total)

  useEffect(() => {
    let alive = true
    void loadTopic(topicId).then((t) => {
      if (alive) setTopic(t)
    })
    return () => {
      alive = false
    }
  }, [topicId])

  // 进入知识点时记录一次访问（用于「继续上次」与完成率统计）
  // visited ref 保证每个知识点只记一次，因此这里不需要依赖 progress 的引用变化
  const visited = useRef<string | null>(null)
  const recordVisitRef = useRef(progress.recordVisit)
  recordVisitRef.current = progress.recordVisit
  useEffect(() => {
    if (visited.current === topicId) return
    visited.current = topicId
    recordVisitRef.current(topicId, total)
  }, [topicId, total])

  const solvedList = p.solved
  const isSolved = useCallback((i: number) => solvedList.includes(i), [solvedList])
  const stage = topic?.stages[stageIndex]
  const stageSolved = isSolved(stageIndex)
  const requireSolve = stage?.requireSolve !== false
  const canAdvance = !requireSolve || stageSolved
  const allDone = solvedList.length >= total

  /**
   * 用 ref 拿最新的 progress，而不是把它放进 useCallback 的依赖里。
   *
   * 原因：progress 这个 context 对象的引用每次状态更新都会变，
   * 如果直接依赖它，ctx.solve 就会每次渲染都换一个新引用，
   * 而各知识点的 useSolveOnce 是以 solve 为依赖的 —— 结果就是每渲染一次
   * 都白跑一遍 effect。功能上被 fired ref 挡住了，但纯属浪费。
   */
  const progressRef = useRef(progress)
  progressRef.current = progress

  const solve = useCallback(() => {
    progressRef.current.solveStage(topicId, stageIndex, total)
    announce('这一步完成了。')
  }, [announce, stageIndex, topicId, total])

  const say = useCallback((text: string, tone: 'normal' | 'reject' | 'accept' = 'normal') => {
    setDynamicSay({ text, tone })
  }, [])

  // 切换步骤时清空动态旁白与提示层级
  const goToStage = useCallback(
    (i: number) => {
      setStageIndex(Math.min(Math.max(i, 0), total - 1))
      setDynamicSay(null)
      setHintLevel(0)
      setFeedbackSent(false)
    },
    [total],
  )

  const nextStage = useCallback(() => {
    if (stageIndex >= total - 1) return
    goToStage(stageIndex + 1)
  }, [goToStage, stageIndex, total])

  const prevStage = useCallback(() => goToStage(stageIndex - 1), [goToStage, stageIndex])

  // Alt + ←/→ 切换步骤；不用裸方向键，避免和画布内的对象移动抢键
  // F = 全屏：课堂上投屏讲解时最常用的一个动作
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const target = e.target as HTMLElement | null
      const typing = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')
      if (e.key === 'f' || e.key === 'F') {
        if (typing || e.ctrlKey || e.metaKey || e.altKey) return
        e.preventDefault()
        if (document.fullscreenElement) {
          void document.exitFullscreen().catch(() => {})
        } else if (document.documentElement.requestFullscreen) {
          void document.documentElement.requestFullscreen().catch(() => {})
        }
        return
      }
      if (!e.altKey) return
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        nextStage()
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        prevStage()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [nextStage, prevStage])

  // 滚动到舞台顶部：手机端切换步骤后画布应该在视野里
  useEffect(() => {
    stageRef.current?.scrollIntoView({ block: 'nearest', behavior: reducedMotion ? 'auto' : 'smooth' })
  }, [stageIndex, reducedMotion])

  const onChangeHint = useCallback(
    (level: HintLevel) => {
      setHintLevel(level)
      if (level > 0) progress.recordHint(topicId, level as 1 | 2 | 3, total)
      // H3 = 「直接看答案」：我们替你完成这一步，但保留回退重试的自由（铁律 R6）
      if (level === 3) {
        announce('好，我把这一步做完了，你可以随时回退重试。')
        solve()
      }
    },
    [announce, progress, solve, topicId, total],
  )

  const sendFeedback = useCallback(() => {
    progress.recordConfused(topicId, total)
    setFeedbackSent(true)
    announce('已记录，谢谢你告诉我卡在哪里。')
  }, [announce, progress, topicId, total])

  const ctx: StageCtx = useMemo(
    () => ({
      solved: stageSolved,
      hintLevel,
      solve,
      say,
      announce,
      reducedMotion,
    }),
    [announce, hintLevel, reducedMotion, say, solve, stageSolved],
  )

  const stageMeta = STAGE_SEQUENCE[stageIndex]
  const stageDots = useMemo(
    () =>
      STAGE_SEQUENCE.map((s, i) => ({
        key: s.kind,
        label: topic?.stages[i].label ?? s.label,
        short: topic?.stages[i].short ?? s.short,
      })),
    [topic],
  )

  if (!topic) return <TopicSkeleton />

  const nextId = nextTopicId(topicId)
  const prevId = prevTopicId(topicId)

  return (
    <div className="mx-auto w-full max-w-6xl px-3 pb-24 pt-4 sm:px-4">
      {/* ---------------------------------------------------------- 页头 */}
      <header className="mb-3">
        <nav aria-label="面包屑" className="mb-1.5 flex flex-wrap items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
          <Link to="/map" className="hover:text-a-600 hover:underline">
            知识地图
          </Link>
          <span aria-hidden="true">›</span>
          <Link to={`/m/${moduleDef.id}`} className="hover:text-a-600 hover:underline">
            {moduleDef.name}
          </Link>
          <span aria-hidden="true">›</span>
          <span className="text-slate-600 dark:text-slate-300">{topic.title}</span>
        </nav>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h1 className="text-xl font-bold text-slate-900 sm:text-2xl dark:text-slate-50">{topic.title}</h1>
          <Chip tone="a" showGlyph={false}>
            {topic.id}
          </Chip>
          {allDone ? <Chip tone="ok">已通关</Chip> : null}
        </div>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{topic.oneLiner}</p>
      </header>

      <div className="mb-3">
        <StageDots stages={stageDots} index={stageIndex} solved={solvedList} onPick={goToStage} />
      </div>

      {/* ------------------------------------------------------ 主体两栏 */}
      <div className="gap-5 lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <main className="min-w-0">
          <Card className="p-3 sm:p-4">
            <div className="mb-2 flex items-baseline justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">
                  {topic.stages[stageIndex].label ?? stageMeta.label}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">{stageMeta.goal}</p>
              </div>
              <span className="shrink-0 font-mono text-xs text-slate-400">
                {stageIndex + 1}/{total}
              </span>
            </div>

            {/* 舞台：捕获所有指针/键盘活动，用于「停滞 15 秒自动浮现 H1」 */}
            <div
              ref={stageRef}
              onPointerDownCapture={() => setActivityKey((k) => k + 1)}
              onKeyDownCapture={() => setActivityKey((k) => k + 1)}
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={stageIndex}
                  initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
                  transition={{ duration: reducedMotion ? 0.01 : 0.22, ease: [0.4, 0, 0.2, 1] }}
                >
                  {topic.stages[stageIndex].render(ctx)}
                </motion.div>
              </AnimatePresence>
            </div>

            <div className="mt-3">
              <NarratorBar tone={dynamicSay?.tone ?? 'normal'}>
                {dynamicSay?.text ?? topic.stages[stageIndex].narration}
              </NarratorBar>
            </div>

            {/* 步骤控制 */}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Btn variant="outline" onClick={prevStage} disabled={stageIndex === 0}>
                ← 上一步
              </Btn>
              {stageIndex < total - 1 ? (
                <Btn variant="primary" onClick={nextStage} disabled={!canAdvance} aria-describedby="gate-hint">
                  下一步 →
                </Btn>
              ) : (
                <Btn variant="primary" onClick={() => navigate('/map')}>
                  去知识地图
                </Btn>
              )}
              {!canAdvance ? (
                <p id="gate-hint" className="text-xs text-cur-700 dark:text-cur-500">
                  先在上面动手试一下 —— 自己试出来的才记得住。
                </p>
              ) : null}
            </div>
          </Card>

          {/* 提示脚手架 */}
          <div className="mt-3">
            <HintLadder
              hints={topic.stages[stageIndex].hints}
              level={hintLevel}
              onLevelChange={onChangeHint}
              activityKey={activityKey}
              solved={stageSolved}
            />
          </div>

          {/* 通关庆祝 */}
          <AnimatePresence>
            {allDone ? (
              <motion.div
                initial={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                className="mt-4"
              >
                <Callout tone="ok" title="这个知识点你已经走完了 🎉">
                  <p>
                    回想一下：{topic.bigIdea}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Btn size="sm" variant="ghost" onClick={() => progress.resetTopic(topicId)}>
                      再走一遍
                    </Btn>
                    <Btn
                      size="sm"
                      variant="outline"
                      onClick={() => progress.toggleMastered(topicId)}
                    >
                      {progress.state.mastered.includes(topicId) ? '取消「已掌握」' : '标记为已掌握'}
                    </Btn>
                  </div>
                </Callout>
              </motion.div>
            ) : null}
          </AnimatePresence>

          {/* 「这一步没看懂？」—— 全站最重要的按钮 */}
          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-dashed border-slate-300 px-3 py-3 dark:border-slate-700">
            <Btn size="sm" variant="outline" onClick={sendFeedback} disabled={feedbackSent}>
              {feedbackSent ? '已记录 ✓' : '这一步没看懂？'}
            </Btn>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {feedbackSent
                ? `已记录「卡在${topic.stages[stageIndex].label ?? stageMeta.label}」。这类反馈会直接决定我们重写哪一步。`
                : '点一下就会记下你卡在哪一步，我们会优先重做最容易卡住的地方。'}
            </p>
          </div>

          {/* 上一个 / 下一个 */}
          <nav className="mt-4 flex items-center justify-between gap-3" aria-label="相邻知识点">
            {prevId ? (
              <Link to={`/learn/${prevId}`} className="min-w-0">
                <Btn variant="ghost" size="sm">
                  ← {TOPIC_BY_ID[prevId].title}
                </Btn>
              </Link>
            ) : (
              <span />
            )}
            {nextId ? (
              <Link to={`/learn/${nextId}`} className="min-w-0">
                <Btn variant="ghost" size="sm">
                  {TOPIC_BY_ID[nextId].title} →
                </Btn>
              </Link>
            ) : (
              <span />
            )}
          </nav>
        </main>

        {/* ------------------------------------------------------ 侧栏 */}
        {/* 课堂模式下收起来：投屏讲解时，次要信息会把主舞台挤小 */}
        <aside className={cx('mt-5 flex flex-col gap-3 lg:mt-0', classroom && 'hidden')}>
          <Card>
            <SectionTitle>一句话本质</SectionTitle>
            <PlainSpeak sticker={BIG_IDEA_STICKERS[topic.id]}>{topic.bigIdea}</PlainSpeak>
          </Card>

          <Card>
            <SectionTitle>学完你能做到</SectionTitle>
            <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-200">{topic.outcome}</p>
          </Card>

          <FormalDefinition defaultOpen={showFormal}>
            <div className="space-y-2 text-slate-700 dark:text-slate-200">{topic.formalDefinition}</div>
          </FormalDefinition>

          {topic.misconceptions.length > 0 ? (
            <Card>
              <SectionTitle hint="提前知道，少走弯路">容易想错的地方</SectionTitle>
              <ul className="flex flex-col gap-2.5">
                {topic.misconceptions.map((m) => (
                  <li key={m.wrong} className="text-sm">
                    <div className="flex gap-2 rounded-lg bg-bad-50 px-2.5 py-1.5 text-bad-700 dark:bg-bad-500/10 dark:text-bad-500">
                      <span aria-hidden="true">✗</span>
                      <span className="line-through decoration-bad-500/60">{m.wrong}</span>
                    </div>
                    <div className="mt-1 flex gap-2 px-2.5 text-slate-700 dark:text-slate-200">
                      <span aria-hidden="true" className="text-ok-600">
                        ✓
                      </span>
                      <span>{m.right}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          {topic.glossary.length > 0 ? (
            <Card>
              <SectionTitle hint="大白话 + 正式说法">本页术语</SectionTitle>
              <dl className="flex flex-col gap-2.5">
                {topic.glossary.map((g) => (
                  <div key={g.term}>
                    <dt className="text-sm font-semibold text-slate-800 dark:text-slate-100">{g.term}</dt>
                    <dd className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">{g.plain}</dd>
                    {g.formal ? (
                      <dd className={cx('mt-0.5 font-mono text-xs text-slate-500 dark:text-slate-400')}>{g.formal}</dd>
                    ) : null}
                  </div>
                ))}
              </dl>
            </Card>
          ) : null}

          {topic.prerequisites.length > 0 ? (
            <Card>
              <SectionTitle>如果这里看不懂</SectionTitle>
              <p className="mb-2 text-sm text-slate-600 dark:text-slate-300">
                可能是前置知识还没走通，建议先花几分钟回顾：
              </p>
              <div className="flex flex-wrap gap-2">
                {topic.prerequisites.map((id) => (
                  <Link key={id} to={`/learn/${id}`}>
                    <Chip tone="a">{TOPIC_BY_ID[id]?.title ?? id}</Chip>
                  </Link>
                ))}
              </div>
            </Card>
          ) : null}
        </aside>
      </div>
    </div>
  )
}

function TopicSkeleton() {
  return (
    <div className="mx-auto w-full max-w-6xl px-3 py-4 sm:px-4">
      <div className="mb-3 h-6 w-40 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
      <Card>
        <div className="flex flex-col gap-3">
          <div className="h-4 w-32 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
          <div className="h-56 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800/60" />
          <div className="h-14 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800/60" />
        </div>
      </Card>
    </div>
  )
}
