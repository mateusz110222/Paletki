import babelParser from '@babel/eslint-parser';
import eslintJs from '@eslint/js';

export default [
    {ignores: ['dist/**', 'node_modules/**']},
    {
        files: ['**/*.{js,jsx,mjs,cjs,ts,tsx}'],
        ...eslintJs.configs.recommended,
        languageOptions: {
            parser: babelParser,
            parserOptions: {
                requireConfigFile: false,
                babelOptions: {
                    babelrc: false,
                    configFile: false,
                    presets: ['@babel/preset-typescript'],
                    parserOpts: {plugins: ['jsx']},
                },
            },
        },
        rules: {
            ...eslintJs.configs.recommended.rules,
            'no-undef': 'off',
            'no-unused-vars': 'off',
        },
    },
];
