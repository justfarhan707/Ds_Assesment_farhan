import { supabase } from './supabase';

export type KnowledgeCategory =
    | 'returns'
    | 'refunds'
    | 'shipping'
    | 'cancellation'
    | 'products'
    | 'damage';

export type KnowledgeEntry = {
    id: string;
    brand_id: string;
    category: KnowledgeCategory;
    title: string;
    content: string;
    version: number;
    created_at: string;
    updated_at: string;
};

export type KnowledgeInput = {
    category: KnowledgeCategory;
    title: string;
    content: string;
};

function validate(input: KnowledgeInput): KnowledgeInput {
    const title = input.title.trim();
    const content = input.content.trim();

    if (!title || !content) {
        throw new Error('Title and content are required.');
    }

    if (content.length > 20000) {
        throw new Error('Content cannot exceed 20,000 characters.');
    }

    return { category: input.category, title, content };
}

export async function loadKnowledge(): Promise<KnowledgeEntry[]> {
    const { data, error } = await supabase
        .from('knowledge_entries')
        .select('*')
        .order('category')
        .order('title');

    if (error) throw error;
    return data ?? [];
}

export async function createKnowledge(
    brandId: string,
    input: KnowledgeInput,
): Promise<KnowledgeEntry> {
    const { data, error } = await supabase
        .from('knowledge_entries')
        .insert({ brand_id: brandId, ...validate(input) })
        .select('*')
        .single();

    if (error) throw error;
    return data;
}

export async function updateKnowledge(
    id: string,
    expectedVersion: number,
    input: KnowledgeInput,
): Promise<KnowledgeEntry> {
    const { data, error } = await supabase
        .from('knowledge_entries')
        .update(validate(input))
        .eq('id', id)
        .eq('version', expectedVersion)
        .select('*')
        .maybeSingle();

    if (error) throw error;

    if (!data) {
        throw new Error(
            'This entry changed, was deleted, or is no longer accessible. Reload before editing.',
        );
    }

    return data;
}

export async function deleteKnowledge(
    id: string,
    expectedVersion: number,
): Promise<void> {
    const { data, error } = await supabase
        .from('knowledge_entries')
        .delete()
        .eq('id', id)
        .eq('version', expectedVersion)
        .select('id')
        .maybeSingle();

    if (error) throw error;

    if (!data) {
        throw new Error(
            'This entry changed, was deleted, or is no longer accessible. Reload before deleting.',
        );
    }
}