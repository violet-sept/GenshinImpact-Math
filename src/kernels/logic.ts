/**
 * 命题逻辑内核：表达式 AST、求值、真值表、永真式判定。
 * 纯函数，零 React 依赖，可被穷举单测。
 */
import type { Step } from './types'

/* ------------------------------------------------------------------ AST */

export type Expr =
  | { k: 'var'; name: string }
  | { k: 'not'; a: Expr }
  | { k: 'and'; a: Expr; b: Expr }
  | { k: 'or'; a: Expr; b: Expr }
  | { k: 'imp'; a: Expr; b: Expr }
  | { k: 'iff'; a: Expr; b: Expr }

export const VAR = (name: string): Expr => ({ k: 'var', name })
export const NOT = (a: Expr): Expr => ({ k: 'not', a })
export const AND = (a: Expr, b: Expr): Expr => ({ k: 'and', a, b })
export const OR = (a: Expr, b: Expr): Expr => ({ k: 'or', a, b })
export const IMP = (a: Expr, b: Expr): Expr => ({ k: 'imp', a, b })
export const IFF = (a: Expr, b: Expr): Expr => ({ k: 'iff', a, b })

/** 运算符优先级：数字越大结合越紧 */
const PREC: Record<Expr['k'], number> = {
  iff: 1,
  imp: 2,
  or: 3,
  and: 4,
  not: 5,
  var: 9,
}

const BINARY_SYMBOL: Record<'and' | 'or' | 'imp' | 'iff', string> = {
  and: '∧',
  or: '∨',
  imp: '→',
  iff: '↔',
}

/** 把 AST 渲染成人类可读的符号串（自动按优先级补括号） */
export function exprToString(e: Expr, parentPrec = 0): string {
  const p = PREC[e.k]
  let s: string
  switch (e.k) {
    case 'var':
      s = e.name
      break
    case 'not':
      s = `¬${exprToString(e.a, p)}`
      break
    default: {
      const left = exprToString(e.a, p)
      // 右操作数用 <= 判断：保证 `a → (b → c)` 这类不结合的情形不被误读
      const right = exprToString(e.b, p + 1)
      s = `${left} ${BINARY_SYMBOL[e.k]} ${right}`
    }
  }
  return p < parentPrec ? `(${s})` : s
}

/** 表达式中出现的所有命题变元，按字母序去重 */
export function varsOf(e: Expr): string[] {
  const out = new Set<string>()
  const walk = (x: Expr): void => {
    switch (x.k) {
      case 'var':
        out.add(x.name)
        return
      case 'not':
        walk(x.a)
        return
      default:
        walk(x.a)
        walk(x.b)
    }
  }
  walk(e)
  return [...out].sort()
}

/** 叶子（子表达式）数量：用于「复杂度」展示与卡诺图规模判断 */
export function sizeOf(e: Expr): number {
  switch (e.k) {
    case 'var':
      return 1
    case 'not':
      return 1 + sizeOf(e.a)
    default:
      return 1 + sizeOf(e.a) + sizeOf(e.b)
  }
}

/* --------------------------------------------------------------- 求值与真值表 */

export type Env = Record<string, boolean>

export function evalExpr(e: Expr, env: Env): boolean {
  switch (e.k) {
    case 'var': {
      const v = env[e.name]
      if (v === undefined) throw new Error(`未赋值的命题变元：${e.name}`)
      return v
    }
    case 'not':
      return !evalExpr(e.a, env)
    case 'and':
      return evalExpr(e.a, env) && evalExpr(e.b, env)
    case 'or':
      return evalExpr(e.a, env) || evalExpr(e.b, env)
    case 'imp':
      // 蕴含「前件为假时整体为真」是初学者最大的坑，必须由动画专门讲
      return !evalExpr(e.a, env) || evalExpr(e.b, env)
    case 'iff':
      return evalExpr(e.a, env) === evalExpr(e.b, env)
  }
}

export interface TruthRow {
  assignment: Env
  value: boolean
}

export interface TruthTable {
  vars: string[]
  rows: TruthRow[]
}

/**
 * 生成真值表。行序固定为「000, 001, 010, ...」的二进制序，
 * 与教材一致 —— 顺序错乱会让学生在对照教材时困惑。
 */
