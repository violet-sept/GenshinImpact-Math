# 动态壁纸视频放这里

## 为什么这个目录是空的

原来这里的 `nahida.mp4` 有 **135MB**，超过了 GitHub 单文件 100MB 的硬上限 ——
只要它在仓库里，`git push` 就会被直接拒绝。所以它**不在仓库里**，`.gitignore` 把
`public/wallpaper/*` 整个忽略了（只保留本说明）。

## 怎么让壁纸显示出来

**本机开发：** 把任意 mp4 命名为 `nahida.mp4` 放进这个目录，`npm run dev` 就会自动用它。
文件在本地、跑得快，也不消耗任何外链流量。

**线上部署：** 仓库里没有这个文件，改由外链顶替它。**而且默认已经配好了** ——
`deploy.yml` 里写死了这个地址，指向本仓库 v1.0 Release 的附件：

```
https://github.com/violet-sept/GenshinImpact-Math/releases/download/v1.0/nahida.mp4
```

也就是说**什么都不用做，线上站就有壁纸**。只有想换成自己的存储时才需要覆盖：

```bash
# .env.local（已被 gitignore 忽略）
VITE_WALLPAPER_URL=https://your-cdn.example.com/nahida.mp4
```

用 GitHub Pages 的话更推荐填到仓库变量里，工作流会自动覆盖默认值：
`Settings → Secrets and variables → Actions → Variables → 新建 VITE_WALLPAPER_URL`。

**不要壁纸也可以。** 把默认值清空、或删掉本地文件，页面都会检测到视频加载不了、
自动把壁纸层整个收起来、退回纯主题色背景 —— 不会出现「毛玻璃卡片压在一片空白上」那种糊掉的效果。
这个降级是刻意的：不做的话，没有视频时卡片会变成半透明，正文对比度不达标。

## 为什么放 Release 而不是放进 Pages

Release 附件**不占 GitHub Pages 每月 100GB 的软带宽**。原片 135MB，放在 Pages 上的话
每打开一次页面就下载 135MB，大约 700 多次访问就会被限流；放 Release 则没有这个顾虑，
也绕开了 Pages 关于单文件体积的限制。

## 视频本身的要求

- 能循环播放的 mp4（H.264 兼容性最好）
- 存储要允许 **Range 请求**，否则部分浏览器只播第一帧或干脆不播
- 建议先压到 10MB 以内再传。原片 135MB 意味着每打开一次页面就下载 135MB，
  GitHub Pages 每月 100GB 的软带宽大约只够 700 多次访问就被限流

> 壁纸画面的版权情况见仓库根目录的 `THIRD-PARTY-NOTICES.md`。
