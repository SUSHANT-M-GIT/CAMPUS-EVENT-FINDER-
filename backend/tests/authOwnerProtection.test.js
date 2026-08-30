const bcrypt = require('bcryptjs');

const mockSave = jest.fn();
var mockUserModel = function MockUser(data) {
  Object.assign(this, data);
  this.save = mockSave;
};

mockUserModel.findOne = jest.fn();
mockUserModel.findById = jest.fn();

jest.mock('../models/User', () => mockUserModel);
jest.mock('../services/emailService', () => ({
  sendEmail: jest.fn().mockResolvedValue(true),
}));

const controller = require('../controllers/authController');

describe('Owner email protection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.SUPER_ADMIN_EMAIL = 'mishrasushant029@gmail.com';
  });

  it('allows a normal user to register with the reserved owner email as a regular account', async () => {
    mockUserModel.findOne.mockResolvedValue(null);

    const req = {
      body: {
        name: 'Sushant',
        email: 'MISHRASUSHANT029@gmail.com',
        password: 'secret123',
        role: 'admin',
        collegeName: 'Campus',
      },
    };

    const res = {
      statusCode: 200,
      result: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(payload) {
        this.result = payload;
        return this;
      },
    };

    await controller.register(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.result).toHaveProperty('msg');
    expect(res.result.msg).toMatch(/otp sent|verify/i);
    expect(mockSave).toHaveBeenCalled();
  });

  it('keeps any admin account as a standard user without converting it to a protected owner record', async () => {
    const existingUser = {
      _id: 'owner-1',
      name: 'Sushant',
      email: 'mishrasushant029@gmail.com',
      role: 'student',
      isVerified: false,
      verificationStatus: 'pending',
      accountStatus: 'active',
      save: mockSave.mockResolvedValue(true),
    };

    mockUserModel.findOne.mockResolvedValue(existingUser);

    const req = {
      body: {
        name: 'Sushant',
        email: 'mishrasushant029@gmail.com',
        password: 'secret123',
        role: 'student',
        collegeName: 'Campus',
        collegeId: 'CAMPUS-1',
      },
    };

    const res = {
      statusCode: 200,
      result: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(payload) {
        this.result = payload;
        return this;
      },
    };

    await controller.register(req, res);

    expect(res.statusCode).toBe(200);
    expect(existingUser.role).toBe('student');
    expect(existingUser.verificationStatus).toBe('pending');
    expect(existingUser.accountStatus).toBe('active');
    expect(mockSave).toHaveBeenCalledTimes(1);
  });

  it('allows an authenticated user to change their password with the current password', async () => {
    const originalHash = await bcrypt.hash('oldPassword123', 10);
    const user = {
      _id: 'user-42',
      email: 'student@example.com',
      password: originalHash,
      save: mockSave.mockResolvedValue(true),
    };

    mockUserModel.findById.mockResolvedValue(user);

    const req = {
      user: { id: 'user-42' },
      body: {
        currentPassword: 'oldPassword123',
        newPassword: 'newPassword456',
      },
    };

    const res = {
      statusCode: 200,
      result: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(payload) {
        this.result = payload;
        return this;
      },
    };

    await controller.changePassword(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.result.msg).toMatch(/password.*updated|updated.*password/i);
    const matches = await bcrypt.compare('newPassword456', user.password);
    expect(matches).toBe(true);
    expect(mockSave).toHaveBeenCalledTimes(1);
  });
});