export function truthTable(e: Expr): TruthTable {
  const vars = varsOf(e)
  const n = vars.length
  const total = 1 << n
  const rows: TruthRow[] = []
  for (let i = 0; i < total; i++) {
    const assignment: Env = {}
    vars.forEach((name, idx) => {
      // 最高位对应第一个变元
      assignment[name] = ((i >> (n - 1 - idx)) & 1) === 1
    })
    rows.push({ assignment, value: evalExpr(e, assignment) })
  }
  return { vars, rows }
}

/** 重言式（永真式）：所有行都为真 */
export function isTautology(e: Expr): boolean {
  return truthTable(e).rows.every((r) => r.value)
}

/** 矛盾式（永假式）：所有行都为假 */
export function isContradiction(e: Expr): boolean {
  return truthTable(e).rows.every((r) => !r.value)
}

/** 可满足式：至少有一行为真 */
export function isSatisfiable(e: Expr): boolean {
  return truthTable(e).rows.some((r) => r.value)
}

/** 两个表达式是否逻辑等价（真值表逐行一致） */
export function equivalent(a: Expr, b: Expr): boolean {
  const inputs = [...new Set([...varsOf(a), ...varsOf(b)])].sort()
  const n = inputs.length
  for (let i = 0; i < 1 << n; i++) {
    const env: Env = {}
    inputs.forEach((name, idx) => {
      env[name] = ((i >> (n - 1 - idx)) & 1) === 1
    })
    if (evalExpr(a, env) !== evalExpr(b, env)) return false
  }
  return true
}

/** 找出两个表达式取值不同的第一行；等价则返回 null */
export function findDifference(a: Expr, b: Expr): { assignment: Env; left: boolean; right: boolean } | null {
  const inputs = [...new Set([...varsOf(a), ...varsOf(b)])].sort()
  const n = inputs.length
  for (let i = 0; i < 1 << n; i++) {
    const env: Env = {}
    inputs.forEach((name, idx) => {
      env[name] = ((i >> (n - 1 - idx)) & 1) === 1
    })
    const left = evalExpr(a, env)
    const right = evalExpr(b, env)
    if (left !== right) return { assignment: env, left, right }
  }
  return null
}

/* --------------------------------------------------------------- 德摩根律 */

export type DeMorganSide = 'notAnd' | 'notOr'

/**
 * 生成「德摩根律」的逐步变形序列，供 L3 的积木翻转动画使用。
 * 返回的是**变形过程的每一步**，UI 只负责按索引播放。
 */
export function deMorganSteps(side: DeMorganSide, p: Expr, q: Expr): Step<Expr>[] {
  if (side === 'notAnd') {
    const start = NOT(AND(p, q))
    const expanded = OR(NOT(p), NOT(q))
    return [
      {
        snapshot: start,
        explanation: '「不是（P 而且 Q）」——先看看它到底在否定什么。',
        highlight: [],
        label: '原式',
      },
      {
        snapshot: OR(NOT(AND(p, q)), NOT(AND(p, q))),
        explanation: '否定一个「并且」，等于把否定分别送给两边，再把「并且」换成「或者」。',
        highlight: ['op'],
        label: '拆开否定',
      },
      {
        snapshot: expanded,
        explanation: `于是得到 ¬${exprToString(p)} ∨ ¬${exprToString(q)}。两边一模一样，所以它们相等。`,
        highlight: [],
        label: '德摩根律',
        tone: 'accept',
      },
    ]
  }
  const start = NOT(OR(p, q))
  const expanded = AND(NOT(p), NOT(q))
  return [
    {
      snapshot: start,
      explanation: '「不是（P 或者 Q）」——只要有一个成立就不行。',
      highlight: [],
      label: '原式',
    },
    {
      snapshot: AND(NOT(OR(p, q)), NOT(OR(p, q))),
      explanation: '否定一个「或者」，等于两个都否定掉，再把「或者」换成「并且」。',
      highlight: ['op'],
      label: '拆开否定',
    },
    {
      snapshot: expanded,
      explanation: `于是得到 ¬${exprToString(p)} ∧ ¬${exprToString(q)}。两边一模一样，所以它们相等。`,
      highlight: [],
      label: '德摩根律',
      tone: 'accept',
    },
  ]
}
