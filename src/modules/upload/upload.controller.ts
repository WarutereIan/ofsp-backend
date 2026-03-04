import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import * as multer from 'multer';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody, ApiConsumes } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { UploadService, ALLOWED_MIMES } from './upload.service';

const DEFAULT_MAX_SIZE = 10 * 1024 * 1024; // 10MB

/** File type when using multer memoryStorage() */
interface MulterMemoryFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

@ApiTags('Upload')
@ApiBearerAuth()
@Controller('upload')
@UseGuards(JwtAuthGuard)
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post('image')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: multer.memoryStorage(),
      limits: {
        fileSize: Number(process.env.MAX_FILE_SIZE) || DEFAULT_MAX_SIZE,
      },
      fileFilter: (_req, file, cb) => {
        if (!ALLOWED_MIMES.includes(file.mimetype as any)) {
          return cb(new Error('Invalid file type. Allowed: JPEG, PNG, WebP, GIF.'), false);
        }
        cb(null, true);
      },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  @ApiOperation({ summary: 'Upload a single image' })
  @ApiResponse({ status: 201, description: 'Image uploaded; returns URL path' })
  @ApiResponse({ status: 400, description: 'No file or invalid file type/size' })
  async uploadImage(@UploadedFile() file: MulterMemoryFile | undefined): Promise<{ url: string }> {
    if (!file?.buffer) {
      throw new BadRequestException('Image file is required');
    }

    const result = await this.uploadService.storeImage(
      file.buffer,
      file.originalname,
      file.mimetype,
    );
    return { url: result.url };
  }
}
