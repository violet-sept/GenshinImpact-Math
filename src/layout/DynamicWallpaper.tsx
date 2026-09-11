import { useSettings, WALLPAPER_SRC } from '@/platform/settings'

/*
 * 动态壁纸（默认开启）：整站背景循环播放一段视频。
 *
 * 这里**刻意不叠任何遮罩**：壁纸是独立于「浅色 / 深色」的一层，
 * 一旦压上 bg-slate-950/80 这类主题色，它看起来就只是「显示设置里的那个颜色」包了一层。
 *
 * 那正文的可读性交给谁？交给内容方框自己 —— 见 index.css 的「动态壁纸模式」：
 * 卡片与分区面板做成毛玻璃，方框的颜色直接取自它背后的壁纸，
 * 直接压在壁纸上的标题 / 正文另加一层与主题同向的光晕。
 *
 * 视频地址与「这次构建有没有壁纸」都定义在 @/platform/settings：
 * 仓库里不含视频文件（135MB，超 GitHub 单文件上限），线上靠 VITE_WALLPAPER_URL 指外链。
 */
export function DynamicWallpaper() {
  const { wallpaperOn, markWallpaperFailed } = useSettings()
  if (!wallpaperOn) return null

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <video
        className="h-full w-full object-cover"
        src={WALLPAPER_SRC}
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        // 地址失效时不能就这么算了：毛玻璃已经铺上去了，必须让 settings 把整层收掉
        onError={markWallpaperFailed}
      />
    </div>
  )
}
