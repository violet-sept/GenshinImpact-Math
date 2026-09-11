import { useCallback, useEffect, useMemo, useState } from 'react'

import { GraphView } from '@/primitives'
import { Btn, Callout, Card, Chip, PlainSpeak, SectionTitle, Segmented, StepControls, cx } from '@/ui'
import { Quiz } from '@/ui/Quiz'
import { makeGraph, type Graph } from '@/kernels/graph'
import { treeLayout, type Positions } from '@/kernels/layout'
import type { Step } from '@/kernels/types'
import { useStepper } from '@/platform/useStepper'
import { useSolveOnce, useTriedSet } from '../hooks'
import type { StageCtx, Topic } from '../types'

/* ============================================================== 树 */

/** ① 用的文件夹树：一个根，每个文件夹最多两个孩子 */
const FOLDER_NAME: Record<string, string> = {
  根: '我的资料',
  图: '图片',
  文: '文档',
  旅: '旅行照',
  宠: '宠物照',
  作: '作业',
  笔: '笔记',
}
const FOLDER_KIDS: Record<string, string[]> = {
  根: ['图', '文'],
  图: ['旅', '宠'],
  文: ['作', '笔'],
  旅: [],
  宠: [],
  作: [],
  笔: [],
}
const kidsOfFolder = (id: string): string[] => FOLDER_KIDS[id] ?? []
const FOLDER_IDS = ['根', '图', '文', '旅', '宠', '作', '笔']
const FOLDER_GRAPH: Graph = makeGraph(
  ['根', '图', '文', '旅', '宠', '作', '笔'],
  [
    ['根', '图'],
    ['根', '文'],
    ['图', '旅'],
    ['图', '宠'],
    ['文', '作'],
    ['文', '笔'],
  ],
)
const FOLDER_POS: Positions = treeLayout('根', kidsOfFolder, { width: 340, levelHeight: 72 })

/** ②③④ 用的二叉树：A 是根，一共三层 */
const MAIN_KIDS: Record<string, string[]> = {
  A: ['B', 'C'],
  B: ['D', 'E'],
  C: ['F', 'G'],
  D: [],
  E: [],
  F: [],
  G: [],
}
const kidsOfMain = (id: string): string[] => MAIN_KIDS[id] ?? []
const MAIN_GRAPH: Graph = makeGraph(
  ['A', 'B', 'C', 'D', 'E', 'F', 'G'],
  [
    ['A', 'B'],
    ['A', 'C'],
    ['B', 'D'],
    ['B', 'E'],
    ['C', 'F'],
    ['C', 'G'],
  ],
)
const MAIN_POS: Positions = treeLayout('A', kidsOfMain, { width: 340, levelHeight: 74 })

/** ⑤ 用的二叉搜索树：左小右大 */
const BST_KIDS: Record<string, string[]> = {
  '5': ['3', '8'],
  '3': ['1', '4'],
  '8': ['7', '9'],
  '1': [],
  '4': [],
  '7': [],
  '9': [],
}
const kidsOfBst = (id: string): string[] => BST_KIDS[id] ?? []
const BST_GRAPH: Graph = makeGraph(
  ['5', '3', '8', '1', '4', '7', '9'],
  [
    ['5', '3'],
    ['5', '8'],
    ['3', '1'],
    ['3', '4'],
    ['8', '7'],
    ['8', '9'],
  ],
)
const BST_POS: Positions = treeLayout('5', kidsOfBst, { width: 340, levelHeight: 74 })

/* ============================================================== 遍历的步骤序列（纯函数） */

type Order = 'pre' | 'in' | 'post'

const ORDER_NAME: Record<Order, string> = { pre: '前序', in: '中序', post: '后序' }
const ORDER_RULE: Record<Order, string> = {
  pre: '先记自己，再走左，再走右',
  in: '先走左，再记自己，再走右',
  post: '先走左，再走右，最后记自己',
}

interface WalkEvent {
  node: string
  /** down = 刚走到；up = 从孩子那边回来；record = 把节点记进访问序列 */
  kind: 'down' | 'up' | 'record'
  /** up 事件里，是从哪个孩子回来的 */
  from?: string
}

/**
 * 生成「小人走路」的事件序列。
 *
 * 关键：**记录发生在哪一步，决定了是哪种遍历**。
 *   前序：一到达就记 → 然后走左、走右
 *   中序：走完左孩子再记 → 然后走右
 *   后序：左右都走完才记
 * 叶子没有孩子要等，三种遍历里都是「一到就记」。
 */
