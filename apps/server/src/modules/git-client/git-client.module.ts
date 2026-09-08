import { Module } from '@nestjs/common';
import { GitProviderFactory } from './git-provider.factory';

@Module({
  providers: [GitProviderFactory],
  exports: [GitProviderFactory],
})
export class GitClientModule {}
