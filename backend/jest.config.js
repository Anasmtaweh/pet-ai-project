// c:\Users\Anas\Desktop\backend\jest.config.js
module.exports = {
    testEnvironment: 'node',
    setupFilesAfterEnv: ['./jest.setup.js'],
    testPathIgnorePatterns: ['/node_modules/', '/config/'],
    testTimeout: 30000 // Increase timeout to 30 seconds (30000 ms)
  };
