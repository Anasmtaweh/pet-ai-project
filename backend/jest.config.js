// Configuration file for Jest, a JavaScript testing framework.
module.exports = {
    // Sets the test environment to 'node' for backend testing.
    testEnvironment: 'node',

    // Specifies a setup file to run after the test framework is installed, for global test configurations or mocks.
    setupFilesAfterEnv: ['./jest.setup.js'],

    // Patterns for paths to ignore during test execution (e.g., node_modules, config directory).
    testPathIgnorePatterns: ['/node_modules/', '/config/'],

    // Sets the default timeout for tests to 30 seconds (30000 ms).
    testTimeout: 30000
  };