function walkEvents(root: string, order: Order, kids: (id: string) => string[]): WalkEvent[] {
  const out: WalkEvent[] = []
  const rec = (n: string): void => {
    const children = kids(n)
    if (children.length === 0) {
      out.push({ node: n, kind: 'record' })
      return
    }
    out.push({ node: n, kind: order === 'pre' ? 'record' : 'down' })
    children.forEach((k, i) => {
      rec(k)
      out.push({ node: n, kind: 'up', from: k })
      if (order === 'in' && i === 0) out.push({ node: n, kind: 'record' })
    })
    if (order === 'post') out.push({ node: n, kind: 'record' })
  }
  rec(root)
  return out
}

interface WalkState {
  current: string
  visited: string[]
  justRecorded: string | null
}

function explain(order: Order, ev: WalkEvent, kids: (id: string) => string[]): string {
  const isLeaf = kids(ev.node).length === 0
  if (ev.kind === 'record') {
    if (order === 'pre') return `走进 ${ev.node}。前序的规矩是「先记自己」，所以马上记下 ${ev.node}。`
    if (order === 'in') {
      return isLeaf
        ? `${ev.node} 没有左孩子。中序是「先走左、再记自己」，所以现在记下 ${ev.node}，接着往右走。`
        : `${ev.node} 的左子树走完了，轮到记自己 —— 记下 ${ev.node}，接着往右走。`
    }
    return isLeaf
      ? `${ev.node} 没有孩子要等。后序是「最后才记自己」，所以直接记下 ${ev.node}。`
      : `${ev.node} 的左右两边都走完了，最后才记自己 —— 记下 ${ev.node}。`
  }
  if (ev.kind === 'down') {
    return order === 'in'
      ? `走到 ${ev.node}。中序要先走左边，所以先不急着记它。`
      : `走到 ${ev.node}。后序要等左右两边都走完，才轮到记它。`
  }
  return `${ev.from ?? ''} 那边走完了，小人回到 ${ev.node}。`
}

function buildWalk(root: string, order: Order, kids: (id: string) => string[]): Step<WalkState>[] {
  const events = walkEvents(root, order, kids)
  const visited: string[] = []
  const steps: Step<WalkState>[] = []
  for (const ev of events) {
    if (ev.kind === 'record' && !visited.includes(ev.node)) visited.push(ev.node)
    steps.push({
      snapshot: { current: ev.node, visited: [...visited], justRecorded: ev.kind === 'record' ? ev.node : null },
      explanation: explain(order, ev, kids),
      highlight: [ev.node],
      label: ev.kind === 'record' ? `记下 ${ev.node}` : ev.kind === 'down' ? `走到 ${ev.node}` : `回到 ${ev.node}`,
      tone: ev.kind === 'record' ? 'accept' : 'normal',
    })
  }
  steps.push({
    snapshot: { current: root, visited: [...visited], justRecorded: null },
    explanation: `${ORDER_NAME[order]}走完了。访问顺序：${visited.join(' → ')}。`,
    highlight: [],
    label: '走完',
    tone: 'accept',
  })
  return steps
}

/** 只想要最终的访问顺序时用它 */
function traversalOf(root: string, order: Order, kids: (id: string) => string[]): string[] {
  const steps = buildWalk(root, order, kids)
  return steps[steps.length - 1].snapshot.visited
}

/** 小人站在当前节点正下方一点的位置（避开节点右上角的角标） */
function WalkerLayer({ at, reduced }: { at: { x: number; y: number }; reduced: boolean }) {
  return (
    <g
      style={{
        transform: `translate(${at.x}px, ${at.y + 30}px)`,
        transition: reduced ? 'none' : 'transform var(--dl-dur) var(--ease-dl)',
      }}
    >
      <circle cx={0} cy={-7} r={5.5} fill="var(--color-b-600)" />
      <path d="M-6 9 L0 -2 L6 9 Z" fill="var(--color-b-600)" />
      <text y={24} textAnchor="middle" className="dl-svg-text" fill="var(--color-b-700)" fontSize={11}>
        小人
      </text>
    </g>
  )
}

/* ============================================================== ① 看一看 */

