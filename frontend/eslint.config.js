//  @ts-check

import { tanstackConfig } from '@tanstack/eslint-config'

export default [
  { ignores: ['public/**', 'eslint.config.js', 'prettier.config.js'] },
  ...tanstackConfig,
]
