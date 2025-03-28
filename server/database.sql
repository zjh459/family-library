-- 注意：数据库和表已经存在，此文件仅作参考
-- 如果您需要创建新的数据库，可以取消注释以下语句
-- CREATE DATABASE IF NOT EXISTS family_library CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE family_library;

-- 分类表结构（参考）
-- CREATE TABLE IF NOT EXISTS `categories` (
--   `id` int(11) NOT NULL AUTO_INCREMENT,
--   `cloud_id` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
--   `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
--   `icon` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'default',
--   `color` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT '#000000',
--   `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
--   `update_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
--   PRIMARY KEY (`id`),
--   UNIQUE KEY `name` (`name`)
-- ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 图书表结构（参考）
-- CREATE TABLE IF NOT EXISTS `books` (
--   `id` int(11) NOT NULL AUTO_INCREMENT,
--   `cloud_id` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
--   `title` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
--   `author` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
--   `category_id` int(11) DEFAULT NULL,
--   `category_name` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
--   `categories_json` text COLLATE utf8mb4_unicode_ci,
--   `publisher` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
--   `publication_date` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
--   `price` decimal(10,2) DEFAULT NULL,
--   `isbn` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
--   `cover` text COLLATE utf8mb4_unicode_ci,
--   `summary` text COLLATE utf8mb4_unicode_ci,
--   `borrow_status` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'in',
--   `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
--   `update_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
--   PRIMARY KEY (`id`),
--   KEY `category_id` (`category_id`),
--   CONSTRAINT `books_ibfk_1` FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`) ON DELETE SET NULL
-- ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 图书表
CREATE TABLE IF NOT EXISTS books (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci; 