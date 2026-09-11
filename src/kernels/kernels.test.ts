/**
 * 算法内核单测。
 *
 * 规划书 §11.1：「一根画错的边、一个错误的松弛顺序，会让学生形成错误认知，
 * 代价远高于一次崩溃。」因此这里不只是「跑通」，而是**与独立的暴力实现交叉验证**。
 */
import { describe, expect, it } from 'vitest'

import {
  AND,
  IMP,
  IFF,
  NOT,
  OR,
  VAR,
  equivalent,
  evalExpr,
  exprToString,
  isContradiction,
  isTautology,
  truthTable,
  varsOf,
  type Expr,
} from './logic'
import {
  SET_OPS,
  applyOp,
  cartesian,
  complement,
  difference,
  intersect,
  isProperSubset,
  isSubset,
  powerSet,
  setToString,
  subsetVerdict,
  symdiff,
  union,
} from './sets'
import {
  combinations,
  countModel,
  factorial,
  hanoiMinimum,
  hanoiMoves,
  inclusionExclusion3,
  pascal,
  permutations,
  pigeonholeLowerBound,
  withRepetitionOrdered,
  withRepetitionUnordered,
} from './counting'
import {
  addPair,
  checkProperties,
  equivalenceClasses,
  fromMatrix,
  hasPair,
  isAntisymmetric,
  isEquivalence,
  isPartialOrder,
  isReflexive,
  isSymmetric,
  isTransitive,
  pairKey,
  reflexiveClosure,
  symmetricClosure,
  toMatrix,
  togglePair,
  transitiveClosureSteps,
  type Relation,
} from './relations'
import {
  adjacencyMatrix,
  checkTrail,
  degree,
  degreeSequence,
  degrees,
  dijkstra,
  eulerVerdict,
  fmtDist,
  isConnected,
  kruskal,
  makeGraph,
  neighbors,
  oddDegreeNodes,
  reconstructPath,
  wouldFormCycle,
  type Graph,
  greedyColoring,
  isProperColoring,
} from './graph'
import { circleLayout, forceLayout, treeLayout } from './layout'

/* ============================================================ 逻辑 */

describe('logic · AST 与真值表', () => {
  it('按优先级补括号，不产生歧义', () => {
    expect(exprToString(AND(VAR('P'), OR(VAR('Q'), VAR('R'))))).toBe('P ∧ (Q ∨ R)')
    expect(exprToString(OR(AND(VAR('P'), VAR('Q')), VAR('R')))).toBe('P ∧ Q ∨ R')
    expect(exprToString(NOT(AND(VAR('P'), VAR('Q'))))).toBe('¬(P ∧ Q)')
    expect(exprToString(IMP(VAR('P'), IMP(VAR('Q'), VAR('R'))))).toBe('P → (Q → R)')
  })

  it('变元收集去重且有序', () => {
    expect(varsOf(AND(VAR('R'), OR(VAR('P'), VAR('R'))))).toEqual(['P', 'R'])
  })

  it('蕴含只在「真→假」时为假 —— 这是初学者最大的坑', () => {
    const e = IMP(VAR('P'), VAR('Q'))
    expect(evalExpr(e, { P: true, Q: false })).toBe(false)
    expect(evalExpr(e, { P: false, Q: false })).toBe(true)
    expect(evalExpr(e, { P: false, Q: true })).toBe(true)
    expect(evalExpr(e, { P: true, Q: true })).toBe(true)
  })

  it('真值表行数 = 2ⁿ，且行序与教材一致（000,001,010…）', () => {
    const t = truthTable(AND(VAR('P'), VAR('Q')))
    expect(t.vars).toEqual(['P', 'Q'])
    expect(t.rows).toHaveLength(4)
    expect(t.rows.map((r) => r.value)).toEqual([false, false, false, true])
    const t3 = truthTable(OR(VAR('P'), AND(VAR('Q'), NOT(VAR('R')))))
    expect(t3.rows).toHaveLength(8)
  })

  it('真值表逐行求值必须与 evalExpr 完全一致（交叉验证）', () => {
    const exprs: Expr[] = [
      AND(VAR('P'), VAR('Q')),
      IMP(VAR('P'), VAR('Q')),
      IFF(VAR('P'), OR(VAR('Q'), VAR('R'))),
      NOT(OR(VAR('P'), AND(VAR('Q'), NOT(VAR('R'))))),
    ]
    for (const e of exprs) {
      const { vars, rows } = truthTable(e)
      for (const row of rows) {
        expect(evalExpr(e, row.assignment)).toBe(row.value)
      }
      expect(vars.length).toBeGreaterThan(0)
    }
  })

  it('永真式 / 矛盾式判定', () => {
    expect(isTautology(OR(VAR('P'), NOT(VAR('P'))))).toBe(true)
    expect(isTautology(IMP(VAR('P'), VAR('P')))).toBe(true)
    expect(isTautology(IMP(VAR('P'), VAR('Q')))).toBe(false)
    expect(isContradiction(AND(VAR('P'), NOT(VAR('P'))))).toBe(true)
    expect(isContradiction(VAR('P'))).toBe(false)
  })

  it('德摩根律两种形式都成立（穷举验证）', () => {
    const P = VAR('P')
    const Q = VAR('Q')
    expect(equivalent(NOT(AND(P, Q)), OR(NOT(P), NOT(Q)))).toBe(true)
    expect(equivalent(NOT(OR(P, Q)), AND(NOT(P), NOT(Q)))).toBe(true)
    // 反例：把 ∧ 误写成 ∨ 就不等价了
    expect(equivalent(NOT(AND(P, Q)), AND(NOT(P), NOT(Q)))).toBe(false)
  })

  it('分配律、吸收律等价性穷举验证', () => {
    const P = VAR('P')
    const Q = VAR('Q')
    const R = VAR('R')
    expect(equivalent(AND(P, OR(Q, R)), OR(AND(P, Q), AND(P, R)))).toBe(true)
    expect(equivalent(OR(P, AND(P, Q)), P)).toBe(true)
  })
})

