// c:\Users\Anas\Desktop\backend\__tests__\middleware\userMiddleware.test.js

const userMiddleware = require('../../middleware/userMiddleware'); // Adjust path if needed
const jwt = require('jsonwebtoken');
const { createRequest, createResponse } = require('node-mocks-http');

// Mock the jwt module
jest.mock('jsonwebtoken');
// Mock the jwtSecret configuration
jest.mock('../../config/jwtSecret', () => ({
  secret: 'test-secret-key' // Use a consistent secret for testing
}));

describe('User Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    // Create fresh mock objects for each test
    req = createRequest();
    res = createResponse();
    next = jest.fn(); // Mock the next function
    // Reset jwt mock implementation before each test
    jwt.verify.mockReset();
  });

  it('should call next() and set req.user for a valid token with "user" role', () => {
    const mockUserPayload = { id: 'user123', role: 'user', email: 'user@example.com' };
    const token = 'validUserToken';
    req.headers.authorization = `Bearer ${token}`;

    // Configure jwt.verify to successfully decode the token
    jwt.verify.mockImplementation((t, secret, callback) => {
      if (t === token && secret === 'test-secret-key') {
        // Simulate async verification if needed, or just return directly
        return mockUserPayload;
      }
      throw new Error('Invalid token simulation'); // Should not happen in this test
    });

    userMiddleware(req, res, next);

    expect(jwt.verify).toHaveBeenCalledWith(token, 'test-secret-key');
    expect(next).toHaveBeenCalledTimes(1); // next() should have been called
    expect(res.statusCode).toBe(200); // No error status should be set
    expect(req.user).toBeDefined();
    expect(req.user.id).toBe(mockUserPayload.id);
    expect(req.user.role).toBe('user');
  });

  it('should return 403 if the token is valid but role is not "user"', () => {
    const mockAdminPayload = { id: 'admin456', role: 'admin', email: 'admin@example.com' };
    const token = 'validAdminToken';
    req.headers.authorization = `Bearer ${token}`;

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

  it('should return 401 if no authorization header is provided', () => {
    // No req.headers.authorization set

    userMiddleware(req, res, next);

    expect(jwt.verify).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
    expect(res._getJSONData()).toEqual({ message: 'Authorization token is required' });
  });

  it('should return 401 if authorization header is malformed (missing Bearer)', () => {
    req.headers.authorization = 'invalidTokenFormat'; // Missing "Bearer " prefix

    userMiddleware(req, res, next);

    expect(jwt.verify).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
    expect(res._getJSONData()).toEqual({ message: 'Authorization token is required' }); // Because token extraction fails
  });

  it('should return 401 if the token is invalid or expired', () => {
    const token = 'invalidOrExpiredToken';
    req.headers.authorization = `Bearer ${token}`;

    // Configure jwt.verify to throw an error
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