function HookStage({ ctx }: { ctx: StageCtx }) {
  const [picked, setPicked] = useState<string | null>(null)
  const { tried, markTried } = useTriedSet()

  const open = (id: string): void => {
    setPicked(id)
    markTried(id)
    const children = kidsOfFolder(id)
    const text =
      children.length === 0
        ? `${FOLDER_NAME[id]} 里面没有子文件夹了 —— 这种节点叫叶子。`
        : `${FOLDER_NAME[id]} 里有：${children.map((k) => FOLDER_NAME[k]).join('、')}。`
    ctx.say(text, 'normal')
    ctx.announce(text)
  }

  useSolveOnce(ctx, tried.size >= FOLDER_IDS.length)

  const children = picked ? kidsOfFolder(picked) : []

  return (
    <div className="flex flex-col gap-3">
      <PlainSpeak>
        电脑里的文件夹就是这样一层套一层：最上面一个<b>根</b>，每个文件夹里最多放两个子文件夹，
        顺着线往下走<b>永远不会绕回自己</b>。这种结构叫<b>树</b>。
        把每个文件夹都点一下，看看它里面装了什么。
      </PlainSpeak>

      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_16rem]">
        <div className="rounded-xl bg-slate-50 p-2 dark:bg-slate-800/40">
          <GraphView
            graph={FOLDER_GRAPH}
            positions={FOLDER_POS}
            highlightNodes={picked ? [picked] : []}
            onNodeClick={open}
            ariaLabel="文件夹的层次结构，一共七个文件夹"
            keyboardHint="用 Tab 选中文件夹，按 Enter 看它里面有什么。"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Card className="p-3">
            <SectionTitle>点过的文件夹</SectionTitle>
            <p className="text-sm text-slate-700 dark:text-slate-200">
              {picked
                ? `${FOLDER_NAME[picked]}：${children.length === 0 ? '空的，没有子文件夹' : children.map((k) => FOLDER_NAME[k]).join('、')}`
                : '还没点。随便点一个试试。'}
            </p>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              已经点过 {tried.size} / {FOLDER_IDS.length} 个文件夹。
            </p>
          </Card>

          <Callout role="status" tone={tried.size >= FOLDER_IDS.length ? 'ok' : 'info'}>
            {tried.size >= FOLDER_IDS.length
              ? '看完了。最上面那个「我的资料」是根；底下那些装不下东西的是叶子；没有任何一条路能绕回自己 —— 所以它是一棵树。'
              : '继续点：注意有的文件夹里面还有文件夹，有的已经到底了。'}
          </Callout>

          <ul className="flex flex-col gap-1 text-xs text-slate-600 dark:text-slate-300">
            <li>· 最上面那个叫<b>根</b>：我的资料</li>
            <li>· 每个文件夹最多两个孩子（左、右）</li>
            <li>· 没有孩子的叫<b>叶子</b>：旅行照、宠物照、作业、笔记</li>
            <li>· 顺着线走，永远回不到自己 —— <b>没有环</b></li>
          </ul>
        </div>
      </div>
    </div>
  )
}

/* ============================================================== ② 玩一玩 */

