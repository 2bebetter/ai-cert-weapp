# 图标资源说明

## tabBar 图标（assets/tab/）

小程序 tabBar **只接受本地 PNG**，不支持 SVG、图标字体或 base64 data-uri，
所以这 8 个文件是必需的实体图片。

| 文件 | tab | 图形 |
|---|---|---|
| `home.png` / `home-on.png` | 首页 | 房子（带门） |
| `book.png` / `book-on.png` | 理论学习 | 翻开的书 |
| `code.png` / `code-on.png` | 实操学习 | `<>` 括号 |
| `user.png` / `user-on.png` | 我的 | 人像头肩 |

- `-on` 后缀 = 选中态，配色 `#007aff`；未选中为 `#8e8e93`
- 规格 81×81 RGBA（微信推荐尺寸），单文件约 1 KB，远低于 40 KB 上限
- 与内页矢量图标同一套 24×24 栅格、线宽 2、圆头圆角

### 重新生成

```bash
node tools/gen-tabbar-icons.js
```

脚本用纯 Node 光栅化折线/圆并自编码 PNG，**零依赖**。
改 `ICONS` 里的坐标点即可调整图形，改 `COLORS` 调整配色。

## 内页图标（styles/icons.wxss）

页面内部图标不走图片，用 inline SVG data-uri 写在 `styles/icons.wxss` 里，
在 `app.wxss` 顶部 `@import`，全局可用。用法：

```html
<view class="ic ic-16 ic-alert"></view>
```

## 已知坑

**`project.private.config.json` 里的 `ignoreDevUnusedFiles` 必须保持 `false`。**

它对应开发者工具「详情 → 本地设置 → 过滤未使用的文件」。开启后工具会按
依赖图裁剪文件，而 **tabBar 图标只被 `app.json` 引用，不在 WXML/WXSS 依赖
图里**，会被判为无用文件剔除，导致 tabBar 四个图标全部显示为无法加载的图片。

如果图标再次不显示，按顺序排查：

1. 确认该设置是关的（工具界面里也要确认一次，外部改文件可能被工具覆盖）
2. 工具 → 清除缓存 → 清除全部缓存
3. 重新编译（Cmd/Ctrl + B）；必要时重启开发者工具
