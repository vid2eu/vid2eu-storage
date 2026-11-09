import type { FastifyPluginAsync } from 'fastify';
import service from './stream.service.ts';
import type { VideoAssetType } from '@vid2eu/db/schema';

const uploadRoutes: FastifyPluginAsync = async (app) => {

    app.get('/:id/:quality', async (request, reply) => {
        const { id, quality } = request.params as {
            id: string;
            quality: VideoAssetType;
        };

        const range = request.headers.range;

        const result = await service.stream(id, quality, range);

        reply
            .header('Accept-Ranges', 'bytes')
            .header('Content-Type', result.mimeType || 'video/mp4')
            .header('Content-Length', result.end - result.start + 1);

        if (result.statusCode === 206) {
            reply.header(
                'Content-Range',
                `bytes ${result.start}-${result.end}/${result.total}`
            );
        }

        return reply
            .code(result.statusCode)
            .send(result.stream);
    });
};

export default uploadRoutes;