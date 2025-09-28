import { supabase } from '@/integrations/supabase/client';

const VOICE_PROMPT_KEY = 'voice_system_prompt';

export async function getVoiceSystemPrompt(): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('app_settings')
      .select('value_text')
      .eq('key', VOICE_PROMPT_KEY as any)
      .maybeSingle();
    if (error) throw error;
    return (data?.value_text ?? null) as any;
  } catch (e) {
    console.error('getVoiceSystemPrompt failed:', e);
    return null;
  }
}

export async function setVoiceSystemPrompt(content: string, updatedBy?: string) {
  const payload: any = { key: VOICE_PROMPT_KEY, value_text: content };
  if (updatedBy) payload.updated_by = updatedBy as any;
  const { error } = await supabase
    .from('app_settings')
    .upsert(payload, { onConflict: 'key' } as any);
  if (error) throw error;
}
