import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

/** 单个知识点的学习进度 */
export interface TopicProgress {
  /** 已通关的步骤下标集合 */
  solved: number[]
  /** 该知识点的总步骤数（用于算完成度，内容改版后自动对齐） */
  total: number
  completed: boolean
  /** 三级提示的使用次数 —— 规划书 §14.1 的核心难度指标 */
  hints: { h1: number; h2: number; h3: number }
  /** 点过多少次「这一步没看懂」 */
  confused: number
  lastVisit: number
  visits: number
}

export interface ProgressState {
  version: 1
  topics: Record<string, TopicProgress>
  /** 用户主动标记「已掌握」的知识点 */
  mastered: string[]
}

const STORAGE_KEY = 'dl.progress.v1'

const EMPTY: ProgressState = { version: 1, topics: {}, mastered: [] }

export const emptyTopicProgress = (total: number): TopicProgress => ({
  solved: [],
  total,
  completed: false,
  hints: { h1: 0, h2: 0, h3: 0 },
  confused: 0,
  lastVisit: 0,
  visits: 0,
})

interface ProgressCtx {
  state: ProgressState
  get: (topicId: string, total?: number) => TopicProgress
  solveStage: (topicId: string, stageIndex: number, total: number) => void
  unsolveStage: (topicId: string, stageIndex: number, total: number) => void
  recordHint: (topicId: string, level: 1 | 2 | 3, total: number) => void
  recordConfused: (topicId: string, total: number) => void
  recordVisit: (topicId: string, total: number) => void
  toggleMastered: (topicId: string) => void
  resetTopic: (topicId: string) => void
  resetAll: () => void
  /** 全局完成度，用于首页与知识地图 */
  summary: { completed: number; started: number }
}

const Ctx = createContext<ProgressCtx | null>(null)

function read(): ProgressState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return EMPTY
    const parsed = JSON.parse(raw) as ProgressState
    return { ...EMPTY, ...parsed, topics: parsed.topics ?? {} }
  } catch {
    return EMPTY
  }
}

export function ProgressProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ProgressState>(() => read())

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      /* 存不下就算了，不该打断学习 */
    }
  }, [state])

  /** 收口所有写入：先补齐默认结构，避免内容改版后读到残缺对象 */
  const mutate = useCallback(
    (topicId: string, total: number, fn: (p: TopicProgress) => TopicProgress) => {
      setState((s) => {
        const current = s.topics[topicId] ?? emptyTopicProgress(total)
        const merged: TopicProgress = { ...emptyTopicProgress(total), ...current, total }
        const next = fn(merged)
        next.completed = next.total > 0 && next.solved.length >= next.total
        return { ...s, topics: { ...s.topics, [topicId]: next } }
      })
    },
    [],
  )

  const value = useMemo<ProgressCtx>(() => {
    const get = (topicId: string, total = 0): TopicProgress => {
      const p = state.topics[topicId]
      if (!p) return emptyTopicProgress(total)
      return { ...emptyTopicProgress(total), ...p, total: total || p.total }
    }
    return {
      state,
      get,
      solveStage: (topicId, stageIndex, total) =>
        mutate(topicId, total, (p) => ({
          ...p,
          solved: p.solved.includes(stageIndex) ? p.solved : [...p.solved, stageIndex].sort((a, b) => a - b),
        })),
      unsolveStage: (topicId, stageIndex, total) =>
        mutate(topicId, total, (p) => ({ ...p, solved: p.solved.filter((i) => i !== stageIndex) })),
      recordHint: (topicId, level, total) =>
        mutate(topicId, total, (p) => ({
          ...p,
          hints: { ...p.hints, [`h${level}`]: p.hints[`h${level}` as 'h1' | 'h2' | 'h3'] + 1 },
        })),
      recordConfused: (topicId, total) => mutate(topicId, total, (p) => ({ ...p, confused: p.confused + 1 })),
      recordVisit: (topicId, total) =>
        mutate(topicId, total, (p) => ({ ...p, visits: p.visits + 1, lastVisit: Date.now() })),
      toggleMastered: (topicId) =>
        setState((s) => ({
          ...s,
          mastered: s.mastered.includes(topicId) ? s.mastered.filter((x) => x !== topicId) : [...s.mastered, topicId],
        })),
      resetTopic: (topicId) =>
        setState((s) => {
          const topics = { ...s.topics }
          delete topics[topicId]
          return { ...s, topics, mastered: s.mastered.filter((x) => x !== topicId) }
        }),
      resetAll: () => setState(EMPTY),
      summary: {
        completed: Object.values(state.topics).filter((t) => t.completed).length,
        started: Object.values(state.topics).filter((t) => t.solved.length > 0 || t.visits > 0).length,
      },
    }
  }, [state, mutate])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useProgress(): ProgressCtx {
  const v = useContext(Ctx)
  if (!v) throw new Error('useProgress 必须在 <ProgressProvider> 内使用')
  return v
}
