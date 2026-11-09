import type { FastifyPluginAsync } from 'fastify';
import * as service from './upload.service.ts';
import { HttpError } from '../../helpers/errors.ts';

const uploadRoutes: FastifyPluginAsync = async (app) => {
    app.post('/', async (request, reply) => {
        const token = request.headers['x-upload-token'] as string | undefined;
        const session = await service.openSession(token);

        try {
            const part = await request.file({ limits: { fileSize: session.expectedSize, files: 1 } });

            if (!part) {
                throw new HttpError(400, 'No file provided');
            }

            const result = await service.uploadVideo(session, part);
            return reply.send(result);
        } catch (error) {
            if (!(error instanceof HttpError && error.statusCode === 502)) {
                await service.releaseSession(session);
            }
            throw error;
        }
    });

    app.post('/:videoId/prepare', async (request, reply) => {
        const { videoId } = request.params as { videoId: string };
        const { expectedSize } = (request.body ?? {}) as { expectedSize?: unknown };
        const jwt = request.headers['authorization']?.split(' ')[1];

        if (!jwt) {
            return reply.code(401).send({ error: 'Authorization header missing or invalid' });
        }

        if (typeof expectedSize !== 'number' || !Number.isSafeInteger(expectedSize) || expectedSize <= 0) {
            return reply.code(400).send({ error: 'expectedSize must be a positive integer' });
        }

        const result = await service.createSession(videoId, jwt, expectedSize);

        return reply.send(result);
    });
};

export default uploadRoutes;
