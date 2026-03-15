"use client"

import React, { useState } from 'react';
import { typography } from '@/app/designSystem';

interface InfoBadgeProps {
    /** Text shown in the tooltip on hover */
    text: string;
}

/**
 * Small circular "i" icon that reveals a tooltip on hover.
 * Appears with a smooth scale + fade animation.
 */
export default function InfoBadge({ text }: InfoBadgeProps) {
    const [isHovered, setIsHovered] = useState(false);

    return (
        <div
            className="relative inline-flex items-center"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            {/* Circle with "i" */}
            <div
                style={{
                    width: 18,
                    height: 18,
                    borderRadius: '50%',
                    border: '1.5px solid rgba(255, 255, 255, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    transition: 'border-color 0.2s ease',
                    borderColor: isHovered ? 'rgba(255, 255, 255, 0.7)' : 'rgba(255, 255, 255, 0.3)',
                }}
            >
                <span
                    style={{
                        ...typography.caption,
                        fontSize: '11px',
                        fontStyle: 'italic',
                        color: isHovered ? 'rgba(255, 255, 255, 0.9)' : 'rgba(255, 255, 255, 0.4)',
                        transition: 'color 0.2s ease',
                        lineHeight: '1',
                        userSelect: 'none',
                    }}
                >
                    i
                </span>
            </div>

            {/* Tooltip */}
            <div
                style={{
                    position: 'absolute',
                    left: 'calc(100% + 10px)',
                    top: '50%',
                    transform: `translateY(-50%) scale(${isHovered ? 1 : 0.95})`,
                    opacity: isHovered ? 1 : 0,
                    pointerEvents: isHovered ? 'auto' : 'none',
                    transition: 'opacity 0.25s ease, transform 0.25s ease',
                    whiteSpace: 'nowrap',
                    backgroundColor: 'rgba(255, 255, 255, 0.08)',
                    backdropFilter: 'blur(20px)',
                    WebkitBackdropFilter: 'blur(20px)',
                    borderRadius: '8px',
                    padding: '8px 14px',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                }}
            >
                <span
                    style={{
                        ...typography.caption,
                        fontSize: '12px',
                        color: 'rgba(255, 255, 255, 0.7)',
                        letterSpacing: '0px',
                    }}
                >
                    {text}
                </span>
            </div>
        </div>
    );
}
