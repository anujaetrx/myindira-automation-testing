import { z } from 'zod';
import { BaseApiClient, type ApiResult } from './BaseApiClient';

const item = z.object({ id: z.number(), code: z.string(), name: z.string() });

/** GET /admin/master-data/list (shape observed on QA). */
export const masterDataListSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  code: z.string(),
  timestamp: z.string(),
  data: z.object({
    roles: z.array(item),
    campuses: z.array(item),
    departments: z.array(item),
  }),
});
export type MasterDataList = z.infer<typeof masterDataListSchema>;

export class MasterDataApiClient extends BaseApiClient {
  list(): Promise<ApiResult<MasterDataList>> {
    return this.get('/admin/master-data/list');
  }

  /** GET /admin/master-data/template/{TYPE}: a CSV for DEPARTMENT / CAMPUS / ROLE (read the text from result.response). */
  template(type: string): Promise<ApiResult<unknown>> {
    return this.get(`/admin/master-data/template/${type}`);
  }
}
