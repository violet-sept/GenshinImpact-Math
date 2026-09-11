import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const wallpaperUrl = (env.VITE_WALLPAPER_URL ?? '').trim()

  /*
   * 「这次构建到底有没有壁纸可放」必须在首帧之前就定下来。
   *
   * 仓库里不含那段壁纸视频（135MB，超过 GitHub 单文件 100MB 上限），线上靠
   * VITE_WALLPAPER_URL 指外链。如果没有外链却铺上毛玻璃，卡片会半透明地压在
   * 一片空白上，正文对比度直接不达标 —— 所以宁可完全不铺。
   *
   * ⚠️ 这个判断有两处消费者，规则必须一致：
   *     · index.html 的首屏内联脚本 —— 由下面这个插件替换 __DL_HAS_WALLPAPER__ 占位符
   *     · src/platform/settings.tsx 的 HAS_WALLPAPER —— 供 React 侧与设置面板使用
   *   规则：开发模式放行（本地通常有文件），生产构建必须有外链。
   *   那边用的是 `import.meta.env.MODE === 'development'`，与这里的 `mode` 严格同一个值 ——
   *   刻意不用 `import.meta.env.DEV`，那个取自 NODE_ENV，自定义 mode 时会与这里分叉。
   */
  const hasWallpaper = mode === 'development' || wallpaperUrl !== ''

  return {
    // 相对路径：dist 可直接放到任意静态目录 / CDN 子路径下运行，GitHub Pages 项目站也不需要改
    base: './',
    plugins: [
      react(),
      tailwindcss(),
      {
        // 占位符刻意不用 %VITE_xxx% 的形式：那是 Vite 内建 env 替换的语法，
        // 未定义的变量会被它当成「找不到」而留下警告。这里用自定义标记，各管各的。
        name: 'dl-wallpaper-flag',
        transformIndexHtml(html) {
          return html.replace('__DL_HAS_WALLPAPER__', String(hasWallpaper))
        },
      },
    ],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    build: {
      target: 'es2022',
      cssCodeSplit: true,
      reportCompressedSize: true,
    },
  }
})
