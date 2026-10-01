# Fearless Soldier / 无畏士兵

在 200×200 格森林中拓荒、寻找装备，并击败深处的 Boss。电脑浏览器单人游戏，原生 JavaScript + Canvas，无运行时第三方依赖。

## 启动

需要 Node.js 20 或更新版本。

```sh
npm start
```

打开 http://localhost:5173。可通过 `PORT=5174 npm start` 改端口。不要直接双击 HTML，浏览器需要 HTTP 来加载模块。

## 操作

WASD / 方向键移动，空格每按一次攻击一次，Esc 暂停。页面失焦自动暂停，点击继续恢复。食物与武器走上去自动拾取，满血保留食物。存档保存在当前浏览器与当前地址的 localStorage；刷新后可继续，死亡清除本局。

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

产品规则见 [docs/PRD.md](docs/PRD.md)。逻辑与平衡配置在 `src/game.js`，像素绘制在 `src/render.js`，UI、输入与存档在 `src/main.js`。