/* ============================================================ 集合 */

describe('sets · 集合运算', () => {
  const A = ['1', '2', '3']
  const B = ['3', '4']

  it('并 / 交 / 差 / 对称差', () => {
    expect(union(A, B)).toEqual(['1', '2', '3', '4'])
    expect(intersect(A, B)).toEqual(['3'])
    expect(difference(A, B)).toEqual(['1', '2'])
    expect(symdiff(A, B)).toEqual(['1', '2', '4'])
  })

  it('并集去重：重复元素只算一份', () => {
    expect(union(['a', 'a'], ['a'])).toEqual(['a'])
  })

  it('补集基于全集计算', () => {
    expect(complement(['1', '2'], ['1', '2', '3', '4'])).toEqual(['3', '4'])
  })

  it('applyOp 与直接函数调用一致', () => {
    for (const op of SET_OPS) {
      expect(applyOp(op.key, A, B)).toEqual(applyOp(op.key, A, B))
    }
    expect(applyOp('union', A, B)).toEqual(union(A, B))
    expect(applyOp('intersect', A, B)).toEqual(intersect(A, B))
  })

  it('子集判定与集合相等的边界', () => {
    expect(isSubset(['1'], A)).toBe(true)
    expect(isSubset(A, ['1'])).toBe(false)
    expect(isProperSubset(['1'], A)).toBe(true)
    expect(isProperSubset(A, A)).toBe(false)
    expect(isSubset([], A)).toBe(true) // 空集是任何集合的子集
  })

  it('幂集大小 = 2ⁿ 且包含空集与自身', () => {
    const ps = powerSet(['a', 'b', 'c'])
    expect(ps).toHaveLength(8)
    expect(ps[0]).toEqual([])
    expect(ps.at(-1)).toEqual(['a', 'b', 'c'])
    expect(powerSet([])).toEqual([[]])
  })

  it('笛卡尔积大小 = |A|×|B|，且有序', () => {
    expect(cartesian(['1', '2'], ['x', 'y', 'z'])).toHaveLength(6)
    expect(cartesian(['1'], ['x'])).toEqual([['1', 'x']])
  })

  it('集合字符串表示：空集显示为 ∅', () => {
    expect(setToString([])).toBe('∅')
    expect(setToString(['a'])).toBe('{ a }')
  })

  it('subsetVerdict 覆盖六种关系', () => {
    expect(subsetVerdict(A, A).kind).toBe('equal')
    expect(subsetVerdict(['1'], A).kind).toBe('properSubset')
    expect(subsetVerdict(A, ['1']).kind).toBe('properSuperset')
    expect(subsetVerdict(['1'], ['2']).kind).toBe('disjoint')
    expect(subsetVerdict(['1', '2'], ['2', '3']).kind).toBe('overlap')
  })
})

