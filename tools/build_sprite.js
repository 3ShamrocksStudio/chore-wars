// Builds app/brand/icons.svg (symbol sprite) and app/brand/avatars.svg from app/icons.js
const fs = require('fs'), path = require('path');
const { ICONS, AVATARS } = require('../app/icons.js');
let s = '<svg xmlns="http://www.w3.org/2000/svg" style="display:none">\n';
for (const [k, v] of Object.entries(ICONS)) s += `<symbol id="cw-${k}" viewBox="0 0 48 48">${v}</symbol>\n`;
for (const [k, v] of Object.entries(AVATARS)) s += `<symbol id="cw-av-${k}" viewBox="0 0 64 64">${v.svg}</symbol>\n`;
fs.writeFileSync(path.join(__dirname, '../app/brand/icons.svg'), s + '</svg>\n');
console.log('icons', Object.keys(ICONS).length, 'avatars', Object.keys(AVATARS).length);
