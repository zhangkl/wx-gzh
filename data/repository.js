const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'db.json');

function readDb() {
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
}

function writeDb(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

function nextId(list) {
  return (list.at(-1)?.id || 0) + 1;
}

function mapArticleWithCategory(article, categories) {
  const category = categories.find((c) => c.id === article.categoryId);
  return { ...article, categoryName: category ? category.name : '未分类' };
}

module.exports = {
  readDb,
  writeDb,
  nextId,
  mapArticleWithCategory
};