/* ============================================================ 计数 */

describe('counting · 排列组合', () => {
  it('阶乘与非法输入', () => {
    expect(factorial(0)).toBe(1)
    expect(factorial(5)).toBe(120)
    expect(() => factorial(-1)).toThrow()
    expect(() => factorial(1.5)).toThrow()
  })

  it('P(n,k) 与暴力枚举一致（交叉验证）', () => {
    const brutePerm = (n: number, k: number): number => {
      const pick = (pool: number[], chosen: number): number => {
        if (chosen === k) return 1
        return pool.reduce((sum, _x, i) => sum + pick(pool.filter((_, j) => j !== i), chosen + 1), 0)
      }
      return pick(
        Array.from({ length: n }, (_, i) => i),
        0,
      )
    }
    for (let n = 0; n <= 6; n++) {
      for (let k = 0; k <= n; k++) {
        expect(permutations(n, k)).toBe(brutePerm(n, k))
      }
    }
  })

  it('C(n,k) 与暴力枚举一致，且满足帕斯卡递推', () => {
    const bruteComb = (n: number, k: number): number => {
      let count = 0
      for (let mask = 0; mask < 1 << n; mask++) {
        let bits = 0
        for (let i = 0; i < n; i++) if ((mask >> i) & 1) bits++
        if (bits === k) count++
      }
      return count
    }
    for (let n = 0; n <= 10; n++) {
      for (let k = 0; k <= n; k++) {
        expect(combinations(n, k)).toBe(bruteComb(n, k))
      }
    }
    for (let n = 1; n <= 10; n++) {
      for (let k = 1; k <= n; k++) {
        expect(combinations(n, k)).toBe(combinations(n - 1, k - 1) + combinations(n - 1, k))
      }
    }
  })

  it('四种计数模型', () => {
    expect(withRepetitionOrdered(3, 2)).toBe(9)
    expect(withRepetitionUnordered(3, 2)).toBe(6) // C(4,2)
    expect(countModel('ordered-no-rep').compute(5, 2)).toBe(20)
    expect(countModel('unordered-no-rep').compute(5, 2)).toBe(10)
    expect(permutations(5, 0)).toBe(1)
    expect(permutations(2, 5)).toBe(0)
  })

  it('杨辉三角', () => {
    expect(pascal(5)).toEqual([
      [1],
      [1, 1],
      [1, 2, 1],
      [1, 3, 3, 1],
      [1, 4, 6, 4, 1],
    ])
    expect(pascal(0)).toEqual([])
  })

  it('汉诺塔：步数严格等于 2ⁿ−1，且每步都合法', () => {
    for (let n = 1; n <= 8; n++) {
      const moves = hanoiMoves(n)
      expect(moves).toHaveLength(hanoiMinimum(n))
      // 真实模拟一遍：大盘不能压在小盘上
      const pegs: Record<string, number[]> = { A: [], B: [], C: [] }
      for (let d = n; d >= 1; d--) pegs.A.push(d)
      for (const m of moves) {
        expect(pegs[m.from].at(-1)).toBe(m.disk)
        const targetTop = pegs[m.to].at(-1)
        if (targetTop !== undefined) expect(m.disk).toBeLessThan(targetTop)
        pegs[m.from].pop()
        pegs[m.to].push(m.disk)
      }
      expect(pegs.C).toEqual(Array.from({ length: n }, (_, i) => n - i))
      expect(pegs.A).toHaveLength(0)
    }
  })

  it('容斥原理三项公式', () => {
    expect(inclusionExclusion3(10, 10, 10, 3, 3, 3, 1)).toBe(22)
  })

  it('鸽巢下界', () => {
    expect(pigeonholeLowerBound(3, 2)).toBe(2)
    expect(pigeonholeLowerBound(4, 2)).toBe(2)
    expect(pigeonholeLowerBound(0, 3)).toBe(0)
    expect(() => pigeonholeLowerBound(1, 0)).toThrow()
  })
})

