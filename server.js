const http = require('http');
const fs = require('fs');
const path = require('path');
const { readDb, writeDb, nextId, mapArticleWithCategory } = require('./data/repository');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8'
};

const publicDir = path.join(__dirname, 'public');

function send(res, statusCode, data, type = 'application/json; charset=utf-8') {
  res.writeHead(statusCode, { 'Content-Type': type });
  res.end(type.includes('json') ? JSON.stringify(data) : data);
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
    });
    req.on('end', () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (e) {
        reject(new Error('JSON 解析失败'));
      }
    });
  });
}

function serveStatic(req, res) {
  const requested = req.url === '/' ? '/index.html' : req.url;
  const filePath = path.join(publicDir, requested);

  if (!filePath.startsWith(publicDir)) {
    return send(res, 403, 'Forbidden', 'text/plain; charset=utf-8');
  }

  fs.readFile(filePath, (err, content) => {
    if (err) return send(res, 404, 'Not found', 'text/plain; charset=utf-8');
    const ext = path.extname(filePath);
    send(res, 200, content, MIME[ext] || 'text/plain; charset=utf-8');
  });
}

function buildContentMetrics(db) {
  const totalArticles = db.articles.length;
  const published = db.articles.filter((a) => a.status === 'published');
  const monthlyNew = db.articles.filter((a) => a.updatedAt.startsWith('2026-03')).length;
  const totalViews = db.articles.reduce((sum, a) => sum + a.views, 0);
  const satisfaction = db.feedback.length
    ? Math.round((db.feedback.filter((f) => f.type === 'useful').length / db.feedback.length) * 1000) / 10
    : 0;

  return {
    totalArticles,
    publishedCount: published.length,
    monthlyNew,
    totalViews,
    satisfaction
  };
}

function buildOverviewMetrics(db) {
  const contentCount = db.articles.length;
  const viewCount = db.articles.reduce((sum, a) => sum + a.views, 0);
  const usefulRate = db.feedback.length
    ? Math.round((db.feedback.filter((f) => f.type === 'useful').length / db.feedback.length) * 1000) / 10
    : 0;

  return {
    contentCount,
    viewCount,
    avgReadDuration: '2分42秒',
    usefulRate,
    trends: db.search.trends,
    categoryDistribution: db.categories.map((category) => {
      const views = db.articles.filter((a) => a.categoryId === category.id).reduce((sum, a) => sum + a.views, 0);
      return { name: category.name, views };
    })
  };
}

function buildSearchMetrics(db) {
  const totalSearch = db.search.trends.reduce((sum, t) => sum + t.total, 0);
  const successSearch = db.search.trends.reduce((sum, t) => sum + t.success, 0);
  const users = 89234;

  return {
    searchCount: totalSearch,
    users,
    successRate: totalSearch ? Math.round((successSearch / totalSearch) * 1000) / 10 : 0,
    perUserCount: Math.round((totalSearch / users) * 100) / 100,
    trends: db.search.trends,
    terminalDistribution: db.search.terminalDistribution,
    hotKeywords: db.search.hotKeywords,
    noResultKeywords: db.search.noResultKeywords
  };
}

function paginate(list, page, pageSize) {
  const total = list.length;
  const offset = (page - 1) * pageSize;
  return {
    total,
    page,
    pageSize,
    list: list.slice(offset, offset + pageSize)
  };
}

