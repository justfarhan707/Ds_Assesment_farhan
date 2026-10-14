import { supabase } from './supabase';

export type PreviousConversation = {
    id: string;
    created_at: string;
    closed_at: string;
};

export type HistoryMessage = {
    id: string;
    sender_role: 'customer' | 'agent';
    content: string;
    created_at: string;
};

type HistoryScope = {
    brandId: string;
    customerId: string;
};

// Lists this customer's closed sessions.
// RLS independently restricts access to the agent's brand.
export async function loadPreviousConversations(
    scope: HistoryScope,
): Promise<PreviousConversation[]> {
    const { data, error } = await supabase
        .from('conversations')
        .select('id, created_at, closed_at')
        .eq('brand_id', scope.brandId)
        .eq('customer_id', scope.customerId)
        .not('closed_at', 'is', null)
        .order('closed_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(50);

    if (error) throw new Error(error.message);

    return data as PreviousConversation[];
}

// Checks that the selected session belongs to the displayed customer
// before returning its messages.
export async function loadPreviousMessages(
    scope: HistoryScope,
    conversationId: string,
): Promise<HistoryMessage[]> {
    const { data: conversation, error: conversationError } = await supabase
        .from('conversations')
        .select('id')
        .eq('id', conversationId)
        .eq('brand_id', scope.brandId)
        .eq('customer_id', scope.customerId)
        .not('closed_at', 'is', null)
        .maybeSingle();

    if (conversationError) {
        throw new Error(conversationError.message);
    }

    if (!conversation) {
        throw new Error('Previous conversation unavailable.');
    }

    const { data, error } = await supabase
        .from('messages')
        .select('id, sender_role, content, created_at')
        .eq('brand_id', scope.brandId)
        .eq('conversation_id', conversation.id)
        .order('created_at', { ascending: true })
        .order('id', { ascending: true });

    if (error) throw new Error(error.message);

    return (data ?? []) as HistoryMessage[];
}