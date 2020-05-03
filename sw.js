/**@license
 *
 * Code based on GIT Web Terminal (added p9.json for v86 emulator)
 *
 * Copyright (c) 2018-2020 Jakub Jankiewicz <http://jcubic.pl/me>
 * Released under the MIT license
 *
 */
/* global BrowserFS, Response, setTimeout, fetch, Blob, Headers */
//self.importScripts('https://cdn.jsdelivr.net/npm/browserfs');
self.importScripts('https://cdn.jsdelivr.net/npm/browserfs@2.x.x/dist/browserfs.js');

self.addEventListener('install', self.skipWaiting);

self.addEventListener('activate', self.skipWaiting);

self.addEventListener('fetch', function (event) {
    let path;
    let fs = new Promise(function(resolve, reject) {
        BrowserFS.configure({ fs: 'IndexedDB', options: {} }, function (err) {
            path = BrowserFS.BFSRequire('path');
            if (err) {
                reject(err);
            } else {
                resolve(BrowserFS.BFSRequire('fs'));
            }
        });
    });
    event.respondWith(fs.then(function(fs) {
        return new Promise(function(resolve, reject) {
            function sendFile(path) {
                fs.readFile(path, function(err, buffer) {
                    if (err) {
                        err.fn = 'readFile(' + path + ')';
                        return reject(err);
                    }
                    var ext = path.replace(/.*\./, '');
                    var mime = {
                        'html': 'text/html',
                        'json': 'application/json',
                        'js': 'application/javascript',
                        'css': 'text/css'
                    };
                    var headers = new Headers({
                        'Content-Type': mime[ext]
                    });
                    resolve(new Response(buffer, {headers}));
                });
            }
            var url = event.request.url;
            var m = url.match(/__browserfs__(.*)/);
            function redirect_dir() {
                return resolve(Response.redirect(url + '/', 301));
            }
            function serve() {
                fs.stat(path, function(err, stat) {
                    if (err) {
                        return resolve(textResponse(error404Page(path)));
                    }
                    if (stat.isFile()) {
                        sendFile(path);
                    } else if (stat.isDirectory()) {
                        if (path.substr(-1, 1) !== '/') {
                            return redirect_dir();
                        }
                        fs.readdir(path, function(err, list) {
                            if (err) {
                                err.fn = 'readdir(' + path + ')';
                                return reject(err);
                            }
                            var len = list.length;
                            if (list.includes('index.html')) {
                                sendFile(path + '/index.html');
                            } else {
                                listDirectory({fs, path, list}).then(function(list) {
                                    resolve(textResponse(fileListingPage(path, list)));
                                }).catch(reject);
                            }
                        });
                    }
                });
            }
            if (url.match(/__fs__p9.json$/)) {
                console.log("generating plan9 json file");
                p9json({fs, path, dir: '/'}).then(data => {
                    resolve(textResponse(JSON.stringify(data), 'application/json'));
                }).catch(e => {
                    resolve(textResponse("<h1>" + e.message + "</h1>" +
                                         "<pre>" + e.stack + "</pre>"));
                });
            } else if (m) {
                var path = m[1];
                if (path === '') {
                    return redirect_dir();
                }
                console.log('serving ' + path + ' from browserfs');
                serve();
            } else {
                if (event.request.cache === 'only-if-cached' && event.request.mode !== 'same-origin') {
                    return;
                }
                //request = credentials: 'include'
                fetch(event.request).then(resolve).catch(reject);
            }
        });
    }));
});
// -----------------------------------------------------------------------------
function listDirectory({fs, path, list}) {
    return new Promise(function(resolve, reject) {
        var items = [];
        (function loop() {
            var item = list.shift();
            if (!item) {
                return resolve(items);
            }
            fs.stat(path + '/' + item, function(err, stat) {
                if (err) {
                    err.fn = 'stat(' + path + '/' + item + ')';
                    return reject(err);
                }
                items.push(stat.isDirectory() ? item + '/' : item);
                loop();
            });
        })();
    });
}

// -----------------------------------------------------------------------------
function textResponse(string, contentType = 'text/html') {
    var blob = new Blob([string], {
        type: contentType
    });
    return new Response(blob);
}

// -----------------------------------------------------------------------------
function fileListingPage(path, list) {
    var output = [
        '<!DOCTYPE html>',
        '<html>',
        '<body>',
        `<h1>BrowserFS ${path}</h1>`,
        '<ul>'
    ];
    if (path.match(/^\/(.*\/)/)) {
        output.push('<li><a href="..">..</a></li>');
    }
    list.forEach(function(name) {
        output.push('<li><a href="' + name + '">' + name + '</a></li>');
    });
    output = output.concat(['</ul>', '</body>', '</html>']);
    return output.join('\n');
}

// -----------------------------------------------------------------------------
function error404Page(path) {
    var output = [
        '<!DOCTYPE html>',
        '<html>',
        '<body>',
        '<h1>404 File Not Found</h1>',
        `<p>File ${path} not found in browserfs`,
        '</body>',
        '</html>'
    ];
    return output.join('\n');
}

// -----------------------------------------------------------------------------
function p9json({path, fs, dir}) {
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

    var result = {
        "version": VERSION,
        "size": 0
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
        return obj;
    }

    function walk(dir) {
        return new Promise((resolve, reject) => {
            var result = [];
            fs.stat(dir, function(err, stat) {
                if (err) {
                    return reject(err);
                }
                if (stat.isDirectory()) {
                    fs.readdir(dir, function(e, files) {
                        if (e) {
                            return reject(e);
                        }
                        (function recur() {
                            var file = files.shift();
                            if (file) {
                                var fullPath = dir + (dir === '/' ? '' : '/') + file;
                                fs.stat(fullPath, function(e, f) {
                                    if (e) {
                                        return reject(e);
                                    }
                                    var name = fullPath.replace(/[^\/]+\//, '');
                                    var node = make_node(f, name);
                                    if (f.isSymbolicLink()) {
                                        fs.readlink(fullPath, function(e, path) {
                                            if (e) {
                                                return reject(e);
                                            }
                                            result.push(node);
                                            node[IDX_TARGET] = path;
                                            recur();
                                        });
                                    } else if (f.isDirectory()) {
                                        walk(fullPath).then(rest => {
                                            node[IDX_TARGET] = rest;
                                            result.push(node);
                                            recur();
                                        }).catch(reject);
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
                }
            });
       });
    }


    return walk(dir).then((data) => {
      result["fsroot"] = data;
      return result;
    });
}