function ExploreStage({ ctx }: { ctx: StageCtx }) {
  const [order, setOrder] = useState<Order>('pre')
  const [doneOrders, setDoneOrders] = useState<Set<Order>>(() => new Set())

  const steps = useMemo(() => buildWalk('A', order, kidsOfMain), [order])
  const stepper = useStepper<WalkState>(steps, order)
  const snap = stepper.step?.snapshot

  // 刻意用 === 最后一步（而不是 atEnd）：切换遍历方式的那一帧索引还没复位，
  // 用 atEnd 会把新的一种遍历误判成「已经走完」。
  const atFinal = stepper.count > 1 && stepper.index === stepper.count - 1

  useEffect(() => {
    if (!atFinal) return
    setDoneOrders((prev) => (prev.has(order) ? prev : new Set(prev).add(order)))
  }, [atFinal, order])

  const onStep = useCallback(
    (i: number) => {
      const s = steps[i]
      if (s) ctx.say(s.explanation, s.tone ?? 'normal')
    },
    [ctx, steps],
  )

  useSolveOnce(ctx, doneOrders.size >= 3)

  const visited = snap?.visited ?? []
  const current = snap?.current ?? 'A'
  const dimNodes = visited.filter((v) => v !== current)

  return (
    <div className="flex flex-col gap-3">
      <PlainSpeak>
        这棵树一共三层：根 A，中间是 B 和 C，最下面是 D、E、F、G。
        小人要从根 A 出发走一圈，<b>每到一个节点，就按当前规矩决定「现在记不记它」</b>。
        右边会实时把记下来的顺序列出来。三种规矩都走一遍才算完成。
      </PlainSpeak>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_19rem]">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Segmented<Order>
              label="遍历方式"
              value={order}
              onChange={(v) => {
                // 先复位再换序，保证换过去时索引是 0，不会出现「刚切过来就算走完」
                stepper.reset()
                setOrder(v)
                ctx.say(`${ORDER_NAME[v]}：${ORDER_RULE[v]}。`, 'normal')
              }}
              options={[
                { value: 'pre', label: '前序 根左右' },
                { value: 'in', label: '中序 左根右' },
                { value: 'post', label: '后序 左右根' },
              ]}
            />
            <Btn variant="primary" onClick={stepper.toggle}>
              {stepper.playing ? '暂停' : stepper.atEnd ? '再看一遍' : stepper.atStart ? '开始走' : '继续走'}
            </Btn>
          </div>

          <div className="rounded-xl bg-slate-50 p-2 dark:bg-slate-800/40">
            <GraphView
              graph={MAIN_GRAPH}
              positions={MAIN_POS}
              highlightNodes={[current]}
              dimNodes={dimNodes}
              nodeBadges={Object.fromEntries(visited.map((n, i) => [n, String(i + 1)]))}
              overlay={<WalkerLayer at={MAIN_POS[current]} reduced={ctx.reducedMotion} />}
              ariaLabel={`二叉树遍历：当前在节点 ${current}，已访问 ${visited.join('、') || '还没开始'}`}
              keyboardHint="用下面的按钮或步骤条，让小人一步步走。"
            />
          </div>

          <StepControls api={stepper} label="遍历动画" onStepChange={onStep} />

          <Callout tone={stepper.step?.tone === 'accept' ? 'ok' : 'info'} role="status">
            {stepper.step?.explanation ?? '点 ▶ 让小人开始走。'}
          </Callout>
        </div>

        <aside className="flex flex-col gap-3">
          <Card>
            <SectionTitle hint={ORDER_RULE[order]}>{ORDER_NAME[order]}的访问顺序</SectionTitle>
            {visited.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">还没记下任何节点。</p>
            ) : (
              <p className="font-mono text-sm font-semibold text-slate-800 dark:text-slate-100">{visited.join(' → ')}</p>
            )}
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              节点上的小角标 = 它是第几个被记下的。
            </p>
          </Card>

          <Card>
            <SectionTitle hint="三种都走完才通关">三种遍历的进度</SectionTitle>
            <div className="flex flex-wrap gap-1.5">
              {(['pre', 'in', 'post'] as const).map((o) => (
                <Chip key={o} tone={doneOrders.has(o) ? 'ok' : o === order ? 'cur' : 'dim'} showGlyph={false}>
                  {ORDER_NAME[o]} {doneOrders.has(o) ? '✓' : '…'}
                </Chip>
              ))}
            </div>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              已走完 {doneOrders.size} / 3 种。
            </p>
          </Card>

          <Callout tone="cur" title="小人的三种规矩">
            <ul className="flex flex-col gap-1">
              <li>前序：先记自己，再走左，再走右</li>
              <li>中序：先走左，再记自己，再走右</li>
              <li>后序：先走左，再走右，最后记自己</li>
            </ul>
          </Callout>
        </aside>
      </div>
    </div>
  )
}

/* ============================================================== ③ 起个名 */

interface OrderQuestion {
  id: string
  scene: string
  answer: Order
  why: string
}

const ORDER_QUESTIONS: OrderQuestion[] = [
  {
    id: 'q1',
    scene: '「先记自己，再走左，再走右」',
    answer: 'pre',
    why: '这是前序。「自己」永远排在最前面，所以前序的第一个一定是根。',
  },
  {
    id: 'q2',
    scene: '「先走左，再记自己，再走右」',
    answer: 'in',
    why: '这是中序。自己夹在左右中间，所以中序的结果看上去是「左子树 | 自己 | 右子树」。',
  },
  {
    id: 'q3',
    scene: '「先走左，再走右，最后记自己」',
    answer: 'post',
    why: '这是后序。自己排在最后，所以后序的最后一个一定是根，而且它一定会先把两个孩子都处理干净。',
  },
]

