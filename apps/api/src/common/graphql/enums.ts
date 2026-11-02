import { registerEnumType } from '@nestjs/graphql';

export enum InterfaceLanguage {
  EN = 'EN',
  RU = 'RU',
}

export enum ProfileVisibility {
  PUBLIC = 'PUBLIC',
  PRIVATE = 'PRIVATE',
}

export enum LibraryVisibility {
  PUBLIC = 'PUBLIC',
  PRIVATE = 'PRIVATE',
}

export enum AccountRole {
  USER = 'USER',
  MODERATOR = 'MODERATOR',
  ADMIN = 'ADMIN',
}

export enum PersonCapacity {
  AUTHOR = 'AUTHOR',
  DIRECTOR = 'DIRECTOR',
}

export enum OutboxMessageType {
  SEND_EMAIL = 'SEND_EMAIL',
  INVALIDATE_SESSIONS = 'INVALIDATE_SESSIONS',
  CREATE_NOTIFICATION = 'CREATE_NOTIFICATION',
  REFRESH_WORK = 'REFRESH_WORK',
}

registerEnumType(InterfaceLanguage, { name: 'InterfaceLanguage' });
registerEnumType(ProfileVisibility, { name: 'ProfileVisibility' });
registerEnumType(LibraryVisibility, { name: 'LibraryVisibility' });
registerEnumType(AccountRole, { name: 'AccountRole' });
registerEnumType(PersonCapacity, { name: 'PersonCapacity' });
registerEnumType(OutboxMessageType, { name: 'OutboxMessageType' });

export function toDatabaseLanguage(language: InterfaceLanguage): 'en' | 'ru' {
  return language === InterfaceLanguage.EN ? 'en' : 'ru';
}

export function fromDatabaseLanguage(language: 'en' | 'ru'): InterfaceLanguage {
  return language === 'en' ? InterfaceLanguage.EN : InterfaceLanguage.RU;
}
