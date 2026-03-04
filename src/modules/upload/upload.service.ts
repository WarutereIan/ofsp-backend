import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  CreateBucketCommand,
  HeadBucketCommand,
  PutBucketPolicyCommand,
} from '@aws-sdk/client-s3';
import * as fs from 'fs';
import * as path from 'path';

export const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const;

function sanitizeFilename(name: string): string {
  const ext = path.extname(name).toLowerCase() || '.jpg';
  const base = path.basename(name, path.extname(name))
    .replace(/[^a-zA-Z0-9-_]/g, '')
    .slice(0, 80) || 'image';
  return `${base}${ext}`;
}

export interface UploadResult {
  url: string;
}

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);
  private readonly s3Client: S3Client | null = null;
  private readonly s3Bucket: string;
  private readonly s3Endpoint: string;
  private readonly s3PublicUrl: string | null = null;
  private readonly useS3: boolean;

  constructor(private readonly configService: ConfigService) {
    const endpoint = this.configService.get<string>('S3_ENDPOINT', '');
    const bucket = this.configService.get<string>('S3_BUCKET', '');
    const accessKey = this.configService.get<string>('S3_ACCESS_KEY', '');
    const secretKey = this.configService.get<string>('S3_SECRET_KEY', '');
    const region = this.configService.get<string>('S3_REGION', 'us-east-1');
    const publicUrl = this.configService.get<string>('S3_PUBLIC_URL', '');

    this.useS3 = !!(endpoint && bucket && accessKey && secretKey);
    this.s3Endpoint = endpoint;
    this.s3Bucket = bucket;
    this.s3PublicUrl = publicUrl || null;

    if (this.useS3) {
      const forcePathStyle = this.configService.get<string>('S3_FORCE_PATH_STYLE', 'true') === 'true';
      this.s3Client = new S3Client({
        endpoint,
        region,
        credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
        forcePathStyle,
      });
      this.logger.log(`S3 storage enabled → ${endpoint} bucket="${bucket}"`);
      this.ensureBucketExists();
    } else {
      this.logger.log('S3 not configured, using local disk storage');
    }
  }

  private async ensureBucketExists() {
    try {
      await this.s3Client!.send(new HeadBucketCommand({ Bucket: this.s3Bucket }));
      this.logger.log(`S3 bucket "${this.s3Bucket}" exists`);
    } catch {
      this.logger.warn(`S3 bucket "${this.s3Bucket}" not found, creating...`);
      try {
        await this.s3Client!.send(new CreateBucketCommand({ Bucket: this.s3Bucket }));
        this.logger.log(`S3 bucket "${this.s3Bucket}" created`);
      } catch (createErr: any) {
        this.logger.error(`Failed to create S3 bucket: ${createErr.message}`);
        return;
      }
    }

    await this.ensurePublicReadPolicy();
  }

  private async ensurePublicReadPolicy() {
    try {
      const policy = JSON.stringify({
        Version: '2012-10-17',
        Statement: [
          {
            Sid: 'PublicRead',
            Effect: 'Allow',
            Principal: '*',
            Action: ['s3:GetObject'],
            Resource: [`arn:aws:s3:::${this.s3Bucket}/*`],
          },
        ],
      });
      await this.s3Client!.send(
        new PutBucketPolicyCommand({ Bucket: this.s3Bucket, Policy: policy }),
      );
      this.logger.log(`S3 bucket "${this.s3Bucket}" public-read policy applied`);
    } catch (err: any) {
      this.logger.warn(`Could not set public-read policy: ${err.message}`);
    }
  }

  async storeImage(
    buffer: Buffer,
    originalname: string,
    mimetype: string,
  ): Promise<UploadResult> {
    if (this.useS3 && this.s3Client) {
      return this.storeImageS3(buffer, originalname, mimetype);
    }
    return this.storeImageDisk(buffer, originalname);
  }

  private async storeImageS3(
    buffer: Buffer,
    originalname: string,
    mimetype: string,
  ): Promise<UploadResult> {
    const filename = `${Date.now()}-${sanitizeFilename(originalname)}`;

    await this.s3Client!.send(
      new PutObjectCommand({
        Bucket: this.s3Bucket,
        Key: filename,
        Body: buffer,
        ContentType: mimetype,
      }),
    );

    // Build the public URL: endpoint/bucket/key (path-style for MinIO)
    let url: string;
    if (this.s3PublicUrl) {
      url = `${this.s3PublicUrl.replace(/\/$/, '')}/${filename}`;
    } else {
      url = `${this.s3Endpoint.replace(/\/$/, '')}/${this.s3Bucket}/${filename}`;
    }

    this.logger.debug(`Uploaded to S3: ${url}`);
    return { url };
  }

  private storeImageDisk(buffer: Buffer, originalname: string): UploadResult {
    const uploadDir = this.configService.get<string>('UPLOAD_DESTINATION', 'uploads');
    const destPath = path.isAbsolute(uploadDir) ? uploadDir : path.join(process.cwd(), uploadDir);
    fs.mkdirSync(destPath, { recursive: true });

    const filename = `${Date.now()}-${sanitizeFilename(originalname)}`;
    const filePath = path.join(destPath, filename);
    fs.writeFileSync(filePath, buffer);

    const apiPrefix = this.configService.get<string>('API_PREFIX', 'api/v1');
    const url = `/${apiPrefix}/uploads/${filename}`;
    return { url };
  }
}
