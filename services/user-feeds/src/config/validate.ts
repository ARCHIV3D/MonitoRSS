import { plainToClass } from "class-transformer";
import {
  IsEnum,
  IsNotEmpty,
  IsNumberString,
  IsString,
  validateSync,
} from "class-validator";

export enum Environment {
  Development = "development",
  Production = "production",
  Local = "local",
  Test = "test",
}

export class EnvironmentVariables {
  @IsEnum(Environment)
  NODE_ENV: Environment;

  @IsString()
  USER_FEEDS_FEED_REQUESTS_API_URL: string;

  @IsString()
  USER_FEEDS_FEED_REQUESTS_API_KEY: string;

  @IsString()
  USER_FEEDS_POSTGRES_URI: string;

  @IsString()
  USER_FEEDS_FEED_MONGODB_URI: string;

  @IsString()
  USER_FEEDS_POSTGRES_DATABASE: string;

  @IsString()
  USER_FEEDS_DISCORD_CLIENT_ID: string;

  @IsString()
  USER_FEEDS_DISCORD_RABBITMQ_URI: string;

  @IsNumberString()
  USER_FEEDS_API_PORT: string;

  @IsString()
  USER_FEEDS_API_KEY: string;

  @IsString()
  @IsNotEmpty()
  USER_FEEDS_RABBITMQ_BROKER_URL: string;
}

export function validateConfig(
  config: Record<string, unknown> | EnvironmentVariables
) {
  const validatedConfig = plainToClass(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    throw new Error(errors.toString());
  }

  return validatedConfig;
}