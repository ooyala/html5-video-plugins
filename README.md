# html5-video-plugins

## Getting started

1. Install node.js for Mac: http://howtonode.org/how-to-install-nodejs

2. Sync submodules by running the following commands:
   ```bash
   $ git submodule init
   $ git submodule update
   ```
   
3. Install npm:

   Get https://npmjs.org/install.sh and install with `sh install.sh`. Make sure to install npm 1.1.16 or
   above. If you have an older version of npm, you'll need to do `sudo npm uninstall npm -g` before
   re-installing.

   Also you need the following global npm packages:
   ```bash
   $ npm install -g npm
   $ npm install -g node-gyp
   ```

4. Install the node packages using npm:
   ```bash
   $ npm install
   ```

5. [Optional] Install the node packages for submodules using npm:
   ```bash
   $ cd [submodule]
   $ npm install
   ```
   This is automatically done during building.

## Testing

Unit tests live in the folder "test".  Unit tests are based on the "jest" framework.
Run tests with the command:
```bash
$ gulp test
```

## Building

Minify and package the plugins by running the following command:
```bash
$ gulp build
```

To automatically build the plugins when a file is changed, run the command:
```bash
$ gulp watch
```
