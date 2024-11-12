import { registerPlugin } from '@capacitor/core';

export interface FFmpegStreamPlugin {
  startStream(options: { rtspUrl: string }): Promise<{ httpUrl: string }>;
}

const FFmpegStream = registerPlugin<FFmpegStreamPlugin>('FFmpegStream');

export default FFmpegStream;
