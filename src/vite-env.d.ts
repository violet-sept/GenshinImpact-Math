/// <reference types="vite/client" />

/**
 * 项目自定义的环境变量。
 *
 * `vite/client` 自带 `[key: string]: any` 的索引签名，所以不写这一段也能编译通过，
 * 但那意味着任何拼错的变量名都会被静默当成 `any`。这里显式声明，让拼错立刻报错。
 */
interface ImportMetaEnv {
  /** 动态壁纸视频的外链地址；留空则回退到 `public/wallpaper/nahida.mp4` */
  readonly VITE_WALLPAPER_URL?: string
}
