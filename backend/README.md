# 书架小程序MySQL后端

这是书架小程序的MySQL后端服务，提供了API接口供小程序调用。

## 安装

```bash
npm install
```

## 数据导入

将导出的JSON文件放入exports目录，然后运行:

```bash
npm run import -- exports/books.json exports/categories.json
```

## 启动服务

```bash
npm start
```

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
