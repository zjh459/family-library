# 稻米小屋小程序服务器端

这是稻米小屋小程序的服务器端API，用于连接MySQL数据库并处理数据请求。

## 部署步骤

### 1. 安装依赖

```bash
cd server
npm install
```

### 2. 设置MySQL数据库

1. 确保你的服务器上已安装MySQL
2. 创建数据库和表结构：

```bash
mysql -u your_username -p < database.sql
```

3. 在 `index.js` 中修改数据库连接配置：

```javascript
const pool = mysql.createPool({
  host: 'localhost',           // 修改为你的MySQL服务器地址
  user: 'your_mysql_username', // 修改为你的MySQL用户名
  password: 'your_mysql_password', // 修改为你的MySQL密码
  database: 'family_library',  // 数据库名称
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});
```

### 3. 启动服务器

开发环境：
```bash
npm run dev
```

生产环境：
```bash
npm start
```

或者使用PM2持久化运行（推荐）：
```bash
npm install -g pm2
pm2 start index.js --name family-library-api
```

服务器默认在3000端口运行，可以通过修改index.js中的port变量更改端口。

### 4. 配置域名和HTTPS（推荐）

#### 4.1 生成SSL证书

1. 使用OpenSSL生成自签名SSL证书：

首先，需要准备以下信息：
- 国家代码（C）：如CN（中国）
- 省份（ST）：如Guangdong
- 城市（L）：如Shenzhen
- 组织名称（O）：如DaoMi Technology
- 域名（CN）：如daomi.xyz

然后执行以下命令：

```bash
# 创建并进入证书存放目录
mkdir -p /www/server/nginx/ssl
cd /www/server/nginx/ssl

# 生成2048位的私钥文件
openssl genrsa -out server.key 2048

# 生成证书签名请求（CSR）
# 请将下面命令中的信息替换为您的实际信息
openssl req -new -key server.key -out server.csr -subj "/C=CN/ST=Guangdong/L=Shenzhen/O=DaoMi Technology/CN=daomi.xyz"

# 生成自签名证书（有效期365天）
openssl x509 -req -days 365 -in server.csr -signkey server.key -out server.crt

# 设置证书文件权限
chmod 600 server.key
chmod 644 server.crt

# 删除临时的CSR文件
rm server.csr
```

注意事项：
- 请根据实际情况修改上述命令中的信息（省份、城市、组织名称和域名）
- 证书文件将保存在Nginx的ssl目录下：/www/server/nginx/ssl/
- 自签名证书仅适用于开发和测试环境，生产环境请使用正式的SSL证书
- 生成证书后需要在nginx.conf中正确配置证书路径
- 配置完成后需要重启Nginx服务：`nginx -s reload`

#### 4.2 配置Nginx

建议使用Nginx配置反向代理，并设置SSL证书，以便安全地从微信小程序访问API。示例配置：

```nginx
server {
    listen 443 ssl;
    server_name your-domain.com;

    ssl_certificate /path/to/server/ssl/server.crt;
    ssl_certificate_key /path/to/server/ssl/server.key;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## API接口说明

### 获取所有图书
- URL: `GET /api/books`
- 响应: 所有图书的数组

### 获取单本图书
- URL: `GET /api/books/:id`
- 参数: id - 图书ID
- 响应: 单本图书的详细信息

### 添加图书
- URL: `POST /api/books`
- 请求体: 图书对象
- 响应: 添加成功的图书，包含新分配的ID

### 更新图书
- URL: `PUT /api/books/:id`
- 参数: id - 图书ID
- 请求体: 更新的图书对象
- 响应: 更新成功的图书信息

### 删除图书
- URL: `DELETE /api/books/:id`
- 参数: id - 图书ID
- 响应: 删除操作的结果

### 分类统计
- URL: `GET /api/statistics/categories`
- 响应: 各分类的图书数量

### 借阅统计
- URL: `GET /api/statistics/borrow`
- 响应: 各借阅状态的图书数量