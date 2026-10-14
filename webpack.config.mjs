import path from 'node:path';
import {fileURLToPath} from 'node:url';
import webpack from 'webpack';

const root = path.dirname(fileURLToPath(import.meta.url));

const common = {
    mode: 'production',
    // Readable output for the Chrome Web Store review: minified code is
    // allowed, but there is no reason to make it harder to read.
    optimization: {minimize: false},
    devtool: false,
    output: {path: path.join(root, 'dist'), filename: '[name].js'},
};

export default [
    {
        ...common,
        name: 'page',
        entry: {page: './src/page/index.js'},
        output: {...common.output, clean: true},
        plugins: [
            // rtcstats' WebSocketTrace gets the BridgeSocket instead of a real
            // WebSocket. Page bundle only: the service worker needs the real one.
            new webpack.ProvidePlugin({
                WebSocket: [path.join(root, 'src/page/bridge-socket.js'), 'default'],
            }),
        ],
    },
    {
        ...common,
        name: 'extension',
        // After 'page', which empties dist/ first.
        dependencies: ['page'],
        entry: {
            relay: './src/content/index.js',
            background: './src/background/sw.js',
            popup: './src/popup/popup.js',
            options: './src/options/options.js',
        },
    },
];
