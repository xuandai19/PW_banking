-- Banking System – MySQL schema
-- Chạy: mysql -u root -p < sql/schema.sql
-- hoặc: node scripts/initDb.js

CREATE DATABASE IF NOT EXISTS banking_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE banking_db;

CREATE TABLE IF NOT EXISTS admins (
  id INT PRIMARY KEY AUTO_INCREMENT,
  username VARCHAR(50) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  full_name VARCHAR(100) NOT NULL,
  role ENUM('ADMIN','SUBADMIN','EMPLOYEE','BANK','BRANCH') NOT NULL,
  email VARCHAR(150) NULL UNIQUE,
  email_verified TINYINT(1) NOT NULL DEFAULT 0,
  verify_token VARCHAR(128) NULL,
  verify_token_expires DATETIME NULL,
  reset_token VARCHAR(128) NULL,
  reset_token_expires DATETIME NULL,
  bank_id INT NULL,
  branch_id INT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_admins_bank_id (bank_id),
  INDEX idx_admins_branch_id (branch_id)
);

CREATE TABLE IF NOT EXISTS banks (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(150) NOT NULL,
  code VARCHAR(50) NOT NULL UNIQUE,
  address VARCHAR(255) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_banks_name (name)
);

CREATE TABLE IF NOT EXISTS branches (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(150) NOT NULL,
  address VARCHAR(255) NOT NULL,
  phone VARCHAR(30) NULL,
  bank_id INT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_branches_bank FOREIGN KEY (bank_id) REFERENCES banks(id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  UNIQUE KEY uk_branches_bank_name (bank_id, name)
);

CREATE TABLE IF NOT EXISTS accounts (
  id INT PRIMARY KEY AUTO_INCREMENT,
  account_number VARCHAR(50) NOT NULL UNIQUE,
  owner_name VARCHAR(150) NOT NULL,
  balance DECIMAL(18,2) NOT NULL DEFAULT 0,
  status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
  branch_id INT NULL,
  bank_id INT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_accounts_branch FOREIGN KEY (branch_id) REFERENCES branches(id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_accounts_bank FOREIGN KEY (bank_id) REFERENCES banks(id)
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS transactions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  type VARCHAR(30) NOT NULL,
  amount DECIMAL(18,2) NOT NULL,
  from_account_id INT NULL,
  to_account_id INT NULL,
  account_id INT NULL,
  branch_id INT NULL,
  bank_id INT NULL,
  description VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_transactions_from_account FOREIGN KEY (from_account_id) REFERENCES accounts(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_transactions_to_account FOREIGN KEY (to_account_id) REFERENCES accounts(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_transactions_account FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_transactions_branch FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_transactions_bank FOREIGN KEY (bank_id) REFERENCES banks(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  INDEX idx_transactions_created_at (created_at),
  INDEX idx_transactions_bank_id (bank_id),
  INDEX idx_transactions_branch_id (branch_id),
  INDEX idx_transactions_account_id (account_id)
);

-- Migration helper (chạy nếu DB đã tồn tại từ bản cũ):
-- ALTER TABLE transactions ADD COLUMN description VARCHAR(255) NULL AFTER bank_id;

CREATE TABLE IF NOT EXISTS approvals (
  id INT PRIMARY KEY AUTO_INCREMENT,
  type VARCHAR(50) NOT NULL,
  description VARCHAR(255) NULL,
  requested_by VARCHAR(50) NULL,
  requested_role VARCHAR(30) NULL,
  payload JSON NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
  note TEXT NULL,
  history JSON NULL,
  approved_by VARCHAR(50) NULL,
  approved_at DATETIME NULL,
  rejected_at DATETIME NULL,
  reason TEXT NULL,
  rejected_by VARCHAR(50) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Portal khách hàng (chủ tài khoản): login, xem số dư, nạp/rút, lịch sử
CREATE TABLE IF NOT EXISTS customers (
  id INT PRIMARY KEY AUTO_INCREMENT,
  account_id INT NOT NULL UNIQUE,
  username VARCHAR(50) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  full_name VARCHAR(150) NOT NULL,
  must_change_password TINYINT(1) NOT NULL DEFAULT 1,
  status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_customers_account FOREIGN KEY (account_id) REFERENCES accounts(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  INDEX idx_customers_username (username)
);
