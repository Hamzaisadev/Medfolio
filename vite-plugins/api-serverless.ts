import type { Plugin, Connect } from 'vite';
import extractPrescriptionHandler from '../api/extract-prescription';
import extractLabReportHandler from '../api/extract-lab-report';
import explainMedicineHandler from '../api/explain-medicine';
import chatAssistantHandler from '../api/chat-assistant';

/**
 * Vite Dev Server plugin that mounts /api/ serverless function handlers
 * during local development (npm run dev).
 */
export function devApiServerlessPlugin(): Plugin {
  return {
    name: 'medfolio-dev-api-serverless',
    configureServer(server) {
      server.middlewares.use(async (req: Connect.IncomingMessage, res, next) => {
        if (!req.url?.startsWith('/api/')) {
          return next();
        }

        const pathname = req.url.split('?')[0];

        try {
          // Collect full body stream for POST/PUT requests
          const chunks: Buffer[] = [];
          for await (const chunk of req) {
            chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
          }
          const rawBody = Buffer.concat(chunks).toString('utf-8');
          (req as any).body = rawBody ? JSON.parse(rawBody) : {};

          if (pathname === '/api/extract-prescription') {
            await extractPrescriptionHandler(req as any, res as any);
            return;
          }

          if (pathname === '/api/extract-lab-report') {
            await extractLabReportHandler(req as any, res as any);
            return;
          }

          if (pathname === '/api/explain-medicine') {
            await explainMedicineHandler(req as any, res as any);
            return;
          }

          if (pathname === '/api/chat-assistant') {
            await chatAssistantHandler(req as any, res as any);
            return;
          }

          next();
        } catch (err: unknown) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          console.error('API middleware error:', err);
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: errorMsg }));
        }
      });
    },
  };
}
