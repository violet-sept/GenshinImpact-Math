/**
 * 知识点目录（轻量元数据）。
 *
 * 刻意与具体交互实现分离：目录要在首页 / 知识地图 / 搜索里被同步引用，
 * 而每个知识点的交互代码只应在进入它时才下载（路由级代码分割，见规划书 §8.5）。
 */

export interface ModuleDef {
  id: string
  name: string
  /** 所属阶段（1 入门 → 4 进阶），决定知识地图的行 */
  stage: 1 | 2 | 3 | 4
  blurb: string
}

export const MODULES: ModuleDef[] = [
  { id: 'logic', name: '逻辑与证明', stage: 1, blurb: '把「说话」变成可以计算的符号' },
  { id: 'sets', name: '集合与函数', stage: 1, blurb: '把「一堆东西」和「对应关系」说清楚' },
  { id: 'relations', name: '关系', stage: 2, blurb: '元素之间的连接方式，以及它有什么性质' },
  { id: 'counting', name: '组合计数', stage: 2, blurb: '不一个一个数，也能算出一共有多少种' },
  { id: 'graph', name: '图论', stage: 3, blurb: '点和线构成的网络：怎么走、怎么连最省' },
  { id: 'trees', name: '树', stage: 3, blurb: '没有环的图，天然适合表达层次结构' },
  { id: 'boolean', name: '布尔代数与数字逻辑', stage: 3, blurb: '从逻辑表达式到真实电路' },
  { id: 'algebra', name: '代数结构', stage: 4, blurb: '运算本身可以被研究' },
  { id: 'automata', name: '形式语言与自动机', stage: 4, blurb: '机器如何识别一串符号' },
]

export interface TopicMeta {
  id: string
  title: string
  moduleId: string
  /** 一句话说清学什么 */
  oneLiner: string
  /** 地图/首页上的吸引句 */
  hookTeaser: string
  prerequisites: string[]
  /** 难度 1–3 */
  difficulty: 1 | 2 | 3
  /** 预估分钟数 */
  minutes: number
}

