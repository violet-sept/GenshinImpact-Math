import { useCallback, useState, type RefObject } from 'react'
import type { Pt } from '@/kernels/layout'

/** 把浏览器视口坐标换算成 SVG 的 viewBox 坐标（响应式缩放下仍然准确） */
export function toSvgPoint(svg: SVGSVGElement, clientX: number, clientY: number): Pt {
  const rect = svg.getBoundingClientRect()
  const vb = svg.viewBox.baseVal
  const scaleX = vb.width / (rect.width || 1)
  const scaleY = vb.height / (rect.height || 1)
  return {
    x: vb.x + (clientX - rect.left) * scaleX,
    y: vb.y + (clientY - rect.top) * scaleY,
  }
}

export interface SvgDragOptions {
  svgRef: RefObject<SVGSVGElement | null>
  /** 拖到新位置时回调（语义事件 MOVE，与输入设备无关） */
  onMove: (id: string, pt: Pt) => void
  /** 键盘微调时需要知道当前位置 */
  getPoint: (id: string) => Pt
  /** 键盘单次移动步长（viewBox 单位） */
  step?: number
  /** 拖动结束（用于埋点 / 提交判定） */
  onDrop?: (id: string) => void
}

/**
 * 用 Pointer Events 统一触摸 / 鼠标拖拽，并**同时提供键盘等价操作**。
 *
 * 规划书 §6.3 要求「每个知识点必须能用纯键盘完成全部交互流程」，
 * 所以键盘方向键微调不是可选项，而是这个 hook 的内建能力：
 * 聚焦后按方向键移动（Shift 加速），与拖动走同一条 onMove 通路。
 */
export function useSvgDrag<S extends SVGElement>({ svgRef, onMove, getPoint, step = 5, onDrop }: SvgDragOptions) {
  const [dragging, setDragging] = useState<string | null>(null)

  const bind = useCallback(
    (id: string) => ({
      onPointerDown: (e: React.PointerEvent<S>) => {
        e.stopPropagation()
        try {
          e.currentTarget.setPointerCapture(e.pointerId)
        } catch {
          /* 某些浏览器在合成事件下会拒绝捕获，退化为普通拖动即可 */
        }
        setDragging(id)
      },
      onPointerMove: (e: React.PointerEvent<S>) => {
        if (dragging !== id) return
        const svg = svgRef.current
        if (!svg) return
        e.preventDefault()
        onMove(id, toSvgPoint(svg, e.clientX, e.clientY))
      },
      onPointerUp: (e: React.PointerEvent<S>) => {
        if (dragging !== id) return
        try {
          e.currentTarget.releasePointerCapture(e.pointerId)
        } catch {
          /* 同上 */
        }
        setDragging(null)
        onDrop?.(id)
      },
      onPointerCancel: () => setDragging(null),
      onKeyDown: (e: React.KeyboardEvent<S>) => {
        const delta: Record<string, [number, number]> = {
          ArrowLeft: [-1, 0],
          ArrowRight: [1, 0],
          ArrowUp: [0, -1],
          ArrowDown: [0, 1],
        }
        const d = delta[e.key]
        if (!d) return
        e.preventDefault()
        const s = step * (e.shiftKey ? 4 : 1)
        const p = getPoint(id)
        onMove(id, { x: p.x + d[0] * s, y: p.y + d[1] * s })
      },
    }),
    [dragging, onMove, getPoint, step, svgRef, onDrop],
  )

  return { dragging, bind }
}