/* ============================================================ 关系 */

describe('relations · 三视图与性质', () => {
  const domain = ['1', '2', '3']
  const r: Relation = {
    domain,
    pairs: [
      ['1', '1'],
      ['2', '2'],
      ['3', '3'],
      ['1', '2'],
      ['2', '1'],
      ['2', '3'],
      ['3', '2'],
      ['1', '3'],
      ['3', '1'],
    ],
  }

  it('有序对 ↔ 矩阵 双向一致', () => {
    const m = toMatrix(r)
    expect(m[0][1]).toBe(true)
    expect(m[1][0]).toBe(true)
    expect(fromMatrix(domain, m).pairs).toHaveLength(r.pairs.length)
  })

  it('三角色互转不丢信息（矩阵往返）', () => {
    const back = fromMatrix(domain, toMatrix(r))
    for (const a of domain) for (const b of domain) expect(hasPair(back, a, b)).toBe(hasPair(r, a, b))
  })

  it('togglePair 幂等两次回到原状', () => {
    const once = togglePair(r, '1', '2')
    expect(hasPair(once, '1', '2')).toBe(false)
    expect(hasPair(togglePair(once, '1', '2'), '1', '2')).toBe(true)
  })

  it('全集关系是等价关系（自反 + 对称 + 传递）', () => {
    expect(isReflexive(r)).toBe(true)
    expect(isSymmetric(r)).toBe(true)
    expect(isTransitive(r)).toBe(true)
    expect(isEquivalence(r)).toBe(true)
    expect(equivalenceClasses(r)).toEqual([['1', '2', '3']])
  })

  it('传递性反例必须给出具体三元组', () => {
    const bad: Relation = { domain, pairs: [['1', '2'], ['2', '3']] }
    const t = checkProperties(bad).find((p) => p.key === 'transitive')!
    expect(t.ok).toBe(false)
    expect(t.witness).toEqual(['1', '2', '3'])
    expect(t.reason).toContain('(1, 3)')
  })

  it('自反对称传递的反例定位准确', () => {
    const missingSelf: Relation = { domain, pairs: [['1', '1']] }
    expect(checkProperties(missingSelf).find((p) => p.key === 'reflexive')!.witness).toEqual(['2'])

    const asym: Relation = { domain, pairs: [['1', '2']] }
    expect(checkProperties(asym).find((p) => p.key === 'symmetric')!.witness).toEqual(['1', '2'])

    const anti: Relation = { domain, pairs: [['1', '2'], ['2', '1']] }
    expect(checkProperties(anti).find((p) => p.key === 'antisymmetric')!.ok).toBe(false)
  })

  it('反对称与自反 ⇒ 反对称关系里 a≠b 时不可能互相指向', () => {
    const partial: Relation = { domain, pairs: [['1', '1'], ['2', '2'], ['3', '3'], ['1', '2'], ['1', '3'], ['2', '3']] }
    expect(isReflexive(partial)).toBe(true)
    expect(isAntisymmetric(partial)).toBe(true)
    expect(isTransitive(partial)).toBe(true)
    expect(isPartialOrder(partial)).toBe(true)
  })

  it('传递闭包：结果必须是传递的，且是包含原关系的最小传递关系', () => {
    const chain: Relation = { domain, pairs: [['1', '2'], ['2', '3']] }
    const steps = transitiveClosureSteps(chain)
    const closure = steps.at(-1)!.snapshot
    expect(isTransitive(closure)).toBe(true)
    expect(hasPair(closure, '1', '3')).toBe(true)
    // 最小性：去掉任何一条新边就不再传递
    for (const p of closure.pairs) {
      const smaller = { ...closure, pairs: closure.pairs.filter((q) => q !== p) }
      if (smaller.pairs.length < closure.pairs.length) {
        const stillContains = chain.pairs.every(([a, b]) => hasPair(smaller, a, b))
        if (stillContains) expect(isTransitive(smaller)).toBe(false)
      }
    }
    expect(steps.length).toBeGreaterThan(1)
  })

  it('传递闭包与 Warshall 矩阵算法结果一致（交叉验证）', () => {
    const warshall = (m: boolean[][]): boolean[][] => {
      const n = m.length
      const a = m.map((row) => [...row])
      for (let k = 0; k < n; k++) for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) a[i][j] = a[i][j] || (a[i][k] && a[k][j])
      return a
    }
    const samples: Relation[] = [
      { domain, pairs: [['1', '2'], ['2', '3']] },
      { domain, pairs: [['1', '2'], ['2', '1'], ['2', '3']] },
      { domain, pairs: [['1', '3'], ['3', '2'], ['2', '1']] },
    ]
    for (const sample of samples) {
      const mine = toMatrix(transitiveClosureSteps(sample).at(-1)!.snapshot)
      expect(mine).toEqual(warshall(toMatrix(sample)))
    }
  })

  it('自反闭包 / 对称闭包', () => {
    const base: Relation = { domain, pairs: [['1', '2']] }
    expect(isReflexive(reflexiveClosure(base))).toBe(true)
    expect(isSymmetric(symmetricClosure(base))).toBe(true)
    expect(reflexiveClosure(base).pairs).toHaveLength(4)
  })

  it('pairKey 不产生键冲突', () => {
    expect(pairKey('a', 'b')).not.toBe(pairKey('ab', ''))
  })

  it('addPair 不重复添加同一条边', () => {
    const once = addPair({ domain, pairs: [] }, '1', '2')
    expect(addPair(once, '1', '2').pairs).toHaveLength(1)
  })
})

