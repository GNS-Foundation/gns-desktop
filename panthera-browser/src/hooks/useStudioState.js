import { useState } from 'react';

export function useStudioState() {
    const [studioTool, setStudioTool] = useState(null); // null, 'gsite', 'profile', 'facets', 'settings'

    const [gsiteData, setGsiteData] = useState({
        blocks: [],
        style: { mood: 'cool', accent: 'blue', density: 'balanced' },
        title: '',
        published: false,
    });

    const [profileData, setProfileData] = useState({
        displayName: '',
        bio: '',
        avatar: null,
        location: '',
        website: '',
    });

    const [facets, setFacets] = useState([]);

    const [settingsData, setSettingsData] = useState({
        notifications: true,
        privateMode: false,
        theme: 'system',
    });

    return {
        studioTool,
        setStudioTool,
        gsiteData,
        setGsiteData,
        profileData,
        setProfileData,
        facets,
        setFacets,
        settingsData,
        setSettingsData,
    };
}
