# 稻米小屋小程序

一个基于微信小程序的稻米小屋管理系统，帮助用户管理家庭藏书。

## 功能特点

- 📚 图书管理：添加、编辑、删除图书信息
- 🔍 搜索功能：支持按书名、作者、分类搜索
- 📱 借阅管理：记录图书借阅状态
- 🏷️ 分类管理：支持自定义图书分类
- 📊 数据统计：展示藏书数量、借阅情况等

## 技术栈

- 微信小程序原生开发
- Vant Weapp UI 组件库
- Node.js 包管理

## 项目结构

```
project/
├── miniprogram/          # 小程序源码目录
│   ├── pages/           # 页面文件
│   ├── images/          # 图片资源
│   ├── app.js           # 小程序入口文件
│   ├── app.json         # 小程序配置文件
│   ├── app.wxss         # 全局样式文件
│   └── sitemap.json     # 小程序搜索配置
├── project.config.json  # 项目配置文件
└── package.json         # 项目依赖配置
```

## 开发环境

- 微信开发者工具
- Node.js
- npm

## 安装和运行

1. 克隆项目
```bash
git clone https://github.com/zjh459/family-library.git
```

2. 配置敏感信息
```bash
# 复制示例配置文件
cp config.js.example config.js

# 编辑 config.js 文件，填入您的云环境ID和API密钥
```

3. 安装依赖
```bash
npm install
```

4. 在微信开发者工具中导入项目

5. 点击"工具" -> "构建 npm"

6. 编译运行项目

## 贡献指南

欢迎提交 Issue 和 Pull Request 来帮助改进项目。

## 许可证

MIT License 

## Vant组件引用问题解决方案

针对错误：`app.json: ["usingComponents"]["van-button"]: "miniprogram_npm/@vant/weapp/button/index" 路径下未找到组件`

### 解决方案：正确引用miniprogram文件夹下的组件

1. 确保project.config.json中设置正确：
   ```json
   "packNpmManually": true,
   "packNpmRelationList": [
     {
       "packageJsonPath": "./package.json",
       "miniprogramNpmDistDir": "./miniprogram/"
     }
   ]
   ```

   这表示npm包会被构建到`miniprogram`目录下。

2. 在app.json中使用正确的组件路径：
   ```json
   "usingComponents": {
     "van-button": "miniprogram/miniprogram_npm/@vant/weapp/button/index",
     ...
   }
   ```

3. 在微信开发者工具中执行以下操作：
   - 确保已安装依赖：`npm install`
   - 点击"工具" -> "构建npm"
   - 确保在miniprogram文件夹下生成了miniprogram_npm目录
   - 重新编译项目

4. 如果仍然有问题，可以尝试：
   - 删除miniprogram_npm目录
   - 重新构建npm
   - 重启开发者工具 