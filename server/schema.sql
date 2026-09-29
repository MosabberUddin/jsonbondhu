-- MySQL 8 storage for the self-hosted ad API (see docs/SELF_HOST.md).
-- One key/value table mirroring the Workers KV namespace ADS_KV:
--   config:current, config:history, stats:YYYY-MM-DD:<campaignId>
-- Keys use utf8mb4_0900_bin: byte-wise and NO PAD, so "a" and "a " stay distinct
-- keys like in KV (utf8mb4_bin is PAD SPACE and would treat them as equal).
-- Values are LONGTEXT because a KV value can be up to 25 MiB.

CREATE DATABASE IF NOT EXISTS jsonbondhu CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin;

CREATE TABLE IF NOT EXISTS jsonbondhu.kv (
  k VARCHAR(512) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NOT NULL PRIMARY KEY,
  v LONGTEXT NOT NULL,
  metadata JSON NULL,
  expires_at BIGINT NULL,
  INDEX idx_kv_expires (expires_at)
) ENGINE=InnoDB;

-- Upgrading a table created from the earlier version of this file:
--   ALTER TABLE jsonbondhu.kv
--     MODIFY k VARCHAR(512) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NOT NULL,
--     MODIFY v LONGTEXT NOT NULL;
