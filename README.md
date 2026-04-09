# nodebb-plugin-language-partner

一个基于 NodeBB 官方 quickstart 结构整理出来的语伴页面插件。

## 功能

- 新增前台页面：`/language-partners`
- HelloTalk 风格的移动端语伴列表 UI
- 从 NodeBB 用户接口拉取在线用户
- 支持母语 / 性别筛选
- 支持点击按钮直接发起私聊
- 支持用户详情缓存与骨架屏
- 支持按国家显示头像角标国旗

## 目录结构

- `plugin.json`：插件声明
- `library.js`：注册前台路由和 ACP 页面
- `lib/controllers.js`：ACP 页面控制器
- `templates/language-partners.tpl`：前台页面模板
- `templates/admin/plugins/language-partner.tpl`：后台说明页
- `public/lib/language-partners.js`：页面逻辑
- `scss/language-partners.scss`：页面样式

## 本地安装

把插件目录放到你的 NodeBB 根目录下，然后用下面两种方式之一安装：

### 方式一：开发联调

```bash
cd /path/to/nodebb-plugin-language-partner
npm link
cd /path/to/NodeBB
npm link nodebb-plugin-language-partner
./nodebb build
./nodebb restart
```

### 方式二：直接放到 node_modules

```bash
cd /path/to/NodeBB
npm install /absolute/path/to/nodebb-plugin-language-partner
./nodebb build
./nodebb restart
```

然后进入：

- ACP -> Extend -> Plugins 启用插件
- 前台访问 `/language-partners`
- ACP 访问 `/admin/plugins/language-partner`

## 你可能还要改的地方

1. `public/lib/language-partners.js`
   - 如果你的站点在线用户接口字段不一样，调整 `fetchLatestList()` 和 `fetchOneProfile()`
   - 如果私聊 socket 事件名与你的 NodeBB 版本不同，调整 `findPrivateRoom()` / `createPrivateRoom()`

2. `templates/language-partners.tpl`
   - 如果你还想做“附近”页，可以把顶部第二个 tab 改成真实链接

3. 地理位置同步
   - 当前保留了你原始代码里的浏览器定位与写回用户 location 字段逻辑
   - 如不需要，请注释掉 `setTimeout(startBackgroundLocationSync, 1200);`

## 发布到 npm

发布前至少改这些字段：

- `package.json > author`
- `package.json > repository`
- `package.json > bugs`
- `plugin.json > url`
