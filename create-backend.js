/**
 * 后端项目创建脚本
 * 用于将后端代码分离到独立目录，便于部署
 */

const fs = require('fs');
const path = require('path');

// 后端项目目录
const backendDir = path.join(__dirname, 'backend');

// 确保目录存在
function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`创建目录: ${dir}`);
  }
}

// 复制文件
function copyFile(src, dest) {
  fs.copyFileSync(src, dest);
  console.log(`复制文件: ${src} -> ${dest}`);
}

// 创建文件
function createFile(file, content) {
  fs.writeFileSync(file, content);
  console.log(`创建文件: ${file}`);
}

// 读取文件内容
function readFile(file) {
  return fs.readFileSync(file, 'utf8');
}

// 开始创建后端项目
console.log('开始创建后端项目...');

// 1. 创建目录结构
ensureDir(backendDir);
ensureDir(path.join(backendDir, 'utils'));
ensureDir(path.join(backendDir, 'tools'));
ensureDir(path.join(backendDir, 'exports'));

// 2. 复制配置文件并修改
const configContent = readFile(path.join(__dirname, 'config.js'));
// 只保留MySQL相关配置
const newConfigContent = configContent.replace(/module\.exports = {[\s\S]+}/m, 
`module.exports = {
  // MySQL配置
  mysql: {
    host: '106.14.26.102',
    port: 3306, 
    user: 'bookshelf',
    password: 'zhangjia59',
    database: 'bookshelf',
    connectionLimit: 10,
    charset: 'utf8mb4'
  }
}`);
createFile(path.join(backendDir, 'config.js'), newConfigContent);

// 3. 复制MySQL工具类
copyFile(
  path.join(__dirname, 'utils', 'mysql.js'),
  path.join(backendDir, 'utils', 'mysql.js')
);

// 4. 复制导入工具
copyFile(
  path.join(__dirname, 'tools', 'import.js'),
  path.join(backendDir, 'tools', 'import.js')
);
copyFile(
  path.join(__dirname, 'tools', 'combine.js'),
  path.join(backendDir, 'tools', 'combine.js')
);

// 5. 复制服务器代码
copyFile(
  path.join(__dirname, 'server', 'app.js'),
  path.join(backendDir, 'app.js')
);

// 6. 创建package.json
const packageJson = {
  "name": "bookshelf-backend",
  "version": "1.0.0",
  "description": "书架小程序MySQL后端",
  "main": "app.js",
  "scripts": {
    "start": "node app.js",
    "import": "node tools/import.js"
  },
  "dependencies": {
    "cors": "^2.8.5",
    "express": "^4.17.1",
    "mysql2": "^2.3.3"
  }
};
createFile(
  path.join(backendDir, 'package.json'),
  JSON.stringify(packageJson, null, 2)
);

// 7. 创建README.md
const readmeContent = `# 书架小程序MySQL后端

这是书架小程序的MySQL后端服务，提供了API接口供小程序调用。

## 安装

\`\`\`bash
npm install
\`\`\`

## 数据导入

将导出的JSON文件放入exports目录，然后运行:

\`\`\`bash
npm run import -- exports/books.json exports/categories.json
\`\`\`

## 启动服务

\`\`\`bash
npm start
\`\`\`

服务器默认在3000端口启动。可以通过更改app.js修改端口。

## API接口

- GET /api/categories - 获取所有分类
- GET /api/categories/:id - 获取单个分类
- POST /api/categories - 创建分类
- PUT /api/categories/:id - 更新分类
- DELETE /api/categories/:id - 删除分类

- GET /api/books - 获取图书列表
- GET /api/books/search - 搜索图书
- GET /api/books/:id - 获取单本图书
- POST /api/books - 创建图书
- PUT /api/books/:id - 更新图书
- DELETE /api/books/:id - 删除图书
`;
createFile(path.join(backendDir, 'README.md'), readmeContent);

// 8. 创建.gitignore
const gitignoreContent = `node_modules/
package-lock.json
npm-debug.log
.DS_Store
exports/*.json
`;
createFile(path.join(backendDir, 'gitignore'), gitignoreContent);

// 9. 更新app.js中的导入路径
let appJsContent = readFile(path.join(backendDir, 'app.js'));
// 替换config导入路径
appJsContent = appJsContent.replace(
  /const config = require\(['"](\.\.\/config|\.\.\/\.\.\/config)['"]\);/g,
  'const config = require(\'./config\');'
);
// 替换mysql工具导入路径
appJsContent = appJsContent.replace(
  /const mysql = require\(['"](\.\.\/utils\/mysql|\.\.\/\.\.\/utils\/mysql)['"]\);/g,
  'const mysql = require(\'./utils/mysql\');'
);
createFile(path.join(backendDir, 'app.js'), appJsContent);

// 10. 更新import.js中的导入路径
let importJsContent = readFile(path.join(backendDir, 'tools', 'import.js'));
// 替换config导入路径
importJsContent = importJsContent.replace(
  /const config = require\(['"](\.\.\/config|\.\.\/\.\.\/config)['"]\);/g,
  'const config = require(\'../config\');'
);
// 替换mysql工具导入路径
importJsContent = importJsContent.replace(
  /const mysql = require\(['"](\.\.\/utils\/mysql|\.\.\/\.\.\/utils\/mysql)['"]\);/g,
  'const mysql = require(\'../utils/mysql\');'
);
createFile(path.join(backendDir, 'tools', 'import.js'), importJsContent);

// 11. 更新combine.js中的导入路径
let combineJsContent = readFile(path.join(backendDir, 'tools', 'combine.js'));
// 替换任何相对路径导入
combineJsContent = combineJsContent.replace(
  /const config = require\(['"](\.\.\/config|\.\.\/\.\.\/config)['"]\);/g,
  'const config = require(\'../config\');'
);
createFile(path.join(backendDir, 'tools', 'combine.js'), combineJsContent);

console.log('后端项目创建完成！');
console.log(`
后端项目位于: ${backendDir}

使用方法:
cd backend
npm install
node tools/import.js exports/books.json exports/categories.json
node app.js
`); 