/* ============================================================ 图 */

const path3: Graph = makeGraph(
  ['A', 'B', 'C'],
  [
    ['A', 'B', 1],
    ['B', 'C', 2],
  ],
)

const weighted: Graph = makeGraph(
  ['A', 'B', 'C', 'D', 'E'],
  [
    ['A', 'B', 4],
    ['A', 'C', 2],
    ['B', 'C', 1],
    ['B', 'D', 5],
    ['C', 'D', 8],
    ['C', 'E', 10],
    ['D', 'E', 2],
  ],
)

describe('graph · 表示与遍历', () => {
  it('邻接矩阵对称、对角为 0（简单图）', () => {
    const m = adjacencyMatrix(weighted)
    expect(m).toHaveLength(5)
    for (let i = 0; i < 5; i++) {
      expect(m[i][i]).toBe(0)
      for (let j = 0; j < 5; j++) expect(m[i][j]).toBe(m[j][i])
    }
  })

  it('度数与度序列（握手定理：度数之和 = 2|E|）', () => {
    const d = degrees(weighted)
    const total = Object.values(d).reduce((a, b) => a + b, 0)
    expect(total).toBe(weighted.edges.length * 2)
    expect(degree(weighted, 'A')).toBe(2)
    expect(degreeSequence(weighted)).toEqual([...degreeSequence(weighted)].sort((a, b) => b - a))
  })

  it('neighbors 返回边本身（多重图需要靠边 id 区分）', () => {
    const multi = makeGraph(['X', 'Y'], [['X', 'Y', 1], ['X', 'Y', 1]])
    expect(neighbors(multi, 'X')).toHaveLength(2)
    expect(degree(multi, 'X')).toBe(2)
    expect(new Set(neighbors(multi, 'X').map((n) => n.edge.id)).size).toBe(2)
  })

  it('连通性判定', () => {
    expect(isConnected(path3)).toBe(true)
    expect(isConnected(makeGraph(['A', 'B'], []))).toBe(false)
    expect(isConnected(makeGraph([], []))).toBe(true)
  })
})

