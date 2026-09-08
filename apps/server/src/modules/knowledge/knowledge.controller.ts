import {
  Controller,
  Get,
  Post,
  Delete,
  Query,
  Param,
  Body,
  UseGuards,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  Request,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { KnowledgeService } from './knowledge.service';

class SearchDto {
  @IsString()
  projectId!: string;

  @IsString()
  query!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  topK?: number;
}

@Controller('api/v1/knowledge')
@UseGuards(JwtAuthGuard)
export class KnowledgeController {
  constructor(private readonly knowledge: KnowledgeService) {}

  @Post('documents')
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @Query('projectId') projectId: string,
    @UploadedFile() file: Express.Multer.File,
    @Request() req: { user: { userId: string } },
  ) {
    if (!projectId) {
      throw new BadRequestException({ code: 400, data: null, message: 'projectId required' });
    }
    if (!file) {
      throw new BadRequestException({ code: 400, data: null, message: 'file required' });
    }
    if (file.size > 10 * 1024 * 1024) {
      throw new BadRequestException({ code: 400, data: null, message: 'file must be <= 10MB' });
    }
    const ext = (file.originalname.split('.').pop() ?? '').toLowerCase();
    if (!['md', 'markdown', 'pdf'].includes(ext)) {
      throw new BadRequestException({
        code: 400,
        data: null,
        message: 'only md/pdf supported',
      });
    }
    const fileType = ext === 'pdf' ? 'pdf' : 'md';
    return this.knowledge.createDocument({
      projectId,
      uploaderId: req.user.userId,
      fileName: file.originalname,
      fileType,
      buffer: file.buffer,
    });
  }

  @Get('documents')
  list(@Query('projectId') projectId: string) {
    if (!projectId) {
      throw new BadRequestException({ code: 400, data: null, message: 'projectId required' });
    }
    return this.knowledge.listDocuments(projectId);
  }

  @Delete('documents/:id')
  remove(@Param('id') id: string) {
    return this.knowledge.deleteDocument(id);
  }

  @Post('search')
  search(@Body() body: SearchDto) {
    return this.knowledge.search(body.projectId, body.query, body.topK ?? 5);
  }
}
