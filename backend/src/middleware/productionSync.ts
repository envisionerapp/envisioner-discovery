import { ProductionSyncService } from '../services/productionSyncService';

const syncService = ProductionSyncService.getInstance();

export function createSyncMiddleware() {
  return {
    // Middleware for Prisma operations
    streamer: {
      async $allOperations(params: any, next: any) {
        const result = await next(params);

        // Only sync in development (your local environment)
        if (process.env.NODE_ENV === 'development') {
          const { model, operation, args } = params;

          if (model === 'streamer') {
            try {
              switch (operation) {
                case 'create':
                  await syncService.syncStreamerToProduction('create', result);
                  break;
                case 'update':
                  await syncService.syncStreamerToProduction('update', result);
                  break;
                case 'updateMany':
                  // For updateMany, we'd need to get the affected records first
                  break;
                case 'delete':
                  await syncService.syncStreamerToProduction('delete', args.where, args.where?.id);
                  break;
                case 'deleteMany':
                  // For deleteMany, we'd need to get the affected records first
                  break;
              }
            } catch (error) {
              // Don't fail the local operation if sync fails
              console.warn('Production sync failed:', error);
            }
          }
        }

        return result;
      }
    }
  };
}