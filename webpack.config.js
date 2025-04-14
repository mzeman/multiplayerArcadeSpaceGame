const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const webpack = require('webpack'); // Import webpack for DefinePlugin

module.exports = {
  entry: './src/index.ts',
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'dist'),
    clean: true,
  },
  resolve: {
    extensions: ['.ts', '.js'],
    alias: {
      // Add alias for the shared directory
      '@shared': path.resolve(__dirname, 'src/shared')
    }
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: 'index.html',
      inject: 'body',
    }),
  new CopyWebpackPlugin({
      patterns: [
        { from: 'assets', to: 'assets' }
      ]
    }),
    // Define environment variables for client-side code
    new webpack.DefinePlugin({
      'process.env.LOG_LEVEL': JSON.stringify('debug') // Set client log level to debug
    }),
  ],
  devtool: 'source-map',
  mode: 'development',
  devServer: {
    static: {
      directory: path.join(__dirname, 'dist'),
    },
    compress: true,
    port: 8080,
    open: true,
    allowedHosts: 'all',
  },
};