
import pkg from './package.json'

export default [
  {
    input: 'src/sai-experiment.js',
    external: ['lodash'],
    output: [
      { file: pkg.main, format: 'cjs' },
      { file: pkg.module, format: 'es' }
    ]
  }
]
