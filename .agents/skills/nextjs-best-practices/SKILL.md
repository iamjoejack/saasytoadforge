---
name: nextjs-best-practices
description: >-
  Guides decisions when working in Next.js projects, especially version 13, 14, or 15. Covers
  React Server Components (RSC), Client Components, Server Actions, route handlers,
  data fetching, caching, dynamic routes, and performance optimization. Use when adding
  routes, editing pages, implementing API routes, or optimizing Next.js client-side execution.
---

# Next.js Best Practices

This guide establishes the rules and patterns for Next.js App Router integrations.

## 1. React Server Components (RSC) vs Client Components
- **Default to Server Components**: Every page, layout, and component should be a Server Component unless interactive event hooks (like `onClick`, `onChange`, `useEffect`, `useState`) are needed.
- **RSC Data Fetching**: Fetch data directly in Server Components using `async/await`. Avoid client-side fetch calls unless performing dynamic searches or filtering.
- **Keep Client Components Small**: Move interactivity to the leaves of your component tree. Do not mark an entire page with `"use client"` if only a small button is interactive.

## 2. Server Actions
- **Security**: Always validate input schemas in Server Actions using libraries like Zod.
- **Form States**: Use `useActionState` (or `useFormState` in older React versions) and `useFormStatus` to handle pending indicators and response messages.
- **Optimistic Updates**: Use React's `useOptimistic` hook to provide immediate UI feedback for low-latency experiences.

## 3. Data Fetching & Caching
- **Tag-based Revalidation**: Prefer `revalidateTag` and `revalidatePath` inside Server Actions to purge cached items after mutations.
- **Request Deduping**: React automatically dedupes `fetch` requests inside the same render tree. Feel free to call the same fetch function in headers, layouts, and page bodies.
- **Dynamic Headers**: Access `cookies()` or `headers()` from `next/headers` to perform dynamic, request-time rendering when user session data is required.

## 4. Routing & Page Metadata
- **Semantic Structure**: Use correct App Router files: `page.tsx` for pages, `layout.tsx` for shared layouts, `loading.tsx` for fallback loaders, and `error.tsx` for error boundaries.
- **SEO Mappings**: Define a static `metadata` object or use `generateMetadata()` dynamically on every public-facing route to maximize search engine indexing quality.
