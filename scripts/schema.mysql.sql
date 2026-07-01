CREATE TABLE IF NOT EXISTS mapgen_rrd_samples (
  local_data_id INT UNSIGNED NOT NULL,
  ds_name VARCHAR(64) NOT NULL,
  sample_time DATETIME NOT NULL,
  value_raw DOUBLE NULL,
  collected_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (local_data_id, ds_name, sample_time),
  KEY idx_mapgen_samples_time (sample_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
