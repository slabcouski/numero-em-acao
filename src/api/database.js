import mysql from 'mysql2/promise';
import fs from 'node:fs';

let pool;

export function getPool() {
    if (pool) return pool;

    const { MYSQL_HOST, MYSQL_PORT, MYSQL_DATABASE, MYSQL_USER, MYSQL_PASSWORD, MYSQL_CA_PATH, MYSQL_CA_PEM, MYSQL_ALLOW_INSECURE } = process.env;
    if (!MYSQL_HOST || !MYSQL_DATABASE || !MYSQL_USER || !MYSQL_PASSWORD) {
        throw new Error('Configuração do MySQL incompleta');
    }
    if (!MYSQL_CA_PATH && !MYSQL_CA_PEM && MYSQL_ALLOW_INSECURE !== 'true') {
        throw new Error('Configure a CA MySQL ou autorize explicitamente MYSQL_ALLOW_INSECURE=true');
    }

    const ca = MYSQL_CA_PEM || (MYSQL_CA_PATH ? fs.readFileSync(MYSQL_CA_PATH, 'utf8') : null);
    pool = mysql.createPool({
        host: MYSQL_HOST,
        port: Number(MYSQL_PORT || 3306),
        database: MYSQL_DATABASE,
        user: MYSQL_USER,
        password: MYSQL_PASSWORD,
        ...(ca ? { ssl: { ca, rejectUnauthorized: true } } : {}),
        waitForConnections: true,
        connectionLimit: 2,
        timezone: 'Z',
        charset: 'utf8mb4'
    });
    return pool;
}
