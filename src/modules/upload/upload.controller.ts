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
import * as fs from 'fs';
import * as path from 'path';
import { ConfigService } from '@nestjs/config';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody, ApiConsumes } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
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

function sanitizeFilename(name: string): string {
  const ext = path.extname(name).toLowerCase() || '.jpg';
  const base = path.basename(name, path.extname(name))
    .replace(/[^a-zA-Z0-9-_]/g, '')
    .slice(0, 80) || 'image';
  return `${base}${ext}`;
}

@ApiTags('Upload')
@ApiBearerAuth()
@Controller('upload')
@UseGuards(JwtAuthGuard)
export class UploadController {
  constructor(private configService: ConfigService) {}

  @Post('image')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: multer.memoryStorage(),
      limits: { fileSize: DEFAULT_MAX_SIZE },
      fileFilter: (_req, file, cb) => {
        if (!ALLOWED_MIMES.includes(file.mimetype)) {
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

    const uploadDir = this.configService.get<string>('UPLOAD_DESTINATION', 'uploads');
    const destPath = path.isAbsolute(uploadDir) ? uploadDir : path.join(process.cwd(), uploadDir);
    fs.mkdirSync(destPath, { recursive: true });

    const filename = `${Date.now()}-${sanitizeFilename(file.originalname)}`;
    const filePath = path.join(destPath, filename);
    fs.writeFileSync(filePath, file.buffer);

    const apiPrefix = this.configService.get<string>('API_PREFIX', 'api/v1');
    const url = `/${apiPrefix}/uploads/${filename}`;
    return { url };
  }
}
