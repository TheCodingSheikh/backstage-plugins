import { LoggerService } from '@backstage/backend-plugin-api';

export class LoggerWrapper {
  constructor(private readonly logger: LoggerService) {}

  error(message: any, ...meta: any[]): void {
    this.logger.error(message, ...meta);
  }

  warn(message: any, ...meta: any[]): void {
    this.logger.warn(message, ...meta);
  }

  info(message: any, ...meta: any[]): void {
    this.logger.info(message, ...meta);
  }

  debug(message: any, ...meta: any[]): void {
    this.logger.debug(message, ...meta);
  }

  child(options: object): LoggerWrapper {
    return new LoggerWrapper(this.logger.child(options));
  }
}