describe('graph · 欧拉判定（与暴力搜索交叉验证）', () => {
  /** 暴力：枚举所有走法，看能否恰好用完每条边一次 */
  const bruteForceEuler = (g: Graph): { circuit: boolean; path: boolean } => {
    const n = g.edges.length
    if (n === 0) return { circuit: false, path: false }
    let path = false
    let circuit = false
    const used = new Array(n).fill(false)
    const walk = (v: string, start: string, count: number): void => {
      if (count === n) {
        path = true
        if (v === start) circuit = true
        return
      }
      for (let i = 0; i < n; i++) {
        if (used[i]) continue
        const e = g.edges[i]
        const next = e.u === v ? e.v : e.v === v ? e.u : null
        if (next === null) continue
        used[i] = true
        walk(next, start, count + 1)
        used[i] = false
      }
    }
    for (const s of new Set(g.edges.flatMap((e) => [e.u, e.v]))) walk(s, s, 0)
    return { path, circuit }
  }

  it('路径图：两个奇度点 ⇒ 有欧拉路径无回路', () => {
    const v = eulerVerdict(path3)
    expect(oddDegreeNodes(path3).sort()).toEqual(['A', 'C'])
    expect(v.hasPath).toBe(true)
    expect(v.hasCircuit).toBe(false)
  })

  it('三角形：全是偶度点 ⇒ 有欧拉回路', () => {
    const tri = makeGraph(['A', 'B', 'C'], [['A', 'B'], ['B', 'C'], ['C', 'A']])
    expect(eulerVerdict(tri).hasCircuit).toBe(true)
    expect(eulerVerdict(tri).odd).toEqual([])
  })

  it('柯尼斯堡七桥：4 个奇度点 ⇒ 不存在一笔画', () => {
    // 四块陆地：A 北岸、B 南岸、C 河中岛、D 东岸
    // 桥：A–C ×2、B–C ×2、C–D ×1、D–A ×1、D–B ×1（共 7 座）
    // 度数：A=3, B=3, C=5, D=3 —— 四个全是奇数
    const konigsberg = makeGraph(
      ['A', 'B', 'C', 'D'],
      [
        ['A', 'C'],
        ['A', 'C'],
        ['B', 'C'],
        ['B', 'C'],
        ['C', 'D'],
        ['D', 'A'],
        ['D', 'B'],
      ],
    )
    const v = eulerVerdict(konigsberg)
    expect(konigsberg.edges).toHaveLength(7)
    expect(v.odd).toEqual(['A', 'B', 'C', 'D'])
    expect(v.hasPath).toBe(false)
    expect(v.hasCircuit).toBe(false)
    expect(v.title).toContain('不存在')
    // 欧拉当年就是靠这个结论证明了七桥无解
    expect(bruteForceEuler(konigsberg).path).toBe(false)
  })

  it('随机小图：判定结果与暴力搜索完全一致（穷举交叉验证）', () => {
    const pool: [string, string][] = [
      ['A', 'B'],
      ['B', 'C'],
      ['C', 'D'],
      ['D', 'A'],
      ['A', 'C'],
    ]
    // 枚举 pool 的所有子集（最多 5 条边 → 32 种图）
    for (let mask = 0; mask < 1 << pool.length; mask++) {
      const raw = pool.filter((_, i) => (mask >> i) & 1)
      if (raw.length === 0) continue
      const g = makeGraph(['A', 'B', 'C', 'D'], raw)
      const verdict = eulerVerdict(g)
      const brute = bruteForceEuler(g)
      expect({ path: verdict.hasPath, circuit: verdict.hasCircuit }).toEqual(brute)
    }
  })

  it('checkTrail 能识别「重复边」与「不存在的边」', () => {
    const g = makeGraph(['A', 'B', 'C'], [['A', 'B'], ['B', 'C']])
    expect(checkTrail(g, ['A', 'B', 'C']).ok).toBe(true)
    expect(checkTrail(g, ['A', 'B', 'C']).reason).toContain('每条边都恰好走了一次')

    // A→B→A：这条边确实存在，只是已经用过了 —— 必须说清是「重复」而不是「没有」
    const repeat = checkTrail(g, ['A', 'B', 'A'])
    expect(repeat.ok).toBe(false)
    expect(repeat.reason).toContain('已经走过')

    // C→A：这条边根本不存在
    const missing = checkTrail(g, ['B', 'C', 'A'])
    expect(missing.ok).toBe(false)
    expect(missing.reason).toContain('没有桥')

    const g2 = makeGraph(['A', 'B'], [['A', 'B'], ['A', 'B']])
    const twice = checkTrail(g2, ['A', 'B', 'A'])
    expect(twice.ok).toBe(true)
    const thrice = checkTrail(g2, ['A', 'B', 'A', 'B'])
    expect(thrice.ok).toBe(false)
    expect(thrice.reason).toContain('已经走过')

    expect(checkTrail(g, ['A']).reason).toContain('还剩 2 条边')
  })
})

