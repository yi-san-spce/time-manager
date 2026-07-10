import tseslint from '@electron-toolkit/eslint-config-ts'

export default tseslint.config(
  { ignores: ['**/node_modules', '**/dist', '**/out'] },
  tseslint.configs.recommended
)
