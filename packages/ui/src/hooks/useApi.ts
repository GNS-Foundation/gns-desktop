import { useApi } from '../contexts/ApiContext';

export { useApi } from '../contexts/ApiContext';

export function useEmailApi() {
    const api = useApi();
    return api.email;
}
