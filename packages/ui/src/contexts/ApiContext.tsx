import { createContext, useContext, ReactNode } from 'react';
import { GnsApi } from '@gns/api-core';

const ApiContext = createContext<GnsApi | null>(null);

interface ApiProviderProps {
    adapter: GnsApi;
    children: ReactNode;
}

export function ApiProvider({ adapter, children }: ApiProviderProps) {
    return (
        <ApiContext.Provider value={adapter}>
            {children}
        </ApiContext.Provider>
    );
}

export function useApi(): GnsApi {
    const api = useContext(ApiContext);
    if (!api) {
        throw new Error('useApi must be used within an ApiProvider');
    }
    return api;
}
