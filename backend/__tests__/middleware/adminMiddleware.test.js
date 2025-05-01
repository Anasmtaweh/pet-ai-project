const adminMiddleware = require('../../middleware/adminMiddleware');
const jwt = require('jsonwebtoken');
const { createRequest, createResponse } = require('node-mocks-http');

jest.mock('jsonwebtoken');
jest.mock('../../config/jwtSecret', () => ({ secret: 'test-secret' }));

describe('Admin Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = createRequest();
    res = createResponse();
    next = jest.fn();
    req.headers = {};
  });

  it('should return 401 if no token provided', async () => {
    await adminMiddleware(req, res, next);
    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res._getData())).toEqual({ message: 'Authorization token is required' });
  });

  it('should return 403 for non-admin role', async () => {
    req.headers.authorization = 'Bearer invalid-token';
    jwt.verify.mockReturnValueOnce({ role: 'user' });
    
    await adminMiddleware(req, res, next);
    expect(res.statusCode).toBe(403);
  });

  it('should call next for valid admin token', async () => {
    req.headers.authorization = 'Bearer valid-token';
    jwt.verify.mockReturnValueOnce({ role: 'admin', id: 'user-id' });
    
    await adminMiddleware(req, res, next);
    expect(req.user).toEqual({ role: 'admin', id: 'user-id' });
    expect(next).toHaveBeenCalled();
  });
});