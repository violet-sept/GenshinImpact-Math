import { useMemo, useState } from 'react'

import { Btn, Callout, Card, Chip, PlainSpeak, SectionTitle, Segmented, SliderRow, cx } from '@/ui'
import { GraphView, MatrixGrid } from '@/primitives'
import {
  adjacencyListString,
  degrees,
  dijkstra,
  eulerVerdict,
  greedyColoring,
  isConnected,
  kruskal,
  makeGraph,
  nodesOf,
  type DijkstraState,
  type Graph,
  type KruskalState,
} from '@/kernels/graph'
import type { Step } from '@/kernels/types'
import { circleLayout } from '@/kernels/layout'
import { StepControls } from '@/ui'
import { useStepper } from '@/platform/useStepper'

/** 两种算法的快照合成一个宽松类型，避免在 JSX 里到处做类型收窄 */
type SandboxSnap = Partial<DijkstraState> & Partial<KruskalState>

const NODES = ['A', 'B', 'C', 'D', 'E', 'F']
const POS = circleLayout(NODES, 170, 150, 108)

type Mode = 'build' | 'dijkstra' | 'kruskal' | 'color'

/**
 * 自由沙盒（规划书 §9.1 的 /sandbox）。
 *
 * 知识点页里图是给定的；沙盒里图是你自己的 —— 这一页的价值在于
 * **把「我改一下图会怎样」这件事变成零成本**。算法内核本来就是纯函数，
 * 所以同一套最短路 / 最小生成树代码在这里直接复用，一行都没有抄。
 */
