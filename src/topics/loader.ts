import type { Topic } from './types'

/**
 * 知识点实现按需加载。
 *
 * 用 `import.meta.glob` 自动发现：新增一个知识点只需要往 `impl/` 目录里丢一个文件，
 * 不用改任何注册表 —— 既避免了多人协作时的注册表冲突，也让 Vite 自动做代码分割，
 * 保证「进入某个知识点才下载它的代码」（规划书 §8.5 的包体预算）。
 */
const modules = import.meta.glob<{ default: Topic }>('./impl/*.tsx')

const KEY = (id: string): string => `./impl/${id}.tsx`

/** 已经实现的知识点 id 列表 */
export const READY_IDS: string[] = Object.keys(modules)
  .map((p) => p.replace('./impl/', '').replace('.tsx', ''))
  .sort()

export function isReady(id: string): boolean {
  return KEY(id) in modules
}

export async function loadTopic(id: string): Promise<Topic | null> {
  const loader = modules[KEY(id)]
  if (!loader) return null
  const mod = await loader()
  return mod.default
}
