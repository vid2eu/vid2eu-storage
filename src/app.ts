import Fastify from 'fastify';
import 'dotenv/config';
import {
    serializerCompiler,
    validatorCompiler,
} from 'fastify-type-provider-zod';
import multipart from '@fastify/multipart';
import uploadRoutes from './modules/upload/upload.routes.ts';
import streamRoutes from './modules/stream/stream.routes.ts';
import videosRoutes from './modules/videos/videos.routes.ts';
import { access, constants } from 'node:fs/promises';

const fastify = Fastify({
    logger: true,
});

fastify.register(multipart, {
    limits: {
        fileSize: (Number(process.env.MAX_UPLOAD_SIZE_GB) || 10) * 1024 ** 3,
        files: 1
    }
});

fastify.setValidatorCompiler(validatorCompiler);
fastify.setSerializerCompiler(serializerCompiler);
fastify.register(uploadRoutes, { prefix: '/upload' });
fastify.register(streamRoutes, { prefix: '/stream' });
fastify.register(videosRoutes, { prefix: '/videos' });

fastify.get('/health', async () => {
    await access(process.env.STORAGE_ROOT, constants.W_OK);
    return { ok: true };
});

fastify.listen({ port: Number(process.env.PORT) || 3000, host: '0.0.0.0' }).then(() => {
    console.log(`Server is running on http://localhost:${process.env.PORT || 3000}`);
});

export default fastify;