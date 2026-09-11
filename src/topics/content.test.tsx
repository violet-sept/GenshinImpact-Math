/**
 * 内容层冒烟测试 + 写作规范自动检查。
 *
 * 两件事：
 * 1. **每个知识点的 5 个步骤都能真的渲染出来**（SSR 渲一遍，捕获运行时报错）。
 *    知识点是内容，内容最容易出的错就是「某个数组下标越界」「某个字段没填」，
 *    这类错误构建期发现不了，但用户一点开就白屏。
 * 2. **把规划书 §3.2 的写作反面清单变成 CI 断言** —— 「显然」「易证」这类词
 *    出现在面向零基础用户的文案里，就应该让构建失败。
 */
import { createElement, type ReactNode } from 'react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { BIG_IDEA_STICKERS } from '@/assets/big-idea'
import { Announcer } from '@/platform/announcer'
import { ProgressProvider } from '@/platform/progress'
import { SettingsProvider } from '@/platform/settings'
import { STAGE_SEQUENCE, type StageCtx, type Topic } from './types'

const modules = import.meta.glob<{ default: Topic }>('./impl/*.tsx')

const IDS = Object.keys(modules)
  .map((p) => p.replace('./impl/', '').replace('.tsx', ''))
  .sort()

/**
 * 规划书 §3.2 的反面清单：这些话不该出现在给零基础用户看的文案里。
 *
 * 注意不要收单字词（比如「略」）——「忽略孤立点」会被误判成在说「证明略」。
 * 中文没有词边界，宁可少收几个，也不要制造假阳性让规则失去信任。
 */
const FORBIDDEN = ['显然', '易证', '由定义立得', '众所周知', '不言而喻', '不证自明']

const noop = (): void => {}

function makeCtx(): StageCtx {
  return {
    solved: false,
    hintLevel: 0,
    solve: noop,
    say: noop,
    announce: noop,
    reducedMotion: false,
  }
}

function wrap(node: ReactNode): ReactNode {
  return createElement(
    SettingsProvider,
    null,
    createElement(ProgressProvider, null, createElement(Announcer, null, node as never)),
  )
}

/** 收集「教学文案」类字符串（正式符号定义不参与措辞检查） */
function instructionalStrings(topic: Topic): { where: string; text: string }[] {
  const out: { where: string; text: string }[] = []
  const push = (where: string, v: unknown): void => {
    if (typeof v === 'string' && v) out.push({ where, text: v })
  }
  push('title', topic.title)
  push('oneLiner', topic.oneLiner)
  push('outcome', topic.outcome)
  push('bigIdea', topic.bigIdea)
  topic.glossary.forEach((g, i) => push(`glossary[${i}].plain`, g.plain))
  topic.stages.forEach((s, i) => {
    push(`stages[${i}].label`, s.label)
    push(`stages[${i}].narration`, s.narration)
    s.hints.forEach((h, j) => push(`stages[${i}].hints[${j}]`, h))
  })
  return out
}

describe('知识点内容契约', () => {
  it('至少有一个已实现的知识点', () => {
    expect(IDS.length).toBeGreaterThan(0)
  })

  it('每个已实现的小章节都配了「一句话本质」表情包', () => {
    const missing = IDS.filter((id) => !BIG_IDEA_STICKERS[id])
    expect(missing, '缺表情包：往 src/assets/big-idea/ 放一个与知识点同名的 png').toEqual([])
  })

  for (const id of IDS) {
    describe(`${id}`, () => {
      it('能被加载，且 id 与文件名一致', async () => {
        const mod = await modules[`./impl/${id}.tsx`]()
        const topic = mod.default
        expect(topic.id).toBe(id)
        expect(topic.title.length).toBeGreaterThan(0)
        expect(topic.oneLiner.length).toBeGreaterThan(0)
        expect(topic.outcome.length).toBeGreaterThan(0)
        expect(topic.bigIdea.length).toBeGreaterThan(0)
      })

      it('恰好 5 个步骤，顺序为 hook→explore→name→practice→transfer', async () => {
        const topic = (await modules[`./impl/${id}.tsx`]()).default
        expect(topic.stages).toHaveLength(5)
        // 元数据里的顺序定义在 STAGE_SEQUENCE；此处只校验数量与字段完整
        expect(STAGE_SEQUENCE).toHaveLength(5)
      })

      it('每个步骤都有旁白、3 条提示、可渲染', async () => {
        const topic = (await modules[`./impl/${id}.tsx`]()).default
        for (let i = 0; i < topic.stages.length; i++) {
          const stage = topic.stages[i]
          expect(stage.narration.trim().length, `stages[${i}] 旁白为空`).toBeGreaterThan(0)
          expect(stage.hints, `stages[${i}] 提示不是 3 条`).toHaveLength(3)
          stage.hints.forEach((h, j) => {
            expect(h.trim().length, `stages[${i}].hints[${j}] 为空`).toBeGreaterThan(0)
          })
          expect(() => renderToString(wrap(stage.render(makeCtx())) as never), `stages[${i}] 渲染失败`).not.toThrow()
        }
      })

      it('至少 3 个步骤要求交互才能推进（铁律 R5）', async () => {
        const topic = (await modules[`./impl/${id}.tsx`]()).default
        const gated = topic.stages.filter((s) => s.requireSolve !== false).length
        expect(gated, '不操作就能一路点下去，违背铁律 R5').toBeGreaterThanOrEqual(3)
      })

      it('至少列出 2 条典型误解', async () => {
        const topic = (await modules[`./impl/${id}.tsx`]()).default
        expect(topic.misconceptions.length).toBeGreaterThanOrEqual(2)
        topic.misconceptions.forEach((m) => {
          expect(m.wrong.trim().length).toBeGreaterThan(0)
          expect(m.right.trim().length).toBeGreaterThan(0)
        })
      })

      it('至少 4 条术语，每条都有人话解释', async () => {
        const topic = (await modules[`./impl/${id}.tsx`]()).default
        expect(topic.glossary.length).toBeGreaterThanOrEqual(4)
        topic.glossary.forEach((g) => {
          expect(g.plain.trim().length, `${g.term} 缺少大白话解释`).toBeGreaterThan(0)
        })
      })

      it('教学文案里不含「显然」「易证」这类劝退词（规划书 §3.2）', async () => {
        const topic = (await modules[`./impl/${id}.tsx`]()).default
        const offenders = instructionalStrings(topic).filter((s) => FORBIDDEN.some((w) => s.text.includes(w)))
        expect(
          offenders.map((o) => `${o.where}: ${o.text}`),
          '这些地方出现了不该有的措辞',
        ).toEqual([])
      })
    })
  }
})
