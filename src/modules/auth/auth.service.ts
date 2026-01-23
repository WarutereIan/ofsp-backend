import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { UserRole, UserStatus } from '@prisma/client';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async register(registerDto: RegisterDto) {
    const { email, phone, password, role, profile } = registerDto;

    // Check if user already exists
    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [{ email }, { phone }],
      },
    });

    if (existingUser) {
      throw new BadRequestException('User with this email or phone already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user with profile
    const user = await this.prisma.user.create({
      data: {
        email,
        phone,
        password: hashedPassword,
        role: role as UserRole,
        status: UserStatus.PENDING_VERIFICATION,
        profile: {
          create: {
            firstName: profile.firstName,
            lastName: profile.lastName,
            county: profile.county,
            ward: profile.ward,
          },
        },
      },
      include: {
        profile: true,
      },
    });

    // Generate tokens
    const tokens = await this.generateTokens(user.id, user.email, user.role);

    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;

    return {
      user: userWithoutPassword,
      ...tokens,
    };
  }

  async login(loginDto: LoginDto) {
    const { email, phone, password } = loginDto;

    // Validate that either email or phone is provided
    if (!email && !phone) {
      throw new BadRequestException('Either email or phone must be provided');
    }

    // Find user by email or phone - build where clause explicitly
    let whereClause: { email?: string; phone?: string; OR?: Array<{ email?: string } | { phone?: string }> };
    
    if (email && phone) {
      whereClause = { OR: [{ email }, { phone }] };
    } else if (email) {
      whereClause = { email };
    } else {
      whereClause = { phone };
    }

    const user = await this.prisma.user.findFirst({
      where: whereClause,
      include: { profile: true },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.status === UserStatus.SUSPENDED) {
      throw new UnauthorizedException('Account suspended');
    }

    // Update last login
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    const tokens = await this.generateTokens(user.id, user.email, user.role);

    const { password: _, ...userWithoutPassword } = user;

    return {
      user: userWithoutPassword,
      ...tokens,
    };
  }

  async validateUser(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { profile: true },
    });

    if (!user) {
      return null;
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return null;
    }

    const { password: _, ...result } = user;
    return result;
  }

  async generateTokens(userId: string, email: string, role: UserRole) {
    const payload = { sub: userId, email, role };
    const refreshSecret = this.configService.get<string>('JWT_REFRESH_SECRET');
    const refreshExpiration = this.configService.get<string>('JWT_REFRESH_EXPIRATION', '30d');

    if (!refreshSecret) {
      throw new Error('JWT_REFRESH_SECRET is not configured');
    }

    // Add jti (JWT ID) to refresh token payload to ensure uniqueness
    // This prevents token collision when tokens are generated within the same second
    const refreshPayload = { 
      ...payload, 
      jti: `${userId}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}` 
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload),
      this.jwtService.signAsync(refreshPayload, {
        secret: refreshSecret,
        expiresIn: refreshExpiration,
      } as any),
    ]);

    // Calculate expiration date from the expiration string (e.g., '30d' = 30 days)
    const expiresAt = new Date();
    const expirationDays = parseInt(refreshExpiration.replace('d', '')) || 30;
    expiresAt.setDate(expiresAt.getDate() + expirationDays);

    try {
      await this.prisma.refreshToken.create({
        data: {
          token: refreshToken,
          userId,
          expiresAt,
        },
      });
    } catch (error: any) {
      // Handle unique constraint error (extremely rare but possible)
      if (error?.code === 'P2002' && error?.meta?.target?.includes('token')) {
        // Token already exists - regenerate with new jti and retry once
        const retryPayload = { 
          ...payload, 
          jti: `${userId}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}-retry` 
        };
        const newRefreshToken = await this.jwtService.signAsync(retryPayload, {
          secret: refreshSecret,
          expiresIn: refreshExpiration,
        } as any);
        
        await this.prisma.refreshToken.create({
          data: {
            token: newRefreshToken,
            userId,
            expiresAt,
          },
        });
        
        return {
          accessToken,
          refreshToken: newRefreshToken,
        };
      }
      throw error;
    }

    return {
      accessToken,
      refreshToken,
    };
  }

  async refreshTokens(refreshToken: string) {
    const refreshSecret = this.configService.get<string>('JWT_REFRESH_SECRET');
    
    if (!refreshSecret) {
      throw new UnauthorizedException('JWT_REFRESH_SECRET is not configured');
    }

    try {
      const payload = await this.jwtService.verifyAsync(refreshToken, {
        secret: refreshSecret,
      });

      const storedToken = await this.prisma.refreshToken.findUnique({
        where: { token: refreshToken },
        include: { user: true },
      });

      if (!storedToken) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      if (storedToken.expiresAt < new Date()) {
        throw new UnauthorizedException('Refresh token has expired');
      }

      // Store user info before deleting token
      const userId = storedToken.userId;
      const userEmail = storedToken.user.email;
      const userRole = storedToken.user.role;

      // Delete old refresh token first to avoid unique constraint conflicts
      await this.prisma.refreshToken.delete({
        where: { token: refreshToken },
      });

      // Generate new tokens after deleting old one
      const tokens = await this.generateTokens(
        userId,
        userEmail,
        userRole,
      );

      return tokens;
    } catch (error) {
      // If it's already an UnauthorizedException, re-throw it
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      // For JWT verification errors, check the error type
      const errorMessage = error?.message || 'Invalid refresh token';
      // In development/test, include more details
      if (process.env.NODE_ENV !== 'production') {
        console.error('Refresh token verification failed:', {
          error: errorMessage,
          errorName: error?.name,
          tokenPreview: refreshToken?.substring(0, 20) + '...',
        });
      }
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async logout(userId: string) {
    await this.prisma.refreshToken.deleteMany({
      where: { userId },
    });

    return { message: 'Logged out successfully' };
  }

  /**
   * Get user by ID (for /auth/me endpoint)
   */
  async getUserById(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });

    if (!user) {
      return null;
    }

    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }
}
