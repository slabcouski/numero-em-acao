import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import api from './app.js';
import { loadLocalEnvironment } from './config.js';

loadLocalEnvironment();

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const app = express();
app.use(api);
app.use('/src/js', express.static(path.join(root, 'src', 'js')));
app.use('/src/css', express.static(path.join(root, 'src', 'css')));
app.use('/pages', express.static(path.join(root, 'pages')));
app.get(['/', '/index.html'], (req, res) => res.sendFile(path.join(root, 'index.html')));

app.listen(process.env.PORT || 3000, () => {
    console.log(`Servidor iniciado na porta ${process.env.PORT || 3000}`);
});