export const CATALOG: TopicMeta[] = [
  /* ---------------------------------------------------------- 逻辑与证明 */
  {
    id: 'L1',
    title: '命题与联结词',
    moduleId: 'logic',
    oneLiner: '把「而且」「或者」「不是」变成能算的开关',
    hookTeaser: '两个开关串起来和并起来，灯泡什么时候亮？',
    prerequisites: [],
    difficulty: 1,
    minutes: 7,
  },
  {
    id: 'L2',
    title: '真值表与永真式',
    moduleId: 'logic',
    oneLiner: '把所有可能情况排成一张表，一眼看出真假',
    hookTeaser: '为什么「如果下雨我就带伞」在下雨却没带伞时才算说谎？',
    prerequisites: ['L1'],
    difficulty: 1,
    minutes: 8,
  },
  {
    id: 'L3',
    title: '逻辑等价与德摩根律',
    moduleId: 'logic',
    oneLiner: '两个看起来不一样的式子，其实说的是同一件事',
    hookTeaser: '「不是（又高又帅）」到底等于什么？',
    prerequisites: ['L1', 'L2'],
    difficulty: 2,
    minutes: 8,
  },
  {
    id: 'L4',
    title: '推理规则与证明',
    moduleId: 'logic',
    oneLiner: '从已知出发，一步步必然地推出结论',
    hookTeaser: '福尔摩斯是怎么排除掉所有不可能的？',
    prerequisites: ['L2'],
    difficulty: 2,
    minutes: 9,
  },

  /* ---------------------------------------------------------- 集合与函数 */
  {
    id: 'S1',
    title: '集合与子集',
    moduleId: 'sets',
    oneLiner: '把东西装进圈里，并判断谁装得下谁',
    hookTeaser: '把数字拖进圈里，看看「包含」到底是什么感觉。',
    prerequisites: [],
    difficulty: 1,
    minutes: 7,
  },
  {
    id: 'S2',
    title: '集合的运算',
    moduleId: 'sets',
    oneLiner: '并、交、差：两个圈之间能玩出的四种花样',
    hookTeaser: '两筐水果倒在一起、只留都有的、只留独有的 —— 拖一下就看懂。',
    prerequisites: ['S1'],
    difficulty: 1,
    minutes: 8,
  },
  {
    id: 'S3',
    title: '幂集与笛卡尔积',
    moduleId: 'sets',
    oneLiner: '一个集合能生出多少个子集？两个集合能配出多少对？',
    hookTeaser: '3 个元素居然能变出 8 个子集，它是怎么长出来的？',
    prerequisites: ['S1'],
    difficulty: 2,
    minutes: 8,
  },
  {
    id: 'S4',
    title: '函数与映射',
    moduleId: 'sets',
    oneLiner: '单射、满射、双射：连线的方式决定了一切',
    hookTeaser: '拉几根箭头，看看什么时候两个集合能「一一配上对」。',
    prerequisites: ['S1'],
    difficulty: 2,
    minutes: 9,
  },
  {
    id: 'S7',
    title: '鸽巢原理',
    moduleId: 'sets',
    oneLiner: '东西比抽屉多，就一定有一个抽屉塞了两样',
    hookTeaser: '13 个人里为什么必有两个人同月生日？把鸽子拖进洞试试。',
    prerequisites: ['S1'],
    difficulty: 1,
    minutes: 6,
  },

  /* ---------------------------------------------------------------- 关系 */
  {
    id: 'R1',
    title: '二元关系与三种表示',
    moduleId: 'relations',
    oneLiner: '有序对、矩阵、有向图 —— 同一件事的三种画法',
    hookTeaser: '点一下矩阵格子，关系图会当场长出一条边。',
    prerequisites: ['S1'],
    difficulty: 2,
    minutes: 9,
  },
  {
    id: 'R2',
    title: '关系的性质',
    moduleId: 'relations',
    oneLiner: '自反、对称、传递：三个性质撑起整个关系论',
    hookTeaser: '每加一条边，系统就告诉你是哪一条破坏了传递性。',
    prerequisites: ['R1'],
    difficulty: 2,
    minutes: 10,
  },
  {
    id: 'R3',
    title: '关系的闭包',
    moduleId: 'relations',
    oneLiner: '不够传递？把缺的边一条条补上',
    hookTeaser: '看着「间接到达」一步步变成「直接到达」。',
    prerequisites: ['R2'],
    difficulty: 3,
    minutes: 9,
  },
  {
    id: 'R4',
    title: '等价关系与划分',
    moduleId: 'relations',
    oneLiner: '互相「等价」的东西会自动抱成一团',
    hookTeaser: '元素自己按等价关系站好了队，你只需要看着它分堆。',
    prerequisites: ['R2'],
    difficulty: 2,
    minutes: 8,
  },

  /* ------------------------------------------------------------ 组合计数 */
  {
    id: 'C1',
    title: '加法与乘法原理',
    moduleId: 'counting',
    oneLiner: '「分类」用加法，「分步」用乘法',
    hookTeaser: '从家到学校有几条路？走一遍树状图就明白了。',
    prerequisites: [],
    difficulty: 1,
    minutes: 7,
  },
  {
    id: 'C2',
    title: '排列与组合',
    moduleId: 'counting',
    oneLiner: '顺序算不算数、能不能重复选 —— 四种情况一次讲清',
    hookTeaser: '同一个小球拖进盒子，公式会当场跟着变。',
    prerequisites: ['C1'],
    difficulty: 2,
    minutes: 10,
  },
  {
    id: 'C4',
    title: '二项式定理与杨辉三角',
    moduleId: 'counting',
    oneLiner: '(a+b)ⁿ 展开的系数，就藏在杨辉三角里',
    hookTeaser: '点一下三角里的数字，看它是由哪两个数加出来的。',
    prerequisites: ['C2'],
    difficulty: 2,
    minutes: 8,
  },
  {
    id: 'C5',
    title: '递推关系与汉诺塔',
    moduleId: 'counting',
    oneLiner: '把大问题拆成同样形状的小问题',
    hookTeaser: '手玩 3 层，机器跑 10 层，步数曲线会告诉你公式。',
    prerequisites: ['C1'],
    difficulty: 3,
    minutes: 11,
  },

  /* ---------------------------------------------------------------- 图论 */
  {
    id: 'G1',
    title: '图的基本概念与表示',
    moduleId: 'graph',
    oneLiner: '邻接矩阵、邻接表、图形 —— 同一张图的三种记法',
    hookTeaser: '在矩阵里点一个格子，图上立刻长出一条边。',
    prerequisites: ['S1'],
    difficulty: 2,
    minutes: 9,
  },
  {
    id: 'G2',
    title: '路径、连通性与度',
    moduleId: 'graph',
    oneLiner: '能走到吗？有几条路？每个点牵着几根线？',
    hookTeaser: '拖动节点，看连通块怎么合并和分裂。',
    prerequisites: ['G1'],
    difficulty: 2,
    minutes: 9,
  },
  {
    id: 'G3',
    title: '欧拉路径与七桥问题',
    moduleId: 'graph',
    oneLiner: '一笔画走完所有桥，到底行不行？',
    hookTeaser: '亲手试试那七座桥 —— 试完你会服气地接受欧拉的结论。',
    prerequisites: ['G2'],
    difficulty: 2,
    minutes: 10,
  },
  {
    id: 'G5',
    title: '最短路径 Dijkstra',
    moduleId: 'graph',
    oneLiner: '一步步「确定」每个点，最后拿到最短路线',
    hookTeaser: '你自己来决定下一个确定哪个点，看看会不会比算法选得更聪明。',
    prerequisites: ['G1'],
    difficulty: 3,
    minutes: 12,
  },
  {
    id: 'G6',
    title: '最小生成树 Kruskal',
    moduleId: 'graph',
    oneLiner: '用最省的线把所有点连成一片',
    hookTeaser: '你来决定收下哪条边，系统会告诉你为什么有的一条必须扔掉。',
    prerequisites: ['G1'],
    difficulty: 3,
    minutes: 11,
  },
  {
    id: 'G7',
    title: '图的着色',
    moduleId: 'graph',
    oneLiner: '相邻不能同色，最少要几种颜色？',
    hookTeaser: '给地图上色，冲突的地方会当场闪给你看。',
    prerequisites: ['G1'],
    difficulty: 2,
    minutes: 9,
  },

  /* ------------------------------------------------------------------ 树 */
  {
    id: 'T2',
    title: '二叉树与遍历',
    moduleId: 'trees',
    oneLiner: '前序、中序、后序 —— 同一个树，三种读法',
    hookTeaser: '跟着一个小人沿树爬一圈，访问顺序自动列出来。',
    prerequisites: ['G1'],
    difficulty: 2,
    minutes: 10,
  },

  /* ------------------------------------------------------------- 布尔代数 */
  {
    id: 'B1',
    title: '布尔代数与逻辑门',
    moduleId: 'boolean',
    oneLiner: '表达式、电路、真值表 —— 三位一体',
    hookTeaser: '拨一下开关，电路、真值表、表达式同时跟着变。',
    prerequisites: ['L1', 'L2'],
    difficulty: 3,
    minutes: 11,
  },
]

