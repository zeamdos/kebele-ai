-- Kebele Navigator MVP schema (Supabase / Postgres)
-- Apply in the Supabase SQL editor when flipping USE_REAL_SUPABASE=true.

create table if not exists users (
  id text primary key,
  phone text unique not null,
  "displayName" text not null,
  role text not null check (role in ('citizen', 'runner', 'admin')),
  "createdAt" timestamptz not null default now()
);

create table if not exists documents (
  id text primary key,
  "userId" text not null references users(id),
  "fileName" text not null,
  "mimeType" text not null,
  "storagePath" text not null,
  "ocrText" text not null,
  "correctedText" text,
  "documentKind" text not null,
  "summaryAm" text not null,
  "actionableFlags" jsonb not null default '[]'::jsonb,
  "extractedFields" jsonb not null default '{}'::jsonb,
  "createdAt" timestamptz not null default now()
);

create table if not exists form_sessions (
  id text primary key,
  "userId" text not null references users(id),
  "templateId" text not null,
  answers jsonb not null default '{}'::jsonb,
  "currentFieldIndex" int not null default 0,
  "sourceDocumentId" text references documents(id),
  "paymentId" text,
  "pdfStoragePath" text,
  status text not null,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create table if not exists payments (
  id text primary key,
  "userId" text not null references users(id),
  purpose text not null,
  "amountBirr" numeric not null,
  currency text not null default 'ETB',
  status text not null,
  "providerRef" text unique not null,
  "checkoutUrl" text,
  metadata jsonb not null default '{}'::jsonb,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create table if not exists runners (
  id text primary key,
  "userId" text not null references users(id),
  "displayName" text not null,
  phone text not null,
  kebeles jsonb not null default '[]'::jsonb,
  vetted boolean not null default false,
  active boolean not null default true
);

create table if not exists errands (
  id text primary key,
  reference text unique not null,
  "userId" text not null references users(id),
  "runnerId" text references runners(id),
  title text not null,
  description text not null,
  "kebeleOffice" text not null,
  "priceBirr" numeric not null,
  status text not null,
  "documentIds" jsonb not null default '[]'::jsonb,
  "formSessionId" text references form_sessions(id),
  "paymentId" text references payments(id),
  "contactPhone" text not null,
  "whatsappGroupHint" text,
  "completionPhotoPath" text,
  "completionNote" text,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

-- Storage bucket: create `kebele-files` in Supabase Storage dashboard.
