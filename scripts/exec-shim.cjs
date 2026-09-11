/**
 * 受限沙箱兼容垫片（仅在本机受限环境下需要，普通环境无需使用）
 *
 * 背景：某些受限沙箱禁止 Node 通过「管道 stdio」捕获子进程输出，
 * 此时 `child_process.exec()` 会**同步抛出** `EPERM spawn EPERM`。
 * 而 Vite 在 Windows 上会执行 `net use` 来探测网络驱动器映射
 * （见 vite/dist/node/chunks/node.js 的 optimizeSafeRealPathSync）——
 * 本地磁盘场景下这一步完全不必要，失败时安静降级即可。
 *
 * 用法：NODE_OPTIONS="--require ./scripts/exec-shim.cjs" vite build
 * 正常的开发机不需要它，直接 `npm run build` 即可。
 */
const cp = require('node:child_process')

const noopChild = {
  on() {
    return this
  },
  once() {
    return this
  },
  kill() {
    return false
  },
  unref() {
    return this
  },
  pid: -1,
  stdout: null,
  stderr: null,
}

const wrap = (name) => {
  const original = cp[name]
  if (typeof original !== 'function') return
  cp[name] = function patched(...args) {
    const maybeCallback = args.find((a) => typeof a === 'function')
    try {
      return original.apply(cp, args)
    } catch (error) {
      if (maybeCallback) maybeCallback(error, '', '')
      return noopChild
    }
  }
}

wrap('exec')
wrap('execFile')
