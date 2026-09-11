import { Link } from 'react-router-dom'

import { Btn, Card, Chip, PlainSpeak, SectionTitle } from '@/ui'
import { CATALOG } from '@/topics/catalog'
import { READY_IDS } from '@/topics/loader'

const RULES = [
  {
    n: 'R1',
    title: '先看现象，后给符号',
    body: '每个知识点必须先有一段没有任何公式的直觉动画，才允许出现第一个数学符号。正式定义永远是折叠的，需要你主动点开。',
  },
  {
    n: 'R2',
    title: '一步一屏一件事',
    body: '同一时刻屏幕上只会有一处正在变化的东西。一次只引入一个新概念。',
  },
  {
    n: 'R3',
    title: '每个动作必有即时反馈',
    body: '你做的任何操作都会立刻有回应。做错时不会只显示一个叉，而是告诉你「为什么错」。',
  },
  {
    n: 'R4',
    title: '默认路径不依赖任何前置知识',
    body: '出现的每个新词都配一句大白话。屏幕下方永远有一行旁白告诉你此刻在发生什么。',
  },
  {
    n: 'R5',
    title: '用户必须动手，而且动手是必要的',
    body: '每个知识点至少有 3 个交互环节，不操作就无法推进到下一步 —— 这不是「视频 + 播放按钮」。',
  },
  {
    n: 'R6',
    title: '允许失败，失败不惩罚',
    body: '没有计时、没有扣分、没有失败弹窗。任何一步都可以无限重试、随时回退、直接看答案然后重来。',
  },
]

const SHORTCUTS = [
  ['Tab / Shift+Tab', '在可交互对象之间移动焦点'],
  ['Enter / 空格', '激活当前聚焦的元素（选中、连线、切换）'],
  ['方向键', '移动当前聚焦的对象（画布内）'],
  ['Shift + 方向键', '快速移动（每次 4 格）'],
  ['Alt + →', '进入下一步'],
  ['Alt + ←', '回到上一步'],
  ['F', '进入 / 退出全屏（课堂上投屏讲解用）'],
  ['← →（步骤条上）', '在动画的任意一帧之间前后拖动'],
]

