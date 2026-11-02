import { Module } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { PostgresConnection } from './postgres.connection';

@Module({
  providers: [
    PostgresConnection,
    {
      provide: DataSource,
      useFactory: (connection: PostgresConnection): DataSource =>
        connection.getDataSource(),
      inject: [PostgresConnection],
    },
  ],
  exports: [PostgresConnection, DataSource],
})
export class DatabaseModule {}
