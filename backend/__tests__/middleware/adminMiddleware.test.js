// Import the admin middleware to be tested
const adminMiddleware = require('../../middleware/adminMiddleware');
// Import jsonwebtoken to mock its behavior
const jwt =require('jsonwebtoken');
// Import utilities for creating mock HTTP request and response objects
const { createRequest, createResponse } = require('node-mocks-http');

// Mock the 'jsonwebtoken' module for controlled testing of token verification
jest.mock('jsonwebtoken');
// Mock the JWT secret configuration to use a consistent test secret
jest.mock('../../config/jwtSecret', () => ({ secret: 'test-secret' }));

// Test suite for the Admin Middleware
describe('Admin Middleware', () => {
  let req, res, next;

  // Setup mock request, response, and next function before each test
  beforeEach(() => {
    req = createRequest(); // Create a fresh mock request object
    res = createResponse(); // Create a fresh mock response object
    next = jest.fn(); // Create a mock next function to spy on calls
    req.headers = {}; // Initialize headers for the request
  });

  // Test case: Verifies that a 401 Unauthorized is returned if no token is provided
  it('should return 401 if no token provided', async () => {
    await adminMiddleware(req, res, next);
    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res._getData())).toEqual({ message: 'Authorization token is required' });
  });

  // Test case: Verifies that a 403 Forbidden is returned if the token is valid but the user role is not 'admin'
  it('should return 403 for non-admin role', async () => {
    req.headers.authorization = 'Bearer invalid-token'; // Set a dummy token in the header
    // Mock jwt.verify to return a user with a non-admin role
    jwt.verify.mockReturnValueOnce({ role: 'user' });
    
    await adminMiddleware(req, res, next);
    expect(res.statusCode).toBe(403); // Expect a Forbidden status
  });

  // Test case: Verifies that the next middleware is called if a valid admin token is provided
  it('should call next for valid admin token', async () => {
    req.headers.authorization = 'Bearer valid-token'; // Set a dummy token in the header
    // Mock jwt.verify to return a user with an 'admin' role and an ID
    jwt.verify.mockReturnValueOnce({ role: 'admin', id: 'user-id' });
    
    await adminMiddleware(req, res, next);
    // Expect the req.user object to be populated with the decoded token payload
    expect(req.user).toEqual({ role: 'admin', id: 'user-id' });
    // Expect the next middleware function to have been called
    expect(next).toHaveBeenCalled();
  });
});
