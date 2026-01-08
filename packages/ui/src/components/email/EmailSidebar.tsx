import { Send, FileText, Trash2, Inbox, AtSign } from 'lucide-react';
import clsx from 'clsx';
import { EmailFolder } from '@gns/api-core';

interface EmailSidebarProps {
    currentFolder: EmailFolder;
    onSelectFolder: (folder: EmailFolder) => void;
    unreadCount: number;
    className?: string;
}

export function EmailSidebar({ currentFolder, onSelectFolder, unreadCount, className }: EmailSidebarProps) {
    const folders: { id: EmailFolder; label: string; icon: any }[] = [
        { id: 'inbox', label: 'Inbox', icon: Inbox },
        { id: 'sent', label: 'Sent', icon: Send },
        { id: 'drafts', label: 'Drafts', icon: FileText },
        { id: 'trash', label: 'Trash', icon: Trash2 },
    ];

    return (
        <div className={clsx("w-64 flex flex-col border-r border-border bg-card/50", className)}>
            <div className="p-4 border-b border-border">
                <div className="flex items-center gap-2 px-2 py-1.5 bg-primary/10 text-primary rounded-md w-fit">
                    <AtSign size={16} />
                    <span className="text-sm font-medium">handle@gcrumbs.com</span>
                </div>
            </div>

            <div className="p-2 space-y-1">
                {folders.map((folder) => {
                    const isActive = currentFolder === folder.id;
                    const Icon = folder.icon;

                    return (
                        <button
                            key={folder.id}
                            onClick={() => onSelectFolder(folder.id)}
                            className={clsx(
                                "w-full flex items-center justify-between px-3 py-2 rounded-md text-sm font-medium transition-colors",
                                isActive
                                    ? "bg-primary text-primary-foreground"
                                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                            )}
                        >
                            <div className="flex items-center gap-3">
                                <Icon size={18} />
                                <span>{folder.label}</span>
                            </div>

                            {folder.id === 'inbox' && unreadCount > 0 && (
                                <span className={clsx(
                                    "px-2 py-0.5 rounded-full text-xs font-bold",
                                    isActive ? "bg-primary-foreground/20 text-primary-foreground" : "bg-primary/10 text-primary"
                                )}>
                                    {unreadCount}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
