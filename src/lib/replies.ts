import { supabase } from './supabase';
export type ReplyGeneration = {
  previous_conversation_id: string | null;
  previous_conversation_snapshot: { id: string; sender_role: string; content: string; created_at: string }[];
  id: string; status: 'pending' | 'draft' | 'failed' | 'sent' | 'superseded';
  customer_message_id: string; ai_response: string | null; answerability: 'supported' | 'partial' | 'unsupported' | null;
  selected_evidence: { policy_id: string; quote: string }[];
  retrieved_context: { entry_id: string; title: string; content: string; policy_version: number }[];
  missing_information: string[]; review_reasons: string[];
  model: string; latency_ms: number | null; error_code: string | null;
};
export async function generateReply(conversationId: string, requestKey: string, previousConversationId: string | null = null): Promise<ReplyGeneration> {
  const { data, error } = await supabase.functions.invoke('generate-reply', { body: { conversationId, requestKey, previousConversationId } });
  if (error) {
    let message = error.message;
    if ('context' in error && error.context instanceof Response) {
      const response = await error.context.json().catch(() => null);
      message = response?.error ?? message;
    }
    throw new Error(message);
  }
  if (!data?.generation?.id) throw new Error('Unexpected generation response.');
  return data.generation;
}

export type SentReply = { id: string; sender_role: string; content: string; created_at: string };
export async function approveReply(generationId: string, content: string): Promise<SentReply> {
  const { data, error } = await supabase.rpc('approve_reply', { p_generation_id: generationId, p_content: content });
  if (error) throw new Error(error.message);
  if (!data?.id) throw new Error('Unexpected approval response.');
  return data;
}
