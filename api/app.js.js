const fs = require('fs');
const path = require('path');

module.exports = (req, res) => {
  const filePath = path.join(__dirname, '..', 'public', 'app.js');
  const content = fs.readFileSync(filePath, 'utf8');
  
  res.setHeader('Content-Type', 'application/javascript');
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  res.send(content);
};

