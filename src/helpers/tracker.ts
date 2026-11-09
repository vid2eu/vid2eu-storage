import { Transform } from 'node:stream';

function createProgressTracker(
    expectedSize: number,
    onProgress: (percentage: number, bytesReceived: number) => void
) {
    let bytesReceived = 0;

    const tracker = new Transform({
        transform(chunk, encoding, callback) {
            bytesReceived += chunk.length;

            const percentage = Math.min(
                100,
                Math.round((bytesReceived / expectedSize) * 100)
            );

            onProgress(percentage, bytesReceived);

            callback(null, chunk);
        }
    });

    return tracker;
}

export default createProgressTracker;