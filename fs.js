// based on Python version from
// https://github.com/copy/fs2json/blob/master/fs2json.py
var fs = require('fs');
var path = require('path');



const VERSION = 2;

const IDX_NAME = 0;
const IDX_SIZE = 1;
const IDX_MTIME = 2;
const IDX_MODE = 3;
const IDX_UID = 4;
const IDX_GID = 5;

// target for symbolic links
// child nodes for directories
// nothing for files
const IDX_TARGET = 6;



module.exports = function(dir) {

    var result = {
        "version": VERSION,
        "size": 0,
    };

    function make_node(st, name) {
        var obj = [];

        obj[IDX_NAME] = name;
        obj[IDX_SIZE] = st.size;
        obj[IDX_MTIME] = +st.mtime;
        obj[IDX_MODE] = st.mode;

        obj[IDX_UID] = st.uid;
        obj[IDX_GID] = st.gid;

        result["size"] += st.size;
        return obj
    }

    function walk(dir) {
        return new Promise((resolve, reject) => {
            var result = [];
            fs.readdir(dir, function(e, files) {
                if (e) {
                    return reject(e);
                }
                (function recur() {
                    var file = files.shift();
                    if (file) {
                        var fullPath = path.join(dir, file);
                        fs.stat(fullPath, function(e, f) {
                            if (e) {
                                return reject(e);
                            }
                            var name = path.basename(fullPath);
                            var node = make_node(f, name);
                            if (f.isSymbolicLink()) {
                                fs.readlink(fullPath, function(e, path) {
                                  if (!e) {
                                      result.push(node);
                                      node[IDX_TARGET] = path;
                                      recur();
                                  }
                                });
                            } else if (f.isDirectory()) {
                                walk(fullPath).then(rest => {
                                    node[IDX_TARGET] = rest;
                                    result.push(node);
                                    recur();
                                });
                            } else {
                                result.push(node);
                                recur();
                            }
                        });
                    } else {
                        resolve(result);
                    }
                })();
            });
       });
    }


    return walk(dir).then((data) => {
      result["fsroot"] = data;
      return result;
    });
};
