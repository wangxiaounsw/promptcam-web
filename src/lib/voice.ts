import { admin } from '@/lib/auth';
import { FISH_VOICE } from '@/lib/tts';

export type VoiceSource = 'me' | 'org' | 'default';

/**
 * 念稿子用谁的声音:个人设了用个人的 → 所属公司设了用公司的 → 默认声音。
 * 第一期只有个人这一层在用,公司那层是给第二期留的口子。
 */
export async function resolveVoice(userId: string): Promise<{ voiceId: string; from: VoiceSource }> {
  const { data } = await admin()
    .from('profiles')
    .select('voice_id, organizations(voice_id)')
    .eq('id', userId)
    .maybeSingle();
  const mine = (data?.voice_id as string | null) ?? null;
  if (mine) return { voiceId: mine, from: 'me' };
  const org = data?.organizations as { voice_id: string | null } | { voice_id: string | null }[] | null;
  const orgVoice = Array.isArray(org) ? org[0]?.voice_id : org?.voice_id;
  if (orgVoice) return { voiceId: orgVoice, from: 'org' };
  return { voiceId: FISH_VOICE, from: 'default' };
}
