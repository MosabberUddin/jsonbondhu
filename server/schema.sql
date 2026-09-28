-- MySQL 8 storage for the self-hosted ad API (see docs/SELF_HOST.md).
-- One key/value table mirroring the Workers KV namespace ADS_KV:
--   config:current, config:history, stats:YYYY-MM-DD:<campaignId>
-- utf8mb4_bin keeps key comparison and ordering byte-wise, like KV.

CREATE DATABASE IF NOT EXISTS jsonbondhu CHARACTER SET utf8mb4 COLLATE utf8mb4_bin;

CREATE TABLE IF NOT EXISTS jsonbondhu.kv (
  k VARCHAR(512) NOT NULL PRIMARY KEY,
  v MEDIUMTEXT NOT NULL,
  metadata JSON NULL,
  expires_at BIGINT NULL,
  INDEX idx_kv_expires (expires_at)
) ENGINE=InnoDB;
