import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole, UserStatus } from '@prisma/client';

jest.mock('bcrypt');

describe('AuthService', () => {
  let service: AuthService;
  let prisma: jest.Mocked<PrismaService>;
  let jwtService: jest.Mocked<JwtService>;
  let configService: jest.Mocked<ConfigService>;

  const mockPrismaService = {
    user: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    refreshToken: {
      findUnique: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
  };

  const mockJwtService = {
    signAsync: jest.fn(),
    verifyAsync: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prisma = module.get(PrismaService);
    jwtService = module.get(JwtService);
    configService = module.get(ConfigService);

    // Default config values
    configService.get.mockImplementation((key: string) => {
      if (key === 'JWT_REFRESH_SECRET') return 'refresh-secret';
      if (key === 'JWT_REFRESH_EXPIRATION') return '30d';
      return undefined;
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    const registerDto = {
      email: 'test@example.com',
      phone: '+254712345678',
      password: 'password123',
      role: 'FARMER',
      profile: {
        firstName: 'John',
        lastName: 'Doe',
        county: 'Nairobi',
        ward: 'Dagoretti North',
      },
    };

    it('should register new user successfully', async () => {
      const hashedPassword = 'hashedPassword123';
      const mockUser = {
        id: 'user-1',
        email: registerDto.email,
        phone: registerDto.phone,
        password: hashedPassword,
        role: UserRole.FARMER,
        status: UserStatus.PENDING_VERIFICATION,
        profile: {
          id: 'profile-1',
          userId: 'user-1',
          firstName: registerDto.profile.firstName,
          lastName: registerDto.profile.lastName,
          county: registerDto.profile.county,
          ward: registerDto.profile.ward,
        },
      };

      const mockTokens = {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      };

      mockPrismaService.user.findFirst.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue(hashedPassword);
      mockPrismaService.user.create.mockResolvedValue(mockUser);
      mockJwtService.signAsync
        .mockResolvedValueOnce(mockTokens.accessToken)
        .mockResolvedValueOnce(mockTokens.refreshToken);
      mockPrismaService.refreshToken.create.mockResolvedValue({} as any);

      const result = await service.register(registerDto);

      expect(result.user).toBeDefined();
      expect(result.user.email).toBe(registerDto.email);
      expect(result.user.password).toBeUndefined();
      expect(result.accessToken).toBe(mockTokens.accessToken);
      expect(result.refreshToken).toBe(mockTokens.refreshToken);
      expect(mockPrismaService.user.findFirst).toHaveBeenCalledWith({
        where: {
          OR: [{ email: registerDto.email }, { phone: registerDto.phone }],
        },
      });
      expect(bcrypt.hash).toHaveBeenCalledWith(registerDto.password, 10);
      expect(mockPrismaService.user.create).toHaveBeenCalled();
    });

    it('should hash password before storing', async () => {
      const hashedPassword = 'hashedPassword123';
      const mockUser = {
        id: 'user-1',
        email: registerDto.email,
        phone: registerDto.phone,
        password: hashedPassword,
        role: UserRole.FARMER,
        status: UserStatus.PENDING_VERIFICATION,
        profile: { id: 'profile-1', userId: 'user-1' },
      };

      mockPrismaService.user.findFirst.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue(hashedPassword);
      mockPrismaService.user.create.mockResolvedValue(mockUser);
      mockJwtService.signAsync.mockResolvedValue('token');
      mockPrismaService.refreshToken.create.mockResolvedValue({} as any);

      await service.register(registerDto);

      expect(bcrypt.hash).toHaveBeenCalledWith(registerDto.password, 10);
      expect(mockPrismaService.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            password: hashedPassword,
          }),
        }),
      );
    });

    it('should create profile with user', async () => {
      const hashedPassword = 'hashedPassword123';
      const mockUser = {
        id: 'user-1',
        email: registerDto.email,
        phone: registerDto.phone,
        password: hashedPassword,
        role: UserRole.FARMER,
        status: UserStatus.PENDING_VERIFICATION,
        profile: {
          id: 'profile-1',
          userId: 'user-1',
          firstName: registerDto.profile.firstName,
          lastName: registerDto.profile.lastName,
          county: registerDto.profile.county,
          ward: registerDto.profile.ward,
        },
      };

      mockPrismaService.user.findFirst.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue(hashedPassword);
      mockPrismaService.user.create.mockResolvedValue(mockUser);
      mockJwtService.signAsync.mockResolvedValue('token');
      mockPrismaService.refreshToken.create.mockResolvedValue({} as any);

      await service.register(registerDto);

      expect(mockPrismaService.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            profile: {
              create: {
                firstName: registerDto.profile.firstName,
                lastName: registerDto.profile.lastName,
                county: registerDto.profile.county,
                ward: registerDto.profile.ward,
              },
            },
          }),
        }),
      );
    });

    it('should throw BadRequestException if email exists', async () => {
      const existingUser = {
        id: 'user-1',
        email: registerDto.email,
        phone: '+254799999999',
      };

      mockPrismaService.user.findFirst.mockResolvedValue(existingUser);

      await expect(service.register(registerDto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.register(registerDto)).rejects.toThrow(
        'User with this email or phone already exists',
      );
      expect(mockPrismaService.user.create).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException if phone exists', async () => {
      const existingUser = {
        id: 'user-1',
        email: 'other@example.com',
        phone: registerDto.phone,
      };

      mockPrismaService.user.findFirst.mockResolvedValue(existingUser);

      await expect(service.register(registerDto)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockPrismaService.user.create).not.toHaveBeenCalled();
    });

    it('should set status to PENDING_VERIFICATION', async () => {
      const hashedPassword = 'hashedPassword123';
      const mockUser = {
        id: 'user-1',
        email: registerDto.email,
        phone: registerDto.phone,
        password: hashedPassword,
        role: UserRole.FARMER,
        status: UserStatus.PENDING_VERIFICATION,
        profile: { id: 'profile-1', userId: 'user-1' },
      };

      mockPrismaService.user.findFirst.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue(hashedPassword);
      mockPrismaService.user.create.mockResolvedValue(mockUser);
      mockJwtService.signAsync.mockResolvedValue('token');
      mockPrismaService.refreshToken.create.mockResolvedValue({} as any);

      await service.register(registerDto);

      expect(mockPrismaService.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: UserStatus.PENDING_VERIFICATION,
          }),
        }),
      );
    });

    it('should generate JWT tokens on registration', async () => {
      const hashedPassword = 'hashedPassword123';
      const mockUser = {
        id: 'user-1',
        email: registerDto.email,
        phone: registerDto.phone,
        password: hashedPassword,
        role: UserRole.FARMER,
        status: UserStatus.PENDING_VERIFICATION,
        profile: { id: 'profile-1', userId: 'user-1' },
      };
      const accessToken = 'access-token';
      const refreshToken = 'refresh-token';

      mockPrismaService.user.findFirst.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue(hashedPassword);
      mockPrismaService.user.create.mockResolvedValue(mockUser);
      mockJwtService.signAsync
        .mockResolvedValueOnce(accessToken)
        .mockResolvedValueOnce(refreshToken);
      mockPrismaService.refreshToken.create.mockResolvedValue({} as any);

      const result = await service.register(registerDto);

      expect(mockJwtService.signAsync).toHaveBeenCalledTimes(2);
      expect(result.accessToken).toBe(accessToken);
      expect(result.refreshToken).toBe(refreshToken);
    });
  });

  describe('login', () => {
    const loginDto = {
      email: 'test@example.com',
      password: 'password123',
    };

    it('should login with valid credentials', async () => {
      const hashedPassword = 'hashedPassword123';
      const mockUser = {
        id: 'user-1',
        email: loginDto.email,
        password: hashedPassword,
        role: UserRole.FARMER,
        status: UserStatus.ACTIVE,
        profile: { id: 'profile-1', userId: 'user-1' },
      };
      const mockTokens = {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      };

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockPrismaService.user.update.mockResolvedValue(mockUser);
      mockJwtService.signAsync
        .mockResolvedValueOnce(mockTokens.accessToken)
        .mockResolvedValueOnce(mockTokens.refreshToken);
      mockPrismaService.refreshToken.create.mockResolvedValue({} as any);

      const result = await service.login(loginDto);

      expect(result.user).toBeDefined();
      expect(result.user.email).toBe(loginDto.email);
      expect(result.user.password).toBeUndefined();
      expect(result.accessToken).toBe(mockTokens.accessToken);
      expect(result.refreshToken).toBe(mockTokens.refreshToken);
      expect(bcrypt.compare).toHaveBeenCalledWith(
        loginDto.password,
        hashedPassword,
      );
    });

    it('should return access and refresh tokens', async () => {
      const hashedPassword = 'hashedPassword123';
      const mockUser = {
        id: 'user-1',
        email: loginDto.email,
        password: hashedPassword,
        role: UserRole.FARMER,
        status: UserStatus.ACTIVE,
        profile: { id: 'profile-1', userId: 'user-1' },
      };
      const accessToken = 'access-token';
      const refreshToken = 'refresh-token';

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockPrismaService.user.update.mockResolvedValue(mockUser);
      mockJwtService.signAsync
        .mockResolvedValueOnce(accessToken)
        .mockResolvedValueOnce(refreshToken);
      mockPrismaService.refreshToken.create.mockResolvedValue({} as any);

      const result = await service.login(loginDto);

      expect(result.accessToken).toBe(accessToken);
      expect(result.refreshToken).toBe(refreshToken);
    });

    it('should throw UnauthorizedException for invalid email', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.login(loginDto)).rejects.toThrow(
        'Invalid credentials',
      );
      expect(bcrypt.compare).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException for invalid password', async () => {
      const hashedPassword = 'hashedPassword123';
      const mockUser = {
        id: 'user-1',
        email: loginDto.email,
        password: hashedPassword,
        role: UserRole.FARMER,
        status: UserStatus.ACTIVE,
        profile: { id: 'profile-1', userId: 'user-1' },
      };

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.login(loginDto)).rejects.toThrow(
        'Invalid credentials',
      );
    });

    it('should throw UnauthorizedException for inactive user', async () => {
      const hashedPassword = 'hashedPassword123';
      const mockUser = {
        id: 'user-1',
        email: loginDto.email,
        password: hashedPassword,
        role: UserRole.FARMER,
        status: UserStatus.SUSPENDED,
        profile: { id: 'profile-1', userId: 'user-1' },
      };

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.login(loginDto)).rejects.toThrow(
        'Account suspended',
      );
    });

    it('should update lastLoginAt timestamp', async () => {
      const hashedPassword = 'hashedPassword123';
      const mockUser = {
        id: 'user-1',
        email: loginDto.email,
        password: hashedPassword,
        role: UserRole.FARMER,
        status: UserStatus.ACTIVE,
        profile: { id: 'profile-1', userId: 'user-1' },
      };

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockPrismaService.user.update.mockResolvedValue(mockUser);
      mockJwtService.signAsync.mockResolvedValue('token');
      mockPrismaService.refreshToken.create.mockResolvedValue({} as any);

      await service.login(loginDto);

      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: { lastLogin: expect.any(Date) },
      });
    });
  });

  describe('validateUser', () => {
    const email = 'test@example.com';
    const password = 'password123';

    it('should return user if credentials valid', async () => {
      const hashedPassword = 'hashedPassword123';
      const mockUser = {
        id: 'user-1',
        email,
        password: hashedPassword,
        role: UserRole.FARMER,
        status: UserStatus.ACTIVE,
        profile: { id: 'profile-1', userId: 'user-1' },
      };

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.validateUser(email, password);

      expect(result).toBeDefined();
      expect(result?.email).toBe(email);
      expect(result?.password).toBeUndefined();
    });

    it('should throw UnauthorizedException if user not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      const result = await service.validateUser(email, password);

      expect(result).toBeNull();
    });

    it('should throw UnauthorizedException if password invalid', async () => {
      const hashedPassword = 'hashedPassword123';
      const mockUser = {
        id: 'user-1',
        email,
        password: hashedPassword,
        role: UserRole.FARMER,
        status: UserStatus.ACTIVE,
        profile: { id: 'profile-1', userId: 'user-1' },
      };

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      const result = await service.validateUser(email, password);

      expect(result).toBeNull();
    });
  });

  describe('refreshTokens', () => {
    const refreshToken = 'valid-refresh-token';
    const payload = {
      sub: 'user-1',
      email: 'test@example.com',
      role: UserRole.FARMER,
    };

    it('should generate new access token with valid refresh token', async () => {
      const mockStoredToken = {
        id: 'token-1',
        token: refreshToken,
        userId: 'user-1',
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        user: {
          id: 'user-1',
          email: payload.email,
          role: UserRole.FARMER,
        },
      };
      const newAccessToken = 'new-access-token';
      const newRefreshToken = 'new-refresh-token';

      mockJwtService.verifyAsync.mockResolvedValue(payload);
      mockPrismaService.refreshToken.findUnique.mockResolvedValue(
        mockStoredToken,
      );
      mockJwtService.signAsync
        .mockResolvedValueOnce(newAccessToken)
        .mockResolvedValueOnce(newRefreshToken);
      mockPrismaService.refreshToken.create.mockResolvedValue({} as any);
      mockPrismaService.refreshToken.delete.mockResolvedValue({} as any);

      const result = await service.refreshTokens(refreshToken);

      expect(result.accessToken).toBe(newAccessToken);
      expect(result.refreshToken).toBe(newRefreshToken);
      expect(mockPrismaService.refreshToken.delete).toHaveBeenCalledWith({
        where: { token: refreshToken },
      });
    });

    it('should throw UnauthorizedException for invalid refresh token', async () => {
      mockJwtService.verifyAsync.mockRejectedValue(new Error('Invalid token'));

      await expect(service.refreshTokens(refreshToken)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.refreshTokens(refreshToken)).rejects.toThrow(
        'Invalid refresh token',
      );
    });

    it('should throw UnauthorizedException for expired refresh token', async () => {
      const mockStoredToken = {
        id: 'token-1',
        token: refreshToken,
        userId: 'user-1',
        expiresAt: new Date(Date.now() - 1000), // Expired
        user: {
          id: 'user-1',
          email: payload.email,
          role: UserRole.FARMER,
        },
      };

      mockJwtService.verifyAsync.mockResolvedValue(payload);
      mockPrismaService.refreshToken.findUnique.mockResolvedValue(
        mockStoredToken,
      );

      await expect(service.refreshTokens(refreshToken)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException if token not found in database', async () => {
      mockJwtService.verifyAsync.mockResolvedValue(payload);
      mockPrismaService.refreshToken.findUnique.mockResolvedValue(null);

      await expect(service.refreshTokens(refreshToken)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('logout', () => {
    it('should delete all refresh tokens for user', async () => {
      const userId = 'user-1';
      mockPrismaService.refreshToken.deleteMany.mockResolvedValue({ count: 2 });

      const result = await service.logout(userId);

      expect(result.message).toBe('Logged out successfully');
      expect(mockPrismaService.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: { userId },
      });
    });
  });
});
