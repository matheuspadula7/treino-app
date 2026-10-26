-- Esquema do banco do app de treino (MySQL / MariaDB, utf8mb4)

CREATE TABLE IF NOT EXISTS users (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(80) NOT NULL,
  created_at DATETIME NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS profiles (
  user_id INT UNSIGNED PRIMARY KEY,
  sex ENUM('M','F') NOT NULL DEFAULT 'M',
  birth_date DATE NULL,
  height_cm DECIMAL(5,1) NULL,
  weight_kg DECIMAL(5,1) NULL,
  activity ENUM('baixo','moderado','alto') NOT NULL DEFAULT 'moderado',
  goal VARCHAR(30) NOT NULL DEFAULT 'perder_gordura',
  days_per_week TINYINT NOT NULL DEFAULT 4,
  updated_at DATETIME NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS body_logs (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  log_date DATE NOT NULL,
  weight_kg DECIMAL(5,1) NULL,
  waist_cm DECIMAL(5,1) NULL,
  chest_cm DECIMAL(5,1) NULL,
  arm_cm DECIMAL(5,1) NULL,
  thigh_cm DECIMAL(5,1) NULL,
  hip_cm DECIMAL(5,1) NULL,
  photo VARCHAR(120) NULL,
  notes VARCHAR(255) NULL,
  KEY idx_user_date (user_id, log_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS plans (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  name VARCHAR(80) NOT NULL,
  split VARCHAR(20) NOT NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL,
  KEY idx_user_active (user_id, active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS plan_days (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  plan_id INT UNSIGNED NOT NULL,
  position TINYINT NOT NULL,
  label VARCHAR(4) NOT NULL,
  title VARCHAR(80) NOT NULL,
  KEY idx_plan (plan_id),
  CONSTRAINT fk_pd_plan FOREIGN KEY (plan_id) REFERENCES plans(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS plan_exercises (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  day_id INT UNSIGNED NOT NULL,
  position TINYINT NOT NULL,
  name VARCHAR(100) NOT NULL,
  muscle VARCHAR(40) NULL,
  kind ENUM('strength','cardio') NOT NULL DEFAULT 'strength',
  sets TINYINT NOT NULL DEFAULT 3,
  rep_min TINYINT NOT NULL DEFAULT 10,
  rep_max TINYINT NOT NULL DEFAULT 12,
  rest_sec SMALLINT NOT NULL DEFAULT 60,
  cardio_minutes SMALLINT NULL,
  KEY idx_day (day_id),
  CONSTRAINT fk_pe_day FOREIGN KEY (day_id) REFERENCES plan_days(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS workouts (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  plan_day_id INT UNSIGNED NULL,
  label VARCHAR(4) NOT NULL,
  title VARCHAR(80) NOT NULL,
  started_at DATETIME NOT NULL,
  finished_at DATETIME NULL,
  status ENUM('em_andamento','finalizado') NOT NULL DEFAULT 'em_andamento',
  notes VARCHAR(255) NULL,
  plan_snapshot MEDIUMTEXT NULL,
  watch_image VARCHAR(120) NULL,
  watch_data TEXT NULL,
  duration_min SMALLINT NULL,
  calories SMALLINT NULL,
  avg_hr SMALLINT NULL,
  max_hr SMALLINT NULL,
  distance_km DECIMAL(5,2) NULL,
  feedback TEXT NULL,
  KEY idx_user_started (user_id, started_at),
  KEY idx_user_label (user_id, label)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS workout_sets (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  workout_id INT UNSIGNED NOT NULL,
  exercise_name VARCHAR(100) NOT NULL,
  set_number TINYINT NOT NULL,
  reps SMALLINT NULL,
  weight_kg DECIMAL(6,2) NULL,
  done_at DATETIME NOT NULL,
  KEY idx_workout (workout_id),
  KEY idx_name (exercise_name),
  CONSTRAINT fk_ws_workout FOREIGN KEY (workout_id) REFERENCES workouts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
