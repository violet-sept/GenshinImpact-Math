# 第三方素材声明 / Third-Party Notices

本仓库的**源代码**以 [MIT](./LICENSE) 授权。但仓库里还包含一部分**不属于我、也不在 MIT 覆盖范围内**的美术素材，在此单独声明。

**授权范围 / Scope：** [LICENSE](./LICENSE) 里是标准 MIT 原文，**只覆盖源代码**（TypeScript / CSS / HTML / 构建脚本），不包含任何美术素材。The MIT license covers the **source code only**. Art assets originating from the game "Genshin Impact" remain the property of miHoYo / COGNOSPHERE and are **NOT** covered by it — see the sections below.

---

## 1. 《原神》游戏素材

仓库内以下文件来自游戏《原神》（Genshin Impact）的官方表情包与官方截图：

| 路径 | 数量 | 用途 |
| --- | --- | --- |
| `src/assets/big-idea/*.png` | 21 张 | 知识点侧栏「一句话本质」旁的小图标 |
| `src/assets/rules/*.png` | 4 张 | 首页「网站规则」四条规则的图标 |

**版权归属：** © miHoYo / COGNOSPHERE. All rights reserved.
《原神》的名称、角色形象、表情包与截图，其著作权与商标权均归米哈游（上海米哈游影铁科技有限公司 / COGNOSPHERE PTE. LTD.）所有。

**本项目的立场：**

- 本项目是**非商业的、以学习为目的的同人作品**，不售卖、不投放广告、不做任何形式的商业变现。
- 使用这些素材属于「合理引用」性质的教学演示，**不主张对这些素材的任何权利**，也不表示米哈游对本项目的认可或背书。
- 这些素材**不在 MIT 协议覆盖范围内**。任何人 fork 本项目时，对这部分素材的再使用需要**自行**取得授权或替换为无版权素材。

**如果你要商用或者再分发，请把上表里的文件替换成你自己的素材。** 替换方式很简单：

- 「一句话本质」图标：按知识点 id 命名（如 `L1.png`、`C5.png`）放进 `src/assets/big-idea/` 即可，`src/assets/big-idea/index.ts` 用 `import.meta.glob` 自动发现，**不需要改任何代码**。
- 「网站规则」图标：替换 `src/assets/rules/` 下的 4 个文件，或改 `src/pages/Home.tsx` 里的 `PILLARS` 图标引用。

> 缺图会导致内容契约测试失败（`src/topics/content.test.tsx` 会检查每个知识点都有对应图片），这算是刻意留的一道提醒。

---

## 2. 动态壁纸视频

原来放在 `public/wallpaper/nahida.mp4` 的壁纸视频（约 135MB）**没有收录进本仓库**，原因有两个：

1. 它超过了 GitHub 单文件 100MB 的硬上限，提交后 push 会被直接拒绝；
2. 它的画面同样来自《原神》，版权情况与第 1 节相同；
3. 附带一提，135MB 的视频让每次打开页面都要下载一遍，GitHub Pages 每月 100GB 的软带宽限制大约只够 700 多次访问。

所以壁纸改成了**可选外链**：把视频放在你自己的存储上，用 `VITE_WALLPAPER_URL` 指过去。详见 [`.env.example`](./.env.example) 与 README 的「部署」一节。仓库里**不含**任何视频文件。

---

## 3. 运行时依赖

npm 依赖（React、Vite、Tailwind CSS、Motion、React Router、Vitest 等）各自遵循其自身协议，都是 MIT 或 Apache-2.0 等宽松协议，完整清单与协议文本见 `node_modules/` 中各包自带的 `LICENSE`，以及 `package-lock.json`。
