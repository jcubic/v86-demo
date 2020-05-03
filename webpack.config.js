var path = require('path');
var CopyWebpackPlugin = require('copy-webpack-plugin');
var webpack = require('webpack');

module.exports = {
    entry:  {
        app: './index.js'
    },
    output: {
        path: path.resolve('./dist'),
        filename: "[name].js"
    },
    optimization: {
        splitChunks: {
            chunks: 'async',
            minSize: 30000,
            maxSize: 0,
            minChunks: 1,
            maxAsyncRequests: 6,
            maxInitialRequests: 4,
            automaticNameDelimiter: '~',
            automaticNameMaxLength: 30,
            cacheGroups: {
                vendor: {
                    test: /node_modules/,
                    name: 'vendor',
                    priority: -10,
                    chunks: 'all',
                    enforce: true
                },
                default: {
                    minChunks: 2,
                    priority: -20,
                    reuseExistingChunk: true
                }
            }
        }
    },
    resolve: {
      // Use our versions of Node modules.
      alias: {
        'fs': 'browserfs/dist/shims/fs.js',
        'buffer': 'browserfs/dist/shims/buffer.js',
        'path': 'browserfs/dist/shims/path.js',
        'processGlobal': 'browserfs/dist/shims/process.js',
        'bufferGlobal': 'browserfs/dist/shims/bufferGlobal.js',
        'BrowserFS': require.resolve('browserfs')
      }
    },
    plugins: [
        new webpack.DefinePlugin({
            PRODUCTION: process.env.NODE_ENV == 'production'
        }),
        new CopyWebpackPlugin([
            {from: 'index.html'},
            {from: 'sw.js'}
        ]),
        new webpack.ProvidePlugin({ BrowserFS: 'bfsGlobal', process: 'processGlobal', Buffer: 'bufferGlobal' })
    ],
    node: {
        fs: 'empty',
        process: false,
        Buffer: false
    },
    module: {
        noParse: /browserfs\.js/,
        rules: [
            {
                test: /^fs$/,
                loader: 'null-loader'
            },
            {
                test: /\.js$/,
                exclude: /node_modules/,
                loader: 'babel-loader',
                query: {
                    presets: ['@babel/preset-env']
                }
            },
            {
                test: /\.html$/,
                loader: 'html-loader'
            },
            {
                test: /\.css$/,
                loaders: ['style-loader', 'css-loader']
            },
            {
                test: /\.(bin|iso)$/,
                loader: 'file-loader' +
                    (process.env.NODE_ENV == 'production' ? '?publicPath=assets/&outputPath=/assets/' : '')
            }
        ]
    }
};
