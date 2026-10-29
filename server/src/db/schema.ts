import {
  bigint,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';

const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 320 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  fullName: varchar('full_name', { length: 255 }).notNull(),
  createdAt: createdAt(),
});

export const refreshTokens = pgTable(
  'refresh_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull().unique(),
    // Цепочка ротации: при повторном использовании токена отзывается вся семья.
    familyId: uuid('family_id').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index('refresh_tokens_user_id_idx').on(t.userId), index('refresh_tokens_family_id_idx').on(t.familyId)]
);

export const spaces = pgTable('spaces', {
  id: uuid('id').primaryKey().defaultRandom(),
  type: varchar('type', { length: 16, enum: ['space', 'project'] }).notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  ownerId: uuid('owner_id')
    .notNull()
    .references(() => users.id),
  createdAt: createdAt(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

export const spaceMembers = pgTable(
  'space_members',
  {
    spaceId: uuid('space_id')
      .notNull()
      .references(() => spaces.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: varchar('role', { length: 16, enum: ['owner', 'editor', 'viewer'] }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.spaceId, t.userId] }), index('space_members_user_id_idx').on(t.userId)]
);

export const pages = pgTable(
  'pages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    spaceId: uuid('space_id')
      .notNull()
      .references(() => spaces.id, { onDelete: 'cascade' }),
    parentId: uuid('parent_id').references((): AnyPgColumn => pages.id, { onDelete: 'cascade' }),
    // Дробная позиция: перемещение между соседями меняет одну запись.
    position: doublePrecision('position').notNull(),
    title: varchar('title', { length: 255 }).notNull(),
    content: jsonb('content').notNull(),
    version: integer('version').notNull().default(1),
    createdById: uuid('created_by_id').references(() => users.id, { onDelete: 'set null' }),
    createdByName: varchar('created_by_name', { length: 255 }).notNull(),
    createdAt: createdAt(),
    updatedById: uuid('updated_by_id').references(() => users.id, { onDelete: 'set null' }),
    updatedByName: varchar('updated_by_name', { length: 255 }).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('pages_space_parent_position_idx').on(t.spaceId, t.parentId, t.position)]
);

export const attachments = pgTable(
  'attachments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // null, пока вложение загружено в сессию импорта и не привязано к странице (commit привяжет).
    pageId: uuid('page_id').references(() => pages.id, { onDelete: 'cascade' }),
    fileName: varchar('file_name', { length: 512 }).notNull(),
    mimeType: varchar('mime_type', { length: 255 }).notNull(),
    size: bigint('size', { mode: 'number' }).notNull(),
    storageKey: text('storage_key').notNull(),
    uploadedById: uuid('uploaded_by_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
  },
  (t) => [index('attachments_page_id_idx').on(t.pageId)]
);

export const imports = pgTable('imports', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  status: varchar('status', { length: 16, enum: ['open', 'committed'] })
    .notNull()
    .default('open'),
  // Результат commit (соответствие локальных id серверным): повторный вызов отдаёт его же.
  result: jsonb('result'),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
});

export const importAttachments = pgTable(
  'import_attachments',
  {
    importId: uuid('import_id')
      .notNull()
      .references(() => imports.id, { onDelete: 'cascade' }),
    localId: varchar('local_id', { length: 255 }).notNull(),
    attachmentId: uuid('attachment_id')
      .notNull()
      .references(() => attachments.id, { onDelete: 'cascade' }),
  },
  (t) => [uniqueIndex('import_attachments_import_local_idx').on(t.importId, t.localId)]
);
