//lives in browser and calss the backend endpoiut and handles the response 

import { supabase } from './supabase';

export async function indexKnowledge(entryId: string) {
    const { data, error } = await supabase.functions.invoke(
        'index-knowledge',
        { body: { entryId } },
    );

    if (error) {
        let message = error.message;

        if (
            'context' in error &&
            error.context instanceof Response
        ) {
            const body = await error.context.json().catch(() => null);
            message = body?.error ?? message;
        }

        throw new Error(message);
    }

    return data;
}