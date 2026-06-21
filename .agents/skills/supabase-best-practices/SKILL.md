---
name: supabase-best-practices
description: >-
  Guides decisions when designing, integrating, or refactoring Supabase backends. Covers PostgreSQL database
  schemas, Row-Level Security (RLS) policies, TypeScript type generation, auth hooks, client instantiations,
  and connection pool optimization. Use when writing migrations, creating DB clients, or querying user data.
---

# Supabase Best Practices

This guide establishes conventions for using Supabase Postgres and Auth.

## 1. Row-Level Security (RLS)
- **Always Enable RLS**: RLS must be enabled on every table in the public schema:
  ```sql
  alter table public.my_table enable row level security;
  ```
- **Explicit Policies**: Define separate RLS policies for `select`, `insert`, `update`, and `delete` operations. Do not group them into general `ALL` policies unless required.
- **Tenant Context**: Use `auth.uid()` to map user context. Ensure policies are indexed by querying user references:
  ```sql
  create policy "Users can update own workspace"
    on public.workspaces
    for update
    using ( auth.uid() = owner_id );
  ```

## 2. Supabase Clients in Next.js
- **Avoid Global Clients**: Do not instantiate a singleton Supabase client on the server. Always use `createRouteHandlerClient`, `createPagesServerClient`, or equivalent server-specific helpers to prevent session leaks between request boundaries.
- **Route Handlers and Actions**: Use the server client for route handlers, server actions, and middleware to correctly read, write, and verify cookie tokens.
- **Browser Client**: Use `createClientComponentClient` or a global client component context provider ONLY in client components (`"use client"`).

## 3. Type Safety
- **Type Generation**: Generate database types using the Supabase CLI (`supabase gen types typescript`).
- **Strict Casts**: Inject type definitions into the Supabase client creation to guarantee full query auto-completion and compile-time type-safety:
  ```typescript
  import { Database } from '@/types/supabase'
  const supabase = createServerClient<Database>(...)
  ```
