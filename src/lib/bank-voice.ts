/**
 * 口播库朗读用谁的声音（Fish Audio 声音 id）。按口播的行业挑：
 * 数据类是王小墨的号，用 Shawn 本人的声音；其余行业用 xiaoxia（「女大学生」）。
 * 要给某个行业换声音，只改 BANK_VOICES。
 */
export const XIAOXIA_VOICE = '5c353fdb312f4888836a9a5680099ef0';
export const SHAWN_VOICE = '8382e1c04b8f4e56b91a8e30be619e49';

const BANK_VOICES: Readonly<Record<string, string>> = {
  data: SHAWN_VOICE,
};

export function bankVoice(industry: string | null | undefined): string {
  return (industry && BANK_VOICES[industry]) || XIAOXIA_VOICE;
}
