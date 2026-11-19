import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);

export async function hashPassword(password) {
    const salt = randomBytes(16).toString('hex');
    const hash = await scrypt(password, salt, 64);
    return `scrypt$${salt}$${hash.toString('hex')}`;
}

export async function verifyPassword(password, stored) {
    if (typeof stored !== 'string') return false;
    const parts = stored.split('$');
    if (parts.length !== 3 || !['scrypt', 'legacy-scrypt'].includes(parts[0]) || !/^[0-9a-f]{32}$/.test(parts[1]) || !/^[0-9a-f]{128}$/.test(parts[2])) {
        return false;
    }
    const expected = Buffer.from(parts[2], 'hex');
    const actual = await scrypt(password, parts[1], 64);
    if (timingSafeEqual(actual, expected)) return true;
    if (parts[0] !== 'legacy-scrypt' || [...password].some(character => character.codePointAt(0) > 255)) return false;
    const latin1 = await scrypt(Buffer.from(password, 'latin1'), parts[1], 64);
    return timingSafeEqual(latin1, expected);
}