function NameStage({ ctx }: { ctx: StageCtx }) {
  const [answers, setAnswers] = useState<Record<string, Order>>({})
  const allRight = ORDER_QUESTIONS.every((q) => answers[q.id] === q.answer)
  useSolveOnce(ctx, allRight)

  return (
    <div className="flex flex-col gap-4">
      <PlainSpeak>
        你刚才做的三种「规矩」，名字就叫<b>前序遍历</b>、<b>中序遍历</b>、<b>后序遍历</b>。
        它们唯一的区别就是：<b>记自己的那个动作放在什么时候</b>。
      </PlainSpeak>

      <Card>
        <SectionTitle hint="点一下选一种遍历，选错会说清为什么">这是哪一种？</SectionTitle>
        <ul className="flex flex-col gap-3">
          {ORDER_QUESTIONS.map((q) => {
            const picked = answers[q.id]
            const right = picked === q.answer
            return (
              <li key={q.id} className="flex flex-col gap-2">
                <p className="text-sm text-slate-700 dark:text-slate-200">{q.scene}</p>
                <div className="flex flex-wrap items-center gap-2">
                  {(['pre', 'in', 'post'] as const).map((o) => {
                    const active = picked === o
                    const good = active && right
                    const bad = active && !right
                    return (
                      <button
                        key={o}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setAnswers((a) => ({ ...a, [q.id]: o }))}
                        className={cx(
                          'min-h-11 rounded-xl border px-4 text-sm font-medium dl-transition',
                          good
                            ? 'border-ok-500 bg-ok-50 text-ok-700 dark:bg-ok-500/15 dark:text-ok-500'
                            : bad
                              ? 'border-bad-500 bg-bad-50 text-bad-700 dark:bg-bad-500/15 dark:text-bad-500'
                              : 'border-slate-300 bg-white text-slate-700 hover:border-a-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200',
                        )}
                      >
                        {ORDER_NAME[o]}
                      </button>
                    )
                  })}
                  {picked ? (
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {right ? '✓ 对，' : '✗ 再想想：'}
                      {q.why}
                    </span>
                  ) : null}
                </div>
              </li>
            )
          })}
        </ul>
      </Card>

      <Card>
        <SectionTitle hint="同一棵树，三种读法">② 那棵树的三份答案</SectionTitle>
        <ul className="flex flex-col gap-2 font-mono text-sm">
          {(['pre', 'in', 'post'] as const).map((o) => (
            <li key={o} className="flex flex-wrap items-center gap-2">
              <span className="w-24 shrink-0 text-slate-500 dark:text-slate-400">{ORDER_NAME[o]}</span>
              <span className="font-semibold text-slate-800 dark:text-slate-100">
                {traversalOf('A', o, kidsOfMain).join(' → ')}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-sm leading-relaxed text-slate-700 dark:text-slate-200">
          三份答案完全不一样 —— 因为树本身没变，<b>变的只是「什么时候记自己」</b>。
          所以「遍历」这个词的意思就是：给树定一个规矩，把每个节点都恰好访问一次。
        </p>
      </Card>
    </div>
  )
}

/* ============================================================== ④ 练一练 */

function PracticeStage({ ctx }: { ctx: StageCtx }) {
  const [solvedCount, setSolvedCount] = useState(0)
  useSolveOnce(ctx, solvedCount >= 3)

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-slate-600 dark:text-slate-300">三道题，随便选。选错会说清为什么错，可以马上再来。</p>

      <Card>
        <Quiz
          question={
            <>
              一棵树：根是 <b>C</b>；C 的左孩子是 <b>A</b>；A 的右孩子是 <b>B</b>；C 的右孩子是 <b>D</b>。
              它的<b>中序</b>遍历结果是？
            </>
          }
          resetKey="t2p1"
          onSolved={() => setSolvedCount((c) => c + 1)}
          choices={[
            {
              id: 'a',
              label: 'A B C D',
              correct: true,
              why: '对。中序是「先走左、再记自己、再走右」：C 的左子树是 A（A 没有左孩子，先记 A，再走它的右孩子 B，记 B），然后记 C 自己，最后走右边的 D。',
            },
            {
              id: 'b',
              label: 'C A B D',
              correct: false,
              why: '不对。这是前序（先记自己 C，再走左子树 A、B，最后走右 D）。中序要把自己放到左右中间。',
            },
            {
              id: 'c',
              label: 'A C B D',
              correct: false,
              why: '不对。B 是 A 的右孩子，属于 C 的左子树内部，必须先于 C 被记下来。中序里左边整棵子树都排在 C 前面。',
            },
            {
              id: 'd',
              label: 'B A C D',
              correct: false,
              why: '不对。A 是 B 的父亲，中序里父亲在左子树走完之后、右子树之前被记 —— 如果 A 只有右孩子 B，A 会排在 B 前面。',
            },
          ]}
        />
      </Card>

      <Card>
        <Quiz
          question={<>只告诉你一棵二叉树的中序遍历，能唯一确定这棵树长什么样吗？</>}
          resetKey="t2p2"
          onSolved={() => setSolvedCount((c) => c + 1)}
          choices={[
            {
              id: 'a',
              label: '不能，只给中序不够',
              correct: true,
              why: '对。反例：A 做根、B 做右孩子，中序是 A B；B 做根、A 做左孩子，中序也是 A B。两种树长得完全不一样，中序却一模一样。',
            },
            {
              id: 'b',
              label: '能，中序唯一确定了这棵树',
              correct: false,
              why: '不对。上面那个反例就是证据：中序 A B 对应的树至少有两种，光看中序分不出是哪一种。',
            },
            {
              id: 'c',
              label: '任意两种遍历组合起来都能唯一确定',
              correct: false,
              why: '不对。中序配前序、中序配后序可以；但前序配后序不行 —— A 做根 B 做左孩子、A 做根 B 做右孩子，前序都是 A B，后序都是 B A。',
            },
          ]}
        />
      </Card>

      <Card>
        <Quiz
          question={<>前序遍历的<b>第一个</b>节点、后序遍历的<b>最后一个</b>节点，分别是谁？</>}
          resetKey="t2p3"
          onSolved={() => setSolvedCount((c) => c + 1)}
          choices={[
            {
              id: 'a',
              label: '都是根节点',
              correct: true,
              why: '对。前序一到根就先记下它，所以根永远排第一；后序要等左右子树都走完才记根，所以根永远排最后。',
            },
            {
              id: 'b',
              label: '都是最左边的那个叶子',
              correct: false,
              why: '不对。只有中序的第一个才是最左边的节点。前序的第一个是根。',
            },
            {
              id: 'c',
              label: '前序是根，后序是最右边的叶子',
              correct: false,
              why: '不对。后序最后记的是根 —— 左右子树都走完了，最后才轮到它自己。',
            },
          ]}
        />
      </Card>
    </div>
  )
}

/* ============================================================== ⑤ 换个场景 */

function TransferStage({ ctx }: { ctx: StageCtx }) {
  const steps = useMemo(() => buildWalk('5', 'in', kidsOfBst), [])
  const stepper = useStepper<WalkState>(steps, 'bst-in')
  const [quizDone, setQuizDone] = useState(false)
  const snap = stepper.step?.snapshot
  const atFinal = stepper.count > 1 && stepper.index === stepper.count - 1

  const onStep = useCallback(
    (i: number) => {
      const s = steps[i]
      if (s) ctx.say(s.explanation, s.tone ?? 'normal')
    },
    [ctx, steps],
  )

  useSolveOnce(ctx, atFinal && quizDone)

  const visited = snap?.visited ?? []
  const current = snap?.current ?? '5'
  const sorted = [...visited].map(Number).sort((a, b) => a - b)
  const sameOrder = visited.length > 1 && visited.join(',') === sorted.join(',')

  return (
    <div className="flex flex-col gap-4">
      <PlainSpeak>
        这是二叉树最重要的一个用途。这棵树有一条规矩：<b>左子树里的数都比自己小，右子树里的数都比自己大</b>
        —— 这样的树叫<b>二叉搜索树</b>。现在用中序遍历走一遍，盯着右边输出的数字看。
      </PlainSpeak>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_19rem]">
        <div className="flex flex-col gap-2">
          <div className="rounded-xl bg-slate-50 p-2 dark:bg-slate-800/40">
            <GraphView
              graph={BST_GRAPH}
              positions={BST_POS}
              highlightNodes={[current]}
              dimNodes={visited.filter((v) => v !== current)}
              nodeBadges={Object.fromEntries(visited.map((n, i) => [n, String(i + 1)]))}
              overlay={<WalkerLayer at={BST_POS[current]} reduced={ctx.reducedMotion} />}
              ariaLabel={`二叉搜索树的中序遍历，当前在节点 ${current}`}
              keyboardHint="用下面的按钮或步骤条，让小人一步步走。"
            />
          </div>

          <StepControls api={stepper} label="BST 中序遍历" onStepChange={onStep} />

          <Callout tone={stepper.step?.tone === 'accept' ? 'ok' : 'info'} role="status">
            {stepper.step?.explanation ?? '点 ▶ 开始。'}
          </Callout>
        </div>

        <aside className="flex flex-col gap-3">
          <Card>
            <SectionTitle hint="中序 左根右">输出的数字</SectionTitle>
            <p className="font-mono text-sm font-semibold text-slate-800 dark:text-slate-100">
              {visited.length === 0 ? '还没开始' : visited.join(' → ')}
            </p>
            {atFinal ? (
              <>
                <p className="mt-2 font-mono text-xs text-slate-500 dark:text-slate-400">
                  从小到大应该是：{sorted.join(' → ')}
                </p>
                <Callout tone={sameOrder ? 'ok' : 'bad'}>
                  {sameOrder
                    ? '两边一模一样 —— 中序遍历一棵「左小右大」的树，出来的正好是从小到大排好的序列。'
                    : '还没走完，走完再看看。'}
                </Callout>
              </>
            ) : null}
          </Card>

          <Card>
            <SectionTitle>为什么中序能做到这件事</SectionTitle>
            <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-200">
              中序的规矩是「先走完左边，再记自己，再走右边」。左边全是比自己小的数，右边全是比自己大的数。
              所以轮到记自己的时候，<b>比它小的都已经记完了，比它大的还一个都没记</b> ——
              输出的顺序自然就是从小到大。
            </p>
          </Card>
        </aside>
      </div>

      {atFinal ? (
        <Card>
          <Quiz
            question={<>为什么中序遍历一棵二叉搜索树，能得到排好序的序列？</>}
            resetKey="t2t1"
            onSolved={() => setQuizDone(true)}
            choices={[
              {
                id: 'a',
                label: '因为中序是「先走完左边、再记自己、再走右边」，而左边都比自己小、右边都比自己大',
                correct: true,
                why: '对。轮到自己时，比自己小的全在左边、已经记过了，比自己大的全在右边、还没轮到 —— 所以输出天然是从小到大。',
              },
              {
                id: 'b',
                label: '因为树上的数字一开始就是按顺序摆好的',
                correct: false,
                why: '不对。树只保证「左边小、右边大」，并不保证数字在树上是按大小一条线排下去的。是遍历顺序把顺序「读」了出来。',
              },
              {
                id: 'c',
                label: '因为中序遍历会顺手排一次序',
                correct: false,
                why: '不对。遍历本身不做任何比较和交换，它只是按固定规矩走。顺序是树的结构 + 中序规矩一起决定的。',
              },
            ]}
          />
        </Card>
      ) : null}
    </div>
  )
}

