
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
};
