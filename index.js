import {V86Starter} from 'v86/build/libv86';
import bios from 'v86/bios/seabios.bin';
import vga_bios from 'v86/bios/vgabios.bin';
import iso from 'v86/images/linux.iso';

if ('serviceWorker' in navigator) {
    var scope = location.pathname.replace(/\/[^\/]+$/, '/');

    navigator.serviceWorker.register('sw.js', {scope}).then(function(reg) {
       reg.addEventListener('updatefound', function() {
           var installingWorker = reg.installing;
           console.log('A new service worker is being installed:',
                       installingWorker);
       });
       var BF = new Promise(function(resolve, reject) {
            BrowserFS.configure({ fs: 'IndexedDB', options: {} }, function (err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({
                      fs: BrowserFS.BFSRequire('fs'),
                      path: BrowserFS.BFSRequire('path')
                    });
                }
            });
        });

        BF.then(function({fs, path}) {
            var emulator = window.emulator = new V86Starter({
                screen_container: document.getElementById("screen_container"),
                bios: {
                    url: bios
                },
                vga_bios: {
                    url: vga_bios
                },
                cdrom: {
                    url: iso
                },
                filesystem: {
                    basefs: "./__fs__p9.json",
                    baseurl: "./__browserfs__/",
                },
                autostart: true
            });

            document.querySelector('#mount').addEventListener('click', function() {
              emulator.keyboard_send_text("mount -t 9p host9p /mnt/9p/\n");
            });
            fs.stat('/foo', function(e) {
                if (e) {
                    fs.mkdir('/foo');
                    fs.writeFile('/foo/foo', 'Hello foo');
                    fs.writeFile('/foo/bar', 'Hello foo bar');
                    fs.writeFile('/bar', 'Hello bar');
                }
            });
        });
       // registration worked
       console.log('Registration succeeded. Scope is ' + reg.scope);
    }).catch(function(error) {
       // registration failed
           console.log('Registration failed with ' + error);
    });
}






// create basic FS





