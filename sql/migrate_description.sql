-- Chạy một lần nếu database đã tồn tại từ bản trước (chưa có cột description)
USE banking_db;

-- Thêm cột description nếu chưa có
SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'transactions'
    AND COLUMN_NAME = 'description'
);

SET @sql := IF(
  @col_exists = 0,
  'ALTER TABLE transactions ADD COLUMN description VARCHAR(255) NULL AFTER bank_id',
  'SELECT "column description already exists" AS info'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
