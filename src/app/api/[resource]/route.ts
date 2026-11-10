import { createResource, listResource } from '@/lib/crud';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: { resource: string } }) {
  return listResource(params.resource);
}

export async function POST(req: Request, { params }: { params: { resource: string } }) {
  return createResource(params.resource, req);
}
