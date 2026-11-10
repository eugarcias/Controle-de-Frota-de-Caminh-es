import { deleteResource, updateResource } from '@/lib/crud';

export const dynamic = 'force-dynamic';

type Ctx = { params: { resource: string; id: string } };

export async function PATCH(req: Request, { params }: Ctx) {
  return updateResource(params.resource, params.id, req);
}

export async function DELETE(_req: Request, { params }: Ctx) {
  return deleteResource(params.resource, params.id);
}
