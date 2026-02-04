import { z } from 'zod';
import { insertDownloadSchema, insertSettingsSchema, downloads, settings } from './schema';

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
};

export const api = {
  downloads: {
    list: {
      method: 'GET' as const,
      path: '/api/downloads',
      input: z.object({
        state: z.string().optional(),
      }).optional(),
      responses: {
        200: z.array(z.custom<typeof downloads.$inferSelect>()),
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/downloads/:id',
      responses: {
        200: z.custom<typeof downloads.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/downloads',
      input: insertDownloadSchema,
      responses: {
        201: z.custom<typeof downloads.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    update: {
      method: 'PATCH' as const,
      path: '/api/downloads/:id',
      input: insertDownloadSchema.partial(),
      responses: {
        200: z.custom<typeof downloads.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/downloads/:id',
      responses: {
        204: z.void(),
        404: errorSchemas.notFound,
      },
    },
    clearCompleted: {
      method: 'POST' as const,
      path: '/api/downloads/clear',
      responses: {
        204: z.void(),
      },
    },
  },
  settings: {
    get: {
      method: 'GET' as const,
      path: '/api/settings',
      responses: {
        200: z.custom<typeof settings.$inferSelect>(),
      },
    },
    update: {
      method: 'PATCH' as const,
      path: '/api/settings',
      input: insertSettingsSchema.partial(),
      responses: {
        200: z.custom<typeof settings.$inferSelect>(),
      },
    },
  },
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
