CREATE DATABASE IF NOT EXISTS unicred CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE unicred;

CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(190) NOT NULL UNIQUE,
  phone VARCHAR(20) NULL,
  income DECIMAL(14,2) NOT NULL DEFAULT 0,
  password_hash VARCHAR(128) NOT NULL,
  status ENUM('active', 'pending', 'blocked') NOT NULL DEFAULT 'active',
  last_login DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS products (
  id VARCHAR(32) PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  annual_rate DECIMAL(8,4) NOT NULL,
  min_amount DECIMAL(14,2) NOT NULL,
  max_amount DECIMAL(14,2) NOT NULL,
  min_term_months SMALLINT UNSIGNED NOT NULL,
  max_term_months SMALLINT UNSIGNED NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS applications (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  public_id VARCHAR(32) NOT NULL UNIQUE,
  user_id BIGINT UNSIGNED NOT NULL,
  product_id VARCHAR(32) NOT NULL,
  amount DECIMAL(14,2) NOT NULL,
  months SMALLINT UNSIGNED NOT NULL,
  monthly_payment DECIMAL(14,2) NOT NULL,
  status ENUM('under_review', 'approved', 'rejected') NOT NULL DEFAULT 'under_review',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_app_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_app_product FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE TABLE IF NOT EXISTS credits (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  public_id VARCHAR(32) NOT NULL UNIQUE,
  user_id BIGINT UNSIGNED NOT NULL,
  product_id VARCHAR(32) NOT NULL,
  application_id BIGINT UNSIGNED NOT NULL,
  amount DECIMAL(14,2) NOT NULL,
  balance DECIMAL(14,2) NOT NULL,
  months SMALLINT UNSIGNED NOT NULL,
  monthly_payment DECIMAL(14,2) NOT NULL,
  status ENUM('active', 'paid_off') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_credit_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_credit_product FOREIGN KEY (product_id) REFERENCES products(id),
  CONSTRAINT fk_credit_application FOREIGN KEY (application_id) REFERENCES applications(id)
);

CREATE TABLE IF NOT EXISTS payments (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  public_id VARCHAR(32) NOT NULL UNIQUE,
  credit_id BIGINT UNSIGNED NOT NULL,
  amount DECIMAL(14,2) NOT NULL,
  status ENUM('pending', 'paid') NOT NULL DEFAULT 'pending',
  due_date DATE NOT NULL,
  paid_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_payment_credit FOREIGN KEY (credit_id) REFERENCES credits(id)
);

CREATE TABLE IF NOT EXISTS documents (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(120) NOT NULL,
  status VARCHAR(40) NOT NULL DEFAULT 'Pendiente',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_document_user FOREIGN KEY (user_id) REFERENCES users(id)
);

INSERT INTO products (id, name, annual_rate, min_amount, max_amount, min_term_months, max_term_months)
SELECT 'personal', 'Crédito personal', 0.2490, 5000, 250000, 6, 36 FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM products WHERE id = 'personal');
INSERT INTO products (id, name, annual_rate, min_amount, max_amount, min_term_months, max_term_months)
SELECT 'express', 'Crédito express', 0.3290, 5000, 50000, 3, 18 FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM products WHERE id = 'express');
INSERT INTO products (id, name, annual_rate, min_amount, max_amount, min_term_months, max_term_months)
SELECT 'metas', 'Crédito para metas', 0.2690, 10000, 180000, 12, 48 FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM products WHERE id = 'metas');
