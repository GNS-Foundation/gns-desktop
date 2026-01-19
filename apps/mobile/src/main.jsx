import React from 'react';
import ReactDOM from 'react-dom/client';
import MobileApp from './MobileApp';
import './index.css';

import { HashRouter } from 'react-router-dom';

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <HashRouter>
            <MobileApp />
        </HashRouter>
    </React.StrictMode>,
);
