import type { ReactNode } from 'react'

/** 五步法的阶段类型（规划书 §5.1） */
export type StageKind = 'hook' | 'explore' | 'name' | 'practice' | 'transfer'

export interface StageMeta {
  kind: StageKind
  label: string
  short: string
  goal: string
}

/** 固定 5 步：所有知识点共用同一套骨架，用户有稳定预期、开发可复用 */
export const STAGE_SEQUENCE: StageMeta[] = [
  { kind: 'hook', label: '① 看一看', short: '看', goal: '先看现象，一个字公式都没有' },
  { kind: 'explore', label: '② 玩一玩', short: '玩', goal: '自己动手，把规律试出来' },
  { kind: 'name', label: '③ 起个名', short: '名', goal: '给刚发现的东西一个正式名字' },
  { kind: 'practice', label: '④ 练一练', short: '练', goal: '在即时反馈里把它固化下来' },
  { kind: 'transfer', label: '⑤ 换个场景', short: '变', goal: '换个情境，验证是不是真懂' },
]

export interface StageCtx {
  /** 本步是否已通关 */
  solved: boolean
  /** 当前提示层级 0–3 */
  hintLevel: 0 | 1 | 2 | 3
  /** 调用即标记本步完成。「不操作不能推进」由这一步驱动（铁律 R5） */
  solve: () => void
  /** 覆盖旁白条上的文字（交互型步骤需要动态讲解） */
  say: (text: string, tone?: 'normal' | 'reject' | 'accept') => void
  /** 屏幕阅读器播报 */
  announce: (text: string) => void
  /** 当前是否「关闭动画」（降级为静态高亮） */
  reducedMotion: boolean
}

export interface StageSpec {
  /** 覆盖默认的步骤名，例如把「② 玩一玩」改成「② 亲手搭一个关系」 */
  label?: string
  short?: string
  /** 静态旁白（人话）。交互型步骤可在 render 里用 ctx.say 动态覆盖 */
  narration: string
  /**
   * 是否强制交互才能推进（铁律 R5）。
   * 默认 true —— 只有「钩子」这种纯展示步骤才允许设为 false。
   */
  requireSolve?: boolean
  /** [H1 方向提示, H2 局部演示, H3 完整答案] */
  hints: [string, string, string]
  render: (ctx: StageCtx) => ReactNode
}

export interface GlossaryEntry {
  term: string
  /** 大白话解释 */
  plain: string
  /** 正式定义（可选） */
  formal?: string
}

export interface Misconception {
  /** 常见的错误想法 */
  wrong: string
  /** 为什么错 / 正确理解 */
  right: string
}

export interface Topic {
  id: string
  title: string
  moduleId: string
  /** 一句话说清这个知识点在讲什么 */
  oneLiner: string
  /** 学完之后你能做到什么 */
  outcome: string
  prerequisites: string[]
  /** 一句话本质 */
  bigIdea: string
  /** 典型误解（规划书 DoD 要求 ≥2 条，并配反例） */
  misconceptions: Misconception[]
  formalDefinition: ReactNode
  glossary: GlossaryEntry[]
  stages: [StageSpec, StageSpec, StageSpec, StageSpec, StageSpec]
}
