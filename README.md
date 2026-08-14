# AMU Portal

阿牧网云统一数字内容入口与路径路由中心。

目标：长期固定使用一个主域名，通过 `/xxx/` 路径访问不同项目，减少重复 DNS 配置，并保持各项目仓库独立维护。

## 规划路由

- `/`：统一导航首页
- `/exhibition/`：阿牧展厅
- `/culture/`：企业文化手册
- `/factory/`：贵安工厂 / 生产智造中心
- `/events/`：展会与活动专题
- `/verify/`：后续验证与静态文件入口

## 架构

- `public/`：Cloudflare Pages 静态输出目录
- `functions/_middleware.js`：统一路径反向代理
- 各子项目仍保持独立仓库、独立部署

建议在 Cloudflare Pages → Settings → Environment variables 配置：

- `EXHIBITION_ORIGIN`：展厅项目源站，例如 `https://xxx.pages.dev`
- `CULTURE_ORIGIN`：文化手册源站；代码已内置 `https://magazinelite.pages.dev` 作为当前默认值
- `FACTORY_ORIGIN`：工厂项目源站（有项目后再配）
- `EVENTS_ORIGIN`：活动项目源站（有项目后再配）

这样主域名只需要绑定 AMU_Portal；以后新增项目，原则上只增加路径路由，不再新增 DNS 记录。

## Cloudflare Pages 部署

- Framework preset：None
- Build command：`exit 0`
- Build output directory：`public`
- Root directory：仓库根目录
- Functions：自动识别根目录下的 `functions/`
- Custom domain：后续将 `www.amncai.cn` 绑定到本项目

## 维护原则

1. `main` 为唯一发布分支。
2. 新增项目优先新增路径路由，不新增 DNS 记录。
3. 子项目继续在自己的仓库维护，Portal 只负责统一入口和路由。
4. 微信等域名验证文件放在 `public/` 中，因此部署后仍位于网站根路径。
