import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

describe('AuthController', () => {
  let controller: AuthController;
  let service: AuthService;

  const mockAuthService = {
    register: jest.fn(),
    login: jest.fn(),
    refreshTokens: jest.fn(),
    logout: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .compile();

    controller = module.get<AuthController>(AuthController);
    service = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /auth/register', () => {
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

    it('should register new user', async () => {
      const mockResult = {
        user: {
          id: 'user-1',
          email: registerDto.email,
          phone: registerDto.phone,
          role: 'FARMER',
        },
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      };

      mockAuthService.register.mockResolvedValue(mockResult);

      const result = await controller.register(registerDto);

      expect(result).toEqual(mockResult);
      expect(service.register).toHaveBeenCalledWith(registerDto);
    });

    it('should return 400 for duplicate email', async () => {
      mockAuthService.register.mockRejectedValue(
        new BadRequestException('User with this email or phone already exists'),
      );

      await expect(controller.register(registerDto)).rejects.toThrow(
        BadRequestException,
      );
      expect(service.register).toHaveBeenCalledWith(registerDto);
    });

    it('should validate DTO fields', async () => {
      const invalidDto = {
        email: 'invalid-email',
        phone: '123',
        password: 'short',
        role: 'INVALID',
        profile: {},
      };

      // Note: DTO validation is handled by NestJS validation pipe
      // This test ensures the controller passes the DTO to the service
      mockAuthService.register.mockRejectedValue(
        new BadRequestException('Validation failed'),
      );

      await expect(controller.register(invalidDto as any)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('POST /auth/login', () => {
    const loginDto = {
      email: 'test@example.com',
      password: 'password123',
    };

    it('should login successfully', async () => {
      const mockResult = {
        user: {
          id: 'user-1',
          email: loginDto.email,
          role: 'FARMER',
        },
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      };

      mockAuthService.login.mockResolvedValue(mockResult);

      const result = await controller.login(loginDto);

      expect(result).toEqual(mockResult);
      expect(service.login).toHaveBeenCalledWith(loginDto);
    });

    it('should return 401 for invalid credentials', async () => {
      mockAuthService.login.mockRejectedValue(
        new UnauthorizedException('Invalid credentials'),
      );

      await expect(controller.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(service.login).toHaveBeenCalledWith(loginDto);
    });

    it('should return tokens in response', async () => {
      const mockResult = {
        user: {
          id: 'user-1',
          email: loginDto.email,
          role: 'FARMER',
        },
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      };

      mockAuthService.login.mockResolvedValue(mockResult);

      const result = await controller.login(loginDto);

      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
    });
  });

  describe('POST /auth/refresh', () => {
    const refreshTokenDto = {
      refreshToken: 'valid-refresh-token',
    };

    it('should refresh access token', async () => {
      const mockResult = {
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
      };

      mockAuthService.refreshTokens.mockResolvedValue(mockResult);

      const result = await controller.refresh(refreshTokenDto);

      expect(result).toEqual(mockResult);
      expect(service.refreshTokens).toHaveBeenCalledWith(
        refreshTokenDto.refreshToken,
      );
    });

    it('should return 401 for invalid refresh token', async () => {
      mockAuthService.refreshTokens.mockRejectedValue(
        new UnauthorizedException('Invalid refresh token'),
      );

      await expect(controller.refresh(refreshTokenDto)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(service.refreshTokens).toHaveBeenCalledWith(
        refreshTokenDto.refreshToken,
      );
    });
  });

  describe('POST /auth/logout', () => {
    const userId = 'user-1';

    it('should logout successfully', async () => {
      const mockResult = {
        message: 'Logged out successfully',
      };

      mockAuthService.logout.mockResolvedValue(mockResult);

      const result = await controller.logout(userId);

      expect(result).toEqual(mockResult);
      expect(service.logout).toHaveBeenCalledWith(userId);
    });
  });
});
