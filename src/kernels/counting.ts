/**
 * 组合计数内核：排列、组合、四种计数模型、汉诺塔、杨辉三角。
 */

/** 阶乘（n ≤ 170 以内不会溢出到 Infinity，教学场景足够） */
export function factorial(n: number): number {
  if (n < 0 || !Number.isInteger(n)) throw new Error(`阶乘只对非负整数有定义，收到 ${n}`)
  let r = 1
  for (let i = 2; i <= n; i++) r *= i
  return r
}

/** 排列数 P(n, k) = n! / (n−k)! ：从 n 个里挑 k 个**排成一列** */
export function permutations(n: number, k: number): number {
  if (k < 0 || k > n) return 0
  let r = 1
  for (let i = 0; i < k; i++) r *= n - i
  return r
}

/** 组合数 C(n, k) = n! / (k!(n−k)!) ：从 n 个里挑 k 个**装进袋子** */
export function combinations(n: number, k: number): number {
  if (k < 0 || k > n) return 0
  const kk = Math.min(k, n - k)
  let r = 1
  for (let i = 1; i <= kk; i++) r = (r * (n - kk + i)) / i
  return Math.round(r)
}

/** 可重复排列：n^k —— 每次都能从 n 个里再挑一个 */
export const withRepetitionOrdered = (n: number, k: number): number =>
  n < 0 || k < 0 ? 0 : Math.pow(n, k)

/** 可重复组合（隔板法）：C(n+k−1, k) */
export const withRepetitionUnordered = (n: number, k: number): number =>
  n <= 0 || k < 0 ? 0 : combinations(n + k - 1, k)

export type CountMode = 'ordered-no-rep' | 'unordered-no-rep' | 'ordered-with-rep' | 'unordered-with-rep'

export interface CountModel {
  key: CountMode
  label: string
  plain: string
  formula: string
  compute: (n: number, k: number) => number
}

/** C2「小球入盒」的四种模型：把「有序/无序 × 可重复/不可重复」讲成一个人话表格 */
export const COUNT_MODELS: CountModel[] = [
  {
    key: 'ordered-no-rep',
    label: '有序 · 不重复',
    plain: '排队：顺序算数，而且同一个东西不能选两次。',
    formula: 'P(n, k) = n × (n−1) × … × (n−k+1)',
    compute: permutations,
  },
  {
    key: 'unordered-no-rep',
    label: '无序 · 不重复',
    plain: '抓一把：顺序不算数，同一个东西也不能选两次。',
    formula: 'C(n, k) = P(n, k) / k!',
    compute: combinations,
  },
  {
    key: 'ordered-with-rep',
    label: '有序 · 可重复',
    plain: '每次都能重新挑：顺序算数，选过的还能再选。',
    formula: 'nᵏ',
    compute: withRepetitionOrdered,
  },
  {
    key: 'unordered-with-rep',
    label: '无序 · 可重复',
    plain: '点菜：顺序不算数，但同一道菜可以点好几份。',
    formula: 'C(n+k−1, k)',
    compute: withRepetitionUnordered,
  },
]

export function countModel(key: CountMode): CountModel {
  const m = COUNT_MODELS.find((x) => x.key === key)
  if (!m) throw new Error(`未知计数模型 ${key}`)
  return m
}

/* --------------------------------------------------------------- 汉诺塔 */

export interface HanoiMove {
  disk: number
  from: string
  to: string
}

/**
 * 汉诺塔最优解步骤（2ⁿ − 1 步）。
 * 直接按递归定义生成，不使用搜索 —— 保证结果与教材公式严格一致。
 */
export function hanoiMoves(n: number, from = 'A', to = 'C', via = 'B'): HanoiMove[] {
  const out: HanoiMove[] = []
  const rec = (k: number, a: string, c: string, b: string): void => {
    if (k === 0) return
    rec(k - 1, a, b, c)
    out.push({ disk: k, from: a, to: c })
    rec(k - 1, b, c, a)
  }
  rec(n, from, to, via)
  return out
}

/** 汉诺塔最少步数 2ⁿ − 1，用于「步数曲线」与归纳法的对照 */
export const hanoiMinimum = (n: number): number => Math.pow(2, n) - 1

/* --------------------------------------------------------------- 杨辉三角 */

/** 杨辉三角前 rows 行 */
export function pascal(rows: number): number[][] {
  const out: number[][] = []
  for (let n = 0; n < rows; n++) {
    const row: number[] = []
    for (let k = 0; k <= n; k++) row.push(combinations(n, k))
    out.push(row)
  }
  return out
}

/** 二项式 (a+b)^n 展开后每项的系数与该次幂 */
export function binomialExpansion(n: number): { k: number; coeff: number; term: string }[] {
  return pascal(n + 1)[n].map((coeff, k) => ({
    k,
    coeff,
    term: termLabel(n, k),
  }))
}

function termLabel(n: number, k: number): string {
  const aPow = n - k
  const bPow = k
  const a = aPow === 0 ? '' : aPow === 1 ? 'a' : `a^${aPow}`
  const b = bPow === 0 ? '' : bPow === 1 ? 'b' : `b^${bPow}`
  return a + b || '1'
}

/** 容斥原理：三个集合的并集元素个数 */
export function inclusionExclusion3(
  a: number,
  b: number,
  c: number,
  ab: number,
  ac: number,
  bc: number,
  abc: number,
): number {
  return a + b + c - ab - ac - bc + abc
}

/**
 * 鸽巢原理：把 pigeons 只鸽子放进 holes 个洞。
 * 返回「至少有一个洞装了几只」的理论下界，用于 S7 的必然性论证。
 */
export function pigeonholeLowerBound(pigeons: number, holes: number): number {
  if (holes <= 0) throw new Error('洞的数量必须为正')
  return Math.floor((pigeons + holes - 1) / holes)
}
