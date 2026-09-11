# 离散实验室 · DiscreteLab

> 用**可以上手拖的交互式动画**讲离散数学。目标不是让你记住定义，而是让你在 10 分钟内通过拖动、点击、试错真正理解一个概念。

**在线试用 → <https://violet-sept.github.io/GenshinImpact-Math/>**

[![Deploy to GitHub Pages](https://github.com/violet-sept/GenshinImpact-Math/actions/workflows/deploy.yml/badge.svg)](https://github.com/violet-sept/GenshinImpact-Math/actions/workflows/deploy.yml)
[![CI](https://github.com/violet-sept/GenshinImpact-Math/actions/workflows/ci.yml/badge.svg)](https://github.com/violet-sept/GenshinImpact-Math/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](#开源协议与第三方素材)
[![Node](https://img.shields.io/badge/node-%3E%3D22.12-brightgreen.svg)](https://nodejs.org)

---

## 这个站在做什么

离散数学有三个劝退点：**结构看不见**、**符号密度高**、**只会背不会用**。结果是大部分人靠刷题通过考试，考完即忘。

这里想做的事只有一件：**把看不见的结构变成可以上手拖的东西**。

- 把小球拖进圈里，就理解了「属于」和「子集」
- 点一下关系矩阵的格子，有向图当场长出一条边
- 亲手试试那七座桥，试到放弃之后，你会服气地接受欧拉的结论
- 自己决定下一步确定哪个点，才知道 Dijkstra 为什么要挑「当前最小」的那个

为了「让派蒙也能看懂」，规划书 §3 定了六条铁律，落到代码里是这样的：

| 铁律 | 落点 |
| --- | --- |
| 先看现象，后给符号 | 正式定义默认**折叠**，需要用户主动点开 |
| 一步一屏一件事 | 动画规范 + 算法返回**步骤序列**而非最终答案 |
| 每个动作必有即时反馈 | 答错必须解释「为什么错」，用橙色而不是纯红 |
| 默认路径不依赖前置知识 | 屏幕下方常驻一句大白话旁白；术语同屏解释 |
| 用户必须动手 | 至少 3 个步骤**不操作就无法推进** |
| 允许失败不惩罚 | 无计时、无扣分、可无限重试、可随时看答案后回退 |

完整的目标、范围、教学设计、排期与验收标准见
[`docs/离散数学交互式动画教学网站-项目规划书.md`](./docs/离散数学交互式动画教学网站-项目规划书.md)。

---

## 快速开始

```bash
git clone https://github.com/violet-sept/GenshinImpact-Math.git
cd GenshinImpact-Math
npm install
npm run dev          # 开发服务器，默认 http://localhost:5173
npm test             # 算法内核单测 + 内容契约测试（211 项）
npm run build        # 类型检查 + 生产构建，产出 dist/
npm run preview      # 本地预览 dist/，默认 http://localhost:4173
```

要求 Node **≥ 22.12**（Vite 8 的下限）。

`dist/` 用的是**相对路径**（`base: './'`）+ **HashRouter**，所以可以直接丢到任何静态托管或子目录里，不需要配 URL 重写。

> Windows 上想双击就跑，可以直接用 `start-site.cmd`：它会按需构建、起本地服务、再自动打开浏览器。

---

## 部署到 GitHub Pages

仓库已经配好工作流，**推上去就能自动上线**。

### 首次设置（只做一次）

1. 在 GitHub 上建一个空仓库，把本地代码推上去：

   ```bash
   git remote add origin git@github.com:violet-sept/GenshinImpact-Math.git
   git push -u origin main
   ```

2. 打开仓库的 **Settings → Pages**，把 **Source** 选成 **GitHub Actions**。
   （不要选「Deploy from a branch」—— 本站由工作流产出 `dist/` 工件再发布。）

3. 完事。之后再往 `main` 推任何提交，都会自动：类型检查 → 测试 → 构建 → 发布。
   站点地址：<https://violet-sept.github.io/GenshinImpact-Math/>

### 为什么不需要额外配置

- **不用改 `base`**：`base: './'` 产出相对路径，放在 `/仓库名/` 这种子路径下照样能跑到正确的资源。
- **不用配 404 重写**：路由是 `HashRouter`，刷新任意页面都不会 404，静态托管不需要 fallback 规则。
- **不用手推 `gh-pages` 分支**：用官方 Pages 工件发布，没有脏分支。

### 工作流

| 文件 | 触发 | 干什么 |
| --- | --- | --- |
| [`.github/workflows/ci.yml`](./.github/workflows/ci.yml) | PR、push 到 main | 类型检查 + 测试 + 构建（**不发布**） |
| [`.github/workflows/deploy.yml`](./.github/workflows/deploy.yml) | push 到 main、手动 | 同上三道门禁，通过后发布到 Pages |

两份刻意分开：PR 不该发布。部署工作流里也跑了测试 ——
**宁可发布失败，也不要发一个白屏的站点上去**。

### 动态壁纸：开箱即用

壁纸视频不在仓库里（原因见下一节），但**线上站默认就有壁纸** ——
`deploy.yml` 里已经写好了默认地址，指向本仓库自己 v1.0 Release 的附件：

```
https://github.com/violet-sept/GenshinImpact-Math/releases/download/v1.0/nahida.mp4
```

所以**不需要配置任何东西**。想换成自己的存储（比如国内 CDN）再覆盖它：

1. 把视频传到你自己的图床 / CDN / 对象存储，拿到**直链**；
2. 仓库 **Settings → Secrets and variables → Actions → Variables → New variable**；
3. 名称 `VITE_WALLPAPER_URL`，值为新直链。工作流会用 `vars.VITE_WALLPAPER_URL || '<默认值>'` 取它。

> 放在 Release 而不是 Pages 上是有意的：Release 附件不占 GitHub Pages 那 100GB/月的软带宽，
> 也绕开了 Pages 单文件体积的顾虑 —— 否则每次打开页面下载 135MB，一个月大约只够 700 多次访问就被限流。

---

## 关于动态壁纸（为什么仓库里没有那段视频）

原来 `public/wallpaper/nahida.mp4` 有 **135MB**。它进不了仓库，有三个独立的原因：

1. **GitHub 硬上限**：单文件超过 100MB，`git push` 会被直接拒绝 —— 有它在，这个仓库根本推不上去。
2. **版权**：壁纸画面来自《原神》，和站内表情包一样属于米哈游素材（见 [THIRD-PARTY-NOTICES.md](./THIRD-PARTY-NOTICES.md)）。
3. **带宽**：135MB 的自动播放视频意味着每打开一次页面就要下载 135MB。GitHub Pages 每月 100GB 软带宽大约只够 **700 多次访问**就被限流。

所以壁纸改成了**可选外链**，三种情况：

| 场景 | 怎么做 |
| --- | --- |
| 本机开发想看壁纸 | 什么都不用配。把任意 mp4 命名成 `nahida.mp4` 放进 `public/wallpaper/` 即可（`npm run dev` 和 `start-site.cmd` 都会自动用它） |
| 线上站也要壁纸 | **已经配好了** —— `deploy.yml` 默认指向本仓库 v1.0 Release 的附件（见上一节） |
| 想换成自己的地址 | 设仓库变量 `VITE_WALLPAPER_URL` 覆盖默认值 |
| 完全不要壁纸 | 把默认值清空即可，页面会自动退回纯主题色背景 |

**没有视频时不会出现「毛玻璃压在空白上」。** 这一层是刻意做的：
壁纸模式下卡片与面板都是半透明毛玻璃、颜色取自背后的画面；如果视频加载不出来还留着毛玻璃，
卡片就会半透明地压在一片空白上，正文对比度直接不达标。所以：

- 构建期就知道这次有没有壁纸（`vite.config.ts` 按 mode + 环境变量判定），
  没有的话**连 `<video>` 都不渲染**，也不会发一个必然 404 的请求；
- 首屏内联脚本拿到的是同一个布尔值，不会先铺毛玻璃再撤回；
- 万一外链失效（地址填错 / 文件被删），`<video>` 的 `onError` 会通知 `settings` 把整层收掉，退回纯主题色背景；
- 没有壁纸可放时，「显示设置」里的那一项**整组都不出现** —— 留一个按了没反应的开关只会误导人。

细节见 `src/platform/settings.tsx`、`src/layout/DynamicWallpaper.tsx`、`public/wallpaper/README.md` 与 [`.env.example`](./.env.example)。

---

## 这个站现在有什么

| | |
| --- | --- |
| 模块 | 9 个（逻辑、集合、关系、计数、图论、树、布尔代数、代数结构、自动机） |
| 规划知识点 | 25 个 |
| **已上线知识点** | **21 个**（规划书 §4.3 的 MVP 清单 15 个已全部覆盖） |
| 自动测试 | **211 项**（62 项算法内核 + 149 项内容契约），全绿 |
| 交互原语 | 4 个共享组件（Venn / GraphView / MatrixGrid / TruthTableView） |
| 构建产物 | `dist/` 约 **1.9MB**（不含可选的壁纸视频） |

尚未上线的 4 个（L4 推理规则、S3 幂集与笛卡尔积、R3 关系的闭包、R4 等价关系与划分）
在地图与知识点页会明确显示「正在制作」，而不是假装能点。

MVP 清单对照（规划书 §4.3）：`L1 L2 L3 · S1 S2 S4 · R1 R2 · C1 C2 C5 · G1 G3 G5 · B1` ✅ 全部上线。
额外完成：`S7 C4 G2 G6 G7 T2`。

---

## 技术栈

| 层 | 选型 |
| --- | --- |
| 构建 | **Vite 8** + TypeScript（`strict`，含 `noUnusedLocals`） |
| 框架 | **React 19** + React Router 7（HashRouter） |
| 样式 | **Tailwind CSS 4**（`@theme` 定义设计令牌，`@custom-variant` 实现深色/高对比） |
| 动画 | **Motion 13**（仅用于步骤切换与通关庆祝） |
| 图形 | **原生 SVG**（无 D3、无 Canvas、无 WebGL） |
| 状态 | React 内置（Context + useState）。进度持久化在 `localStorage` |
| 测试 | **Vitest 5**（算法内核 + 内容契约） |
| 部署 | **GitHub Actions → GitHub Pages** |

### 与规划书的技术栈偏离说明

规划书 §7.1 推荐 **Next.js 15**。本项目改用 **Vite + React**，理由如下：

1. **包体预算是硬性指标**。规划书 §8.5 要求「知识点页 JS 首包 ≤ 180KB（gzip）」，而 Next.js 仅框架运行时就占掉大半。实测当前知识点页首包约 **149KB**，用 Vite 还能留出余量。
2. **SSG 在本项目收益接近零**。知识点页几乎全是客户端交互画布，用 Next.js 就得整页 `'use client'`，服务端渲染那点优势被抵消掉，反而多背一套运行时。
3. **部署更简单**。产出纯静态文件 + HashRouter，任何静态托管都能跑（GitHub Pages 也不需要任何重写规则），也符合规划书「优先国内可用（备案 + CDN）」的部署考虑。
4. **迁移成本低**。项目里全是标准 React 组件，没有用到任何 Vite 特有 API；若要迁到 Next.js，只需替换路由与入口。

其余选型（Tailwind、Motion、SVG 优先、纯函数内核、localStorage 进度）与规划书一致。
规划书里提的 **D3.js** 也被去掉了：需要的布局算法（力导向、树、圆周）只有百来行，自己实现反而能保证**确定性**（同一张图每次打开长得一模一样），这对教学和视觉回归测试都重要。

---

## 目录结构

```
GenshinImpact-Math/                ← 仓库根
├─ src/
│  ├─ kernels/              ★ 算法内核：纯函数、零 React 依赖、可穷举单测
│  │  ├─ logic.ts           命题逻辑：Expr AST / 真值表 / 永真式 / 德摩根
│  │  ├─ sets.ts            集合运算 / 子集判定 / 幂集 / 笛卡尔积
│  │  ├─ relations.ts       三视图 / 性质判定（带反例证人）/ 闭包
│  │  ├─ counting.ts        排列组合 / 四种计数模型 / 汉诺塔 / 杨辉三角
│  │  ├─ graph.ts           度数与连通性 / 欧拉判定 / 一笔画校验 / Dijkstra / Kruskal / 着色
│  │  ├─ layout.ts          确定性布局：圆周 / 力导向 / 树
│  │  ├─ types.ts           Step<S>：步骤序列契约
│  │  └─ kernels.test.ts    62 项内核单测
│  ├─ platform/             平台层：响应式 / 输入抽象 / 设置 / 进度 / 播报
│  │  ├─ settings.tsx       主题 / 字号 / 动画开关 / 高对比 / 课堂模式 / 动态壁纸
│  │  ├─ progress.tsx       学习进度 + 提示使用统计（localStorage）
│  │  ├─ useResponsive.ts   五档断点（xs/sm/md/lg/xl）
│  │  ├─ useSvgDrag.ts      Pointer Events 拖拽 + **键盘等价操作**
│  │  ├─ useStepper.ts      步骤播放器（单步 / 回退 / 时间旅行 / 变速）
│  │  └─ announcer.tsx      屏幕阅读器 aria-live 播报
│  ├─ ui/                   UI 组件库（约 20 个），内建无障碍
│  ├─ primitives/           ★ 交互原语：VennDiagram / GraphView / MatrixGrid / TruthTableView
│  ├─ topics/               ★ 知识点
│  │  ├─ types.ts           Topic / StageSpec / StageCtx 契约
│  │  ├─ catalog.ts         25 个知识点的轻量元数据（供地图/首页同步引用）
│  │  ├─ hooks.ts           useSolveOnce / useTriedSet
│  │  ├─ loader.ts          import.meta.glob 自动发现 + 路由级代码分割
│  │  ├─ content.test.tsx   149 项内容契约测试
│  │  └─ impl/<ID>.tsx      每个知识点的实现
│  ├─ learn/                TopicPage（五步法运行器）+ 首页演示
│  ├─ pages/                首页 / 知识地图 / 模块 / 进度 / 术语表 / 沙盒 / 关于
│  ├─ layout/               响应式外壳 + 设置面板 + 动态壁纸
│  ├─ assets/
│  │  ├─ big-idea/          21 张「一句话本质」配图（按知识点 id 命名，glob 自动发现）
│  │  └─ rules/             4 张「网站规则」配图
│  └─ index.css             设计令牌 + 动态壁纸模式的毛玻璃规则
├─ public/
│  ├─ wallpaper/            动态壁纸视频（**仓库里是空的**，见该目录 README）
│  └─ .nojekyll             防止 static 托管走 Jekyll 处理
├─ docs/                    项目规划书
├─ tools/                   开发辅助脚本（表情包抽取与白底抠图）
├─ scripts/exec-shim.cjs    受限环境兼容垫片（见下）
├─ .github/workflows/       CI 与 Pages 部署
├─ .env.example             环境变量说明
├─ LICENSE                  MIT（仅覆盖代码）
└─ THIRD-PARTY-NOTICES.md   第三方素材版权声明
```

---

## 三层架构与两条铁律

### 分层

```
内容层   topics/impl/*.tsx        每个知识点的五步脚本与交互
编排层   learn/TopicPage.tsx      步骤机 + 三级提示 + 进度
原语层   primitives/              Venn / Graph / Matrix / TruthTable
内核层   kernels/                 纯函数算法，100% 可测
平台层   platform/                响应式 / 输入 / 无障碍 / 持久化
```

**内核层必须零 React 依赖**。这不是洁癖，而是三个实际好处：
① 能用单测穷举验证数学正确性（教学产品最不能容忍「教错了」）；
② 同一份算法既能驱动动画，也能被沙盒页直接复用；
③ 未来可复用到命令行工具或题库。

### 铁律一：算法返回「步骤序列」，而不是「最终答案」

```ts
// kernels/graph.ts
export function dijkstra(g: Graph, start: string): Step<DijkstraState>[]
```

因为算法已经把每一帧的状态快照都算好了，前端的 `next / prev / goTo` 全部是纯索引移动 ——
**暂停、回退、单步、时间旅行、分享链接全部免费**。这正是「交互式动画」相对一段视频的全部价值。

### 铁律二：不操作就不能推进

每个知识点的 5 个步骤里，至少 3 个带有真实交互，且 `requireSolve` 默认是 `true`：
未完成时「下一步」按钮是禁用的，并给出一句温和的说明（而不是硬邦邦的错误）。
完成判定统一走 `useSolveOnce(ctx, 条件)` —— 它保证条件成立时只触发一次，
条件不再成立时自动解除（用户改回错误状态后可以再次通关），避免 effect 无限循环。

---

## 怎么新增一个知识点

1. 在 `src/topics/catalog.ts` 里加一条元数据（id / title / moduleId / oneLiner / prerequisites / difficulty / minutes）。
2. 在 `src/topics/impl/<ID>.tsx` 里 `export default` 一个 `Topic` 对象。
3. 往 `src/assets/big-idea/<ID>.png` 放一张配图（内容契约测试会检查它在不在）。

**不需要改任何注册表** —— `loader.ts` 用 `import.meta.glob('./impl/*.tsx')` 自动发现，
`src/assets/big-idea/index.ts` 同样用 glob 自动收集配图，
并且 Vite 会自动把知识点切成独立 chunk（进入该知识点才下载）。

最小骨架：

```tsx
import { useState } from 'react'
import { PlainSpeak, Card } from '@/ui'
import { Quiz } from '@/ui/Quiz'
import { useSolveOnce } from '../hooks'
import type { StageCtx, Topic } from '../types'

function ExploreStage({ ctx }: { ctx: StageCtx }) {
  const [done, setDone] = useState(false)
  useSolveOnce(ctx, done)
  return <button onClick={() => setDone(true)}>动手试试</button>
}

const topic: Topic = {
  id: 'X1',
  title: '……',
  moduleId: '……',
  oneLiner: '……',
  outcome: '学完你能做到……',
  prerequisites: [],
  bigIdea: '一句话本质',
  misconceptions: [{ wrong: '常见错误想法', right: '正确理解' }],
  formalDefinition: <>……</>,
  glossary: [{ term: '术语', plain: '大白话', formal: '正式写法' }],
  stages: [
    { label: '① 看一看', narration: '……', hints: ['H1', 'H2', 'H3'], render: (ctx) => <ExploreStage ctx={ctx} /> },
    /* 共 5 项，顺序固定 */
  ],
}
export default topic
```

### 写作规范（会被评审打回的红线）

- ❌ 「显然」「易证」「由定义立得」「众所周知」
- ❌ 一屏堆 3 个以上公式（正式定义放 `formalDefinition`，默认折叠）
- ❌ 答错只标红、不解释为什么
- ❌ 用红色叉号表示错误（用橙色，降低焦虑，也兼顾色觉障碍）
- ❌ 一个 stage 里同时出现定义 + 例子 + 反例 + 定理
- ✅ 每个 stage 的 `hints` 恰好 3 条：H1 只指方向 / H2 具体指路 / H3 完整答案
- ✅ 旁白尽量 ≤ 25 字，且屏幕下方永远有一句人话

前三类红线里，前两类**已经写成会自动失败的测试**（见下节），不是靠人自觉。

---

## 测试

```bash
npm test
```

共 211 项，分两层。

### 一、算法内核（62 项）

重点不是「跑通」而是**与独立实现交叉验证**：

| 被测算法 | 交叉验证方式 |
| --- | --- |
| 欧拉判定 | 枚举 4 点 5 边图的全部 31 个子图，与「穷举所有走法」的暴力搜索逐一比对 |
| 柯尼斯堡七桥 | 暴力搜索确认无解 |
| Dijkstra | 与「枚举所有简单路径取最小」比对；并验证每步的 settled 不变量 |
| 路径还原 | 还原出的路径权重必须严格等于 `dist` |
| Kruskal | 与「枚举所有 n−1 条边组合取最小连通」比对 |
| 传递闭包 | 与 Warshall 矩阵算法比对；并验证最小性（去掉任一新边就不再传递） |
| 排列组合 | P(n,k) / C(n,k) 与暴力枚举比对（n ≤ 10）；并验证帕斯卡递推 |
| 汉诺塔 | 真实模拟每一步，验证大盘不压小盘，且步数严格等于 2ⁿ−1 |
| 真值表 | 逐行求值必须与 `evalExpr` 一致 |
| 布局 | 同输入必然同输出（视觉回归基线的前提） |

之所以下这个功夫：**一根画错的边、一个错误的松弛顺序，会让学生形成错误认知，代价远高于一次崩溃。**

### 二、内容契约（149 项 = 21 个知识点 × 7 + 2）

`src/topics/content.test.tsx` 把规划书里的**写作规范变成了 CI 断言**。每个知识点都会被检查：

| 检查项 | 对应铁律 |
| --- | --- |
| 能被加载，且 `id` 与文件名一致 | 元数据与实现不能漂移 |
| 恰好 5 个步骤 | 五步法 |
| 每个步骤都有旁白、恰好 3 条提示（H1/H2/H3）、能 SSR 渲染不抛异常 | 规划书 §3.4 三级脚手架；数组越界这类错误构建期发现不了，但用户一点开就白屏 |
| 至少 3 个步骤要求交互才能推进 | 铁律 R5「不操作不能推进」 |
| 至少 2 条典型误解 | 规划书 §10.3 的 DoD |
| 至少 4 条术语且都有大白话 | 同上 |
| 文案里不含「显然 / 易证 / 由定义立得 / 众所周知」 | 规划书 §3.2 反面清单 |

外加 2 项全局检查：至少有一个已实现的知识点；每个已实现的知识点都配好了「一句话本质」配图。

最后一条尤其值得一提：**把「不要写显然」写成会失败的测试**，比写在文档里靠人自觉有效得多。
（规则里刻意不收单字词如「略」——「忽略孤立点」会被误判成在说「证明略」，中文没有词边界，
宁可少收几个也不要制造假阳性让规则失去信任。）

---

## 响应式与无障碍

### 断点（按「内容形态」划分，不按「设备」）

| 名称 | 宽度 | 布局 |
| --- | --- | --- |
| `xs` | < 480px | 单列堆叠，控制条在拇指热区，底部标签栏导航 |
| `sm` | 480–767px | 单列，舞台放大 |
| `md` | 768–1023px | 单列 + 侧栏下沉 |
| `lg` | 1024–1439px | 左右分栏（舞台 + 侧栏） |
| `xl` | ≥ 1440px | 同 lg，另可开「课堂模式」（字号放大、隐藏次要信息） |

### 三种输入统一

`useSvgDrag` 把触摸 / 鼠标 / 键盘映射到**同一个语义事件 `onMove(id, pt)`**：

- 触摸/鼠标：Pointer Events + `setPointerCapture`
- 键盘：`Tab` 聚焦 → 方向键移动（每次 5 单位，`Shift` 加速到 4 倍）

因此「纯键盘完成全部交互流程」不是额外工作量，而是原语自带的能力。

### 其他

- 每个语义色都同时带**文字或形状冗余**（`Chip` 组件自动加 `●▲✓!◆○`），色盲用户也能区分
- 尊重 `prefers-reduced-motion`，也可在设置里手动关动画（关闭后动画时长压到 1ms）
- `Announcer` 用 `aria-live` 播报画布状态变化
- 字号可放大到 150%，用 `--dl-font-scale` 驱动 `html { font-size }`
- 主题：浅色 / 深色（默认）/ 跟随系统；另有高对比度主题（投影仪场景）
- 路由切换后焦点移到 `#dl-main`，读屏用户不用重新 Tab 一遍导航

---

## 性能预算实测

| 指标 | 预算 | 实测 |
| --- | --- | --- |
| 首屏 JS（gzip） | ≤ 500KB | **~108KB**（index 94.6 + Home 4.7 + CSS 8.3） |
| 知识点页 JS（gzip） | ≤ 180KB | **~149KB**（最重的 C2 也只有 ~10KB 的独立 chunk） |
| 全站 JS+CSS 总量（gzip，按需加载） | — | ~372KB |
| `dist/` 体积 | — | ~1.9MB（不含可选的壁纸视频） |

手段：路由级代码分割（38 个 chunk，每个知识点独立）、无 D3、无 KaTeX（公式用等宽字体）、图片全为内联 SVG 或小尺寸 PNG。
构建产物里 `TopicPage` 那一块（46KB gzip）主要是 Motion —— 它是唯一为动画引入的运行时依赖。

---

## 开源协议与第三方素材

**代码**以 [MIT](./LICENSE) 授权，随便用。

但仓库里有一部分**不属于我、也不在 MIT 覆盖范围内**的美术素材：`src/assets/big-idea/`（21 张）
与 `src/assets/rules/`（4 张）来自游戏《原神》的官方表情包，版权归**米哈游 / COGNOSPHERE** 所有。

本项目是**非商业的、以学习为目的的同人作品**，不售卖、不投放广告、不做商业变现，
也不表示米哈游对本项目的认可或背书。**fork 之后如果要用在商业场景，请把这几张图换成你自己的素材** ——
「一句话本质」配图按知识点 id 命名（`L1.png`、`C5.png`…）放进 `src/assets/big-idea/` 就会自动生效，
不需要改任何代码。

完整声明见 [THIRD-PARTY-NOTICES.md](./THIRD-PARTY-NOTICES.md)。

---

## 关于 `scripts/exec-shim.cjs`

**正常开发机上你不需要它，直接 `npm run dev` / `npm run build` 即可。** CI 用的也是普通脚本。

某些受限沙箱环境禁止 Node 通过「管道 stdio」捕获子进程输出，此时 `child_process.exec()` 会**同步抛出** `EPERM`。
而 Vite 在 Windows 上会执行 `net use` 来探测网络驱动器映射（`optimizeSafeRealPathSync`）——
本地磁盘场景下这一步完全不必要。该垫片让它在失败时安静降级。

如果 `npm run build` 在你的环境里报 `EPERM spawn EPERM`，改用：

```bash
npm run dev:shim
npm run build:shim
```

---

## 数据与隐私

进度、提示使用次数、「这一步没看懂」的记录，全部只存在浏览器 `localStorage`：

- `dl.progress.v1` —— 学习进度
- `dl.settings.v1` —— 显示设置

不含任何可识别身份的信息，不上传任何服务器，用户可在「我的进度」页一键清除。

---

## 已知限制 / 后续工作

- 知识点目录里 25 个已规划、21 个已上线。剩下 4 个（L4 推理规则、S3 幂集与笛卡尔积、
  R3 关系的闭包、R4 等价关系与划分）会显示「正在制作」而不是假装能点。
- **尚未做真人可用性测试。** 规划书 §11.2 要求「非 CS 背景用户无提示通关率 ≥ 50%」，
  这是「傻子也能懂」的硬门槛，但目前只有设计和自检，没有实测数据。
  上线前应当找 5–8 位非计算机背景的人，不讲解、只看，记录卡点与提示层级分布。
- 沙盒页目前是图论沙盒（搭图 / 最短路 / 最小生成树 / 着色），集合与逻辑沙盒待补。
- 尚无 E2E 与视觉回归测试（规划书 §11.1 的 Playwright 多视口矩阵）。
  内容契约测试覆盖了「能渲染 + 结构完整」，但没有覆盖「点下去会发生什么」。
- 无障碍经过设计与人工走查（键盘通路是原语内建的），但**尚未跑 axe-core 自动化扫描**，
  也没有经过真实读屏软件用户的验证。
- 服务端能力（账号、跨设备同步、教师布置任务）按规划书 v1 的范围刻意不做。
- 数学正确性有交叉验证兜底，但**仍需一位学科教师逐条复核术语与符号表述**（规划书 §11.3）。

---

## 贡献

欢迎提 issue 和 PR。改内容之前请先读上面的「写作规范」与「测试」两节 ——
那些红线大多已经写成会自动失败的测试，本地 `npm test` 跑一遍就知道有没有踩到。
提交前请确保这三条都是绿的：

```bash
npm run typecheck && npm test && npm run build
```
