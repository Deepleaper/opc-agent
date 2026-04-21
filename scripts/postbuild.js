const fs = require('fs');
const path = require('path');
// Copy studio-ui
fs.cpSync('src/studio-ui', 'dist/studio-ui', { recursive: true });
// Copy dynamic-import.js
fs.mkdirSync('dist/utils', { recursive: true });
fs.copyFileSync('src/utils/dynamic-import.js', 'dist/utils/dynamic-import.js');
console.log('Postbuild: copied studio-ui + dynamic-import.js');
