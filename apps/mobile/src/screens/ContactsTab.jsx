import React from 'react';
import { useContacts } from '../hooks/useContacts';
import { ContactCard } from '../components/ContactCard';
import { FloatingActionButtons } from '../components/FloatingActionButtons';
import './ContactsTab.css';

export function ContactsTab() {
    const { contacts, loading } = useContacts();

    const handleContactTap = (contact) => {
        // TODO: Navigate to contact profile
        alert(`View profile: ${contact.name || contact.handle}`);
    };

    const handleSendMoney = () => {
        // TODO: Navigate to send money screen
        alert('Send Money - Coming soon');
    };

    const handleNewMessage = () => {
        // TODO: Navigate to new message screen
        alert('New Message - Coming soon');
    };

    if (loading) {
        return <div className="contacts-tab loading">Loading contacts...</div>;
    }

    if (!contacts || contacts.length === 0) {
        return (
            <div className="contacts-tab">
                <header className="contacts-header">
                    <h1>CONTACTS</h1>
                </header>

                <div className="empty-state">
                    <div className="empty-icon">👥</div>
                    <h2>No contacts yet</h2>
                    <p>Connect with people to start messaging</p>
                </div>

                <FloatingActionButtons
                    onSendMoney={handleSendMoney}
                    onNewMessage={handleNewMessage}
                />
            </div>
        );
    }

    return (
        <div className="contacts-tab">
            <header className="contacts-header">
                <h1>CONTACTS</h1>
                <span className="contact-count">{contacts.length}</span>
            </header>

            <div className="contacts-list">
                {contacts.map((contact, index) => (
                    <ContactCard
                        key={contact.publicKey || index}
                        contact={contact}
                        onTap={() => handleContactTap(contact)}
                    />
                ))}
            </div>

            <FloatingActionButtons
                onSendMoney={handleSendMoney}
                onNewMessage={handleNewMessage}
            />
        </div>
    );
}
