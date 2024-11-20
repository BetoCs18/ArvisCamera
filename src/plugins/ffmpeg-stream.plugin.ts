import { registerPlugin } from '@capacitor/core';

export interface FFmpegStreamPlugin {
  startStream(options: { rtspUrl: string }): Promise<{ httpUrl: string }>;
  stopStream(): Promise<void>;
}

const FFmpegStream = registerPlugin<FFmpegStreamPlugin>('FFmpegStream');

export default FFmpegStream;