/* ============================================================== 导出 */

const topic: Topic = {
  id: 'T2',
  title: '二叉树与遍历',
  moduleId: 'trees',
  oneLiner: '前序、中序、后序 —— 同一个树，三种读法',
  outcome: '你能看着一棵二叉树，说出它的前序、中序、后序遍历结果，并解释为什么中序遍历一棵二叉搜索树会得到排好序的序列。',
  prerequisites: ['G1'],
  bigIdea: '遍历就是给树定一个规矩、把每个节点恰好访问一次。三种遍历的唯一区别，是「记自己」这个动作放在走左右之前、之间、还是之后。',
  misconceptions: [
    {
      wrong: '中序遍历就是从左边读到右边、从上读到下',
      right: '那是「层序」的读法。中序是先走完整棵左子树，再记自己，再走右子树 —— 它可能先往下钻很深，再回到上面。',
    },
    {
      wrong: '三种遍历只是名字不同，结果差不多',
      right: '同一棵树的三种结果完全不同。以 A 为根、B 和 C 为孩子的树：前序是 A B C，中序是 B A C，后序是 B C A。',
    },
    {
      wrong: '中序遍历二叉搜索树得到的是插入顺序',
      right: '得到的是从小到大排好的顺序。这正是二叉搜索树最重要的用途。',
    },
  ],
  formalDefinition: (
    <>
      <p>
        <b>二叉树：</b>
        <span className="font-mono">每个节点最多有两个孩子（左、右），没有环</span>
      </p>
      <p>
        <b>遍历：</b>
        <span className="font-mono">按某个固定规矩，把每个节点恰好访问一次</span>
      </p>
      <ul className="ml-4 list-disc text-sm">
        <li>
          <b>前序</b> <span className="font-mono">根 → 左 → 右</span>：一到达节点就记下它
        </li>
        <li>
          <b>中序</b> <span className="font-mono">左 → 根 → 右</span>：左子树走完再记自己
        </li>
        <li>
          <b>后序</b> <span className="font-mono">左 → 右 → 根</span>：左右子树都走完才记自己
        </li>
      </ul>
      <p>
        <b>二叉搜索树：</b>
        <span className="font-mono">任意节点，左子树里的值都小于它，右子树里的值都大于它</span>
        —— 所以它的中序遍历是递增序列。
      </p>
    </>
  ),
  glossary: [
    { term: '二叉树', plain: '每个节点最多两个孩子（左、右），而且没有环的树。' },
    { term: '根', plain: '最上面那个节点，它没有父亲。' },
    { term: '叶子', plain: '一个孩子都没有的节点。' },
    { term: '子树', plain: '从某个节点往下的那一整块，它自己也构成一棵树。' },
    { term: '前序遍历', plain: '先记自己，再走左，再走右。', formal: '根 → 左 → 右' },
    { term: '中序遍历', plain: '先走左，再记自己，再走右。', formal: '左 → 根 → 右' },
    { term: '后序遍历', plain: '先走左，再走右，最后记自己。', formal: '左 → 右 → 根' },
    { term: '二叉搜索树', plain: '有「左小右大」规矩的二叉树，中序遍历它就能得到排好序的序列。' },
  ],
  stages: [
    {
      label: '① 看一看',
      short: '看',
      narration: '文件夹是怎么一层层套起来的？',
      requireSolve: true,
      hints: [
        '每个文件夹都点一下，注意它里面装了什么。',
        '有的文件夹里还套着文件夹，有的已经到底了。',
        '七个文件夹分别是：我的资料（根）里有图片、文档；图片里有旅行照、宠物照；文档里有作业、笔记。全都点一遍。',
      ],
      render: (ctx) => <HookStage ctx={ctx} />,
    },
    {
      label: '② 玩一玩',
      short: '玩',
      narration: '跟着小人走一圈，看访问顺序实时长出来',
      requireSolve: true,
      hints: [
        '点 ▶ 让小人自己走，也可以用 ⟩ 一步步看它什么时候「记下」节点。',
        '注意区分两种动作：走到某个节点，和把某个节点记下来 —— 记的时机决定是哪种遍历。',
        '前序：A B D E C F G；中序：D B E A F C G；后序：D E B F G C A。三种都用步骤条走到底就完成了。',
      ],
      render: (ctx) => <ExploreStage ctx={ctx} />,
    },
    {
      label: '③ 起个名',
      short: '名',
      narration: '三种规矩的名字，就藏在先后顺序里',
      requireSolve: true,
      hints: [
        '看「记自己」这三个字排在最前、中间、还是最后。',
        '自己排最前 = 前序；夹在左右之间 = 中序；排最后 = 后序。',
        '三问答案依次是：前序、中序、后序。',
      ],
      render: (ctx) => <NameStage ctx={ctx} />,
    },
    {
      label: '④ 练一练',
      short: '练',
      narration: '三道题，选错会说明为什么错',
      requireSolve: true,
      hints: [
        '拿不准就画出来：在纸上把这棵树画好，按规矩一步步走。',
        '中序的口诀是「左边整棵子树都排在我前面」。',
        '三题答案依次是：A B C D；只给中序不能唯一确定；前序的第一个和后序的最后一个都是根。',
      ],
      render: (ctx) => <PracticeStage ctx={ctx} />,
    },
    {
      label: '⑤ 换个场景',
      short: '变',
      narration: '中序走一棵二叉搜索树，看看会输出什么',
      requireSolve: true,
      hints: [
        '先用 ▶ 把整棵树走完，再看右边输出的数字。',
        '这棵树的规矩是「左边都比自己小、右边都比自己大」。',
        '中序输出是 1 → 3 → 4 → 5 → 7 → 8 → 9，正好从小到大。走完后回答下面那道「为什么」的题。',
      ],
      render: (ctx) => <TransferStage ctx={ctx} />,
    },
  ],
}

export default topic
