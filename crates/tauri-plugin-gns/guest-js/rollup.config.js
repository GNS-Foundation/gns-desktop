import typescript from '@rollup/plugin-typescript';

const input = [
  'src/index.ts',
  'src/identity.ts',
  'src/messaging.ts',
  'src/resolver.ts',
  'src/trust.ts',
  'src/trajectory.ts',
  'src/types.ts',
];

export default [
  // ESM build
  {
    input,
    output: {
      dir: 'dist',
      format: 'esm',
      sourcemap: true,
      preserveModules: true,
      preserveModulesRoot: 'src',
      exports: 'named',
    },
    external: ['@tauri-apps/api/core'],
    plugins: [
      typescript({
        tsconfig: './tsconfig.json',
        declaration: true,
        declarationMap: true,
        declarationDir: './dist',
      }),
    ],
  },
  // CJS build
  {
    input,
    output: {
      dir: 'dist',
      format: 'cjs',
      sourcemap: true,
      preserveModules: true,
      preserveModulesRoot: 'src',
      entryFileNames: '[name].cjs',
      exports: 'named',
    },
    external: ['@tauri-apps/api/core'],
    plugins: [
      typescript({
        tsconfig: './tsconfig.json',
        declaration: false,
        declarationMap: false,
      }),
    ],
  },
];