export default function SandboxPage() {
  const [pairs, setPairs] = useState<[string, string, number][]>([
    ['A', 'B', 4],
    ['A', 'C', 2],
    ['B', 'C', 1],
    ['B', 'D', 5],
    ['C', 'D', 8],
    ['C', 'E', 10],
    ['D', 'E', 2],
    ['E', 'F', 3],
  ])
  const [mode, setMode] = useState<Mode>('build')
  const [start, setStart] = useState('A')
  const [selectedEdge, setSelectedEdge] = useState<string | null>(null)

  const graph: Graph = useMemo(() => makeGraph(NODES, pairs), [pairs])
  const n = nodesOf(graph)
  const matrix = useMemo(() => {
    const m = n.map(() => n.map(() => false))
    graph.edges.forEach((e) => {
      const i = n.indexOf(e.u)
      const j = n.indexOf(e.v)
      if (i >= 0 && j >= 0) {
        m[i][j] = true
        m[j][i] = true
      }
    })
    return m
  }, [graph, n])

  const toggle = (i: number, j: number): void => {
    const u = n[i]
    const v = n[j]
    if (u === v) return
    setPairs((prev) => {
      const idx = prev.findIndex(([a, b]) => (a === u && b === v) || (a === v && b === u))
      if (idx >= 0) return prev.filter((_, k) => k !== idx)
      return [...prev, [u, v, 3]]
    })
  }

  const setWeight = (id: string, w: number): void => {
    setPairs((prev) =>
      prev.map(([a, b], i) => (id === `e${i}` ? [a, b, w] : [a, b]) as [string, string, number]),
    )
  }

  const euler = eulerVerdict(graph)
  const deg = degrees(graph)
  const connected = isConnected(graph)

  const dijkstraSteps = useMemo(() => dijkstra(graph, start), [graph, start])
  const kruskalSteps = useMemo(() => kruskal(graph), [graph])
  const coloring = useMemo(() => greedyColoring(graph), [graph])

  const activeSteps = (
    mode === 'dijkstra' ? dijkstraSteps : mode === 'kruskal' ? kruskalSteps : []
  ) as unknown as Step<SandboxSnap>[]
  const stepper = useStepper<SandboxSnap>(activeSteps, `${mode}-${start}-${pairs.length}-${pairs.map((p) => p[2]).join(',')}`)
  const snap = stepper.step?.snapshot

  const colorIndex = useMemo(() => {
    const m: Record<string, number> = {}
    Object.entries(coloring).forEach(([k, v]) => (m[k] = v))
    return m
  }, [coloring])
  const colorPalette = ['var(--color-a-500)', 'var(--color-b-500)', 'var(--color-cur-500)', 'var(--color-ok-500)']

  const nodeColors: Record<string, string> = {}
  const nodeBadges: Record<string, string> = {}
  if (mode === 'build') {
    n.forEach((id) => (nodeBadges[id] = String(deg[id] ?? 0)))
  } else if (mode === 'color') {
    n.forEach((id) => (nodeColors[id] = colorPalette[colorIndex[id] ?? 0]))
  } else if (mode === 'dijkstra' && snap?.dist) {
    n.forEach((id) => (nodeBadges[id] = snap.dist?.[id] === Infinity ? '∞' : String(snap.dist?.[id] ?? '∞')))
  }

  const highlightNodes =
    mode === 'dijkstra' && snap?.settled ? snap.settled : mode === 'kruskal' && snap?.accepted ? [] : []
  const highlightEdges =
    mode === 'dijkstra'
      ? stepper.step?.highlight.filter((h) => h.startsWith('e')) ?? []
      : mode === 'kruskal'
        ? (snap?.accepted ?? []).map((e) => e.id)
        : []

  return (
    <div className="mx-auto w-full max-w-6xl px-3 pb-16 pt-6 sm:px-4">
      <header>
        <h1 className="text-2xl font-black text-slate-900 sm:text-3xl dark:text-slate-50">沙盒</h1>
        <p className="mt-2 max-w-3xl text-slate-600 dark:text-slate-300">
          这里没有标准答案，也没有步骤提示。你自己造一张图，然后拿上面所有的算法去试 ——
          看看改一条边，结果会怎么变。
        </p>
      </header>

      <div className="mt-4">
        <Segmented
          label="沙盒模式"
          value={mode}
          onChange={setMode}
          options={[
            { value: 'build', label: '搭图（看度数与欧拉）' },
            { value: 'dijkstra', label: '跑最短路' },
            { value: 'kruskal', label: '跑最小生成树' },
            { value: 'color', label: '跑着色' },
          ]}
        />
      </div>

      <div className="mt-4 gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <Card>
          <SectionTitle hint="拖动节点可以换个摆法">你的图</SectionTitle>
          <GraphView
            graph={graph}
            positions={POS}
            highlightNodes={highlightNodes}
            highlightEdges={highlightEdges}
            nodeColors={nodeColors}
            nodeBadges={nodeBadges}
            edgeLabels={Object.fromEntries(graph.edges.map((e) => [e.id, String(e.w)]))}
            onEdgeClick={(id) => setSelectedEdge(id === selectedEdge ? null : id)}
            nodeLabels={Object.fromEntries(n.map((id) => [id, id]))}
            ariaLabel={`当前图：${n.length} 个点，${graph.edges.length} 条边`}
            keyboardHint="提示：节点可以用 Tab 聚焦后用方向键挪位置；边可以直接点选。"
          />
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            <Chip tone={connected ? 'ok' : 'bad'}>{connected ? '连通' : '不连通'}</Chip>
            <Chip tone={euler.hasCircuit ? 'ok' : euler.hasPath ? 'cur' : 'bad'}>{euler.title}</Chip>
            <Chip tone="dim" showGlyph={false}>
              {n.length} 点 · {graph.edges.length} 边
            </Chip>
          </div>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{euler.plain}</p>
        </Card>

        <aside className="mt-4 flex flex-col gap-3 lg:mt-0">
          <Card>
            <SectionTitle hint="点格子就是加边/删边">邻接矩阵</SectionTitle>
            <MatrixGrid
              rows={n}
              cols={n}
              data={matrix}
              onToggle={toggle}
              highlight={
                mode === 'dijkstra' && stepper.step
                  ? []
                  : []
              }
              ariaLabel="邻接矩阵编辑器"
              rowTitle="行"
              colTitle="列"
            />
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              矩阵是对称的 —— 因为这是无向图：A 连着 B，那么 B 也就连着 A。
            </p>
          </Card>

          {selectedEdge ? (
            <Card>
              <SectionTitle>选中的边</SectionTitle>
              {(() => {
                const idx = graph.edges.findIndex((e) => e.id === selectedEdge)
                const e = graph.edges[idx]
                if (!e) return <p className="text-sm text-slate-500">这条边已经不在了。</p>
                return (
                  <>
                    <p className="mb-2 text-sm text-slate-700 dark:text-slate-200">
                      边 <span className="font-mono font-semibold">{e.u}–{e.v}</span>
                    </p>
                    <SliderRow
                      label="权重（走这条边要花多少）"
                      min={1}
                      max={9}
                      value={e.w}
                      onChange={(v) => setWeight(e.id, v)}
                    />
                  </>
                )
              })()}
            </Card>
          ) : null}

          {mode === 'dijkstra' ? (
            <Card>
              <SectionTitle>起点</SectionTitle>
              <Segmented
                label="起点"
                size="sm"
                columns={3}
                value={start}
                onChange={setStart}
                options={n.map((id) => ({ value: id, label: id }))}
              />
              <div className="mt-3">
                <StepControls api={stepper} label="最短路" />
              </div>
            </Card>
          ) : null}

          {mode === 'kruskal' ? (
            <Card>
              <SectionTitle hint="每次只看最便宜的一条边">最小生成树</SectionTitle>
              <div className="mb-2">
                <StepControls api={stepper} label="最小生成树" />
              </div>
            </Card>
          ) : null}

          {mode === 'kruskal' && snap ? (
            <Card>
              <SectionTitle>当前进展</SectionTitle>
              <p className="text-sm text-slate-700 dark:text-slate-200">
                已收下 {(snap.accepted ?? []).length} 条边
                {(snap.accepted ?? []).length > 0
                  ? `：${(snap.accepted ?? []).map((e) => e.id).join(' ')}`
                  : ''}
              </p>
            </Card>
          ) : null}

          <Callout tone="info">
            沙盒里的所有算法和知识点页里用的是**同一份代码**。它们被写成不含界面代码的纯函数，
            所以既能在动画里一步步播，也能在这里当场算给你看。
          </Callout>

          {mode === 'dijkstra' ? (
            <PlainSpeak>
              数字角标现在显示的是「起点到它的当前最短距离」，带 ∞ 的表示还没找到路。
              用下方的步骤条可以任意往前拖、往回拖。
            </PlainSpeak>
          ) : null}

          <Card>
            <SectionTitle hint="一眼看出谁连着谁">邻接表</SectionTitle>
            <ul className="flex flex-col gap-1 font-mono text-xs">
              {Object.entries(adjacencyListString(graph)).map(([k, v]) => (
                <li key={k} className="flex gap-2">
                  <span className="w-4 text-slate-500 dark:text-slate-400">{k}</span>
                  <span className="text-slate-700 dark:text-slate-200">{v}</span>
                </li>
              ))}
            </ul>
          </Card>

          <div>
            <Btn
              variant="outline"
              size="sm"
              onClick={() => {
                setPairs([
                  ['A', 'B', 4],
                  ['A', 'C', 2],
                  ['B', 'C', 1],
                  ['B', 'D', 5],
                  ['C', 'D', 8],
                  ['C', 'E', 10],
                  ['D', 'E', 2],
                  ['E', 'F', 3],
                ])
                setSelectedEdge(null)
              }}
              className={cx('w-full')}
            >
              恢复成示例图
            </Btn>
          </div>
        </aside>
      </div>
    </div>
  )
}
