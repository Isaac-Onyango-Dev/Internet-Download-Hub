import { z } from 'zod';
import { insertDownloadSchema, insertSettingsSchema, type Download, type Settings } from './schema';

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
        200: z.array(z.custom<Download>()),
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/downloads/:id',
      responses: {
        200: z.custom<Download>(),
        404: errorSchemas.notFound,
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/downloads',
      input: insertDownloadSchema,
      responses: {
        201: z.custom<Download>(),
        400: errorSchemas.validation,
      },
    },
    update: {
      method: 'PATCH' as const,
      path: '/api/downloads/:id',
      input: insertDownloadSchema.partial(),
      responses: {
        200: z.custom<Download>(),
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
    stream: {
      method: 'GET' as const,
      path: '/api/downloads/stream',
      responses: {
        200: z.any(),
      },
    },
    fetchInfo: {
      method: 'POST' as const,
      path: '/api/fetch-info',
      input: z.object({ url: z.string().url() }),
      responses: {
        200: z.any(),
      }
    }
  },
  videoDetect: {
    method: 'POST' as const,
    path: '/api/video-detect',
    input: z.object({ pageUrl: z.string().url() }),
    responses: {
      200: z.array(z.object({
        url: z.string(),
        title: z.string(),
        mimeType: z.string(),
        sourceType: z.literal('yt-dlp'),
        thumbnail: z.string().optional(),
        duration: z.number().optional(),
        uploader: z.string().optional(),
        description: z.string().optional(),
        formats: z.array(z.object({
          formatId: z.string(),
          ext: z.string(),
          resolution: z.string(),
          filesize: z.number(),
          vcodec: z.string(),
          acodec: z.string(),
        })),
      })),
      400: errorSchemas.validation,
    },
  },
  settings: {
    get: {
      method: 'GET' as const,
      path: '/api/settings',
      responses: {
        200: z.custom<Settings>(),
      },
    },
    update: {
      method: 'PATCH' as const,
      path: '/api/settings',
      input: insertSettingsSchema.partial(),
      responses: {
        200: z.custom<Settings>(),
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

// helper type exports for hooks
export type CreateDownloadRequest = z.infer<typeof insertDownloadSchema>;
export type UpdateDownloadRequest = Partial<CreateDownloadRequest>;
export type UpdateSettingsRequest = Partial<z.infer<typeof insertSettingsSchema>>;
