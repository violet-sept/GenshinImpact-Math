/**
 * 集合内核：集合运算、子集判定、幂集、笛卡尔积。
 * 元素统一用字符串表示（在同一页面内元素标签唯一），保证内核无泛型噪声、易测试。
 */

export type SetOp = 'union' | 'intersect' | 'difference' | 'symdiff'

export const uniq = (xs: string[]): string[] => [...new Set(xs)]

export const union = (a: readonly string[], b: readonly string[]): string[] => uniq([...a, ...b])

export const intersect = (a: readonly string[], b: readonly string[]): string[] => {
  const s = new Set(b)
  return a.filter((x) => s.has(x))
}

export const difference = (a: readonly string[], b: readonly string[]): string[] => {
  const s = new Set(b)
  return a.filter((x) => !s.has(x))
}

export const symdiff = (a: readonly string[], b: readonly string[]): string[] =>
  union(difference(a, b), difference(b, a))

/** 相对全集求补集 */
export const complement = (a: readonly string[], universe: readonly string[]): string[] => {
  const s = new Set(a)
  return universe.filter((x) => !s.has(x))
}

export const isSubset = (a: readonly string[], b: readonly string[]): boolean => {
  const s = new Set(b)
  return a.every((x) => s.has(x))
}

export const isProperSubset = (a: readonly string[], b: readonly string[]): boolean =>
  isSubset(a, b) && a.length < b.length

export const equals = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && isSubset(a, b)

export function applyOp(
  op: SetOp,
  a: readonly string[],
  b: readonly string[],
  universe: readonly string[] = [],
): string[] {
  switch (op) {
    case 'union':
      return union(a, b)
    case 'intersect':
      return intersect(a, b)
    case 'difference':
      return difference(a, b)
    case 'symdiff':
      return symdiff(a, b)
    /* c8 ignore next */
    default:
      return complement(a, universe)
  }
}

export interface OpMeta {
  key: SetOp
  label: string
  symbol: string
  /** 大白话解释（铁律 R4：新术语必须配一句人话） */
  plain: string
  /** 正式定义（默认折叠，用户主动展开才显示） */
  formal: string
}

export const SET_OPS: OpMeta[] = [
  {
    key: 'union',
    label: '并集',
    symbol: 'A ∪ B',
    plain: '把 A 和 B 里的东西全部倒在一起。重复的只算一份。',
    formal: 'A ∪ B = { x | x ∈ A ∨ x ∈ B }',
  },
  {
    key: 'intersect',
    label: '交集',
    symbol: 'A ∩ B',
    plain: '只留下同时在 A 和 B 里的东西 —— 两边都有的才要。',
    formal: 'A ∩ B = { x | x ∈ A ∧ x ∈ B }',
  },
  {
    key: 'difference',
    label: '差集',
    symbol: 'A − B',
    plain: '从 A 里挑，把 B 里出现过的东西拿走，剩下的就是差集。',
    formal: 'A − B = { x | x ∈ A ∧ x ∉ B }',
  },
  {
    key: 'symdiff',
    label: '对称差',
    symbol: 'A ⊕ B',
    plain: '只在一个集合里出现的东西。两边都有的反而不要。',
    formal: 'A ⊕ B = (A − B) ∪ (B − A)',
  },
]

/** 所有子集（幂集），按元素个数再按字典序排列，便于动画逐层展开 */
export function powerSet(elements: readonly string[]): string[][] {
  const out: string[][] = []
  const n = elements.length
  for (let mask = 0; mask < 1 << n; mask++) {
    const subset: string[] = []
    for (let i = 0; i < n; i++) if ((mask >> i) & 1) subset.push(elements[i])
    out.push(subset)
  }
  return out.sort((a, b) => a.length - b.length || a.join(',').localeCompare(b.join(',')))
}

export function cartesian(a: readonly string[], b: readonly string[]): [string, string][] {
  const out: [string, string][] = []
  for (const x of a) for (const y of b) out.push([x, y])
  return out
}

/** 集合的字符串表示，如 { 1, 2, 3 }；空集显示为 ∅ */
export const setToString = (a: readonly string[]): string =>
  a.length === 0 ? '∅' : `{ ${[...a].join(', ')} }`

/** 两个集合的关系判定结果，供 S1 的实时反馈使用 */
export interface SubsetVerdict {
  kind: 'equal' | 'properSubset' | 'properSuperset' | 'overlap' | 'disjoint'
  plain: string
}

export function subsetVerdict(a: readonly string[], b: readonly string[]): SubsetVerdict {
  if (equals(a, b)) {
    return { kind: 'equal', plain: '两个集合装的东西一模一样。' }
  }
  if (isProperSubset(a, b)) {
    return { kind: 'properSubset', plain: 'A 里的东西 B 全有，而且 B 还有多余的 —— 所以 A 是 B 的真子集。' }
  }
  if (isProperSubset(b, a)) {
    return { kind: 'properSuperset', plain: 'B 里的东西 A 全有，而且 A 还有多余的 —— 所以 B 是 A 的真子集。' }
  }
  if (intersect(a, b).length === 0) {
    return { kind: 'disjoint', plain: '两边没有任何共同元素，它们不相交。' }
  }
  return { kind: 'overlap', plain: '两边有交集，但谁也装不下谁 —— 互不包含。' }
}
