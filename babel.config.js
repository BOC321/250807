module.exports = {
  presets: [
    ['next/babel', {
      'preset-env': {
        modules: false,
        targets: {
          browsers: ['> 1%', 'last 2 versions'],
        },
      },
    }],
  ],
  plugins: [
    '@babel/plugin-proposal-class-properties',
    '@babel/plugin-proposal-object-rest-spread',
    '@babel/plugin-transform-runtime',
    '@babel/plugin-proposal-optional-chaining',
    '@babel/plugin-proposal-nullish-coalescing-operator',
  ],
  env: {
    test: {
      presets: [['next/babel', { 'preset-env': { modules: 'commonjs' } }]],
      plugins: ['@babel/plugin-transform-runtime'],
    },
    development: {
      plugins: ['react-refresh/babel'],
    },
    production: {
      plugins: [
        '@babel/plugin-transform-react-constant-elements',
        '@babel/plugin-transform-react-inline-elements',
      ],
    },
  },
};
