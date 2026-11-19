CREATE TABLE IF NOT EXISTS exercise_history (
    exercicio_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
    user_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    nivel TINYINT UNSIGNED NOT NULL,
    cycle INT UNSIGNED NOT NULL,
    factor1 TINYINT UNSIGNED NOT NULL,
    factor2 TINYINT UNSIGNED NOT NULL,
    created_at DATETIME(6) NOT NULL,
    UNIQUE KEY exercise_history_unique (user_id, nivel, cycle, factor1, factor2),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (exercicio_id) REFERENCES exercicios(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
