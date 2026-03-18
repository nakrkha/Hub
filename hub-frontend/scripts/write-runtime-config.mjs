import fs from 'node:fs';
import path from 'node:path';

const apiUrl = process.env.NETLIFY_API_URL || process.env.API_URL || '/api';
const outputPath = path.join(process.cwd(), 'public', 'app-config.js');
const fileContents = `window.__APP_CONFIG__ = {\n  apiUrl: '${apiUrl}',\n};\n`;

fs.writeFileSync(outputPath, fileContents, 'utf8');
console.log(`Runtime config written to public/app-config.js with apiUrl=${apiUrl}`);
