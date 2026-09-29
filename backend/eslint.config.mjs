import js from '@eslint/js';
import globals from 'globals';

export default [
    {ignores: ['dist/**', '.encore/**', 'node_modules/**', 'encore.gen/**']},
    {
        ...js.configs.recommended,
        files: ['**/*.{js,mjs,cjs}'],
        languageOptions: {globals: globals.node},
        rules: {
            ...js.configs.recommended.rules,
            'no-console': ['warn', {allow: ['warn', 'error', 'info']}],
            'no-throw-literal': 'error',
            eqeqeq: ['error', 'always'],
        },
    },
];
