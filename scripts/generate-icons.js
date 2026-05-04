const sharp = require('sharp');
const fs = require('fs');

const svg = fs.readFileSync('public/logo.svg');

sharp(svg).resize(192, 192).png().toFile('public/logo192.png', (err) => {
  if (err) console.error(err);
  else console.log('logo192.png created');
});

sharp(svg).resize(512, 512).png().toFile('public/logo512.png', (err) => {
  if (err) console.error(err);
  else console.log('logo512.png created');
});

sharp(svg).resize(64, 64).png().toFile('public/favicon.ico', (err) => {
  if (err) console.error(err);
  else console.log('favicon.ico created');
});
