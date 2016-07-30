var fs = require('fs');

function isDirectory(file) {
  try {
    var isDir = fs.lstatSync(file).isDirectory();
    if (isDir) {
      return true;
    }
  } catch (err) {
  }
  return false;
}

module.exports = {
  isDirectory
};
