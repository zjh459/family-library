# 从云数据库迁移到MySQL的完整指南

本指南将帮助你将稻米小屋小程序从云数据库迁移到自己的MySQL服务器。

## 一、服务器端部署步骤

### 1. 准备MySQL数据库

1. 确保你的服务器上已安装MySQL（推荐MySQL 5.7+）
2. 创建数据库和表结构：

```bash
mysql -u your_username -p < server/database.sql
```

### 2. 安装Node.js服务器

1. 确保服务器上已安装Node.js（推荐v14+）
2. 部署服务器代码：

```bash
# 创建服务器目录
mkdir -p /path/to/family-library-server
cd /path/to/family-library-server

# 复制项目文件
cp -r /path/to/project/server/* .

# 安装依赖
npm install

# 配置MySQL连接信息（修改index.js中的数据库连接部分）
vim index.js

# 使用PM2启动服务
npm install -g pm2
pm2 start index.js --name family-library-api
```

### 3. 配置Nginx反向代理（可选但推荐）

```nginx
server {
    listen 80;
    server_name your-api-domain.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 4. 添加HTTPS支持（使用Let's Encrypt，推荐）

```bash
# 安装Certbot
apt-get update
apt-get install certbot python3-certbot-nginx

# 获取SSL证书
certbot --nginx -d your-api-domain.com

# Certbot会自动配置Nginx
```

## 二、小程序端配置

### 1. 更新config.js

修改项目根目录下的`config.js`文件，添加服务器API配置：

```javascript
// 小程序配置文件
module.exports = {
  // 云环境配置（保留但不再使用）
  cloud: {
    env: 'cloud1-xxxxxx', 
  },
  
  // API配置
  api: {
    tanshu: {
      url: 'https://api.tanshuapi.com/api/isbn_base/v1/index',
      key: 'your_api_key'
    },
    // 服务器API配置（新增）
    server: {
      url: 'https://your-api-domain.com/api', // 修改为你的API服务器地址
    }
  }
}
```

### 2. 将MySQL适配器和API工具添加到项目中

1. 添加`miniprogram/utils/api.js`
2. 添加`miniprogram/utils/mysql-adapter.js`

这两个文件提供了与MySQL服务器通信的功能。

### 3. 修改app.js

在app.js中添加MySQL适配器引用，并修改云数据库相关函数。

## 三、数据迁移

从云数据库导出数据并导入MySQL的方法：

### 方法1：使用云函数导出数据（如果你仍有云开发环境权限）

1. 创建一个云函数用于导出数据
2. 将导出的JSON数据转换为SQL插入语句
3. 在MySQL中执行这些SQL语句

### 方法2：从本地存储导入（如果你已经将数据迁移到MySQL）

由于小程序会将数据同步到本地存储，你可以：

1. 确保MySQL表结构正确
2. 将你已经迁移的数据检查一遍，确保格式正确：
   - `categories`字段应该是JSON格式
   - 确保所有必要的字段都存在

## 四、测试验证

1. 确保服务器API正常运行：访问`https://your-api-domain.com/api/test`应返回成功消息
2. 使用开发者工具编译并运行小程序
3. 检查图书列表是否正确显示
4. 测试添加、更新和删除图书功能

## 五、故障排除

### 常见问题1：小程序无法连接服务器

- 检查API地址是否正确
- 确认服务器防火墙是否开放对应端口
- 微信小程序只允许连接https域名，确保已配置SSL

### 常见问题2：数据格式不一致

- 检查`categories`字段的格式
- 确保日期字段（如`addTime`）格式正确

### 常见问题3：权限问题

- 确认MySQL用户有足够权限
- 检查服务器文件权限

## 附录：MySQL架构参考

```sql
CREATE TABLE books (
  id INT PRIMARY KEY AUTO_INCREMENT,
  title VARCHAR(255) NOT NULL,
  author VARCHAR(255),
  publisher VARCHAR(255),
  publishDate VARCHAR(100),
  isbn VARCHAR(20),
  description TEXT,
  coverUrl TEXT,
  coverSource VARCHAR(50) DEFAULT 'network',
  pages VARCHAR(50),
  price VARCHAR(50),
  binding VARCHAR(50),
  addTime BIGINT,
  borrowStatus VARCHAR(20) DEFAULT 'in',
  borrower VARCHAR(255),
  borrowTime BIGINT,
  returnTime BIGINT,
  notes TEXT,
  categories JSON,
  category VARCHAR(255)
);
``` 