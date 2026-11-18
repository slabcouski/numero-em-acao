import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { loadLocalEnvironment } from '../src/api/config.js';

test('ignora campos minúsculos que conflitam com variáveis no Windows', t => {
    const previousPort = process.env.PORT;
    delete process.env.PORT;
    t.after(() => {
        if (previousPort === undefined) delete process.env.PORT;
        else process.env.PORT = previousPort;
        delete process.env.TEST_CONFIG_VALUE;
    });
    t.mock.method(fs, 'readFileSync', file => {
        if (file === '.env.local') return 'port=5432\nTEST_CONFIG_VALUE=ok\n';
        const error = new Error('not found');
        error.code = 'ENOENT';
        throw error;
    });
    loadLocalEnvironment();
    assert.equal(process.env.PORT, undefined);
    assert.equal(process.env.TEST_CONFIG_VALUE, 'ok');
});
