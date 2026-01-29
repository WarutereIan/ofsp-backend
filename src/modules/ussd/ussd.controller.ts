import { Body, Controller, Header, HttpCode, HttpException, HttpStatus, Logger, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { UssdService } from './ussd.service';
import { UssdRequestDto } from './dto/ussd-request.dto';
import { Public } from '../../common/decorators/public.decorator';
import { SkipTransform } from '../../common/decorators/skip-transform.decorator';

@ApiTags('USSD')
@Controller('ussd')
export class UssdController {
  private readonly logger = new Logger(UssdController.name);

  constructor(private readonly ussdService: UssdService) {}

  /**
   * Africa'sTalking USSD callback endpoint.
   *
   * Africa'sTalking will POST form-encoded data with fields:
   *  - sessionId
   *  - serviceCode
   *  - phoneNumber
   *  - text
   *  - networkCode
   *
   * Response must be a plain text string starting with either:
   *  - "CON " to continue the session
   *  - "END " to terminate the session
   */
  @Post('africastalking')
  @HttpCode(200)
  @Header('Content-Type', 'text/plain')
  @ApiOperation({ summary: 'Africa\'sTalking USSD callback handler' })
  @Public()
  @SkipTransform()
  async handleAfricasTalking(@Body() body: UssdRequestDto): Promise<string> {
    try {
      // Log raw Africa'sTalking request payload for observability/debugging
      this.logger.log(
        `Received Africa'sTalking USSD request: ${JSON.stringify(body)}`,
      );

      const response = await this.ussdService.handleRequest(body);

      // Log the response being sent back to Africa'sTalking
      this.logger.log(
        `Sending USSD response [sessionId=${body.sessionId}]: ${response.substring(0, 100)}${response.length > 100 ? '...' : ''}`,
      );

      return response;
    } catch (error) {
      // Log error details alongside the raw request body
      this.logger.error(
        `Error handling Africa'sTalking USSD request: ${JSON.stringify(body)}`,
        (error as Error)?.stack || String(error),
      );

      throw new HttpException(
        'END Sorry, an error occurred processing your request.',
        HttpStatus.OK,
      );
    }
  }
}