async function handleApi(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const db = readDb();

  if (req.method === 'GET' && url.pathname === '/api/categories') {
    return send(res, 200, db.categories.sort((a, b) => b.sortWeight - a.sortWeight));
  }

  if (req.method === 'POST' && url.pathname === '/api/categories') {
    const body = await parseBody(req);
    if (!body.name) return send(res, 400, { message: '分类名称必填' });
    const record = {
      id: nextId(db.categories),
      name: body.name,
      description: body.description || '',
      icon: body.icon || '📁',
      sortWeight: Number(body.sortWeight || 0),
      enabled: body.enabled !== false
    };
    db.categories.push(record);
    writeDb(db);
    return send(res, 201, record);
  }

  if (req.method === 'PUT' && url.pathname.startsWith('/api/categories/')) {
    const id = Number(url.pathname.split('/').pop());
    const body = await parseBody(req);
    const index = db.categories.findIndex((c) => c.id === id);
    if (index === -1) return send(res, 404, { message: '分类不存在' });
    db.categories[index] = { ...db.categories[index], ...body };
    writeDb(db);
    return send(res, 200, db.categories[index]);
  }

  if (req.method === 'DELETE' && url.pathname.startsWith('/api/categories/')) {
    const id = Number(url.pathname.split('/').pop());
    if (db.articles.some((a) => a.categoryId === id)) {
      return send(res, 400, { message: '该分类下有文档，无法删除' });
    }
    const index = db.categories.findIndex((c) => c.id === id);
    if (index === -1) return send(res, 404, { message: '分类不存在' });
    const deleted = db.categories.splice(index, 1)[0];
    writeDb(db);
    return send(res, 200, deleted);
  }

  if (req.method === 'GET' && url.pathname === '/api/articles') {
    const page = Number(url.searchParams.get('page') || 1);
    const pageSize = Number(url.searchParams.get('pageSize') || 10);
    const categoryId = Number(url.searchParams.get('categoryId') || 0);
    const status = (url.searchParams.get('status') || '').trim();
    const q = (url.searchParams.get('q') || '').trim();

    let list = db.articles.map((a) => mapArticleWithCategory(a, db.categories));
    if (categoryId) list = list.filter((a) => a.categoryId === categoryId);
    if (status) list = list.filter((a) => a.status === status);
    if (q) {
      list = list.filter((a) => a.title.includes(q) || a.keywords.some((k) => k.includes(q)) || a.content.includes(q));
    }
    list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return send(res, 200, paginate(list, page, pageSize));
  }

  if (req.method === 'GET' && url.pathname.startsWith('/api/articles/')) {
    const id = Number(url.pathname.split('/').pop());
    const article = db.articles.find((a) => a.id === id);
    if (!article) return send(res, 404, { message: '文档不存在' });
    return send(res, 200, mapArticleWithCategory(article, db.categories));
  }

  if (req.method === 'POST' && url.pathname === '/api/articles') {
    const body = await parseBody(req);
    if (!body.title || !body.categoryId) return send(res, 400, { message: '标题和分类必填' });
    const record = {
      id: nextId(db.articles),
      title: body.title,
      categoryId: Number(body.categoryId),
      status: body.status || 'draft',
      views: Number(body.views || 0),
      usefulRate: Number(body.usefulRate || 0),
      updatedAt: new Date().toISOString().slice(0, 10),
      keywords: body.keywords || [],
      isHot: Boolean(body.isHot),
      content: body.content || ''
    };
    db.articles.push(record);
    writeDb(db);
    return send(res, 201, mapArticleWithCategory(record, db.categories));
  }

  if (req.method === 'PUT' && url.pathname.startsWith('/api/articles/')) {
    const id = Number(url.pathname.split('/').pop());
    const body = await parseBody(req);
    const index = db.articles.findIndex((a) => a.id === id);
    if (index === -1) return send(res, 404, { message: '文档不存在' });

    db.articles[index] = {
      ...db.articles[index],
      ...body,
      categoryId: body.categoryId ? Number(body.categoryId) : db.articles[index].categoryId,
      updatedAt: new Date().toISOString().slice(0, 10)
    };
    writeDb(db);
    return send(res, 200, mapArticleWithCategory(db.articles[index], db.categories));
  }

  if (req.method === 'DELETE' && url.pathname.startsWith('/api/articles/')) {
    const id = Number(url.pathname.split('/').pop());
    const index = db.articles.findIndex((a) => a.id === id);
    if (index === -1) return send(res, 404, { message: '文档不存在' });
    const deleted = db.articles.splice(index, 1)[0];
    writeDb(db);
    return send(res, 200, deleted);
  }

  if (req.method === 'GET' && url.pathname === '/api/feedback') {
    const list = db.feedback.map((f) => {
      const article = db.articles.find((a) => a.id === f.articleId);
      return { ...f, articleTitle: article ? article.title : '已删除文档' };
    });
    return send(res, 200, list);
  }

  if (req.method === 'POST' && url.pathname === '/api/feedback') {
    const body = await parseBody(req);
    if (!body.articleId || !body.type) return send(res, 400, { message: 'articleId/type 必填' });
    const record = {
      id: nextId(db.feedback),
      articleId: Number(body.articleId),
      user: body.user || 'anonymous',
      type: body.type,
      comment: body.comment || '',
      createdAt: new Date().toISOString().slice(0, 10)
    };
    db.feedback.push(record);
    writeDb(db);
    return send(res, 201, record);
  }

  if (req.method === 'GET' && url.pathname === '/api/metrics/content') {
    return send(res, 200, buildContentMetrics(db));
  }

  if (req.method === 'GET' && url.pathname === '/api/metrics/overview') {
    return send(res, 200, buildOverviewMetrics(db));
  }

  if (req.method === 'GET' && url.pathname === '/api/metrics/search') {
    return send(res, 200, buildSearchMetrics(db));
  }

  if (req.method === 'GET' && url.pathname === '/api/settings') {
    return send(res, 200, db.settings);
  }

  if (req.method === 'PUT' && url.pathname === '/api/settings') {
    const body = await parseBody(req);
    db.settings = { ...db.settings, ...body };
    writeDb(db);
    return send(res, 200, db.settings);
  }

  return send(res, 404, { message: 'Not Found' });
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.url.startsWith('/api/')) return await handleApi(req, res);
    return serveStatic(req, res);
  } catch (error) {
    return send(res, 500, { message: error.message || 'Server error' });
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Help center app running at http://localhost:${PORT}`);
});
