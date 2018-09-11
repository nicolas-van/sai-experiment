
const path = require('path');

module.exports = {
  entry: path.resolve(__dirname, 'src/sai-experiment.js'),
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'sai-experiment.bundle.js',
    library: 'sai-experiment',
    libraryTarget: 'umd',
  },
  optimization: {
    minimizer: [],
  },
  devtool: 'inline-source-map',
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /(node_modules)/,
        use: [
          'babel-loader',
          'eslint-loader',
        ]
      }
    ],
  },
  externals: {
    lodash: {
      commonjs: 'lodash',
      commonjs2: 'lodash',
      amd: 'lodash',
      root: '_'
    }
  }
};