export default function AboutPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-3 pb-16 pt-6 sm:px-4">
      <header>
        <h1 className="text-2xl font-black text-slate-900 sm:text-3xl dark:text-slate-50">关于这个站</h1>
        <p className="mt-2 leading-relaxed text-slate-600 dark:text-slate-300">
          离散数学是计算机专业的核心基础课，但它有三个劝退点：结构看不见、符号密度高、只会背不会用。
          结果是大部分人靠刷题通过考试，考完即忘。
        </p>
      </header>

      <div className="mt-4">
        <PlainSpeak>
          这个站想做的事只有一件：把「看不见的结构」变成「可以上手拖的东西」，
          让任何一个愿意学的普通人，坐在手机或电脑前，用 10 分钟通过拖动、点击、试错真正理解一个概念 ——
          而不是记住一个定义。
        </PlainSpeak>
      </div>

      <Card className="mt-6">
        <SectionTitle hint="这就是「傻子也能看懂」的具体含义">六条铁律</SectionTitle>
        <ol className="flex flex-col gap-3">
          {RULES.map((r) => (
            <li key={r.n} className="flex gap-3">
              <span className="mt-0.5 grid h-6 w-9 shrink-0 place-items-center rounded-md bg-a-100 font-mono text-xs font-bold text-a-700 dark:bg-a-500/20 dark:text-a-300">
                {r.n}
              </span>
              <div>
                <div className="font-semibold text-slate-800 dark:text-slate-100">{r.title}</div>
                <p className="mt-0.5 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{r.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </Card>

      <Card className="mt-4">
        <SectionTitle hint="不操作就无法推进">每个知识点的五步</SectionTitle>
        <ol className="flex flex-col gap-2 text-sm">
          {[
            ['① 看一看', '生活场景引入，建立直觉，零符号'],
            ['② 玩一玩', '自由操作，自己把规律试出来'],
            ['③ 起个名', '给刚发现的东西一个正式名字和符号'],
            ['④ 练一练', '在即时反馈中固化，选错会解释为什么'],
            ['⑤ 换个场景', '变换情境，验证是不是真懂了'],
          ].map(([k, v]) => (
            <li key={k} className="flex gap-3">
              <span className="w-20 shrink-0 font-medium text-slate-700 dark:text-slate-200">{k}</span>
              <span className="text-slate-600 dark:text-slate-300">{v}</span>
            </li>
          ))}
        </ol>
      </Card>

      <Card className="mt-4">
        <SectionTitle hint="不摸鼠标也能全部走完">键盘操作</SectionTitle>
        <p className="mb-3 text-sm text-slate-600 dark:text-slate-300">
          全站的核心流程都能只用键盘完成。画布里的每个元素都可以 Tab 聚焦，然后用方向键操作 ——
          这不是附加功能，是交付门槛。
        </p>
        <dl className="flex flex-col gap-2">
          {SHORTCUTS.map(([k, v]) => (
            <div key={k} className="flex flex-wrap items-baseline gap-2">
              <dt>
                <kbd className="rounded-md border border-slate-300 bg-slate-50 px-2 py-0.5 font-mono text-xs text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200">
                  {k}
                </kbd>
              </dt>
              <dd className="text-sm text-slate-600 dark:text-slate-300">{v}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <Card className="mt-4">
        <SectionTitle>无障碍与其他</SectionTitle>
        <ul className="flex flex-col gap-2 text-sm text-slate-600 dark:text-slate-300">
          <li>· 颜色只是辅助：每种语义色都同时带有文字或形状，红绿色盲也能区分。</li>
          <li>· 尊重系统的「减少动态效果」设置，也可以在显示设置里手动关掉动画。</li>
          <li>· 画布上的每次变化都会通过读屏播报出来，例如「小球 3 已加入集合 A」。</li>
          <li>· 字号可以在显示设置里放大到 150%，布局会自动适应而不是破版。</li>
          <li>· 深色模式、高对比度、课堂投屏模式都已支持。</li>
        </ul>
      </Card>

      <Card className="mt-4">
        <SectionTitle>关于正确性</SectionTitle>
        <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          教学产品最不能容忍的错误是「教错了」。所以所有算法都写成了不依赖任何界面代码的纯函数，
          并且用<b>暴力枚举做交叉验证</b>：最短路结果要和枚举所有路径比、最小生成树要和枚举所有边组合比、
          欧拉判定要和穷举所有走法比、传递闭包要和 Warshall 矩阵算法比。
          另有一套「内容契约测试」：自动检查每个知识点的五步结构、提示条数、误解清单，
          以及文案里有没有出现「显然」「易证」这类劝退词。
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Chip tone="ok">内核单测 + 内容契约测试全绿</Chip>
          <Chip tone="a">规划知识点 {CATALOG.length} 个</Chip>
          <Chip tone="dim" showGlyph={false}>
            已上线 {READY_IDS.length} 个
          </Chip>
        </div>
      </Card>

      <Card className="mt-4">
        <SectionTitle>你的数据</SectionTitle>
        <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          进度、提示使用次数、「这一步没看懂」的记录，全部只存在你这台设备的浏览器本地存储里，
          不会上传到任何服务器，也不含任何能识别你身份的信息。你可以随时在
          <Link to="/progress" className="mx-1 text-a-600 underline">
            我的进度
          </Link>
          页面清除全部记录。
        </p>
      </Card>

      <div className="mt-6 flex flex-wrap gap-3">
        <Link to="/map">
          <Btn variant="primary">开始学 →</Btn>
        </Link>
        <Link to="/progress">
          <Btn variant="outline">看看我的进度</Btn>
        </Link>
      </div>
    </div>
  )
}
