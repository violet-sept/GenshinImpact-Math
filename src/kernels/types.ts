/**
 * 算法内核层共享类型。
 *
 * 规划书 §7.4 的核心约定：算法**返回完整的步骤序列**，而不是回调式执行。
 * 这样「暂停 / 回退 / 跳到第 k 步 / 时间旅行」全部免费 —— 这正是
 * 交互式动画相对一段视频的全部价值所在。
 */
export interface Step<S> {
  /** 执行完这一步之后的完整状态快照 */
  snapshot: S
  /** 一句大白话，说明这一步发生了什么（写作规范见规划书附录 C） */
  explanation: string
  /** 本步需要高亮的对象 id（同一时刻只允许一处焦点，见铁律 R2） */
  highlight: string[]
  /** 短标签，用于步骤列表 / 进度条气泡 */
  label?: string
  /** 错误 / 冲突类的步骤（用橙色而非纯红表达） */
  tone?: 'normal' | 'reject' | 'accept'
}

/** 深拷贝一个可 JSON 序列化的快照（保证历史步骤不被后续修改污染） */
export function clone<T>(value: T): T {
  return structuredClone(value)
}
