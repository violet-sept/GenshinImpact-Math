import { defineConfig } from 'vitest/config'
import { fileURLToPath, URL } from 'node:url'

/**
 * 单测专用配置。
 *
 * 刻意**不加载 vite.config.ts 的插件**：算法内核是零依赖的纯 TypeScript，
 * 测试它不需要 React 编译器，也不需要 Tailwind 的原生绑定 —— 少一层依赖，
 * 单测就能在任何环境（含 CI 的极简容器）里跑起来。
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    reporters: ['default'],
    // 用 worker 线程而不是子进程：内核测试是纯计算，线程池启动更快，
    // 也不依赖 fork 出的子进程管道（受限环境下 fork 可能不可用）。
    pool: 'threads',
  },
})
