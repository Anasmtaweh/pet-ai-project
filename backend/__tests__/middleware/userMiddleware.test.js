// Test suite for the user authentication and authorization middleware.
const userMiddleware = require('../../middleware/userMiddleware');
const jwt = require('jsonwebtoken');
// Import utilities for creating mock HTTP request and response objects for testing middleware
const { createRequest, createResponse } = require('node-mocks-http');

// Mock the 'jsonwebtoken' module to control its behavior during tests
jest.mock('jsonwebtoken');
// Mock the JWT secret configuration to ensure a consistent secret is used for testing
jest.mock('../../config/jwtSecret', () => ({
  secret: 'test-secret-key' // Use a consistent secret for testing
}));

describe('User Middleware', () => {
  let req, res, next;

  // Setup fresh mock request, response, and next function before each test case
  beforeEach(() => {
    // Create fresh mock objects for each test to ensure isolation
    req = createRequest();
    res = createResponse();
    next = jest.fn(); // Mock the next middleware function to spy on its calls
    // Reset jwt.verify mock implementation before each test
    jwt.verify.mockReset();
    req.headers = {}; // Initialize headers for the request
  });

  // Test case: Verifies that next() is called and req.user is set for a valid token with 'user' role.
  it('should call next() and set req.user for a valid token with "user" role', () => {
    const mockUserPayload = { id: 'user123', role: 'user', email: 'user@example.com' };
    const token = 'validUserToken';
    req.headers.authorization = `Bearer ${token}`;

    // Configure jwt.verify to successfully decode the token and return the mock payload
    jwt.verify.mockImplementation((t, secret, callback) => {
      if (t === token && secret === 'test-secret-key') {
        return mockUserPayload; // Simulate successful token verification
      }
      throw new Error('Invalid token simulation'); // This path should not be hit in this test
    });

    userMiddleware(req, res, next);

    expect(jwt.verify).toHaveBeenCalledWith(token, 'test-secret-key');
    expect(next).toHaveBeenCalledTimes(1); // next() should have been called
    expect(res.statusCode).toBe(200); // No error status should be set by the middleware itself
    expect(req.user).toBeDefined();
    expect(req.user.id).toBe(mockUserPayload.id);
    expect(req.user.role).toBe('user');
  });

  // Test case: Verifies that a 403 Forbidden is returned if the token is valid but the role is not 'user'.
  it('should return 403 if the token is valid but role is not "user"', () => {
    const mockAdminPayload = { id: 'admin456', role: 'admin', email: 'admin@example.com' };
    const token = 'validAdminToken';
    req.headers.authorization = `Bearer ${token}`;

    // Configure jwt.verify to return a payload with a non-'user' role
    jwt.verify.mockImplementation((t, secret) => {
      if (t === token && secret === 'test-secret-key') {
        return mockAdminPayload;
      }
      throw new Error('Invalid token simulation');
    });

    userMiddleware(req, res, next);

    expect(jwt.verify).toHaveBeenCalledWith(token, 'test-secret-key');
    expect(next).not.toHaveBeenCalled(); // next() should NOT be called
    expect(res.statusCode).toBe(403);
    expect(res._getJSONData()).toEqual({ message: 'Access denied. User role required' });
  });

  // Test case: Verifies that a 401 Unauthorized is returned if no authorization header is provided.
  it('should return 401 if no authorization header is provided', () => {
    // No req.headers.authorization is set for this test case

    userMiddleware(req, res, next);

    expect(jwt.verify).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
    expect(res._getJSONData()).toEqual({ message: 'Authorization token is required' });
  });

  // Test case: Verifies that a 401 Unauthorized is returned if the authorization header is malformed (e.g., missing 'Bearer' prefix).
  it('should return 401 if authorization header is malformed (missing Bearer)', () => {
    req.headers.authorization = 'invalidTokenFormat'; // Missing "Bearer " prefix

    userMiddleware(req, res, next);

    expect(jwt.verify).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
    // Expects 401 because token extraction from the header will fail
    expect(res._getJSONData()).toEqual({ message: 'Authorization token is required' });
  });

  // Test case: Verifies that a 401 Unauthorized is returned if the token is invalid or expired (jwt.verify throws an error).
  it('should return 401 if the token is invalid or expired', () => {
    const token = 'invalidOrExpiredToken';
    req.headers.authorization = `Bearer ${token}`;

    // Configure jwt.verify to throw an error, simulating an invalid/expired token
    const verifyError = new Error('jwt expired');
    jwt.verify.mockImplementation(() => {
      throw verifyError;
    });

    userMiddleware(req, res, next);

    expect(jwt.verify).toHaveBeenCalledWith(token, 'test-secret-key');
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
    expect(res._getJSONData()).toEqual({ message: 'Invalid token' });
  });
});

