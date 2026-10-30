import type { Request, Response } from 'express';
import app from '../server.js';

const API_PATH_PARAM = '__vercel_api_path';

export default function handler(req: Request, res: Response) {
  const requestUrl = new URL(req.url || '/', 'http://localhost');
  const apiPath = requestUrl.searchParams.get(API_PATH_PARAM);

  if (!apiPath || !/^[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*$/.test(apiPath)) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ error: 'Invalid API route path' }));
    return;
  }

  requestUrl.searchParams.delete(API_PATH_PARAM);
  const query = requestUrl.searchParams.toString();
  req.url = `/api/${apiPath}${query ? `?${query}` : ''}`;

  return app(req, res);
}
