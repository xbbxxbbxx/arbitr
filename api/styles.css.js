const fs = require('fs');
const path = require('path');

module.exports = (req, res) => {
  const filePath = path.join(__dirname, '..', 'public', 'styles.css');
  const content = fs.readFileSync(filePath, 'utf8');
  
  res.setHeader('Content-Type', 'text/css');
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  res.send(content);
};

