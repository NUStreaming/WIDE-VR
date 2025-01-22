const { merge } = require('webpack-merge');
const path = require('path');
const fs = require('fs');
const common = require('./webpack.common.js');

// App directory
const appDirectory = fs.realpathSync(process.cwd());

module.exports = merge(common, {
    mode: 'development',
    devtool: 'inline-source-map',

    devServer: {
        // contentBase: path.resolve(appDirectory),
        static: path.resolve(appDirectory),
        // publicPath: '/',
        compress: true,
        hot: true,
        open: true,
        // disableHostCheck: true,

        // enable to access from other devices on the network
        // host: 'localhost',
        // host: '127.0.0.1',
        host: '192.168.68.70', // Mac local network IP

        // if you aren’t using ngrok, and want to connect locally, webxr requires https
        https: true,
    }    
});