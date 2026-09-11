import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { MODULE_BY_ID, TOPIC_BY_ID } from '@/topics/catalog'
import { READY_IDS, loadTopic } from '@/topics/loader'
import { Card, Chip, PlainSpeak, SectionTitle, cx } from '@/ui'

interface Entry {
  term: string
  plain: string
  formal?: string
  topicId: string
}

/**
 * 术语表。
 *
 * 刻意**从各个知识点里实时聚合**，而不是单独维护一份词表 ——
 * 单一数据源意味着术语永远不会和正文脱节（改一处就同步）。
 * 代价是进这个页面要把所有知识点模块都载入一次，但这是独立路由，
 * 不影响任何知识点页面的首包体积。
 */
export default function GlossaryPage() {
  const [entries, setEntries] = useState<Entry[] | null>(null)
  const [query, setQuery] = useState('')

  useEffect(() => {
    let alive = true
    void Promise.all(
      READY_IDS.map(async (id) => {
        const topic = await loadTopic(id)
        if (!topic) return []
        return topic.glossary.map((g): Entry => ({ ...g, topicId: id }))
      }),
    ).then((lists) => {
      if (!alive) return
      const all = lists.flat()
      all.sort((a, b) => a.term.localeCompare(b.term, 'zh-Hans-CN'))
      setEntries(all)
    })
    return () => {
      alive = false
    }
  }, [])

  const filtered = useMemo(() => {
    if (!entries) return []
    const q = query.trim().toLowerCase()
    if (!q) return entries
    return entries.filter(
      (e) =>
        e.term.toLowerCase().includes(q) ||
        e.plain.toLowerCase().includes(q) ||
        (e.formal ?? '').toLowerCase().includes(q),
    )
  }, [entries, query])

  const grouped = useMemo(() => {
    const map = new Map<string, Entry[]>()
    for (const e of filtered) {
      const modId = TOPIC_BY_ID[e.topicId]?.moduleId ?? 'other'
      const list = map.get(modId) ?? []
      list.push(e)
      map.set(modId, list)
    }
    return [...map.entries()]
  }, [filtered])

  return (
    <div className="mx-auto w-full max-w-4xl px-3 pb-16 pt-6 sm:px-4">
      <header>
        <h1 className="text-2xl font-black text-slate-900 sm:text-3xl dark:text-slate-50">术语表</h1>
        <p className="mt-2 text-slate-600 dark:text-slate-300">
          每个术语都先给一句大白话，再给课本里的正式说法。忘记某个词是什么意思时来这儿查。
        </p>
      </header>

      <div className="mt-4">
        <label className="sr-only" htmlFor="glossary-search">
          搜索术语
        </label>
        <input
          id="glossary-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜一个词，比如「传递」「并集」「双射」"
          className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none focus:border-a-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        />
      </div>

      {entries === null ? (
        <p className="mt-6 text-sm text-slate-500 dark:text-slate-400">正在从各知识点里汇总术语…</p>
      ) : entries.length === 0 ? (
        <Card className="mt-6">
          <PlainSpeak>还没有术语。等知识点上线后这里会自动长出来。</PlainSpeak>
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="mt-6">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            没有找到和「{query}」相关的术语。换个说法试试？
          </p>
        </Card>
      ) : (
        <div className="mt-6 flex flex-col gap-6">
          {grouped.map(([modId, list]) => (
            <Card key={modId}>
              <SectionTitle hint={`${list.length} 条`}>{MODULE_BY_ID[modId]?.name ?? '其他'}</SectionTitle>
              <dl className="flex flex-col gap-3">
                {list.map((e) => (
                  <div key={`${e.topicId}-${e.term}`} className={cx('border-l-2 border-slate-200 pl-3 dark:border-slate-700')}>
                    <dt className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-slate-800 dark:text-slate-100">{e.term}</span>
                      <Link to={`/learn/${e.topicId}`}>
                        <Chip tone="a" showGlyph={false}>
                          出自 {TOPIC_BY_ID[e.topicId]?.title ?? e.topicId}
                        </Chip>
                      </Link>
                    </dt>
                    <dd className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{e.plain}</dd>
                    {e.formal ? (
                      <dd className="mt-1 rounded-lg bg-slate-100 px-2.5 py-1.5 font-mono text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        {e.formal}
                      </dd>
                    ) : null}
                  </div>
                ))}
              </dl>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
