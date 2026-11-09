import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import * as service from './videos.service.ts';

const deleteRequest = z.object({
    videoIds: z.array(z.uuid()).min(1).max(10_000)
});

const videosRoutes: FastifyPluginAsync = async (app) => {
    app.post('/delete', {
        schema: { body: deleteRequest }
    }, async (request, reply) => {
        const jwt = request.headers['authorization']?.split(' ')[1];

        if (!jwt) {
            return reply.code(401).send({ error: 'Authorization header missing or invalid' });
        }

        const { videoIds } = request.body as z.infer<typeof deleteRequest>;
        return service.deleteVideos(jwt, videoIds);
    });
};

export default videosRoutes;
