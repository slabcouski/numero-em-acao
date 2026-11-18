CREATE TABLE users (
    id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
    email VARCHAR(191) COLLATE utf8mb4_bin NOT NULL UNIQUE,
    username TEXT,
    avatar_url TEXT,
    nivel_matematica INT DEFAULT 1,
    pontos_totais INT DEFAULT 0,
    created_at DATETIME(6),
    updated_at DATETIME(6),
    password_hash TEXT,
    auth_provider VARCHAR(32) DEFAULT 'local'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE exercicios (
    id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
    tipo VARCHAR(32) NOT NULL,
    nivel INT NOT NULL,
    pergunta TEXT NOT NULL,
    resposta_correta INT NOT NULL,
    pontos INT DEFAULT 10,
    created_at DATETIME(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE game_progress (
    id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
    user_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL UNIQUE,
    level INT NOT NULL DEFAULT 1,
    chapter INT NOT NULL DEFAULT 1,
    exercise INT NOT NULL DEFAULT 1,
    score INT NOT NULL DEFAULT 0,
    consecutive_correct INT NOT NULL DEFAULT 0,
    last_played DATETIME(6),
    created_at DATETIME(6),
    updated_at DATETIME(6),
    FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE respostas_usuarios (
    id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
    user_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin,
    exercicio_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin,
    resposta_usuario INT NOT NULL,
    esta_correto BOOLEAN NOT NULL,
    pontos_ganhos INT DEFAULT 0,
    tempo_resposta INT,
    created_at DATETIME(6),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (exercicio_id) REFERENCES exercicios(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE google_identities (
    subject VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
    user_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE sessions (
    token_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
    user_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    expires_at DATETIME(6) NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
