import { useEffect } from 'react';
import { useApi } from '../contexts/ApiContext';

export function useApiEvents(event: string, callback: (data: any) => void) {
    const api = useApi();

    useEffect(() => {
        // Subscribe
        const unsubscribe = api.events.on(event, callback);

        // Cleanup
        return () => {
            unsubscribe();
        };
    }, [api, event, callback]); // Re-subscribe if api/event changes
}
