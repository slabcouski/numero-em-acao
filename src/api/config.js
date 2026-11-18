import fs from 'node:fs';
import dotenv from 'dotenv';

export function loadLocalEnvironment() {
    for (const file of ['.env.local', '.env']) {
        let contents;
        try {
            contents = fs.readFileSync(file, 'utf8');
        } catch (error) {
            if (error.code === 'ENOENT') continue;
            throw error;
        }
        for (const [key, value] of Object.entries(dotenv.parse(contents))) {
            if (/^[A-Z][A-Z0-9_]*$/.test(key) && process.env[key] === undefined) {
                process.env[key] = value;
            }
        }
    }
}
