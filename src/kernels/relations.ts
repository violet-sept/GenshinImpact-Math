/**
 * 关系内核：二元关系的三视图（有序对 / 矩阵 / 有向图）与性质判定。
 *
 * 性质判定必须同时给出**反例证人**（witness）—— 这是 R2 知识点的教学核心：
 * 只说「传递性不成立」等于没说，必须指出「(a,b) 和 (b,c) 都在，但 (a,c) 不在」。
 */
import type { Step } from './types'
import { clone } from './types'

export interface Relation {
  domain: string[]
  /** 有序对集合；用 [a, b] 表示 a R b */
  pairs: [string, string][]
}

export const pairKey = (a: string, b: string): string => `${a}\u0000${b}`

export function hasPair(r: Relation, a: string, b: string): boolean {
  return r.pairs.some(([x, y]) => x === a && y === b)
}

export function addPair(r: Relation, a: string, b: string): Relation {
  return hasPair(r, a, b) ? r : { ...r, pairs: [...r.pairs, [a, b]] }
}

export function removePair(r: Relation, a: string, b: string): Relation {
  return { ...r, pairs: r.pairs.filter(([x, y]) => !(x === a && y === b)) }
}

export function togglePair(r: Relation, a: string, b: string): Relation {
  return hasPair(r, a, b) ? removePair(r, a, b) : addPair(r, a, b)
}

export function toMatrix(r: Relation): boolean[][] {
  return r.domain.map((a) => r.domain.map((b) => hasPair(r, a, b)))
}

export function fromMatrix(domain: string[], m: boolean[][]): Relation {
  const pairs: [string, string][] = []
  domain.forEach((a, i) =>
    domain.forEach((b, j) => {
      if (m[i]?.[j]) pairs.push([a, b])
    }),
  )
  return { domain, pairs }
}

/** 有序对集合的字符串表示，如 { (1,1), (1,2) }；空关系显示为 ∅ */
export function relationToString(r: Relation): string {
  if (r.pairs.length === 0) return '∅'
  return `{ ${r.pairs.map(([a, b]) => `(${a},${b})`).join(', ')} }`
}

/* ------------------------------------------------------------- 性质判定 */

export type PropertyKey = 'reflexive' | 'irreflexive' | 'symmetric' | 'antisymmetric' | 'transitive'

export interface PropertyCheck {
  key: PropertyKey
  label: string
  plain: string
  ok: boolean
  /** 反例证人：反射 [a]；对称 [a,b]；传递 [a,b,c] */
  witness: string[] | null
  /** 为什么不合格（人话） */
  reason: string
}

export function isReflexive(r: Relation): boolean {
  return r.domain.every((a) => hasPair(r, a, a))
}

export function isIrreflexive(r: Relation): boolean {
  return r.domain.every((a) => !hasPair(r, a, a))
}

export function isSymmetric(r: Relation): boolean {
  return r.pairs.every(([a, b]) => hasPair(r, b, a))
}

export function isAntisymmetric(r: Relation): boolean {
  return r.pairs.every(([a, b]) => a === b || !hasPair(r, b, a))
}

export function isTransitive(r: Relation): boolean {
  return r.pairs.every(([a, b]) => r.pairs.every(([c, d]) => !(b === c) || hasPair(r, a, d)))
}

