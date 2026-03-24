import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const action = (req.query.action as string) || '';

  const callEdgeHandler = async (handlerFn: (req: Request) => Promise<Response>) => {
    const edgeReq = new Request(`https://localhost${req.url}`, {
      method: req.method || 'GET',
      headers: req.headers as any,
    });
    const response = await handlerFn(edgeReq);
    const body = await response.json();
    res.status(response.status).json(body);
  };

  switch (action) {
    case 'process-deletions': {
      const mod = await import('../lib/cron/process-deletions');
      await callEdgeHandler(mod.default);
      break;
    }
    case 'generate-invoices': {
      const mod = await import('../lib/cron/generate-invoices');
      await callEdgeHandler(mod.default);
      break;
    }
    case 'lifecycle-emails': {
      const mod = await import('../lib/cron/lifecycle-emails');
      await callEdgeHandler(mod.default);
      break;
    }
    case 'weekly-report': {
      const mod = await import('../lib/cron/weekly-report');
      await mod.default(req, res);
      break;
    }
    default:
      res.status(400).json({ error: `Unknown cron action: ${action}` });
  }
}
