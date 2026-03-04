import { PartialType } from '@nestjs/swagger';
import { CreateSubCountyDto } from './create-subcounty.dto';

export class UpdateSubCountyDto extends PartialType(CreateSubCountyDto) {}
