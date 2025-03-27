# 书架小程序项目

这是一个书架管理小程序项目，已完成从微信云开发到MySQL的迁移。该项目分为前端和后端两部分，支持完全分离部署。

## 项目结构

```
项目根目录
├── miniprogram/         # 微信小程序前端
│   ├── pages/           # 小程序页面
│   ├── utils/           # 工具类
│   │   ├── api.js       # API通信工具
│   │   └── database.js  # 数据库操作封装
│   ├── app.js           # 小程序入口
│   ├── app.json         # 小程序配置
│   ├── app.wxss         # 全局样式
│   └── config.js        # 小程序配置（需从config-template.js复制）
│
├── backend/             # 后端服务器（独立部署）
│   ├── app.js           # 服务器入口
│   ├── config.js        # 服务器配置
│   ├── utils/           # 工具类
│   │   └── mysql.js     # MySQL数据库工具
│   └── package.json     # 后端依赖
│
├── create-backend.js    # 后端项目创建脚本（已使用）
├── package.json         # 前端项目依赖
├── project.config.json  # 小程序项目配置
└── 迁移步骤.md          # 迁移指南
```

## 前端使用方法

1. 将`miniprogram/config-template.js`复制为`miniprogram/config.js`
2. 修改`config.js`中的服务器地址为您的后端服务地址
3. 确保`server.useApi = true`开启MySQL API模式
4. 使用微信开发者工具导入项目

## 后端部署说明

后端已经部署到服务器上，运行在指定端口。如需重新部署，请参考以下步骤：

1. 将`backend`目录上传至服务器
2. 进入目录后执行：
   ```bash
   npm install
   node app.js
   ```
3. 建议使用PM2等工具管理Node.js进程：
   ```bash
   npm install -g pm2
   pm2 start app.js --name bookshelf
   ```

## 功能特性

- 图书分类管理（支持图标和颜色）
- 图书详细信息记录和查询
- 全文搜索功能
- 数据导出/导入功能
- 前后端分离架构

## 技术栈

- 前端：微信小程序、Vant Weapp UI
- 后端：Node.js、Express、MySQL
- 数据：MySQL关系型数据库

## 从微信云开发迁移到MySQL

### 1. 准备工作

1. 确保已安装MySQL服务器并创建`bookshelf`数据库
2. 在`config.js`配置文件中设置正确的MySQL连接信息

### 2. 导出数据

方法一：使用小程序导出工具
1. 打开小程序的"数据导出"页面（在首页的设置菜单中）
2. 点击"开始导出"按钮
3. 导出完成后，点击"导出为JSON"按钮
4. 将导出的JSON文件保存到`backend/exports/`目录

方法二：使用云开发控制台导出
1. 登录微信云开发控制台
2. 手动导出`categories`和`books`集合
3. 将导出的JSON文件保存到`backend/exports/`目录

### 3. 导入数据到MySQL

```
cd backend
npm install
node tools/import.js exports/books.json exports/categories.json
```

### 4. 启动服务器

```
cd backend
node app.js
```

服务器默认在3000端口启动，可通过配置文件修改。

### 5. 配置小程序

1. 将`miniprogram/config-template.js`复制为`miniprogram/config.js`
2. 修改配置文件中的服务器URL和其他配置
3. 将`server.useApi`设置为`true`，启用MySQL API

## 前后端分离部署

本项目支持将后端独立部署到服务器。使用以下命令创建独立后端项目：

```
node create-backend.js
```

这将在`backend/`目录创建可独立部署的后端项目。


## 常见问题

1. API连接错误：检查小程序配置文件中的服务器URL是否正确
2. 导入失败：检查JSON文件格式和路径是否正确
3. 数据库连接失败：检查MySQL服务是否启动，配置是否正确 