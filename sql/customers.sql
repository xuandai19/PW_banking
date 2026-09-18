-- Bảng khách hàng (chủ tài khoản) – login portal
-- Chạy cùng schema hoặc qua ensureSchema

CREATE TABLE IF NOT EXISTS customers (
  id INT PRIMARY KEY AUTO_INCREMENT,
  account_id INT NOT NULL UNIQUE,
  username VARCHAR(50) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  full_name VARCHAR(150) NOT NULL,
  email VARCHAR(150) NULL,
  otp_hash VARCHAR(255) NULL,
  must_change_password TINYINT(1) NOT NULL DEFAULT 1,
  status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
  reset_token VARCHAR(128) NULL,
  reset_token_expires DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_customers_account FOREIGN KEY (account_id) REFERENCES accounts(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  INDEX idx_customers_username (username),
  INDEX idx_customers_email (email)
);
