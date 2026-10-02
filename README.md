# Fearless Soldier / 无畏士兵

在 100×100 格森林中拓荒、寻找装备，并击败深处的 Boss。电脑浏览器单人游戏，原生 JavaScript + Canvas，无运行时第三方依赖。

## 启动

需要 Node.js 20 或更新版本。

```sh
npm start
```

打开 http://localhost:5173。可通过 `PORT=5174 npm start` 改端口。不要直接双击 HTML，浏览器需要 HTTP 来加载模块。

画面铺满视口：士兵固定在正中心，地图平滑滚动；左上角为圆形探索地图，右下角为生命与装备。挥砍带刀光、受击动作和合成音效，可通过右上角音符按钮静音。

普通怪物未发现士兵时也会在空地随机游走，发现后追击；脱战后恢复游走并保留血量。已有 v2 存档直接支持该行为。

击杀怪物获得经验，升级后按 1 选择生命强化或按 2 选择攻速强化，也可以点击选择。升级期间暂停战斗；右下角显示等级、经验、生命上限和攻速。成长随本局存档保存，死亡重置，已有 v2 存档无需重新开局。

## 操作

WASD / 方向键移动，空格每按一次攻击一次，Esc 暂停。页面失焦自动暂停，点击继续恢复。食物与武器走上去自动拾取，满血保留食物。存档保存在当前浏览器与当前地址的 localStorage；刷新后可继续，死亡清除本局。当前使用 v2 存档；旧版 200×200 的 v1 存档保留，新版需从缩小后的地图重新出发。

## 验证

```sh
npm test
npm run check
```

浏览器交互测试使用 Playwright（仅开发依赖）：

```sh
npm install
npx playwright install chromium
npm run test:browser
```

测试自动启动独立的 5174 端口服务；截图保存在 `artifacts/`。验证范围与结果见 [docs/VERIFICATION.md](docs/VERIFICATION.md)。

产品规则见 [docs/PRD.md](docs/PRD.md)。逻辑与平衡配置在 `src/game.js`，像素绘制在 `src/render.js`，UI、输入与存档在 `src/main.js`，合成音效在 `src/audio.js`。
