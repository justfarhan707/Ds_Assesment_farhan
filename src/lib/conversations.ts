import { supabase } from './supabase';

export async function loadConversations() {
    const { data, error } = await supabase
        .from('conversations')
        .select(`
      id,
      brand_id,
      auto_reply_enabled,
      customers (
        id,
        name
      ),
      orders (
        id,
        order_number,
        item_name,
        quantity,
        total_amount,
        currency,
        status,
        delivered_at
      )
    `)
        .order('created_at', { ascending: false });

    if (error) throw error;

    return data;
}

export async function loadMessages(conversationId: string) {
    const { data, error } = await supabase
        .from('messages')
        .select('id, sender_role, content, created_at')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })
        .order('id', { ascending: true });

    if (error) throw error;

    return data;
}

type SendMessageInput = {
    conversationId: string;
    brandId: string;
    senderRole: 'customer' | 'agent';
    content: string;
};

export async function sendMessage(input: SendMessageInput) {
    const content = input.content.trim();

    if (!content) {
        throw new Error('Message cannot be empty.');
    }

    if (content.length > 10000) {
        throw new Error('Message cannot exceed 10,000 characters.');
    }

    const { data, error } = await supabase
        .from('messages')
        .insert({
            conversation_id: input.conversationId,
            brand_id: input.brandId,
            sender_role: input.senderRole,
            content,
        })
        .select('id, sender_role, content, created_at')
        .single();

    if (error) throw error;

    return data;
}