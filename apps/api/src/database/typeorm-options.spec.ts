import { createTypeOrmOptions } from './typeorm-options';

describe('createTypeOrmOptions', () => {
  it('keeps synchronize disabled for every caller', () => {
    const options = createTypeOrmOptions(
      'postgresql://culturespace:culturespace@127.0.0.1:5432/culturespace',
    );

    expect(options.synchronize).toBe(false);
    expect(options.type).toBe('postgres');
    expect(options.migrations?.length).toBeGreaterThan(0);
    expect(options.migrationsTableName).toBe('typeorm_migrations');
  });
});
