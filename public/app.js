async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || '请求失败');
  }
  return data;
}

function mountSidebar(active) {
  const el = document.getElementById('sidebar');
  if (!el) return;
  el.innerHTML = `
    <div class="logo">📘 帮助中心管理系统</div>
    <div class="menu">
      <h4>内容管理</h4>
      <a class="${active === 'list' ? 'active' : ''}" href="/index.html">内容列表</a>
      <a class="${active === 'category' ? 'active' : ''}" href="/category.html">分类管理</a>
      <a class="${active === 'feedback' ? 'active' : ''}" href="/feedback.html">评论反馈</a>
      <h4>数据统计</h4>
      <a class="${active === 'overview' ? 'active' : ''}" href="/overview.html">数据概览</a>
      <a class="${active === 'search' ? 'active' : ''}" href="/search.html">搜索统计</a>
      <h4>系统设置</h4>
      <a class="${active === 'edit' ? 'active' : ''}" href="/edit.html">文档编辑</a>
      <a class="${active === 'settings' ? 'active' : ''}" href="/settings.html">系统配置</a>
    </div>`;
}

function fmtPercent(v) {
  return `${Number(v).toFixed(1)}%`;
}

function simpleLineChart(canvas, labels, values, lineColor = '#2563eb') {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  const padding = 28;
  const max = Math.max(...values, 1);

  ctx.clearRect(0, 0, w, h);
  ctx.strokeStyle = '#e5e7eb';
  ctx.beginPath();
  ctx.moveTo(padding, padding);
  ctx.lineTo(padding, h - padding);
  ctx.lineTo(w - padding, h - padding);
  ctx.stroke();

  ctx.strokeStyle = lineColor;
  ctx.lineWidth = 2;
  ctx.beginPath();
  values.forEach((val, i) => {
    const x = padding + (i * (w - padding * 2)) / (values.length - 1 || 1);
    const y = h - padding - (val / max) * (h - padding * 2);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  ctx.fillStyle = '#6b7280';
  ctx.font = '11px Arial';
  labels.forEach((label, i) => {
    const x = padding + (i * (w - padding * 2)) / (labels.length - 1 || 1);
    ctx.fillText(label, x - 8, h - 8);
  });
}