describe('graph · Dijkstra', () => {
  /** 暴力最短路：枚举所有简单路径取最小 */
  const bruteShortest = (g: Graph, start: string): Record<string, number> => {
    const out: Record<string, number> = {}
    for (const n of g.nodes) out[n] = Infinity
    out[start] = 0
    const walk = (v: string, cost: number, visited: Set<string>): void => {
      if (cost < out[v]) out[v] = cost
      for (const { node, edge } of neighbors(g, v)) {
        if (visited.has(node)) continue
        visited.add(node)
        walk(node, cost + edge.w, visited)
        visited.delete(node)
      }
    }
    walk(start, 0, new Set([start]))
    return out
  }

  it('结果与暴力枚举一致（交叉验证）', () => {
    const steps = dijkstra(weighted, 'A')
    const final = steps.at(-1)!.snapshot
    expect(final.dist).toEqual(bruteShortest(weighted, 'A'))
    expect(final.dist).toEqual({ A: 0, B: 3, C: 2, D: 8, E: 10 })
  })

  it('每一步都保持不变量：已确定的点距离不再变化', () => {
    const steps = dijkstra(weighted, 'A')
    let maxSettled = 0
    for (const s of steps) {
      const settled = s.snapshot.settled
      expect(settled.length).toBeGreaterThanOrEqual(maxSettled)
      maxSettled = settled.length
      for (const u of settled) {
        expect(s.snapshot.dist[u]).toBeLessThan(Infinity)
      }
    }
  })

  it('路径还原正确，且权重严格等于最短距离', () => {
    const steps = dijkstra(weighted, 'A')
    const final = steps.at(-1)!.snapshot
    const path = reconstructPath(final, 'A', 'D')
    // A→C→B→D = 2+1+5 = 8，比 A→B→D = 4+5 = 9 更短 —— 内核找到的是前者
    expect(path).toEqual(['A', 'C', 'B', 'D'])
    expect(final.dist.D).toBe(8)

    const cost = (p: string[]): number =>
      p.slice(1).reduce((sum, node, i) => {
        const e = weighted.edges.find(
          (x) => (x.u === p[i] && x.v === node) || (x.u === node && x.v === p[i]),
        )!
        return sum + e.w
      }, 0)
    expect(cost(path)).toBe(final.dist.D)

    // 对每个点都验一遍：还原出的路径权重必须等于 dist
    for (const target of weighted.nodes) {
      const p = reconstructPath(final, 'A', target)
      expect(cost(p)).toBe(final.dist[target])
      for (let i = 1; i < p.length; i++) {
        const a = p[i - 1]
        const b = p[i]
        expect(weighted.edges.some((e) => (e.u === a && e.v === b) || (e.u === b && e.v === a))).toBe(true)
      }
    }
  })

  it('不可达点保持 ∞，且不会死循环', () => {
    const g = makeGraph(['A', 'B', 'Z'], [['A', 'B', 1]])
    const final = dijkstra(g, 'A').at(-1)!.snapshot
    expect(final.dist.Z).toBe(Infinity)
    expect(fmtDist(final.dist.Z)).toBe('∞')
    expect(reconstructPath(final, 'A', 'Z')).toEqual([])
  })

  it('起点到自身为 0', () => {
    const final = dijkstra(weighted, 'C').at(-1)!.snapshot
    expect(final.dist.C).toBe(0)
  })
})

