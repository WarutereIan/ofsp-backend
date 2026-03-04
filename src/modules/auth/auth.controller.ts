import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  Res,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiCookieAuth,
} from '@nestjs/swagger';
import * as express from 'express';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

// Cookie configuration for cross-origin auth
// SameSite=None + Secure required for cross-origin cookies (frontend on vercel.app, backend on jirani.store)
const isProduction = process.env.NODE_ENV === 'production';
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: isProduction, // Must be true in production (HTTPS required)
  sameSite: isProduction ? 'none' as const : 'lax' as const, // 'none' for cross-origin in prod
  path: '/',
};

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private configService: ConfigService,
  ) {}

  /** Parse a duration string like "7d", "24h", "30m", "60s" to milliseconds. */
  private parseDurationToMs(duration: string): number {
    const match = duration.match(/^(\d+)(s|m|h|d)$/);
    if (!match) return 7 * 24 * 60 * 60 * 1000; // default 7 days
    const value = parseInt(match[1], 10);
    switch (match[2]) {
      case 's': return value * 1000;
      case 'm': return value * 60 * 1000;
      case 'h': return value * 60 * 60 * 1000;
      case 'd': return value * 24 * 60 * 60 * 1000;
      default:  return 7 * 24 * 60 * 60 * 1000;
    }
  }

  /**
   * Set auth cookies on the response
   */
  private setAuthCookies(res: express.Response, accessToken: string, refreshToken: string): void {
    // Access token cookie maxAge should match the JWT expiration so the
    // cookie survives as long as the token is valid (avoids unnecessary 401 → refresh cycles).
    const jwtExpiration = this.configService.get<string>('JWT_EXPIRATION', '7d');
    const accessMaxAge = this.parseDurationToMs(jwtExpiration);
    res.cookie('access_token', accessToken, {
      ...COOKIE_OPTIONS,
      maxAge: accessMaxAge,
    });

    // Refresh token: long-lived (matches JWT_REFRESH_EXPIRATION)
    const refreshExpiration = this.configService.get<string>('JWT_REFRESH_EXPIRATION', '30d');
    const refreshDays = parseInt(refreshExpiration.replace('d', '')) || 30;
    res.cookie('refresh_token', refreshToken, {
      ...COOKIE_OPTIONS,
      maxAge: refreshDays * 24 * 60 * 60 * 1000,
      path: '/api/v1/auth', // Only sent to auth endpoints (refresh/logout)
    });
  }

  /**
   * Clear auth cookies
   */
  private clearAuthCookies(res: express.Response): void {
    res.clearCookie('access_token', { ...COOKIE_OPTIONS });
    res.clearCookie('refresh_token', { ...COOKIE_OPTIONS, path: '/api/v1/auth' });
  }

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({ status: 201, description: 'User registered successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async register(
    @Body() registerDto: RegisterDto,
    @Res({ passthrough: true }) res: express.Response,
  ) {
    const result = await this.authService.register(registerDto);
    this.setAuthCookies(res, result.accessToken, result.refreshToken);
    // Return user info and tokens (tokens still in body for backwards compatibility)
    return result;
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login user' })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) res: express.Response,
  ) {
    const result = await this.authService.login(loginDto);
    this.setAuthCookies(res, result.accessToken, result.refreshToken);
    // Return user info and tokens (tokens still in body for backwards compatibility)
    return result;
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token using refresh token from cookie or body' })
  @ApiResponse({ status: 200, description: 'Token refreshed successfully' })
  @ApiResponse({ status: 401, description: 'Invalid refresh token' })
  async refresh(
    @Req() req: express.Request,
    @Res({ passthrough: true }) res: express.Response,
    @Body() body: { refreshToken?: string },
  ) {
    // Get refresh token from cookie first, then body
    const refreshToken = req.cookies?.refresh_token || body.refreshToken;
    if (!refreshToken) {
      res.status(HttpStatus.UNAUTHORIZED);
      return { message: 'No refresh token provided' };
    }

    const result = await this.authService.refreshTokens(refreshToken);
    this.setAuthCookies(res, result.accessToken, result.refreshToken);
    // Return tokens for backwards compatibility
    return result;
  }

  @ApiBearerAuth()
  @ApiCookieAuth()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout user' })
  @ApiResponse({ status: 200, description: 'Logout successful' })
  async logout(
    @CurrentUser('id') userId: string,
    @Res({ passthrough: true }) res: express.Response,
  ) {
    const result = await this.authService.logout(userId);
    this.clearAuthCookies(res);
    return result;
  }

  @ApiBearerAuth()
  @ApiCookieAuth()
  @Get('me')
  @ApiOperation({ summary: 'Get current authenticated user' })
  @ApiResponse({ status: 200, description: 'Current user info' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  async me(@CurrentUser() user: { id: string; email: string; role: string }) {
    // Get full user details
    return this.authService.getUserById(user.id);
  }
}
