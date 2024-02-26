const path = require('path')
const { defineConfig } = require('vite')

module.exports = defineConfig({
  build: {
    lib: {
      entry: path.resolve(__dirname, 'lib/main.js'),
      name: 'minijs',
      fileName: (format) => `minijs.${format}.js`,
    },
  },
  test: {
    include: ['lib/__tests__/**/*.test.js'],
    environment: 'jsdom',
  },
})