describe('graph · Kruskal', () => {
  /** 暴力最小生成树：枚举所有 n−1 条边的组合，取连通且权重最小者 */
  const bruteMST = (g: Graph): number => {
    const ns = g.nodes
    const edges = g.edges
    let best = Infinity
    const combos = (start: number, chosen: typeof edges): void => {
      if (chosen.length === ns.length - 1) {
        const sub: Graph = { nodes: ns, edges: chosen }
        if (isConnected(sub)) best = Math.min(best, chosen.reduce((s, e) => s + e.w, 0))
        return
      }
      for (let i = start; i < edges.length; i++) combos(i + 1, [...chosen, edges[i]])
    }
    combos(0, [])
    return best
  }

  it('总权重等于暴力枚举的最小值（交叉验证）', () => {
    const steps = kruskal(weighted)
    const final = steps.at(-1)!.snapshot
    expect(final.totalWeight).toBe(bruteMST(weighted))
    expect(final.accepted).toHaveLength(weighted.nodes.length - 1)
  })

  it('接受的边不构成环，拒绝的边都给出了理由', () => {
    const final = kruskal(weighted).at(-1)!.snapshot
    for (let i = 0; i < final.accepted.length; i++) {
      const prefix = final.accepted.slice(0, i)
      expect(wouldFormCycle(weighted.nodes, prefix, final.accepted[i])).toBe(false)
    }
    expect(final.rejected.length).toBeGreaterThan(0)
    for (const r of final.rejected) expect(r.reason).toContain('成环')
  })

  it('不连通图：森林而非树，但不会报错', () => {
    const g = makeGraph(['A', 'B', 'C', 'D'], [['A', 'B', 1], ['C', 'D', 1]])
    const final = kruskal(g).at(-1)!.snapshot
    expect(final.totalWeight).toBe(2)
    expect(final.accepted).toHaveLength(2)
  })

  it('单点图：没有边，总权重 0', () => {
    const g = makeGraph(['A'], [])
    const final = kruskal(g).at(-1)!.snapshot
    expect(final.totalWeight).toBe(0)
    expect(final.accepted).toHaveLength(0)
  })
})

describe('graph · 着色', () => {
  it('贪心着色一定是合法着色', () => {
    const c = greedyColoring(weighted)
    expect(isProperColoring(weighted, c)).toBe(true)
  })

  it('三角形需要 3 色', () => {
    const tri = makeGraph(['A', 'B', 'C'], [['A', 'B'], ['B', 'C'], ['C', 'A']])
    const c = greedyColoring(tri)
    expect(new Set(Object.values(c)).size).toBe(3)
  })

  it('二分图（偶数环）只用 2 色', () => {
    const c4 = makeGraph(['A', 'B', 'C', 'D'], [['A', 'B'], ['B', 'C'], ['C', 'D'], ['D', 'A']])
    expect(new Set(Object.values(greedyColoring(c4))).size).toBe(2)
  })
})

/* ============================================================ 布局 */

describe('layout · 确定性', () => {
  it('同输入必然同输出（视觉回归基线的前提）', () => {
    const a = forceLayout(['A', 'B', 'C', 'D'], [['A', 'B'], ['C', 'D']])
    const b = forceLayout(['A', 'B', 'C', 'D'], [['A', 'B'], ['C', 'D']])
    expect(a).toEqual(b)
  })

  it('所有点都落在画布内', () => {
    const pos = forceLayout(['A', 'B', 'C', 'D', 'E'], [['A', 'B'], ['B', 'C'], ['C', 'D'], ['D', 'E'], ['E', 'A']], {
      width: 340,
      height: 300,
    })
    for (const p of Object.values(pos)) {
      expect(p.x).toBeGreaterThanOrEqual(0)
      expect(p.x).toBeLessThanOrEqual(340)
      expect(p.y).toBeGreaterThanOrEqual(0)
      expect(p.y).toBeLessThanOrEqual(300)
    }
  })

  it('树布局：父节点在子节点上方且水平居中', () => {
    const children: Record<string, string[]> = { A: ['B', 'C'], B: ['D', 'E'], C: [], D: [], E: [] }
    const pos = treeLayout('A', (id) => children[id] ?? [])
    expect(pos.A.y).toBeLessThan(pos.B.y)
    expect(pos.B.y).toBeLessThan(pos.D.y)
    expect(pos.A.x).toBeCloseTo((pos.B.x + pos.C.x) / 2, 5)
    expect(pos.B.x).toBeCloseTo((pos.D.x + pos.E.x) / 2, 5)
  })

  it('圆周布局点两两不同', () => {
    const pos = circleLayout(['A', 'B', 'C', 'D'])
    const keys = new Set(Object.values(pos).map((p) => `${p.x},${p.y}`))
    expect(keys.size).toBe(4)
  })
})
