/**
 * 「一句话本质」表情包（每个小章节一张）。
 *
 * 文件名就是知识点 id —— 和 `topics/loader.ts` 用 `import.meta.glob` 自动发现知识点是同一个思路：
 * 想给某个知识点换一张，直接覆盖同名文件；以后新增知识点，往这个目录丢一个同名 png 就会自动生效。
 *
 * 图片已经裁掉透明外边距、抠掉白底，并保留到内容本身的原始分辨率（约 124–144px 高）：
 * 页面上按 48px 显示，在高分屏上也够锐。改动显示大小只需要动 `PlainSpeak` 的 `h-12`。
 * 查不到就是 `undefined`，`PlainSpeak` 会退回原来那个对话框 emoji。
 */
const files = import.meta.glob<string>('./*.png', { eager: true, import: 'default' })

export const BIG_IDEA_STICKERS: Record<string, string> = Object.fromEntries(
  Object.entries(files).map(([path, url]) => [path.replace('./', '').replace('.png', ''), url]),
)
