import React, { useState, useRef, TouchEvent, MouseEvent } from 'react';
import clsx from 'clsx';

interface SwipeableItemProps {
    children: React.ReactNode;
    onDelete?: () => void;
    deleteIcon?: React.ReactNode;
    className?: string;
    disabled?: boolean;
}

export function SwipeableItem({
    children,
    onDelete,
    deleteIcon,
    className,
    disabled = false,
}: SwipeableItemProps) {
    const [offset, setOffset] = useState(0);
    const [isSwiping, setIsSwiping] = useState(false);
    const startX = useRef<number | null>(null);
    const currentX = useRef<number | null>(null);
    const itemRef = useRef<HTMLDivElement>(null);

    // Threshold to trigger delete or snap open
    const SWIPE_THRESHOLD = 80;
    const MAX_SWIPE = 100;

    const handleStart = (clientX: number) => {
        if (disabled) return;
        startX.current = clientX;
        currentX.current = clientX;
        setIsSwiping(true);
    };

    const handleMove = (clientX: number) => {
        if (!startX.current || disabled) return;
        currentX.current = clientX;
        const diff = currentX.current - startX.current;

        // Only allow swiping left (negative diff)
        if (diff < 0) {
            // Add resistance
            const newOffset = Math.max(diff, -MAX_SWIPE);
            setOffset(newOffset);
        }
    };

    const handleEnd = () => {
        if (!startX.current || !currentX.current || disabled) {
            setIsSwiping(false);
            return;
        }

        const diff = currentX.current - startX.current;

        // If swiped far enough left, keep it open or trigger delete
        if (diff < -SWIPE_THRESHOLD) {
            setOffset(-MAX_SWIPE);
        } else {
            // Snap back
            setOffset(0);
        }

        startX.current = null;
        currentX.current = null;
        setIsSwiping(false);
    };

    // Touch Events
    const onTouchStart = (e: TouchEvent) => handleStart(e.touches[0].clientX);
    const onTouchMove = (e: TouchEvent) => handleMove(e.touches[0].clientX);
    const onTouchEnd = () => handleEnd();

    // Mouse Events (for testing on desktop)
    const onMouseDown = (e: MouseEvent) => handleStart(e.clientX);
    const onMouseMove = (e: MouseEvent) => {
        if (isSwiping) handleMove(e.clientX);
    };
    const onMouseUp = () => handleEnd();
    const onMouseLeave = () => {
        if (isSwiping) handleEnd();
    };

    return (
        <div className={clsx("relative overflow-hidden", className)}>
            {/* Background Actions (Delete Button) */}
            <div className="absolute inset-y-0 right-0 w-[100px] bg-red-600 flex items-center justify-center text-white z-0">
                <button
                    className="w-full h-full flex items-center justify-center"
                    onClick={(e) => {
                        e.stopPropagation();
                        if (onDelete) {
                            onDelete();
                            setOffset(0); // Reset after delete
                        }
                    }}
                >
                    {deleteIcon || <span>Delete</span>}
                </button>
            </div>

            {/* Foreground Content */}
            <div
                ref={itemRef}
                className="relative z-10 bg-[#0f172a] w-full transition-transform duration-200 ease-out"
                style={{ transform: `translateX(${offset}px)`, touchAction: 'pan-y' }}
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
                onMouseDown={onMouseDown}
                onMouseMove={onMouseMove}
                onMouseUp={onMouseUp}
                onMouseLeave={onMouseLeave}
            >
                {children}
            </div>
        </div>
    );
}
