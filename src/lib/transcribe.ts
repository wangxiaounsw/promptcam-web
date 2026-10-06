/**
 * 批量转写：把一整段 PCM 交给 Gemini Live，拿回文本。
 *
 * 为什么需要它：客户端的实时转写会因为网络抖动、令牌过期、服务端故障而失败，
 * 而「灵感丢了就是真丢了」。客户端录音时全量留着 PCM，实时失败就把整段发到
 * 这里重试一次 —— 用户说过的话不白费。
 *
 * 用普通的 BidiGenerateContent（不是 Constrained）：这里是服务端，持有真 key。
 * 做法移植自 readmemo-web/src/lib/transcribe.js，那边在生产跑着。
 */
export function transcribe(pcm: Buffer): Promise<string> {
  return new Promise((resolve, reject) => {
    const key = process.env.GEMINI_API_KEY;
    if (!key) return reject(new Error('Voice key not configured'));

    const ws = new WebSocket(
      'wss://generativelanguage.googleapis.com/ws/' +
        'google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=' +
        key,
    );

    const final: string[] = [];
    let interim = '';
    let done = false;
    let quiet: ReturnType<typeof setTimeout> | undefined;

    const finish = (err?: Error) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      if (quiet) clearTimeout(quiet);
      try {
        ws.close();
      } catch {}
      if (err) reject(err);
      else resolve((final.join('') + interim).trim());
    };

    const timer = setTimeout(() => finish(new Error('Transcription timed out')), 45_000);

    ws.onopen = () =>
      ws.send(
        JSON.stringify({
          setup: {
            model: 'models/gemini-3.5-transcribe-live',
            generationConfig: { responseModalities: ['TEXT'] },
            inputAudioTranscription: { mode: 'SMART' },
          },
        }),
      );

    ws.onmessage = async (e: MessageEvent) => {
      try {
        const raw =
          typeof e.data === 'string' ? e.data : await (e.data as Blob).text();
        const m = JSON.parse(raw);
        if (m.error) return finish(new Error('Gemini rejected the request'));
        if (m.setupComplete) {
          // 每块 1 秒音频（16kHz × 16bit 单声道 = 32000 B/s）
          for (let i = 0; i < pcm.length; i += 32000) {
            ws.send(
              JSON.stringify({
                realtimeInput: {
                  audio: {
                    mimeType: 'audio/pcm;rate=16000',
                    data: pcm.subarray(i, i + 32000).toString('base64'),
                  },
                },
              }),
            );
          }
          ws.send(JSON.stringify({ realtimeInput: { audioStreamEnd: true } }));
          // 连续说话时服务端可能永远不发 turnComplete，所以自己兜一个静默窗口
          quiet = setTimeout(() => finish(), 12_000);
        }
        const s = m.serverContent;
        if (!s) return;
        if (s.interimInputTranscription?.text) interim = s.interimInputTranscription.text;
        if (s.inputTranscription?.text) {
          final.push(s.inputTranscription.text);
          interim = '';
          if (quiet) clearTimeout(quiet);
          quiet = setTimeout(() => finish(), 2_500);
        }
        if (s.turnComplete && (final.length || interim)) finish();
      } catch {
        finish(new Error('Could not read transcription result'));
      }
    };

    ws.onerror = () => finish(new Error('Could not reach Gemini'));
    ws.onclose = () => {
      if (!done) finish(new Error('Transcription connection closed'));
    };
  });
}
