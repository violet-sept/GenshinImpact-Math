import { Link } from 'react-router-dom'

import drinkImg from '@/assets/rules/drink.png'
import peekImg from '@/assets/rules/peek.png'
import puzzleImg from '@/assets/rules/puzzle.png'
import winkImg from '@/assets/rules/wink.png'
import { CATALOG, MODULES, LEARNING_PATH, TOPIC_BY_ID, modulesByStage } from '@/topics/catalog'
import { READY_IDS, isReady } from '@/topics/loader'
import { useProgress } from '@/platform/progress'
import { Btn, Card, Chip, PlainSpeak, SectionTitle, cx } from '@/ui'
import { HomeDemo } from '@/learn/HomeDemo'

/** 首次进入时推荐的第一个知识点：挑最简单、依赖最少、可视化收益最高的那个 */
const FIRST_TOPIC = 'S1'

const PILLARS = [
  {
    icon: peekImg,
    title: '先看现象，后给符号',
    body: '每个知识点开头都是一个人人能看懂的小场景，一个字公式都没有。等你先有了直觉，才把符号贴上去。',
  },
  {
    icon: winkImg,
    title: '不动手，就往下走不了',
    body: '这不是「视频 + 播放按钮」。每个环节你都必须自己拖一下、点一下，才能进入下一步。',
  },
  {
    icon: puzzleImg,
    title: '每一步都有一句人话',
    body: '屏幕下面永远有一行大白话，告诉你此刻正在发生什么。看正式定义反而需要你主动点开。',
  },
  {
    icon: drinkImg,
    title: '卡住了也不会被丢下',
    body: '15 秒没动，会浮出一句方向提示；还不行就点「直接看答案」，它会当场做给你看，然后你可以回退重来。',
  },
]

export default function Home() {
  const progress = useProgress()
  const readyCount = READY_IDS.length
  const completed = progress.summary.completed

  // 「继续上次」：优先推荐用户还没走完的第一个知识点
  const resumeId =
    LEARNING_PATH.find((id) => isReady(id) && !progress.get(id).completed) ??
    LEARNING_PATH.find((id) => isReady(id)) ??
    FIRST_TOPIC

  return (
    <div className="mx-auto w-full max-w-6xl px-3 pb-16 pt-6 sm:px-4 sm:pt-10">
      {/* ------------------------------------------------------------ Hero */}
      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start">
        <div>
          <Chip tone="a" showGlyph={false}>
            交互式 · 零基础 · 多端可用
          </Chip>
          <h1 className="mt-3 text-3xl font-black leading-tight text-slate-900 sm:text-4xl dark:text-slate-50">
            把离散数学里
            <br />
            <span className="text-a-600 dark:text-a-400">看不见的结构</span>
            <br />
            变成可以上手拖的东西
          </h1>
          <p className="mt-4 max-w-xl leading-relaxed text-slate-600 dark:text-slate-300">
            集合、关系、图、逻辑——这些东西本来就不该靠背。在这里你可以把小球拖进圈里看「属于」，
            可以一条条加边看「传递性」怎么被破坏，可以单步走完 Dijkstra 看清每一步到底在算什么。
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link to={`/learn/${resumeId}`}>
              <Btn variant="primary" size="lg">
                {completed > 0 ? '继续上次的知识点' : '从第一个知识点开始'} →
              </Btn>
            </Link>
            <Link to="/map">
              <Btn variant="outline" size="lg">
                先看看知识地图
              </Btn>
            </Link>
          </div>

          <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
            目标：让任何一个愿意学的人，坐在手机或电脑前，用 10 分钟通过拖动、点击、试错真正理解一个概念，
            而不是记住一个定义。
          </p>

          {progress.summary.started > 0 ? (
            <div className="mt-5">
              <PlainSpeak>
                你已经动过 {progress.summary.started} 个知识点，走完了 {completed} 个。
                一共上线了 {readyCount} 个，慢慢来。
              </PlainSpeak>
            </div>
          ) : null}
        </div>

        <HomeDemo />
      </section>

      {/* -------------------------------------------------------- 怎么教的 */}
      <section className="mt-12">
        <h2 className="text-xl font-bold text-slate-900 sm:text-2xl dark:text-slate-50">网站规则</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {PILLARS.map((p) => (
            <Card key={p.title}>
              <div className="flex gap-3">
                <img
                  src={p.icon}
                  alt=""
                  aria-hidden="true"
                  loading="lazy"
                  decoding="async"
                  draggable={false}
                  className="h-11 w-11 shrink-0 object-contain"
                />
                <div>
                  <h3 className="font-semibold text-slate-800 dark:text-slate-100">{p.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{p.body}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
          完整版共六条铁律（还有「一次只说一件事」和「允许失败、失败不惩罚」），都写在{' '}
          <Link to="/about" className="text-a-600 underline">
            关于页
          </Link>
          。
        </p>
      </section>

      {/* ------------------------------------------------------ 知识地图预览 */}
      <section className="mt-12">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="text-xl font-bold text-slate-900 sm:text-2xl dark:text-slate-50">学习地图</h2>
          <Link to="/map">
            <Btn size="sm" variant="ghost">
              展开完整地图 →
            </Btn>
          </Link>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {modulesByStage()
            .filter((g) => g.modules.length > 0)
            .map((group) => (
              <div key={group.stage}>
                <h3 className="mb-2 text-sm font-semibold text-slate-500 dark:text-slate-400">{group.title}</h3>
                <div className="flex flex-col gap-2">
                  {group.modules.map((m) => {
                    const topics = CATALOG.filter((t) => t.moduleId === m.id)
                    const ready = topics.filter((t) => isReady(t.id)).length
                    return (
                      <Link key={m.id} to={`/m/${m.id}`} className="block">
                        <Card className="dl-transition hover:border-a-500 hover:shadow-md">
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <div className="font-semibold text-slate-800 dark:text-slate-100">{m.name}</div>
                              <div className="truncate text-xs text-slate-500 dark:text-slate-400">{m.blurb}</div>
                            </div>
                            <span
                              className={cx(
                                'shrink-0 font-mono text-xs',
                                ready > 0 ? 'text-a-600 dark:text-a-400' : 'text-slate-400',
                              )}
                            >
                              {ready}/{topics.length}
                            </span>
                          </div>
                        </Card>
                      </Link>
                    )
                  })}
                </div>
              </div>
            ))}
        </div>
      </section>

      {/* ---------------------------------------------------------- 数字 */}
      <section className="mt-12">
        <Card>
          <SectionTitle hint="全部都在你自己的浏览器里">这个站现在有什么</SectionTitle>
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { k: `${MODULES.length}`, v: '个模块' },
              { k: `${CATALOG.length}`, v: '个知识点规划' },
              { k: `${readyCount}`, v: '个已上线' },
              { k: '全绿', v: '内核单测 + 内容契约测试' },
            ].map((s) => (
              <div key={s.v}>
                <dt className="text-2xl font-black text-a-600 dark:text-a-400">{s.k}</dt>
                <dd className="text-xs text-slate-500 dark:text-slate-400">{s.v}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">
            所有算法（最短路、最小生成树、传递闭包、欧拉判定、汉诺塔……）都写成不含任何 UI 依赖的纯函数，
            并且用暴力枚举做交叉验证 —— 因为教错一个知识点，比程序崩一次严重得多。
          </p>
          <div className="mt-3">
            <Link to={`/learn/${TOPIC_BY_ID[resumeId] ? resumeId : FIRST_TOPIC}`}>
              <Btn variant="primary">现在就试一个 →</Btn>
            </Link>
          </div>
        </Card>
      </section>
    </div>
  )
}
