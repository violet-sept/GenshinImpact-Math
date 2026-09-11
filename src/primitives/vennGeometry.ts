/**
 * 集合画布的几何工具（纯函数，可单测）。
 *
 * 核心教学决策：**成员关系由几何位置决定** —— 把小球拖进圈里，它就是那个集合的元素。
 * 这比「勾选一个复选框表示属于 A」直观一个数量级，因为它把抽象的 ∈ 变成了手上的动作。
 */
import type { Pt } from '@/kernels/layout'

export interface VennCircle {
  id: string
  label: string
  cx: number
  cy: number
  r: number
  /** 视觉语义色：A 蓝、B 紫、C 琥珀 */
  tone: 'a' | 'b' | 'c'
}

/** 两圆配置：左右并排，交叠出 4 个区域 */
export function twoCircles(): [VennCircle, VennCircle] {
  return [
    { id: 'A', label: 'A', cx: 128, cy: 120, r: 84, tone: 'a' },
    { id: 'B', label: 'B', cx: 212, cy: 120, r: 84, tone: 'b' },
  ]
}

/** 三圆配置：倒三角排列，交叠出 8 个区域 */
export function threeCircles(): [VennCircle, VennCircle, VennCircle] {
  return [
    { id: 'A', label: 'A', cx: 120, cy: 96, r: 74, tone: 'a' },
    { id: 'B', label: 'B', cx: 200, cy: 96, r: 74, tone: 'b' },
    { id: 'C', label: 'C', cx: 160, cy: 166, r: 74, tone: 'c' },
  ]
}

export const inCircle = (c: VennCircle, p: Pt): boolean => Math.hypot(p.x - c.cx, p.y - c.cy) <= c.r

/** 一个点落在哪些圆里 —— 这就是这个元素的「成员身份」 */
export function memberships(circles: VennCircle[], p: Pt): string[] {
  return circles.filter((c) => inCircle(c, p)).map((c) => c.id)
}

/** 成员身份的规范化 key，例如 ""、"A"、"AB"、"ABC" */
export function maskOf(circles: VennCircle[], p: Pt): string {
  return memberships(circles, p).join('')
}

/**
 * 每个区域的锚点。
 *
 * 刻意用预设坐标表而不是「算质心」：质心算法在交集区域会算到圆外去，
 * 而这里的位置是给人看的，必须**肉眼一看就知道这是哪个区域**。
 */
const ANCHORS: Record<string, Pt> = {
  // 两圆
  '': { x: 170, y: 232 },
  A: { x: 92, y: 120 },
  B: { x: 248, y: 120 },
  AB: { x: 170, y: 120 },
  // 三圆
  '2:': { x: 292, y: 240 },
  '2:A': { x: 74, y: 62 },
  '2:B': { x: 246, y: 62 },
  '2:C': { x: 160, y: 214 },
  '2:AB': { x: 160, y: 66 },
  '2:AC': { x: 102, y: 152 },
  '2:BC': { x: 218, y: 152 },
  '2:ABC': { x: 160, y: 122 },
}

export function regionCenter(circles: VennCircle[], mask: string): Pt {
  const key = circles.length >= 3 ? `2:${mask}` : mask
  const direct = ANCHORS[key]
  if (direct) return direct
  const picked = circles.filter((c) => mask.includes(c.id))
  if (picked.length === 0) return { x: 170, y: 232 }
  return {
    x: picked.reduce((s, c) => s + c.cx, 0) / picked.length,
    y: picked.reduce((s, c) => s + c.cy, 0) / picked.length,
  }
}

/**
 * 同一个区域里有多个元素时的排布：绕锚点做环形散开。
 * 保证：(1) 不重叠；(2) 顺序稳定（同一状态每次渲染位置一致）。
 */
export function spreadAround(center: Pt, index: number, count: number, radius = 30): Pt {
  if (count <= 1) return { ...center }
  const angle = (index / count) * Math.PI * 2 - Math.PI / 2
  const ring = count <= 6 ? radius : radius * 1.35
  return {
    x: Math.round(center.x + ring * Math.cos(angle)),
    y: Math.round(center.y + ring * Math.sin(angle)),
  }
}

/** 画布尺寸随圆的配置自适应 */
export function canvasSize(circles: VennCircle[]): { width: number; height: number } {
  const maxX = Math.max(...circles.map((c) => c.cx + c.r))
  const maxY = Math.max(...circles.map((c) => c.cy + c.r))
  return { width: Math.max(Math.round(maxX + 30), 340), height: Math.max(Math.round(maxY + 34), 260) }
}
