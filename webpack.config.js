const path = require('path');
const WebpackShellPlugin = require('webpack-shell-plugin');

module.exports = {
  entry: {
    main_html5: './src/main/js/main_html5.js',
    osmf_flash: './src/osmf/js/osmf_flash.js',
    akamaiHD_flash: './src/akamai/js/akamaiHD_flash.js',
    youtube: './src/youtube/js/youtube.js'
  },
  output: {
    path: path.resolve(__dirname, './build'),
    filename: '[name].min.js'
  },
  plugins: [
    new WebpackShellPlugin({
      onBuildStart:['node ant-builds.js']
    })
  ],
  devtool: 'sourcemap',
  devServer: {
    compress: true
  }
}