export const MODULE_BY_ID: Record<string, ModuleDef> = Object.fromEntries(MODULES.map((m) => [m.id, m]))
export const TOPIC_BY_ID: Record<string, TopicMeta> = Object.fromEntries(CATALOG.map((t) => [t.id, t]))

export function topicsOfModule(moduleId: string): TopicMeta[] {
  return CATALOG.filter((t) => t.moduleId === moduleId)
}

/** 按阶段分组，供知识地图按行渲染 */
export function modulesByStage(): { stage: 1 | 2 | 3 | 4; title: string; modules: ModuleDef[] }[] {
  const titles: Record<number, string> = {
    1: '阶段一 · 入门',
    2: '阶段二 · 基础',
    3: '阶段三 · 核心',
    4: '阶段四 · 进阶',
  }
  return ([1, 2, 3, 4] as const).map((stage) => ({
    stage,
    title: titles[stage],
    modules: MODULES.filter((m) => m.stage === stage),
  }))
}

/** 学习路径推荐顺序：按目录内的先后（已按依赖关系编排） */
export const LEARNING_PATH: string[] = CATALOG.map((t) => t.id)

export function nextTopicId(id: string): string | null {
  const i = LEARNING_PATH.indexOf(id)
  return i >= 0 && i < LEARNING_PATH.length - 1 ? LEARNING_PATH[i + 1] : null
}

export function prevTopicId(id: string): string | null {
  const i = LEARNING_PATH.indexOf(id)
  return i > 0 ? LEARNING_PATH[i - 1] : null
}