export function checkProperties(r: Relation): PropertyCheck[] {
  const out: PropertyCheck[] = []

  const missingSelf = r.domain.find((a) => !hasPair(r, a, a))
  out.push({
    key: 'reflexive',
    label: '自反性',
    plain: '每个东西都必须和自己有关系。',
    ok: !missingSelf,
    witness: missingSelf ? [missingSelf] : null,
    reason: missingSelf ? `缺少 (${missingSelf}, ${missingSelf})，所以不是自反的。` : '每个元素都和自己配了对。',
  })

  const selfPair = r.pairs.find(([a, b]) => a === b)
  out.push({
    key: 'irreflexive',
    label: '反自反性',
    plain: '每个东西都不能和自己有关系。',
    ok: !selfPair,
    witness: selfPair ?? null,
    reason: selfPair ? `出现了 (${selfPair[0]}, ${selfPair[1]})，所以不是反自反的。` : '没有任何元素和自己配对。',
  })

  const asymWitness = r.pairs.find(([a, b]) => !hasPair(r, b, a))
  out.push({
    key: 'symmetric',
    label: '对称性',
    plain: '有来就得有往 —— 只要有 a→b，就必须有 b→a。',
    ok: !asymWitness,
    witness: asymWitness ?? null,
    reason: asymWitness
      ? `有 (${asymWitness[0]}, ${asymWitness[1]})，却没有 (${asymWitness[1]}, ${asymWitness[0]})，所以不对称。`
      : '每条边都有反向边陪着。',
  })

  const antiWitness = r.pairs.find(([a, b]) => a !== b && hasPair(r, b, a))
  out.push({
    key: 'antisymmetric',
    label: '反对称性',
    plain: '两个不同的东西之间，最多只能有一个方向的关系。',
    ok: !antiWitness,
    witness: antiWitness ?? null,
    reason: antiWitness
      ? `(${antiWitness[0]}, ${antiWitness[1]}) 和 (${antiWitness[1]}, ${antiWitness[0]}) 同时存在，所以不是反对称的。`
      : '没有任何一对不同元素互相指来指去。',
  })

  let tri: string[] | null = null
  outer: for (const [a, b] of r.pairs) {
    for (const [c, d] of r.pairs) {
      if (b === c && !hasPair(r, a, d)) {
        tri = [a, b, d]
        break outer
      }
    }
  }
  out.push({
    key: 'transitive',
    label: '传递性',
    plain: '能连起来的就必须能直达 —— 有 a→b 和 b→c，就必须有 a→c。',
    ok: !tri,
    witness: tri,
    reason: tri
      ? `有 (${tri[0]}, ${tri[1]}) 和 (${tri[1]}, ${tri[2]})，却缺了 (${tri[0]}, ${tri[2]})，所以不传递。`
      : '所有能接上的关系都已经补全了。',
  })

  return out
}

export function isEquivalence(r: Relation): boolean {
  return isReflexive(r) && isSymmetric(r) && isTransitive(r)
}

export function isPartialOrder(r: Relation): boolean {
  return isReflexive(r) && isAntisymmetric(r) && isTransitive(r)
}

/* --------------------------------------------------------------- 闭包 */

/** 自反闭包：把缺的 (a,a) 全补上 */
export function reflexiveClosure(r: Relation): Relation {
  return { ...r, pairs: [...r.pairs, ...r.domain.filter((a) => !hasPair(r, a, a)).map((a): [string, string] => [a, a])] }
}

/** 对称闭包：每条边都补反向边 */
export function symmetricClosure(r: Relation): Relation {
  let out = r
  for (const [a, b] of r.pairs) out = addPair(out, b, a)
  return out
}

/**
 * 传递闭包的**逐步补边**过程。
 *
 * 刻意不用 Warshall 的矩阵压缩写法：那种写法虽然快，但动画上无法解释
 * 「为什么现在补这一条」。这里按「发现 a→b→c 就补 a→c」逐条补，
 * 每一步都能讲清楚，符合铁律 R2（一步一屏一件事）。
 */
export function transitiveClosureSteps(r: Relation): Step<Relation>[] {
  const steps: Step<Relation>[] = [
    {
      snapshot: clone(r),
      explanation: '先看原始关系。接下来凡是能「转两趟到」的地方，都得补一条直达的线。',
      highlight: [],
      label: '起点',
    },
  ]
  let current = clone(r)
  let guard = 0
  const limit = r.domain.length * r.domain.length * r.domain.length + 8

  for (;;) {
    if (++guard > limit) break
    let added: [string, string] | null = null
    outer: for (const [a, b] of current.pairs) {
      for (const [c, d] of current.pairs) {
        if (b === c && !hasPair(current, a, d)) {
          added = [a, d]
          break outer
        }
      }
    }
    if (!added) break
    const [a, d] = added
    const mid = current.pairs.find(([x, y]) => x === a && hasPair(current, y, d))?.[1] ?? ''
    current = addPair(current, a, d)
    steps.push({
      snapshot: clone(current),
      explanation: `有 ${a}→${mid}，又有 ${mid}→${d}，所以必须补上 ${a}→${d}。`,
      highlight: [pairKey(a, d), pairKey(a, mid), pairKey(mid, d)],
      label: `补 (${a},${d})`,
    })
  }

  steps.push({
    snapshot: clone(current),
    explanation: '再也找不出需要补的线了 —— 现在这个关系就是传递闭包。',
    highlight: [],
    label: '完成',
    tone: 'accept',
  })
  return steps
}

/** 等价类（按 a R b 归组），只在关系确实是等价关系时有意义 */
export function equivalenceClasses(r: Relation): string[][] {
  const used = new Set<string>()
  const out: string[][] = []
  for (const a of r.domain) {
    if (used.has(a)) continue
    const cls = r.domain.filter((b) => hasPair(r, a, b))
    cls.forEach((x) => used.add(x))
    out.push(cls)
  }
  return out
}
