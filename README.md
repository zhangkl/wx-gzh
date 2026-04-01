# 帮助中心知识库（持续完善版）

本项目已实现一个**可运行的完整帮助中心后台 Demo**，覆盖你提供的原型核心功能，并补充了管理端常见能力：

- 内容列表：筛选、分页、删除、关键指标卡片
- 分类管理：新增、启停、删除保护（分类下有文档时不可删）
- 文档编辑：新增/编辑、草稿/发布、热门标记、关键词
- 数据概览：指标卡片、趋势图、分类占比、热门内容排行
- 搜索统计：搜索趋势、终端分布、热门词、无结果词
- 评论反馈：反馈录入与列表
- 系统配置：站点名与策略开关

## 技术实现

- 后端：Node.js 原生 `http`（无框架）
- 数据：`data/db.json` 文件持久化（通过 `data/repository.js` 读写）
- 前端：原生 HTML/CSS/JS，多页面管理后台

## 启动

```bash
npm start
```

访问：<http://localhost:3000>

## 主要 API

### 分类
- `GET /api/categories`
- `POST /api/categories`
- `PUT /api/categories/:id`
- `DELETE /api/categories/:id`

### 文档
- `GET /api/articles?page=1&pageSize=10&q=&categoryId=&status=`
- `GET /api/articles/:id`
- `POST /api/articles`
- `PUT /api/articles/:id`
- `DELETE /api/articles/:id`

### 反馈
- `GET /api/feedback`
- `POST /api/feedback`

### 统计
- `GET /api/metrics/content`
- `GET /api/metrics/overview`
- `GET /api/metrics/search`

### 配置
- `GET /api/settings`
- `PUT /api/settings`
