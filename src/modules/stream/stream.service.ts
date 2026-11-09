import streamRepository from './stream.repository.ts';
import { videoAssetType, type VideoAssetType } from '@vid2eu/db/schema';
import { HttpError } from '../../helpers/errors.ts';
import fs from 'fs';
import path from 'path';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const stream = async (
    id: string,
    version: VideoAssetType,
    range?: string
) => {
    if (!UUID.test(id) || !videoAssetType.enumValues.includes(version)) {
        throw new HttpError(404, 'Video not found');
    }

    const video = await streamRepository.getVideoById(id);

    if (!video?.length) {
        throw new HttpError(404, 'Video not found');
    }

    const assets = await streamRepository.getVideoAssetByVideoIdAndVersion(
        id,
        version
    );

    if (!assets?.length) {
        throw new HttpError(404, 'Video asset not found');
    }

    const asset = assets[0];
    const filePath = path.resolve(process.env.STORAGE_ROOT, asset!.objectKey);

    const stats = await fs.promises.stat(filePath).catch(() => null);

    if (!stats?.isFile()) {
        throw new HttpError(404, 'Video file not found');
    }

    const total = stats.size;
    const unsatisfiable = () =>
        new HttpError(416, 'Range not satisfiable', { 'Content-Range': `bytes */${total}` });

    let start = 0;
    let end = total - 1;
    let statusCode = 200;

    if (range) {
        const match = /^bytes=(\d*)-(\d*)$/.exec(range);

        if (!match || (!match[1] && !match[2])) {
            throw unsatisfiable();
        }

        if (!match[1]) {
            const suffixLength = Number(match[2]);

            if (!Number.isSafeInteger(suffixLength) || suffixLength <= 0) {
                throw unsatisfiable();
            }

            start = Math.max(0, total - suffixLength);
        } else {
            start = Number(match[1]);

            if (!Number.isSafeInteger(start) || start >= total) {
                throw unsatisfiable();
            }

            if (match[2]) {
                end = Number(match[2]);

                if (!Number.isSafeInteger(end) || end < start) {
                    throw unsatisfiable();
                }

                end = Math.min(end, total - 1);
            }
        }

        statusCode = 206;
    }

    const fileStream = fs.createReadStream(filePath, {
        start,
        end
    });

    return {
        stream: fileStream,
        total,
        start,
        end,
        statusCode,
        mimeType: asset!.mimeType
    };
};

export default {
    stream
}
