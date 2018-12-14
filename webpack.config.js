const path = require('path');

module.exports = {
    entry: {
        main_html5: './src/main/js/main_html5.js'
    },
    output: {
        path: path.resolve(__dirname, './build'),
        filename: '[name].min.js',
    },
    devtool: "sourcemap",
    watch: true
};